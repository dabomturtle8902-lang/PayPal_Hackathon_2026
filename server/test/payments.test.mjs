import test from 'node:test';
import assert from 'node:assert/strict';
import http2 from 'node:http2';
import {Readable} from 'node:stream';
import {mkdtemp, rm, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../app.mjs';
import {Store, FX_RATES_USD, defaultContacts, formatMoney, fxQuote, createExchangeRateLoader, newState, normalizeState} from '../store.mjs';
import {PayPal} from '../paypal.mjs';
import {createNvidia, decodeSynthesizeResponse, encodeSynthesizeRequest, normalizeExtractedBill, normalizeParsedRequest} from '../nvidia.mjs';
const organizerToken='organizer-test-key-abcdefghijklmnopqrstuvwxyz';
const baseUrl='http://localhost:3000';
function fakePayPal(){
  const orders=new Map();let calls=0,captures=0;const createIds=[];const captureIds=[];
  return {configured:true,orders,createIds,captureIds,get creates(){return calls;},get captures(){return captures;},
    async create(input){calls++;createIds.push(input.requestId);let order=[...orders.values()].find(o=>o.requestId===input.requestId);if(!order){order={id:'ORDER-'+calls,intent:'CAPTURE',status:'CREATED',requestId:input.requestId,purchase_units:[{custom_id:input.customId,reference_id:input.referenceId,amount:{currency_code:'USD',value:(input.amountCents/100).toFixed(2)}}],links:[{rel:'payer-action',href:'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-'+calls}]};orders.set(order.id,order);}return structuredClone(order);},
    async get(id){assert(orders.has(id));return structuredClone(orders.get(id));},
    async capture(id,key){captures++;captureIds.push(key);const o=orders.get(id);o.status='COMPLETED';o.purchase_units[0].payments={captures:[{id:'CAPTURE-'+id,status:'COMPLETED',amount:structuredClone(o.purchase_units[0].amount)}]};return structuredClone(o);},
    async verify(_event,headers){return headers['paypal-transmission-sig']==='valid';}
  };
}
function setup({store, paypal=fakePayPal(), nvidia, delivery, localOrganizerAutoLogin=false, envOrganizerAutoLogin=false, customBaseUrl=baseUrl}={}){
  store ||= new Store();store.state ||= newState();
  const baseHost=new URL(customBaseUrl).host;
  const {handler}=createApp({store,paypal,nvidia,delivery,organizerToken,baseUrl:customBaseUrl,localOrganizerAutoLogin,envOrganizerAutoLogin,staticDir:join(import.meta.dirname,'../../website/dist')});
  async function request(path,{method='GET',body,preParsedBody,auth=false,headers={},remoteAddress='127.0.0.1'}={}){
    const req=preParsedBody!==undefined?Readable.from([]):Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);
    if(preParsedBody!==undefined){req.body=preParsedBody;Object.defineProperty(req,'readableEnded',{value:true});}
    req.socket={remoteAddress};
    req.url=path;req.method=method;req.headers={host:baseHost,...(body===undefined&&preParsedBody===undefined?{}:{'content-type':'application/json'}),...(auth?{authorization:'Bearer '+organizerToken}:{}),...headers};
    const result={headers:{}};const res={setHeader(k,v){result.headers[k.toLowerCase()]=v;},writeHead(code,headers={}){result.status=code;for(const[k,v]of Object.entries(headers))result.headers[k.toLowerCase()]=v;},end(data){result.text=data?.toString()||'';try{result.body=JSON.parse(result.text);}catch{}}};
    await handler(req,res);return result;
  }
  const publish=lamp=>request('/api/organizer/split',{method:'POST',body:{lamp:lamp||'Maya'},auth:true});
  const token=n=>store.state.participants[n||'Maya'].shareToken;
  const create=(n,body={})=>request(`/api/shares/${token(n)}/orders`,{method:'POST',body});
  return {store,paypal,request,publish,token,create};
}
test('organizer authentication, cookie login, and individual share isolation',async()=>{
  const t=setup();assert.equal((await t.request('/api/organizer/purchase')).status,401);
  assert.equal((await t.request(`/api/shares/${t.token()}`)).status,404);
  const login=await t.request('/api/organizer/session',{method:'POST',body:{token:organizerToken}});
  assert.equal(login.status,200);assert.match(login.headers['set-cookie'],/HttpOnly; SameSite=Strict/);
  assert.equal((await t.request('/api/organizer/purchase',{headers:{cookie:login.headers['set-cookie'].split(';')[0]}})).status,200);
  await t.publish();const response=await t.request(`/api/shares/${t.token()}`);
  assert.equal(response.body.amountCents,7000);assert.equal(response.body.status,'Awaiting payment');
  assert(!JSON.stringify(response.body).includes(t.token('Arun')));assert(!response.body.participants);
});
test('server amounts ignore tampered client input; create/capture are idempotent and ledger becomes paid',async()=>{
  const t=setup();await t.publish();const a=await t.create('Maya',{amount:0.01});
  assert.equal(a.status,200);assert.equal(t.paypal.orders.get(a.body.orderId).purchase_units[0].amount.value,'70.00');
  const b=await t.create();assert.equal(a.body.orderId,b.body.orderId);assert.equal(t.paypal.creates,1);
  t.paypal.orders.get(a.body.orderId).status='APPROVED';
  const path=`/api/shares/${t.token()}/capture`;
  const [one,two]=await Promise.all([t.request(path,{method:'POST',body:{orderId:a.body.orderId}}),t.request(path,{method:'POST',body:{orderId:a.body.orderId}})]);
  assert.equal(one.body.status,'Paid');assert.equal(two.body.status,'Paid');assert.equal(t.paypal.captures,1);
  const ledger=await t.request('/api/organizer/purchase',{auth:true});assert.equal(ledger.body.participants.filter(p=>p.status==='Paid').length,1);
  assert.equal((await t.create()).body.alreadyPaid,true);
});
test('return URL cannot mark paid and a participant cannot capture someone else’s order',async()=>{
  const t=setup();await t.publish();const a=await t.create();
  const redirect=await t.request(`/paypal/return?share=${t.token()}&token=${a.body.orderId}`);
  assert.equal(redirect.status,303);assert.match(redirect.headers.location,/#pay\//);
  assert.equal(t.store.state.participants.Maya.status,'Awaiting payment');
  assert.equal((await t.request(`/api/shares/${t.token('Arun')}/capture`,{method:'POST',body:{orderId:a.body.orderId}})).status,404);
  assert.equal((await t.request(`/api/shares/${t.token()}/capture`,{method:'POST',body:{orderId:a.body.orderId}})).body.status,'Awaiting payment');
  assert.equal(t.paypal.captures,0);
});
test('split editing is server validated and locks after order creation',async()=>{
  const t=setup();assert.equal((await t.publish('Nobody')).status,400);await t.publish('Arun');
  assert.equal(t.store.state.participants.Arun.amountCents,7000);assert.equal(t.store.state.participants.Maya.amountCents,4000);
  await t.create('Arun');assert.equal((await t.publish('Maya')).status,409);
  assert.equal((await t.publish('Arun')).status,200);
});
test('amount/reference mismatch cannot produce a paid ledger entry',async()=>{
  const t=setup();await t.publish();const a=await t.create();const order=t.paypal.orders.get(a.body.orderId);
  order.status='COMPLETED';order.purchase_units[0].amount.value='0.01';
  const r=await t.request(`/api/shares/${t.token()}/capture`,{method:'POST',body:{orderId:a.body.orderId}});
  assert.equal(r.status,502);assert.equal(t.store.state.participants.Maya.status,'Awaiting payment');
});
test('verified pending webhook then completion; duplicates and forged webhooks do not change ledger',async()=>{
  const t=setup();await t.publish();const a=await t.create();const order=t.paypal.orders.get(a.body.orderId);
  order.status='COMPLETED';order.purchase_units[0].payments={captures:[{id:'CAP-1',status:'PENDING',amount:{value:'70.00',currency_code:'USD'}}]};
  const event={id:'EV-1',event_type:'PAYMENT.CAPTURE.PENDING',resource:{supplementary_data:{related_ids:{order_id:order.id}}}};
  const hook=signature=>t.request('/api/paypal/webhook',{method:'POST',body:event,headers:{'paypal-transmission-sig':signature}});
  assert.equal((await hook('fake')).status,401);assert.equal(t.store.state.participants.Maya.status,'Awaiting payment');
  assert.equal((await hook('valid')).status,200);assert.equal(t.store.state.participants.Maya.status,'Processing');
  order.purchase_units[0].payments.captures[0].status='COMPLETED';event.id='EV-2';event.event_type='PAYMENT.CAPTURE.COMPLETED';
  await hook('valid');await hook('valid');assert.equal(t.store.state.participants.Maya.status,'Paid');assert.equal(t.store.state.events.length,2);
});
test('CSRF, host and static traversal protection',async()=>{
  const t=setup();assert.equal((await t.request('/api/organizer/session',{method:'POST',body:{token:organizerToken},headers:{origin:'https://evil.example'}})).status,403);
  assert.equal((await t.request('/api/health',{headers:{host:'evil.example'}})).status,400);
  assert.equal((await t.request('/%2e%2e%2f%2e%2e%2fserver/.env')).status,403);
  const index=await t.request('/');assert.equal(index.status,200);assert.match(index.text,/<title>AI/);
});
test('creation timeout retries the same durable request ID across restart',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'splitsync-'));
  try{
    const file=join(dir,'ledger.json');const store=await new Store(file).init();const paypal=fakePayPal();const original=paypal.create.bind(paypal);let first=true;
    paypal.create=async input=>{const data=await original(input);if(first){first=false;throw new Error('timeout');}return data;};
    const t=setup({store,paypal});await t.publish();assert.equal((await t.create()).status,500);
    const restarted=setup({store:await new Store(file).init(),paypal});const r=await restarted.create();assert.equal(r.status,200);
    assert.equal(paypal.createIds[0],paypal.createIds[1]);assert.equal(paypal.orders.size,1);
    const saved=JSON.parse(await readFile(file));assert(saved.participants.Maya.orders[0].id);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('PayPal client uses Sandbox OAuth and refuses missing credentials',async()=>{
  await assert.rejects(()=>new PayPal({}).token(),/Sandbox Client ID/);
  const calls=[];const paypal=new PayPal({clientId:'test',clientSecret:'test-secret',fetchImpl:async(url,init)=>{calls.push({url,init});return {ok:true,status:200,json:async()=>url.endsWith('/token')?{access_token:'test-access',expires_in:3600}:{id:'TEST'}};}});
  await paypal.get('ORDER-1');await paypal.get('ORDER-2');assert.equal(calls.length,3);
  assert(calls.every(c=>c.url.startsWith('https://api-m.sandbox.paypal.com/')));assert.equal(calls[0].init.headers.Authorization,'Basic '+Buffer.from('test:test-secret').toString('base64'));
});
test('capture timeout reconciles a completed payment without charging again',async()=>{
  const t=setup();await t.publish();const a=await t.create();t.paypal.orders.get(a.body.orderId).status='APPROVED';
  const original=t.paypal.capture.bind(t.paypal);t.paypal.capture=async(...args)=>{await original(...args);throw new Error('timeout after capture');};
  const path=`/api/shares/${t.token()}/capture`,body={orderId:a.body.orderId};
  assert.equal((await t.request(path,{method:'POST',body})).status,500);
  assert.equal((await t.request(path,{method:'POST',body})).body.status,'Paid');assert.equal(t.paypal.captures,1);
});
test('refresh reconciles the last order even when buyer lost the return query',async()=>{
  const t=setup();await t.publish();const a=await t.create();await t.paypal.capture(a.body.orderId,'external-test');
  const refreshed=await t.request(`/api/shares/${t.token()}/refresh`,{method:'POST',body:{}});
  assert.equal(refreshed.body.status,'Paid');assert.equal(refreshed.body.receipt,'CAPTURE-'+a.body.orderId);
});
test('PayPal webhook postback requires configured webhook and validated headers',async()=>{
  const paypal=new PayPal({clientId:'id',clientSecret:'secret'});await assert.rejects(()=>paypal.verify({},{}),/WEBHOOK_ID/);
  paypal.webhookId='WH-TEST';assert.equal(await paypal.verify({},{}),false);
  const headers={'paypal-auth-algo':'SHA256withRSA','paypal-cert-url':'https://attacker.example/cert','paypal-transmission-id':'TX','paypal-transmission-sig':'SIG','paypal-transmission-time':'2026-11-06T00:00:00Z'};
  assert.equal(await paypal.verify({},headers),false);
  let sent;paypal.request=async(path,{body})=>{sent={path,body};return {verification_status:'SUCCESS'};};
  headers['paypal-cert-url']='https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1';
  assert.equal(await paypal.verify({id:'EVENT-1'},headers),true);assert.equal(sent.body.webhook_id,'WH-TEST');assert.equal(sent.body.webhook_event.id,'EVENT-1');
});
test('missing Sandbox credentials do not create an attempt or lock allocation edits',async()=>{
  const t=setup();t.paypal.configured=false;await t.publish();assert.equal((await t.create()).status,503);
  assert.equal(t.store.state.participants.Maya.orders.length,0);assert.equal((await t.publish('Arun')).status,200);
});
test('organizer logout clears session cookie and AI endpoints handle Leah split, TTS audio, and 503 unavailability',async()=>{
  const t0=setup();
  const unconfigured=await t0.request('/api/organizer/suggest-split',{method:'POST',body:{instruction:'Lamp for Leah'},auth:true});
  assert.equal(unconfigured.status,503);
  const ttsUnconfigured=await t0.request('/api/organizer/read-split',{method:'POST',body:{lamp:'Leah'},auth:true});
  assert.equal(ttsUnconfigured.status,503);

  const mockNvidia={
    configured:true,
    async suggest(instruction){return instruction.toLowerCase().includes('leah')?'Leah':'CLARIFY';},
    async speak(){return Buffer.from('RIFFmockaudio');}
  };
  const t=setup({nvidia:mockNvidia});
  const suggested=await t.request('/api/organizer/suggest-split',{method:'POST',body:{instruction:'Assign the $30 lamp to Leah'},auth:true});
  assert.equal(suggested.status,200);assert.equal(suggested.body.lamp,'Leah');
  await t.publish('Leah');
  assert.equal(t.store.state.participants.Maya.amountCents,4000);
  assert.equal(t.store.state.participants.Arun.amountCents,4000);
  assert.equal(t.store.state.participants.Leah.amountCents,7000);
  const tts=await t.request('/api/organizer/read-split',{method:'POST',body:{lamp:'Leah'},auth:true});
  assert.equal(tts.status,200);assert.equal(Buffer.from(tts.body.audio,'base64').toString(),'RIFFmockaudio');

  const logout=await t.request('/api/organizer/logout',{method:'POST',body:{}});
  assert.equal(logout.status,200);assert.match(logout.headers['set-cookie'],/Max-Age=0/);
  const font=await t.request('/fonts/PlusJakartaSans-Regular.ttf');
  assert.equal(font.status,200);assert.equal(font.headers['content-type'],'font/ttf');
});

test('bill normalization flags unreadable fields and total mismatches cleanly',()=>{
  const b=normalizeExtractedBill({merchant:'Bistro 24',date:'',currency:'USD',items:[{name:'Pasta',amountCents:2000},{name:'Drinks',amountCents:1500}],taxCents:300,tipCents:500,totalCents:4800});
  assert.equal(b.totalMismatch,true);
  assert.equal(b.computedTotalCents,4300);
  assert(b.unreadableFields.includes('date'));
});

test('request parser resolves known contacts, flags unknowns, and tracks unallocated bill balance',()=>{
  const contacts=[{id:'maya',name:'Maya'},{id:'arun',name:'Arun'}];
  const parsed=normalizeParsedRequest({recipients:[{name:'Maya',amountCents:2000,reason:'dinner'},{name:'Arun',amountCents:1500,reason:'drinks'},{name:'alex',amountCents:500,reason:'dessert'}]},contacts,{totalCents:4500,currency:'USD'});
  assert.equal(parsed.recipients[0].known,true);
  assert.equal(parsed.recipients[2].unknownContact,true);
  assert.equal(parsed.needsClarification,true);
  assert.equal(parsed.unallocatedCents,500);
});

test('reimbursement requests stay Created when delivery fails, isolate tokens, and never auto-attach PayPal merchant checkout',async()=>{
  const mockNvidia={
    configured:true,
    async extractBill(){return normalizeExtractedBill({merchant:'Olive Kitchen',date:'2026-11-10',items:[{name:'Dinner',amountCents:2000},{name:'Drinks',amountCents:1500}],totalCents:3500});},
    async transcribe(){return {transcript:'Ask Maya for twenty dollars for dinner and Arun for fifteen for drinks.',engine:'mock-stt'};},
    async parseRequest({transcript}){assert.match(transcript,/Maya/);return normalizeParsedRequest({recipients:[{name:'Maya',amountCents:2000,reason:'dinner'},{name:'Arun',amountCents:1500,reason:'drinks'}]},[{id:'maya',name:'Maya'},{id:'arun',name:'Arun'}],{totalCents:3500,currency:'USD'});},
    async speak(){return Buffer.from('RIFFconfirmvoice');},
  };
  const failingDelivery={emailConfigured:true,smsConfigured:false,async send(){return {ok:false,message:'SMTP refused connection'};}};
  const t=setup({nvidia:mockNvidia,delivery:failingDelivery});

  assert.equal((await t.request('/api/organizer/state')).status,401);
  const stt=await t.request('/api/organizer/transcribe',{method:'POST',body:{audioBase64:'dGVzdA==',mimeType:'audio/wav'},auth:true});
  assert.equal(stt.status,200);assert.match(stt.body.transcript,/Maya/);

  const parsed=await t.request('/api/organizer/parse-request',{method:'POST',body:{transcript:stt.body.transcript,bill:{totalCents:3500,currency:'USD'}},auth:true});
  assert.equal(parsed.status,200);assert.equal(parsed.body.recipients.length,2);assert.equal(parsed.body.unallocatedCents,0);

  const voice=await t.request('/api/organizer/read-text',{method:'POST',body:{text:"I'll request $20 from Maya for dinner and $15 from Arun for drinks. Review and send?"},auth:true});
  assert.equal(voice.status,200);assert.equal(Buffer.from(voice.body.audio,'base64').toString(),'RIFFconfirmvoice');

  const created=await t.request('/api/organizer/requests',{method:'POST',body:{title:'Olive Kitchen',merchant:'Olive Kitchen',totalCents:3500,channel:'email',recipients:[{name:'Maya',amountCents:2000,reason:'dinner'},{name:'Arun',amountCents:1500,reason:'drinks'}]},auth:true});
  assert.equal(created.status,200);
  const reqRecord=created.body.request;
  assert.equal(reqRecord.recipients[0].status,'Created');
  assert.equal(reqRecord.recipients[0].deliveryStatus,'Failed');

  const mayaToken=reqRecord.recipients[0].shareToken;
  const arunToken=reqRecord.recipients[1].shareToken;
  const pubMaya=await t.request(`/api/reimbursements/${mayaToken}`);
  assert.equal(pubMaya.status,200);
  assert.equal(pubMaya.body.recipientName,'Maya');
  assert.equal(pubMaya.body.amountCents,2000);
  assert.equal(pubMaya.body.paypalCheckoutSupported,false);
  assert(!JSON.stringify(pubMaya.body).includes(arunToken));

  const shared=await t.request(`/api/organizer/requests/${reqRecord.id}/deliver`,{method:'POST',body:{action:'mark_shared',recipientId:reqRecord.recipients[0].id},auth:true});
  assert.equal(shared.status,200);
  assert.equal(shared.body.request.recipients[0].status,'Sent');
  assert.equal(shared.body.request.recipients[1].status,'Created');

  const paid=await t.request(`/api/organizer/requests/${reqRecord.id}/recipients/${reqRecord.recipients[0].id}/status`,{method:'POST',body:{status:'Paid'},auth:true});
  assert.equal(paid.status,200);
  assert.equal(paid.body.request.recipients[0].status,'Paid');

  const v1Migrated=normalizeState({version:1,lamp:'Leah',published:true,participants:{},events:[]});
  assert.equal(v1Migrated.version,2);assert(Array.isArray(v1Migrated.contacts));assert(Array.isArray(v1Migrated.reimbursements));
});

test('international FX precision, send-intent validated reply, and idempotent demo-pay work cleanly',async()=>{
  const contacts=defaultContacts();
  const gbp=fxQuote(2000,'USD','GBP');
  assert.equal(gbp.targetAmountCents,1490);
  assert.equal(formatMoney(gbp.targetAmountCents,'GBP',true),'£14.90 GBP');
  const jpy=fxQuote(2000,'USD','JPY');
  assert.equal(jpy.targetAmountCents,316400);
  assert.equal(formatMoney(jpy.targetAmountCents,'JPY',true),'¥3,164 JPY');

  const sendParsed=normalizeParsedRequest({
    intent:'send',
    recipients:[{name:'Allen',amountCents:2000,currency:'USD',reason:'Thanks for coffee'}],
  },contacts,null);
  assert.equal(sendParsed.intent,'send');
  assert.equal(sendParsed.recipients[0].targetCurrency,'GBP');
  assert.match(sendParsed.replyText,/£14\.90 GBP/);
  assert.match(sendParsed.replyText,/Verify the recipient and amount before you pay/);

  const t=setup();
  const tx1=await t.request('/api/organizer/demo-pay',{method:'POST',auth:true,body:{contactId:'allen',sourceAmountCents:2000,sourceCurrency:'USD',targetCurrency:'GBP',note:'Thanks for coffee',clientTxId:'tx-allen-1'}});
  assert.equal(tx1.status,200);
  assert.equal(tx1.body.deduplicated,false);
  assert.equal(tx1.body.transaction.targetAmountCents,1490);

  const tx2=await t.request('/api/organizer/demo-pay',{method:'POST',auth:true,body:{contactId:'allen',sourceAmountCents:2000,sourceCurrency:'USD',targetCurrency:'GBP',note:'Thanks for coffee',clientTxId:'tx-allen-1'}});
  assert.equal(tx2.status,200);
  assert.equal(tx2.body.deduplicated,true);
  assert.equal(tx2.body.transaction.id,tx1.body.transaction.id);

  const st=await t.request('/api/organizer/state',{auth:true});
  assert.equal(st.body.demoTransactions.length,1);
});

test('practice requests start Waiting for payment, auto-settle persistently on due timestamps, save rent rules opt-in, and reset cleanly',async()=>{
  const t=setup();
  const created=await t.request('/api/organizer/requests',{method:'POST',auth:true,body:{title:'Rent Dec',kind:'rent',channel:'demo',demoAutoSettle:true,dueDate:'2026-12-01',recipients:[{name:'Maya',contactId:'maya',amountCents:80000,currency:'USD',reason:'December rent'},{name:'Arun',contactId:'arun',amountCents:80000,currency:'USD',reason:'December rent'}]}});
  assert.equal(created.status,200);
  assert.equal(created.body.request.recipients[0].status,'Waiting for payment');
  assert.equal(created.body.request.recipients[0].deliveryStatus,'Created');
  assert(Number.isFinite(created.body.request.recipients[0].settleAt));

  // Fast-forward first recipient due timestamp only -> first settles, second waits
  t.store.state.reimbursements[0].recipients[0].settleAt=Date.now()-100;
  t.store.state.reimbursements[0].recipients[1].settleAt=Date.now()+60000;
  await t.store.save();

  const st=await t.request('/api/organizer/state',{auth:true});
  assert.equal(st.body.reimbursements[0].recipients[0].status,'Paid');
  assert.equal(st.body.reimbursements[0].recipients[0].demoSettled,true);
  assert.equal(st.body.reimbursements[0].recipients[1].status,'Waiting for payment');

  // Opt-in rent rule & reset
  const rule=await t.request('/api/organizer/rent-rule',{method:'POST',auth:true,body:{contactIds:['maya','arun'],totalCents:160000,currency:'USD',mode:'equal',dayOfMonth:1}});
  assert.equal(rule.status,200);assert.equal(rule.body.savedRentRule.totalCents,160000);
  await t.publish();
  const merchantShare = t.store.state.participants.Maya.shareToken;
  const merchantOrder = await t.create();
  assert.equal(merchantOrder.status, 200);
  const reimbursement = await t.request('/api/organizer/requests', {method:'POST', auth:true,
    body:{title:'A personal reimbursement', channel:'link', recipients:[{name:'Maya',amountCents:2000}]}});
  assert.equal(reimbursement.status, 200);
  const reset=await t.request('/api/organizer/reset-demo',{method:'POST',auth:true,body:{}});
  assert.equal(reset.status,200);
  const clean=await t.request('/api/organizer/state',{auth:true});
  assert.equal(clean.body.reimbursements.length,1);
  assert.equal(clean.body.reimbursements[0].id, reimbursement.body.request.id);
  assert.equal(t.store.state.participants.Maya.shareToken, merchantShare);
  assert.equal(t.store.state.participants.Maya.orders.length, 1);
  assert.equal(clean.body.demoTransactions.length,0);
  assert.equal(clean.body.savedRentRule,null);
});

test('practice payment batches validate every row before saving and deduplicate concurrent retries', async () => {
  const t = setup();
  const path = '/api/organizer/demo-pay';
  const payments = ['maya', 'arun', 'allen', 'sofia'].map(contactId => ({
    contactId,
    clientTxId: 'group-test-' + contactId,
    sourceAmountCents: 2000,
    sourceCurrency: 'USD',
  }));
  const pay = payments => t.request(path, {method: 'POST', auth: true, body: {payments}});
  assert.equal((await pay([...payments.slice(0, 3), {...payments[3], sourceAmountCents: -1}])).status, 400);
  assert.equal(t.store.state.demoTransactions.length, 0);
  assert.equal((await pay([payments[0], payments[0]])).status, 400);

  const [first, retry] = await Promise.all([pay(payments), pay(payments)]);
  assert.equal(first.status, 200);
  assert.equal(retry.status, 200);
  assert.deepEqual(first.body.transactions.map(tx => tx.contactId), payments.map(p => p.contactId));
  assert.deepEqual(retry.body.transactions, first.body.transactions);
  assert.equal(t.store.state.demoTransactions.length, 4);
  assert.equal(t.paypal.creates, 0);
});


test('opt-in organizer auto login is restricted to local requests and trusted origins', async () => {
  const t = setup({localOrganizerAutoLogin: true});
  assert.equal((await t.request('/api/organizer/state')).status, 200);
  assert.equal((await t.request('/api/health')).body.localOrganizerAutoLogin, true);
  assert.equal((await t.request('/api/organizer/state', {remoteAddress: '203.0.113.1'})).status, 401);
  assert.equal((await t.request('/api/organizer/state', {headers: {origin: 'https://example.com'}})).status, 401);
  assert.equal((await t.request('/api/organizer/state', {headers: {'sec-fetch-site': 'cross-site'}})).status, 401);
  assert.equal((await t.request('/api/organizer/state', {headers: {origin: baseUrl}})).status, 200);
  assert.equal((await setup().request('/api/organizer/state')).status, 401);
});


test('ECB rates convert in both directions and cache a complete dated snapshot', async () => {
  let calls = 0;
  const load = createExchangeRateLoader(async () => {
    calls++;
    const rates = {CAD: 1.4, EUR: 0.9, GBP: 0.75, INR: 94, JPY: 160};
    return {ok: true, json: async () => Object.entries(rates).map(([quote, rate]) => ({
      base: 'USD', quote, rate, date: '2026-11-11',
    }))};
  });
  const [snapshot, cached] = await Promise.all([load(), load()]);
  assert.equal(calls, 1);
  assert.deepEqual(snapshot, cached);
  assert.equal(fxQuote(1000, 'USD', 'JPY', snapshot.rates).targetAmountCents, 160000);
  assert.equal(fxQuote(160000, 'JPY', 'USD', snapshot.rates).targetAmountCents, 1000);
});

test('requests preserve the full bill and record the organizer share separately', async () => {
  const t = setup();
  const result = await t.request('/api/organizer/requests', {
    method: 'POST', auth: true, body: {
      currency: 'JPY', totalCents: 100000,
      recipients: ['Maya', 'Arun', 'Allen'].map(name => ({name, currency: 'JPY', amountCents: 33300})),
    },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.request.ownShareCents, 100);
  assert.equal(result.body.request.recipients.reduce((sum, row) => sum + row.amountCents, 0), 99900);
});

test('bidirectional receive-side FX demo-pay and electricity requests preserve reviewed quote and kind', async () => {
  const t = setup();
  const revQuote = fxQuote(300000, 'USD', 'JPY', FX_RATES_USD, 'receive');
  assert.equal(revQuote.enteredSide, 'receive');
  assert.equal(revQuote.targetAmountCents, 300000);
  assert.equal(revQuote.targetCurrency, 'JPY');

  const payRes = await t.request('/api/organizer/demo-pay', {
    method: 'POST', auth: true,
    body: {
      contactId: 'yuki',
      enteredSide: 'receive',
      sourceCurrency: 'USD',
      targetCurrency: 'JPY',
      targetAmountCents: 300000,
      sourceAmountCents: revQuote.sourceAmountCents,
      reviewedRate: revQuote.rate,
      note: 'Tokyo dinner',
      clientTxId: 'tx-yuki-receive-1',
    },
  });
  assert.equal(payRes.status, 200);
  assert.equal(payRes.body.transaction.enteredSide, 'receive');
  assert.equal(payRes.body.transaction.targetAmountCents, 300000);
  assert.equal(payRes.body.transaction.sourceAmountCents, revQuote.sourceAmountCents);

  const elecRes = await t.request('/api/organizer/requests', {
    method: 'POST', auth: true,
    body: {
      title: 'Electricity bill',
      merchant: 'ConEd Electric',
      kind: 'electricity',
      currency: 'USD',
      totalCents: 9600,
      dueDate: '2026-12-15',
      channel: 'demo',
      demoAutoSettle: true,
      recipients: [
        {name: 'Maya', contactId: 'maya', amountCents: 4800, currency: 'USD', reason: 'Electricity'},
        {name: 'Arun', contactId: 'arun', amountCents: 4800, currency: 'USD', reason: 'Electricity'},
      ],
    },
  });
  assert.equal(elecRes.status, 200);
  assert.equal(elecRes.body.request.kind, 'electricity');
  assert.equal(elecRes.body.request.dueDate, '2026-12-15');
});

test('localOrganizerAutoLogin health flag reflects server config without bypassing auth checks', async () => {
  const auto = setup({localOrganizerAutoLogin: true});
  const health = await auto.request('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.localOrganizerAutoLogin, true);
  // Organizer endpoints still reject cross-origin or non-loopback requests without bearer/cookie
  assert.equal((await auto.request('/api/organizer/state', {remoteAddress: '203.0.113.1'})).status, 401);
});

test('envOrganizerAutoLogin authenticates same-origin hosted requests and bill extraction without manual token entry', async () => {
  const vercelOrigin = 'https://paypal-ai-hackathon.vercel.app';
  const hosted = setup({
    customBaseUrl: vercelOrigin,
    envOrganizerAutoLogin: true,
    nvidia: {
      configured: true,
      async extractBill({imageDataUrl}) {
        assert.match(imageDataUrl, /^data:image\/png;base64,/);
        return {merchant: 'Cafe Mocha', date: '2026-11-12', currency: 'USD', items: [{name: 'Latte', amountCents: 650}], taxCents: 0, tipCents: 0, totalCents: 650, unreadableFields: [], totalMismatch: false};
      },
    },
  });

  const health = await hosted.request('/api/health', {remoteAddress: '203.0.113.50'});
  assert.equal(health.status, 200);
  assert.equal(health.body.localOrganizerAutoLogin, true);

  const stateRes = await hosted.request('/api/organizer/state', {
    remoteAddress: '203.0.113.50',
    headers: {origin: vercelOrigin, 'sec-fetch-site': 'same-origin'},
  });
  assert.equal(stateRes.status, 200);

  const scanRes = await hosted.request('/api/organizer/extract-bill', {
    method: 'POST',
    remoteAddress: '203.0.113.50',
    headers: {origin: vercelOrigin, 'sec-fetch-site': 'same-origin'},
    preParsedBody: {imageDataUrl: 'data:image/png;base64,AAAA'},
  });
  assert.equal(scanRes.status, 200);
  assert.equal(scanRes.body.merchant, 'Cafe Mocha');

  // Cross-site requests are still rejected
  assert.equal((await hosted.request('/api/organizer/state', {
    remoteAddress: '203.0.113.50',
    headers: {'sec-fetch-site': 'cross-site'},
  })).status, 401);
  assert.equal((await hosted.request('/api/organizer/extract-bill', {
    method: 'POST',
    remoteAddress: '203.0.113.50',
    headers: {origin: 'https://evil.example'},
    body: {imageDataUrl: 'data:image/png;base64,AAAA'},
  })).status, 403);
});

test('Vercel serverless entrypoint uses ORGANIZER_TOKEN env and handles rewritten routes without prompting externally', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'splitsync-vercel-'));
  const prevEnv = {
    VERCEL: process.env.VERCEL,
    DATA_FILE: process.env.DATA_FILE,
    ORGANIZER_TOKEN: process.env.ORGANIZER_TOKEN,
    LOCAL_ORGANIZER_AUTO_LOGIN: process.env.LOCAL_ORGANIZER_AUTO_LOGIN,
  };
  try {
    process.env.VERCEL = '1';
    process.env.DATA_FILE = join(dir, 'ledger.json');
    process.env.ORGANIZER_TOKEN = organizerToken;
    delete process.env.LOCAL_ORGANIZER_AUTO_LOGIN;

    const {default: vercelHandler} = await import('../../api/index.mjs');
    const callVercel = async (path, {method = 'GET', body, headers = {}} = {}) => {
      const req = body === undefined ? Readable.from([]) : Readable.from([Buffer.from(JSON.stringify(body))]);
      req.url = path;
      req.method = method;
      req.socket = {remoteAddress: '203.0.113.99'};
      req.headers = {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'paypal-hackathon-2026-git-main-dabomturtle8902-lang.vercel.app',
        host: 'paypal-hackathon-2026-preview-internal.vercel.app',
        'sec-fetch-site': 'same-origin',
        ...(body === undefined ? {} : {'content-type': 'application/json'}),
        ...headers,
      };
      const result = {headers: {}};
      const res = {
        setHeader(k, v) { result.headers[k.toLowerCase()] = v; },
        writeHead(code, h = {}) { result.status = code; for (const [k, v] of Object.entries(h)) result.headers[k.toLowerCase()] = v; },
        end(data) { result.text = data?.toString() || ''; try { result.body = JSON.parse(result.text); } catch {} },
      };
      await vercelHandler(req, res);
      return result;
    };

    const health = await callVercel('/api/index?__route=/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.localOrganizerAutoLogin, true);

    const state = await callVercel('/api/index?__route=/api/organizer/state', {
      headers: {origin: 'https://paypal-hackathon-2026-git-main-dabomturtle8902-lang.vercel.app'},
    });
    assert.equal(state.status, 200);
    assert.equal(state.body.purchase.purchaseId, 'SS-001');

    // Without NVIDIA_API_KEY configured, extract-bill returns 503 (never 401 asking for ORGANIZER_TOKEN)
    const scan = await callVercel('/api/index?__route=/api/organizer/extract-bill', {
      method: 'POST',
      headers: {origin: 'https://paypal-hackathon-2026-git-main-dabomturtle8902-lang.vercel.app'},
      body: {imageDataUrl: 'data:image/png;base64,AAAA'},
    });
    assert.equal(scan.status, 503);
  } finally {
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await rm(dir, {recursive: true, force: true});
  }
});

test('Chatterbox TTS uses native Node HTTP/2 gRPC without Python and produces valid RIFF/WAV output', async () => {
  const encoded = encodeSynthesizeRequest({text: 'Hello'});
  assert.equal(
    encoded.toString('hex'),
    '0a0548656c6c6f1205656e2d5553180120a2ac012a2243686174746572626f782d4d756c74696c696e6775616c2e656e2d55532e4d616c65',
  );

  const samplePcm = Buffer.from([0x11, 0x22, 0x33, 0x44, 0x55, 0x66]);
  // Protobuf SynthesizeSpeechResponse: field 1 (audio) + field 2 (meta submessage skipped)
  const pbResp = Buffer.concat([
    Buffer.from([0x0a, samplePcm.length]),
    samplePcm,
    Buffer.from([0x12, 0x02, 0x08, 0x01]),
  ]);
  assert.deepEqual(decodeSynthesizeResponse(pbResp), samplePcm);

  let mode = 'ok';
  let capturedHeaders = null;
  let capturedBody = null;
  const server = http2.createServer();
  server.on('stream', (stream, headers) => {
    capturedHeaders = headers;
    const chunks = [];
    stream.on('data', c => chunks.push(c));
    stream.on('end', () => {
      capturedBody = Buffer.concat(chunks);
      if (mode === 'error') {
        stream.respond({':status': 200, 'content-type': 'application/grpc'}, {waitForTrailers: true});
        stream.on('wantTrailers', () => {
          stream.sendTrailers({'grpc-status': '7', 'grpc-message': encodeURIComponent('Permission denied nvapi-secret-key')});
        });
        stream.end();
        return;
      }
      const frame = Buffer.allocUnsafe(5 + pbResp.length);
      frame[0] = 0;
      frame.writeUInt32BE(pbResp.length, 1);
      pbResp.copy(frame, 5);
      stream.respond({':status': 200, 'content-type': 'application/grpc'}, {waitForTrailers: true});
      stream.on('wantTrailers', () => {
        stream.sendTrailers({'grpc-status': '0'});
      });
      stream.end(frame);
    });
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    const nvidia = createNvidia({key: 'nvapi-secret-key', ttsUrl: `http://127.0.0.1:${port}`});
    const wav = await nvidia.speak('Hello');
    assert.equal(capturedHeaders[':path'], '/nvidia.riva.tts.RivaSpeechSynthesis/Synthesize');
    assert.equal(capturedHeaders['function-id'], 'ddacc747-1269-4fab-bfd9-8f593dead106');
    assert.equal(capturedHeaders.authorization, 'Bearer nvapi-secret-key');
    assert.equal(capturedBody[0], 0);
    assert.equal(capturedBody.readUInt32BE(1), encoded.length);
    assert.deepEqual(capturedBody.subarray(5), encoded);

    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.equal(wav.readUInt32LE(24), 22050);
    assert.deepEqual(wav.subarray(44), samplePcm);

    mode = 'error';
    await assert.rejects(
      () => nvidia.speak('Hello'),
      err => {
        assert.equal(err.status, 502);
        assert.match(err.message, /gRPC status 7: Permission denied/);
        assert(!err.message.includes('nvapi-secret-key'));
        return true;
      },
    );
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
