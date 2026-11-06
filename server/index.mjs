import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PayPal} from './paypal.mjs';
import {Store, secret} from './store.mjs';
import {createApp} from './app.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||3000);
const baseUrl=process.env.PUBLIC_BASE_URL||`http://localhost:${port}`;
const origin=new URL(baseUrl);
if(origin.origin!==baseUrl || (origin.protocol!=='https:' && !['localhost','127.0.0.1'].includes(origin.hostname)))throw new Error('PUBLIC_BASE_URL must be an HTTPS origin, or localhost for local testing. No trailing slash.');
const organizerToken=process.env.ORGANIZER_TOKEN||secret();
if(organizerToken.length<24)throw new Error('ORGANIZER_TOKEN must have at least 24 characters.');
const store=await new Store(resolve(process.env.DATA_FILE||resolve(here,'data/sandbox-ledger.json'))).init();
const paypal=new PayPal({clientId:process.env.PAYPAL_CLIENT_ID,clientSecret:process.env.PAYPAL_CLIENT_SECRET,webhookId:process.env.PAYPAL_WEBHOOK_ID});
const {server}=createApp({store,paypal,organizerToken,baseUrl,flutterOrigin:process.env.FLUTTER_WEB_ORIGIN||'',staticDir:resolve(here,'../website/dist')});
server.listen(port,process.env.HOST||'127.0.0.1',()=>{
  console.log(`SplitSync Sandbox: ${baseUrl}\nOrganizer access key (keep private): ${organizerToken}\nPayPal credentials: ${paypal.configured?'configured':'missing — fill server/.env and restart'}\nUse this server, not the old Python :8080 server, for payments.`);
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is in use. Stop the previous server or change PORT and PUBLIC_BASE_URL together.`:'Unable to start server.');process.exitCode=1;});
