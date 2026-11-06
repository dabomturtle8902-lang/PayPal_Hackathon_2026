import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {timingSafeEqual, randomUUID} from 'node:crypto';
import {names, secret} from './store.mjs';
const fail = (status,message) => {throw Object.assign(new Error(message),{status});};
function equal(a,b) { const x=Buffer.from(a||''), y=Buffer.from(b||''); return x.length===y.length && timingSafeEqual(x,y); }
const safeOrder = id => typeof id === 'string' && /^[A-Z0-9-]{1,80}$/.test(id);
export function createApp({store, paypal, organizerToken, baseUrl, flutterOrigin='', staticDir}) {
  const base=new URL(baseUrl);
  const participants=()=>Object.values(store.state.participants);
  const sessionKey=secret();
  const publicShare=p=>({name:p.name,amountCents:p.amountCents,currency:'USD',status:p.status,receipt:p.receipt,
    lamp:store.state.lamp,published:store.state.published,merchant:'Demo Merchant',purchaseTitle:'Move-in essentials'});
  const admin=p=>({...publicShare(p),shareUrl:`${base.origin}/#pay/${p.shareToken}`});
  function organizer(req) {
    return equal(req.headers.authorization,`Bearer ${organizerToken}`) || equal((req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('splitsync_session='))?.slice(18),sessionKey);
  }
  function checkOrder(data,p,order) {
    if(data.id!==order.id || data.intent!=='CAPTURE' || data.purchase_units?.length!==1) fail(502,'PayPal order did not match this share.');
    const unit=data.purchase_units[0];
    if(unit.custom_id!==order.customId || unit.reference_id!==order.referenceId || unit.amount?.currency_code!=='USD' || unit.amount.value!==(p.amountCents/100).toFixed(2)) fail(502,'PayPal amount or purchase reference did not match.');
    return unit;
  }
  function apply(data,p,order) {
    const unit=checkOrder(data,p,order);
    const captures=unit.payments?.captures || [];
    if(captures.length > 1) fail(502,'Unexpected capture count.');
    const capture=captures[0];
    if(!capture) return;
    if(capture.amount?.currency_code!=='USD' || capture.amount?.value!==(p.amountCents/100).toFixed(2)) fail(502,'PayPal capture amount did not match.');
    order.captureId=capture.id;
    if(capture.status==='COMPLETED') { p.status='Paid'; p.receipt=capture.id; order.state='paid'; }
    else if(capture.status==='PENDING') {if(p.status!=='Paid')p.status='Processing';order.state='pending';}
    else if(['DECLINED','FAILED','DENIED'].includes(capture.status) && p.status!=='Paid') { p.status='Awaiting payment';order.state='failed'; }
  }
  async function body(req) {
    let size=0, chunks=[];
    for await(const chunk of req){size+=chunk.length;if(size>65536)fail(413,'Request too large.');chunks.push(chunk);}
    try{return JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{fail(400,'Invalid JSON.');}
  }
  async function handler(req,res) {
    const send=(code,data,headers={})=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data));};
    try {
      res.setHeader('X-Content-Type-Options','nosniff');
      res.setHeader('Referrer-Policy','no-referrer');
      res.setHeader('X-Frame-Options','DENY');
      const url=new URL(req.url,base), path=url.pathname;
      if(req.headers.host && req.headers.host!==base.host) fail(400,'Use the configured PUBLIC_BASE_URL host.');
      if(flutterOrigin && req.headers.origin===flutterOrigin){res.setHeader('Access-Control-Allow-Origin',flutterOrigin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');}
      if(req.method==='OPTIONS'){if(req.headers.origin!==flutterOrigin)fail(403,'Origin not allowed.');res.writeHead(204);res.end();return;}
      if(req.method==='POST' && path!=='/api/paypal/webhook') {
        if(req.headers.origin && ![base.origin,flutterOrigin].filter(Boolean).includes(req.headers.origin))fail(403,'Origin not allowed.');
        if(!req.headers['content-type']?.startsWith('application/json'))fail(415,'Use application/json.');
      }
      if(path==='/api/health' && req.method==='GET') return send(200,{mode:'sandbox',configured:paypal.configured});
      if(path==='/api/organizer/session' && req.method==='POST') {
        const input=await body(req);
        if(!equal(input.token,organizerToken))fail(401,'Invalid SplitSync organizer key.');
        return send(200,{ok:true},{'Set-Cookie':`splitsync_session=${sessionKey}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${base.protocol==='https:'?'; Secure':''}`});
      }
      if(path.startsWith('/api/organizer/')) {
        if(!organizer(req))fail(401,'Enter the SplitSync organizer key printed in the server terminal.');
        if(path==='/api/organizer/purchase' && req.method==='GET') return send(200,{purchaseId:'SS-001',lamp:store.state.lamp,published:store.state.published,participants:participants().map(admin),configured:paypal.configured});
        if(path==='/api/organizer/split' && req.method==='POST') {
          const input=await body(req);
          return await store.exclusive(async()=>{
            if(!names.includes(input.lamp))fail(400,'Choose a valid lamp owner.');
            if(input.lamp!==store.state.lamp && participants().some(p=>p.orders.length))fail(409,'Payment orders already exist. Allocations are locked for this purchase.');
            store.state.lamp=input.lamp; store.state.published=true;
            participants().forEach(p=>p.amountCents=p.name===input.lamp?7000:4000);
            await store.save();return send(200,{participants:participants().map(admin),lamp:store.state.lamp,published:true});
          });
        }
      }
      if(path.startsWith('/api/shares/')) {
        const [, , ,token,action]=path.split('/');
        const p=participants().find(p=>equal(p.shareToken,token));
        if(!p || !store.state.published)fail(404,'Payment link not found or split not published.');
        if(req.method==='GET' && !action) return send(200,publicShare(p));
        if(req.method==='POST' && ['orders','capture','refresh'].includes(action)) {
          const input=await body(req);
          return await store.exclusive(async()=>{
            if(action==='orders') {
              if(p.status==='Paid')return send(200,{share:publicShare(p),alreadyPaid:true});
              if(!paypal.configured)fail(503,'Add your Sandbox Client ID and Secret to server/.env, then restart.');
              let order=p.orders.at(-1);
              // Reuse an existing attempt, including its request ID after a timeout/restart.
              if(!order || order.state==='failed') {
                const attempt=secret(); order={requestId:randomUUID(),captureRequestId:randomUUID(),customId:`SS-001:${p.name}:${attempt}`,referenceId:`SS-001-${p.name}`,state:'creating'};
                p.orders.push(order);await store.save();
              }
              if(order.state==='pending')return send(200,{share:publicShare(p),pending:true});
              if(order.id) {
                const current=await paypal.get(order.id);apply(current,p,order);await store.save();
                if(p.status==='Paid')return send(200,{share:publicShare(p),alreadyPaid:true});
                if(p.status==='Processing')return send(200,{share:publicShare(p),pending:true});
                if(current.status==='VOIDED') {order.state='failed';await store.save();fail(409,'This approval expired. Retry to create a new order.');}
              }
              if(!order.id) {
                // PayPal only retains idempotency keys for a finite period. Never replay
                // an unresolved creation indefinitely; operator reconciliation is required.
                order.startedAt ||= Date.now();await store.save();
                if(Date.now()-order.startedAt>5*60*60*1000)fail(409,'Unresolved order expired locally. Reconcile it in PayPal before retrying.');
                const data=await paypal.create({participant:p.name,amountCents:p.amountCents,customId:order.customId,referenceId:order.referenceId,requestId:order.requestId,
                  returnUrl:`${base.origin}/paypal/return?share=${token}`,cancelUrl:`${base.origin}/paypal/cancel?share=${token}`});
                if(!safeOrder(data.id))fail(502,'PayPal returned an invalid order ID.');
                const approval=data.links?.find(l=>['payer-action','approve'].includes(l.rel))?.href;
                const link=approval?new URL(approval):null;
                if(!link || link.protocol!=='https:' || link.hostname!=='www.sandbox.paypal.com')fail(502,'PayPal did not return a Sandbox approval link.');
                order.id=data.id;order.approvalUrl=approval;order.state='created';await store.save();
              }
              return send(200,{orderId:order.id,approvalUrl:order.approvalUrl});
            }
            const requestedId=input.orderId || (action==='refresh' ? p.orders.at(-1)?.id : undefined);
            if(action==='refresh' && !requestedId)return send(200,publicShare(p));
            if(!safeOrder(requestedId))fail(400,'Invalid order ID.');
            const order=p.orders.find(o=>o.id===requestedId);
            if(!order)fail(404,'Order not found for this participant.');
            if(p.status==='Paid')return send(200,publicShare(p));
            let data=await paypal.get(order.id);checkOrder(data,p,order);
            if(action==='capture' && data.status==='APPROVED') {
              order.captureStartedAt ||= Date.now();await store.save();
              if(Date.now()-order.captureStartedAt>5*60*60*1000)fail(409,'Reconcile this unresolved capture in PayPal before retrying.');
              try { await paypal.capture(order.id,order.captureRequestId); }
              catch(error) {if(error.issue!=='ORDER_ALREADY_CAPTURED')throw error;}
              data=await paypal.get(order.id);
            }
            apply(data,p,order);await store.save();return send(200,publicShare(p));
          });
        }
      }
      if(path==='/api/paypal/webhook' && req.method==='POST') {
        const event=await body(req);
        if(!await paypal.verify(event,req.headers))fail(401,'Invalid PayPal signature.');
        return await store.exclusive(async()=>{
          if(!event.id || store.state.events.includes(event.id))return send(200,{ok:true});
          const id=event.resource?.supplementary_data?.related_ids?.order_id;
          const p=participants().find(p=>p.orders.some(o=>o.id===id));
          if(p) {const order=p.orders.find(o=>o.id===id);apply(await paypal.get(id),p,order);}
          store.state.events.push(event.id);store.state.events=store.state.events.slice(-2000);await store.save();return send(200,{ok:true});
        });
      }
      if(['/paypal/return','/paypal/cancel'].includes(path) && req.method==='GET') {
        const token=url.searchParams.get('share');
        if(!participants().some(p=>equal(p.shareToken,token)))fail(404,'Unknown payment link.');
        const orderId=url.searchParams.get('token')||'';
        // Browser redirect is not proof of payment; frontend requests a verified server capture.
        const query=new URLSearchParams(path.endsWith('cancel')?{cancelled:'1'}:{order:orderId,returned:'1'});
        res.writeHead(303,{Location:`${base.origin}/#pay/${token}?${query}`,'Cache-Control':'no-store'});res.end();return;
      }
      if(path.startsWith('/api/'))fail(404,'API endpoint not found.');
      if(req.method!=='GET' && req.method!=='HEAD')fail(405,'Method not allowed.');
      const file=resolve(staticDir,'.'+decodeURIComponent(path==='/'?'/index.html':path));
      if(!file.startsWith(resolve(staticDir)+sep))fail(403,'Forbidden.');
      const data=await readFile(file);
      const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.svg':'image/svg+xml'}[extname(file)]||'application/octet-stream';
      res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
    } catch(error) {
      const code=error.code==='ENOENT'?404:(error.status||500);
      send(code,{error:code===500?'Server error. Check the local server setup; retry safely.':error.message});
    }
  }
  return {handler, server:createServer(handler)};
}
