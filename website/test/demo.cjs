const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const app = { innerHTML: '' };
const store = {};
const bodyClassSet = new Set();
const noopEl = { textContent: '', hidden: false, style: {}, dataset: {}, classList: { toggle() {} }, setAttribute() {} };

const ctx = {
  console,
  URLSearchParams,
  fetch: async () => ({ ok: false }),
  AbortController,
  AbortSignal,
  Image: undefined,
  location: { hash: '#home', search: '', href: 'https://demo.test/#home' },
  localStorage: {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  },
  document: {
    body: {
      dataset: {},
      classList: {
        toggle(cls, force) { if (force) bodyClassSet.add(cls); else bodyClassSet.delete(cls); },
      },
    },
    createElement: () => ({}),
    querySelector: s => (s === '#app' ? app : (s === '#qr' || s === '#req-qr' ? null : noopEl)),
    querySelectorAll: () => [],
  },
  window: { addEventListener() {}, scrollTo() {}, matchMedia: () => ({ matches: true }) },
  navigator: {},
  setTimeout: () => 1,
  clearTimeout() {},
};

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/app.js'), 'utf8'), ctx);
const run = async s => vm.runInContext(s, ctx);

(async () => {
  await run('enterStaticPreview()');

  // 1. Clean start: no activity yet, empty rent, unopened Scan & pay
  ctx.location.hash = '#home';
  await run('render()');
  assert(app.innerHTML.includes('No activity yet'), 'Home should start empty');
  assert(!app.innerHTML.includes('Test denied') && !app.innerHTML.includes('Test failed'));
  for (const label of ['Scan &amp; pay', 'Request money', 'Send money', 'Ask AI']) {
    assert(app.innerHTML.includes(label), `Missing primary action: ${label}`);
  }

  // 2. Render all primary & focused routes cleanly
  const routes = [
    'home', 'activity', 'store', 'profile', 'send', 'review-transfer',
    'request-new', 'ask', 'scan-bill', 'rent', 'scan', 'review',
    'split', 'clarify', 'requests', 'dashboard', 'product/kit-essentials',
    'cart', 'share/maya', 'handoff/maya', 'result/maya/paid',
  ];
  for (const route of routes) {
    ctx.location.hash = '#' + route;
    await run('render()');
    assert(app.innerHTML.length > 80, route);
    assert(!app.innerHTML.includes('undefined'), route);
  }

  // 3. International contact Send Money via Ask AI -> Allen GBP reference estimate -> Review payment -> Single idempotent Pay
  ctx.location.hash = '#ask';
  await run('submitAskTurn("Allen, send him 20 dollars saying thanks for coffee.")');
  assert.equal(await run('chatDraft.intent'), 'send');
  assert.equal(await run('transferForm.contactId'), 'allen');
  assert.equal(await run('transferForm.targetCurrency'), 'GBP');
  assert(app.innerHTML.includes('£14.90 GBP'));
  await run("go('review-transfer')");
  assert(app.innerHTML.includes('Verify the recipient and amount before you pay'));
  await run('Promise.all([executeDemoPay(), executeDemoPay()])'); // second tap deduplicated by busy/clientTxId
  assert.equal(await run('demoTransactions.length'), 1);

  // 4. Multi-turn voice split + clarification update on same draft + self-settling practice request & honest failed email channel
  ctx.location.hash = '#ask';
  await run('useAskSampleReceipt()');
  await run('submitAskTurn("Ask Maya for twenty dollars for dinner and Alex for fifteen for drinks")');
  assert.equal(await run('chatDraft.needsClarification'), true);
  await run('submitAskTurn("Arun")');
  assert.equal(await run('chatDraft.recipients[1].name'), 'Arun');
  assert(app.innerHTML.includes('Arun owes'));
  await run("askConfirmChannel = 'email'; confirmAskRequests();");
  const emailReqId = await run('reimbursementsList[0].id');
  ctx.location.hash = '#request/' + emailReqId;
  await run('render()');
  assert(app.innerHTML.includes('Created') && app.innerHTML.includes('Failed'));

  // 5. Manual Request Money -> Waiting for payment -> auto-settles when settleAt reached
  await run('openManualRequest("maya"); manualReqForm.amountStr = "25"; submitManualRequest(true);');
  assert.equal(await run('reimbursementsList[0].recipients[0].status'), 'Waiting for payment');
  await run('reimbursementsList[0].recipients[0].settleAt = Date.now() - 10; reconcileLocalDemoSettlements(); render();');
  assert.equal(await run('reimbursementsList[0].recipients[0].status'), 'Paid');
  assert(app.innerHTML.includes('Payment received from Maya'));

  // 6. Store -> cart -> splitCartWithPeople -> Ask AI
  await run("addToCart('kit-essentials', false); addToCart('desk-lamp', false);");
  assert.equal(await run('cartCount()'), 2);
  await run('splitCartWithPeople()');
  assert.equal(ctx.location.hash, '#ask');

  // 7. Scan & pay unsupported code error + isolated SS-001 Sandbox & reimbursement views
  await run('openScanPay()');
  ctx.document.querySelector = s => (s === '#app' ? app : s === '#purchase-link' ? { value: 'https://random-qr.invalid/123' } : noopEl);
  await run('pasteLink()');
  assert(app.innerHTML.includes('Unsupported code'));
  const buyerHtml = await run("buyerPage({name:'Leah',lamp:'Leah',amountCents:7000,status:'Awaiting payment',merchant:'Sandbox Merchant',purchaseTitle:'Move-in essentials',receipt:null},new URLSearchParams('cancelled=1'))");
  assert(buyerHtml.includes('Retry with PayPal'));
  const reimbHtml = await run("reimbursementBuyerPage({merchant:'Olive Kitchen',items:[{name:'Pasta',amountCents:2000}],totalBillCents:4200,recipientName:'Maya',amountCents:2000,currency:'USD',reason:'dinner',status:'Created',note:'Personal reimbursement'})");
  assert(!reimbHtml.includes('Pay with PayPal'));

  ctx.location.hash = '#ask';
  await run('chatDraft = null; chatAttachedBill = null;');
  await run('submitAskTurn("Give Maya $20 and Arun $15.")');
  assert(app.innerHTML.includes('Review 2 payments'));
  await run('submitAskTurn("And Allen $12 and Sofia $18.")');
  assert(app.innerHTML.includes('Review 4 payments'));
  await run('submitAskTurn("Make Maya $24.")');
  assert.equal(await run('chatDraft.recipients.length'), 4);
  assert.equal(await run('chatDraft.recipients[0].amountCents'), 2400);
  await run('openGroupPaymentReview()');
  assert.equal(ctx.location.hash, '#review-payment-draft');
  await run('render()');
  assert(app.innerHTML.includes('69.00 USD'));
  await run('Promise.all([confirmGroupPayments(), confirmGroupPayments()])');
  assert.equal(await run('demoTransactions.length'), 5);
  assert(app.innerHTML.includes('4 practice payments completed'));

  // 8. Presenter reset clears demo state cleanly
  await run('resetDemoSession()');
  assert.equal(await run('demoTransactions.length'), 0);
  assert.equal(await run('reimbursementsList.length'), 0);

  console.log('PASS: clean-start Home, FX Allen GBP flow, multi-turn Ask AI, self-settling requests, Store cart, Rent, Sandbox boundary, and presenter reset.');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
