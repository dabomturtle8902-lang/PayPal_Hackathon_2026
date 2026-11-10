const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const app = { innerHTML: '' };
const store = {};
const bodyClassSet = new Set();
const noopEl = {
  textContent: '',
  hidden: false,
  style: {},
  dataset: {},
  classList: { toggle() {} },
  setAttribute() {},
};

const ctx = {
  console,
  URLSearchParams,
  fetch: async () => ({ ok: false }),
  Image: undefined,
  location: { hash: '#home', search: '', href: 'https://demo.test/#home' },
  localStorage: {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
  },
  document: {
    body: {
      dataset: {},
      classList: {
        toggle(cls, force) {
          if (force) bodyClassSet.add(cls);
          else bodyClassSet.delete(cls);
        },
      },
    },
    createElement: () => ({}),
    querySelector: s => (s === '#app' ? app : (s === '#qr' || s === '#req-qr' ? null : noopEl)),
    querySelectorAll: () => [],
  },
  window: { addEventListener() {}, scrollTo() {} },
  navigator: {},
  setTimeout() {},
  clearTimeout() {},
};

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/app.js'), 'utf8'), ctx);
const run = async s => vm.runInContext(s, ctx);

(async () => {
  await run('enterStaticPreview()');
  assert.equal(await run('shares().Maya+shares().Arun+shares().Leah'), 150);

  const routes = [
    'home', 'activity', 'store', 'profile', 'scan', 'scan-error',
    'scan-bill', 'bill-crop', 'bill-review', 'talk', 'request-review',
    'review', 'split', 'clarify', 'edit', 'requests', 'dashboard',
    'rent', 'product/kit-essentials', 'cart', 'preferences',
    'share/maya', 'share/arun', 'handoff/maya',
    'result/maya/processing', 'result/maya/paid', 'result/maya/cancelled',
  ];

  for (const route of routes) {
    ctx.location.hash = '#' + route;
    await run('render()');
    assert(app.innerHTML.length > 100, route);
    assert(!app.innerHTML.includes('undefined'), route);
  }

  // PhonePe hub tiles on home
  ctx.location.hash = '#home';
  await run('render()');
  for (const label of ['Scan &amp; Pay', 'Request Money', 'Scan Bill', 'Talk to SplitSync']) {
    assert(app.innerHTML.includes(label), `Missing hub tile ${label}`);
  }

  // Leah SS-001 split + isolation check
  await run("setLamp('Leah')");
  assert.equal(await run('shares().Maya'), 40);
  assert.equal(await run('shares().Arun'), 40);
  assert.equal(await run('shares().Leah'), 70);
  ctx.location.hash = '#share/arun';
  await run('render()');
  assert(app.innerHTML.includes('Your share · $40.00 USD'));

  // Voice parsing + unallocated bill balance + email delivery failure stays Created
  await run('useBundledSampleReceipt()');
  await run('useSampleTranscript("Ask Maya for twenty dollars for dinner and Arun for fifteen for drinks.")');
  await run('parseVoiceRequest()');
  assert(app.innerHTML.includes('$7.00 USD')); // $42 bill - $35 allocated = $7.00 unallocated
  assert(app.innerHTML.includes('Chatterbox voice reply'));
  await run("selectedDeliveryChannel = 'email'; confirmCreateRequests();");
  ctx.location.hash = '#request/' + await run('reimbursementsList[0].id');
  await run('render()');
  assert(app.innerHTML.includes('Created'));
  assert(app.innerHTML.includes('Failed'));

  // Store -> add -> cart -> split with people
  await run("addToCart('kit-essentials', false); addToCart('desk-lamp', false);");
  assert.equal(await run('cartCount()'), 2);
  await run('splitCartWithPeople()');
  assert(ctx.location.hash.includes('request-review'));

  // Buyer cancelled & reimbursement payer view checks
  const buyerHtml = await run("buyerPage({name:'Leah',lamp:'Leah',amountCents:7000,status:'Awaiting payment',merchant:'Demo Merchant',purchaseTitle:'Move-in essentials',receipt:null},new URLSearchParams('cancelled=1'))");
  assert(buyerHtml.includes('Retry with PayPal'));
  const reimbHtml = await run("reimbursementBuyerPage({merchant:'Olive Kitchen',billDate:'2026-11-10',items:[{name:'Pasta',amountCents:2000}],totalBillCents:4200,recipientName:'Maya',amountCents:2000,currency:'USD',reason:'dinner',status:'Created',note:'Personal reimbursement'})");
  assert(reimbHtml.includes('$20.00 USD'));
  assert(!reimbHtml.includes('Pay with PayPal'));

  console.log('PASS: 27 routes, PhonePe hub, Scan Bill crop/extract, voice split + Chatterbox UI, Created/Failed delivery boundary, splitStore cart, and isolated payer views.');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
