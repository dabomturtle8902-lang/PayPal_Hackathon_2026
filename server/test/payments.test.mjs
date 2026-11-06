import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {mkdtemp, rm, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../app.mjs';
import {Store, newState} from '../store.mjs';
import {PayPal} from '../paypal.mjs';
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
function setup({store, paypal=fakePayPal()}={}){
  store ||= new Store();store.state ||= newState();
  const {handler}=createApp({store,paypal,organizerToken,baseUrl,staticDir:join(import.meta.dirname,'../../website/dist')});
  async function request(path,{method='GET',body,auth=false,headers={}}={}){
    const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);
    req.url=path;req.method=method;req.headers={host:'localhost:3000',...(body===undefined?{}:{'content-type':'application/json'}),...(auth?{authorization:'Bearer '+organizerToken}:{}),...headers};
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
  const index=await t.request('/');assert.equal(index.status,200);assert.match(index.text,/<title>SplitSync/);
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
