const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const app = { innerHTML: '' };
const store = {};
const bodyClassSet = new Set();
const noopEl = { textContent: '', hidden: false, style: {}, dataset: {}, classList: { toggle() {} }, setAttribute() {} };

const windowListeners = {};
let currentHash = '#home';

const ctx = {
  console,
  URLSearchParams,
  fetch: async () => ({ ok: false }),
  AbortController,
  AbortSignal,
  Image: undefined,
  location: {
    get hash() { return currentHash; },
    set hash(v) {
      const next = String(v || '');
      if (next !== currentHash) {
        currentHash = next;
        for (const fn of (windowListeners.hashchange || [])) fn();
      }
    },
    search: '',
    href: 'https://demo.test/#home',
  },
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
    getElementById: () => null,
    querySelector: s => (s === '#app' ? app : (s === '#qr' || s === '#req-qr' ? null : noopEl)),
    querySelectorAll: () => [],
  },
  window: {
    addEventListener(type, fn) { (windowListeners[type] ||= []).push(fn); },
    scrollTo() {},
    scrollY: 0,
    matchMedia: () => ({ matches: true }),
  },
  navigator: {},
  setTimeout: () => 1,
  clearTimeout() {},
};

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/app.js'), 'utf8'), ctx);
const run = async s => vm.runInContext(s, ctx);

(async () => {
  // 0. Medfarm Welcome Leah gate: PayPal icon, no fingerprint button, PIN 9999 error -> 1234 unlock -> Lock wallet -> Phone authenticator fallback check
  await run('render()');
  assert(app.innerHTML.includes('medfarm-login-screen'), 'App should boot onto Medfarm Welcome Leah login');
  assert(app.innerHTML.includes('Welcome, Leah'));
  assert(app.innerHTML.includes('login-paypal-icon'));
  assert(!app.innerHTML.includes('pin-key-biometric') && !app.innerHTML.includes('Unlock with Biometrics'), 'Redundant fingerprint buttons must be removed');
  assert(app.innerHTML.includes('phone-auth-btn'));
  await run('pinAppend("9"); pinAppend("9"); pinAppend("9"); pinAppend("9");');
  assert.equal(await run('appUnlocked'), false);
  assert(app.innerHTML.includes('Incorrect PIN. Hint: use 1234 or phone authenticator.'));
  await run('pinAppend("1"); pinAppend("2"); pinAppend("3"); pinAppend("4");');
  assert.equal(await run('appUnlocked'), true);
  ctx.location.hash = '#profile';
  await run('render()');
  assert(app.innerHTML.includes('lock-wallet-btn'), 'Profile should include Lock wallet');
  await run('lockWallet()');
  assert.equal(await run('appUnlocked'), false);
  assert(app.innerHTML.includes('medfarm-login-screen'));
  await run('pinAppend("1"); pinAppend("2"); pinAppend("3"); pinAppend("4");');
  assert.equal(await run('appUnlocked'), true);

  await run('enterStaticPreview()');

  // 1. Clean start: no activity yet, wallet & 3D cards, quick contacts, home QR, empty bills
  ctx.location.hash = '#home';
  await run('render()');
  assert(app.innerHTML.includes('No activity yet'), 'Home should start empty');
  assert(!app.innerHTML.includes('Test denied') && !app.innerHTML.includes('Test failed'));
  assert(!app.innerHTML.includes('Ask SplitSync') && !app.innerHTML.includes('Demo mode · Sandbox ready'), 'Old Home SplitSync/Sandbox clutter must be removed');
  for (const label of ['profile-avatar-btn', 'PayPal Wallet', 'Shuffle card', 'Scan &amp; Pay', 'Send Money', 'Request Money', 'Split a Bill', 'Quick contacts', 'leah@paypal', 'home-receive-qr', 'qr-box-lg', 'Electricity', 'Rent']) {
    assert(app.innerHTML.includes(label), `Missing home feature/action: ${label}`);
  }
  const homeQrBlock = app.innerHTML.match(/aria-label="Home Receive Money QR"[\s\S]*?<\/section>/)?.[0] || '';
  assert.equal((homeQrBlock.match(/leah@paypal/g) || []).length, 1, 'Home Receive Money QR should display leah@paypal only once');
  const homeStoreBlock = app.innerHTML.match(/aria-label="Home Store showcase"[\s\S]*?<\/section>/)?.[0] || '';
  assert(homeStoreBlock.includes('home-store-card-0') && homeStoreBlock.includes('home-store-card-3'), 'Home Store bento cards must render');
  assert(!app.innerHTML.includes('Demo catalog') && !homeStoreBlock.includes('Demo Merchant'), 'Home Store should display clean image cards without Demo catalog text');

  // 1b. Shuffle 3D credit cards & recharge PayPal Wallet (+$50 -> $295.00 USD)
  assert.equal(await run('activeCardIdx'), 0);
  await run('shuffleWalletCard()');
  assert.equal(await run('activeCardIdx'), 1);
  assert.equal(await run('walletBalanceCents'), 24500);
  await run('rechargeAmountStr = "50.00"; confirmRechargeWallet();');
  assert.equal(await run('walletBalanceCents'), 29500);

  // 2. Render all primary & focused routes cleanly
  const routes = [
    'home', 'activity', 'store', 'contact-paypal', 'profile', 'send', 'review-transfer',
    'request-new', 'ask', 'scan-bill', 'electricity', 'rent', 'scan', 'review',
    'split', 'clarify', 'requests', 'dashboard', 'product/kit-essentials',
    'cart', 'checkout-review', 'dev', 'share/maya', 'handoff/maya', 'result/maya/paid',
  ];
  for (const route of routes) {
    ctx.location.hash = '#' + route;
    await run('render()');
    assert(app.innerHTML.length > 80, route);
    assert(!app.innerHTML.includes('undefined'), route);
  }

  // 2b. Send Money & Request Money recipient cards show only name + currency (no country names)
  ctx.location.hash = '#send';
  await run('render()');
  const sendCardsHtml = app.innerHTML.match(/<div class="contact-cards"[\s\S]*?<\/button>\s*<\/div>/)?.[0] || '';
  const sendCardsText = sendCardsHtml.replace(/<[^>]+>/g, ' ');
  assert(sendCardsHtml.includes('<b>Allen</b><small>GBP</small>') && sendCardsHtml.includes('<b>Maya</b><small>USD</small>'));
  for (const country of ['United Kingdom', 'United States', 'Canada', 'Germany', 'Japan']) {
    assert(!sendCardsText.includes(country), `Send Money cards should not show country name: ${country}`);
  }
  ctx.location.hash = '#request-new';
  await run('render()');
  const reqCardsHtml = app.innerHTML.match(/<div class="contact-cards"[\s\S]*?<\/button>\s*<\/div>/)?.[0] || '';
  const reqCardsText = reqCardsHtml.replace(/<[^>]+>/g, ' ');
  assert(reqCardsHtml.includes('<b>Allen</b><small>GBP</small>'));
  for (const country of ['United Kingdom', 'United States', 'Canada', 'Germany', 'Japan']) {
    assert(!reqCardsText.includes(country), `Request Money cards should not show country name: ${country}`);
  }

  // 3. International contact Send Money via Ask SplitSync -> Allen GBP reference estimate -> Editable Review payment -> Single idempotent Pay -> Receipt -> Activity
  await run("go('ask')");
  await run('submitAskTurn("Send Allen $20 and say thanks for coffee")');
  assert.equal(await run('chatDraft.intent'), 'send');
  assert.equal(await run('transferForm.contactId'), 'allen');
  assert.equal(await run('transferForm.targetCurrency'), 'GBP');
  assert.equal(ctx.location.hash, '#review-transfer');
  assert(app.innerHTML.includes('Verify the recipient and amount before you pay'));
  assert(app.innerHTML.includes('£14.90 GBP'));
  assert(!app.innerHTML.includes('<span>Pay $20.00 USD</span>'), 'Pay button should not embed cash currency');
  assert(app.innerHTML.includes('<span>Pay</span>'));
  assert(app.innerHTML.includes('rev-amt') && app.innerHTML.includes('rev-note'));
  await run('Promise.all([executeDemoPay(), executeDemoPay()])'); // second tap deduplicated by busy/clientTxId
  assert.equal(await run('demoTransactions.length'), 2); // 1 wallet recharge + 1 transfer
  assert.equal(await run('walletBalanceCents'), 27500); // $295 - $20 paid from PayPal Wallet
  assert(app.innerHTML.includes('Payment receipt'));
  assert(app.innerHTML.includes('PayPal Wallet'));
  assert(app.innerHTML.includes('£14.90 GBP') && app.innerHTML.includes('Demo rate'));

  // 3b. Bidirectional FX entry: enter receive amount in 0-decimal JPY for Yuki, verify Review & Receipt preserve exact JPY
  await run("openSendMoney('yuki')");
  await run("setTransferSide('receive'); transferForm.amountStr = '3000'; render();");
  assert.equal(await run('transferForm.enteredSide'), 'receive');
  assert.equal(await run('transferForm.targetCurrency'), 'JPY');
  await run("go('review-transfer')");
  assert(app.innerHTML.includes('¥3,000 JPY'));
  await run('executeDemoPay()');
  assert.equal(await run('demoTransactions.length'), 3);
  assert(app.innerHTML.includes('¥3,000 JPY') && app.innerHTML.includes('Recipient amount (JPY)'));

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

  // 6. Storefront (11 products), hidden-by-default Sponsored toggle in #dev, Product Detail qty, Cart -/+/Remove, Checkout review & split
  await run("go('store')");
  assert.equal(await run('storeCatalog.length'), 11);
  assert(!app.innerHTML.includes('Sponsored · Paid placement disclosure'), 'Sponsored must be hidden by default');
  await run('toggleSponsoredPlacement()');
  await run("go('store')");
  assert(app.innerHTML.includes('Sponsored · Paid placement disclosure'), 'Sponsored must show explicit disclosure when enabled');
  await run("openProductDetail('desk-lamp')");
  await run('productDetailQty = 2; render();');
  assert(app.innerHTML.includes('$60.00 USD'));
  await run("addToCart('desk-lamp', true, productDetailQty)");
  await run("addToCart('kit-essentials', false, 1)");
  await run("adjustCart('desk-lamp', -1)");
  assert.equal(await run('cartCount()'), 2);
  await run("go('checkout-review')");
  assert(app.innerHTML.includes('Checkout review'));
  await run('splitCartWithPeople()');
  assert.equal(ctx.location.hash, '#ask');

  // 6b. Blank Electricity bill -> create requests + logical Back stack
  await run('openElectricityFlow()');
  assert(app.innerHTML.includes('No active electricity bill'));
  await run("(async () => { electricityForm.creating = true; electricityForm.provider = 'City Power'; electricityForm.contactIds = ['maya','arun']; electricityForm.amountStr = '80'; electricityForm.dueDate = '2026-12-01'; await submitHouseholdBill('electricity'); await submitHouseholdBill('electricity'); })()");
  assert(ctx.location.hash.startsWith('#request/'));
  assert(app.innerHTML.includes('City Power'));
  await run("go('store'); openProductDetail('desk-lamp'); go('cart'); goBack();");
  assert.equal(ctx.location.hash, '#product/desk-lamp');
  await run('goBack()');
  assert.equal(ctx.location.hash, '#store');

  // 7. Scan & pay unsupported code error + isolated SS-001 Sandbox & reimbursement views
  await run('openScanPay()');
  ctx.document.querySelector = s => (s === '#app' ? app : s === '#purchase-link' ? { value: 'https://random-qr.invalid/123' } : (s === '#qr' || s === '#req-qr' ? null : noopEl));
  await run('pasteLink()');
  assert(app.innerHTML.includes('Unsupported code'));
  const buyerHtml = await run("buyerPage({name:'Leah',lamp:'Leah',amountCents:7000,status:'Awaiting payment',merchant:'Sandbox Merchant',purchaseTitle:'Move-in essentials',receipt:null},new URLSearchParams('cancelled=1'))");
  assert(buyerHtml.includes('Retry with PayPal'));
  const reimbHtml = await run("reimbursementBuyerPage({merchant:'Olive Kitchen',items:[{name:'Pasta',amountCents:2000}],totalBillCents:4200,recipientName:'Maya',amountCents:2000,currency:'USD',reason:'dinner',status:'Created',note:'Personal reimbursement'})");
  assert(!reimbHtml.includes('Pay with PayPal'));
  await run("lamp = 'Maya'; go('qr/maya');");
  assert(app.innerHTML.includes('Maya · $70.00 USD') && app.innerHTML.includes('Open Maya’s checkout'), '#qr/maya should match canonical capitalized Maya');

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
  assert.equal(await run('demoTransactions.length'), 7);
  assert(app.innerHTML.includes('4 demo payments completed'));

  // 8. Activity Payment Cycle graph, Contact PayPal AI chat, Ask AI store buy -> Direct Checkout (Pay from Wallet) -> Split cash, minimal Profile QR + FAQs
  await run("go('activity')");
  assert(app.innerHTML.includes('payment-cycle-card') && app.innerHTML.includes('Payment cycle'), 'Activity must render payment cycle graph above list');
  await run("go('contact-paypal')");
  assert(app.innerHTML.includes('Contact PayPal') && app.innerHTML.includes('How do I recharge wallet?'));
  await run("submitPaypalHelpTurn('How do I recharge wallet?')");
  assert(app.innerHTML.includes('PayPal AI') && app.innerHTML.includes('Linked Card'));
  await run("go('home')");
  assert(app.innerHTML.includes('profile-avatar-btn') && app.innerHTML.includes('Quick contacts'));
  await run("go('ask')");
  await run('chatDraft = null; chatAttachedBill = null; chatStoreBuy = null;');
  await run('submitAskTurn("Buy 2 desk lamps")');
  assert.equal(await run('chatStoreBuy.product.id'), 'desk-lamp');
  assert.equal(await run('chatStoreBuy.qty'), 2);
  assert(app.innerHTML.includes('$60.00 USD') && app.innerHTML.includes('Buy now'));
  await run("buyNowStoreItem('desk-lamp', 2)");
  assert.equal(ctx.location.hash, '#checkout-review');
  assert(app.innerHTML.includes('Complete purchase'), 'Direct store checkout must complete directly, not pull SS-001');
  assert(!app.innerHTML.includes('openSs001FromStore'), 'Checkout review primary button must not invoke SS-001');
  await run('completeDemoStoreOrder(6000)');
  assert(ctx.location.hash.startsWith('#tx/'));
  assert(app.innerHTML.includes('Purchased $60.00 USD') && app.innerHTML.includes('Split cash'));
  await run('splitStoreReceipt(activeTxReceiptId)');
  assert.equal(ctx.location.hash, '#ask');
  assert.equal(await run('chatAttachedBill.totalCents'), 6000);
  assert.equal(await run('chatDraft.recipients[0].amountCents'), 2000);

  await run("go('profile')");
  assert(app.innerHTML.includes('Receive Money QR') && app.innerHTML.includes('profile-receive-qr') && app.innerHTML.includes('leah@paypal'));
  assert(!app.innerHTML.includes('Copy link') && !app.innerHTML.includes('Test scan'), 'Profile QR must be clean without Copy link or Test scan');
  assert(app.innerHTML.includes('Help &amp; FAQs'));
  assert(app.innerHTML.includes('Appearance') && app.innerHTML.includes('Dark'));
  await run("setThemeMode('dark')");
  assert.equal(await run('themeMode'), 'dark');
  await run('openMerchantCode("#receive/leah?currency=CAD&amount=45")');
  assert.equal(ctx.location.hash, '#send');
  assert.equal(await run('transferForm.contactId'), 'leah');
  assert.equal(await run('transferForm.sourceCurrency'), 'CAD');
  assert.equal(await run('transferForm.amountStr'), '45.00');

  // Presenter reset clears demo state cleanly
  await run('resetDemoSession()');
  assert.equal(await run('demoTransactions.length'), 0);
  assert.equal(await run('reimbursementsList.length'), 0);
  assert.equal(await run('walletBalanceCents'), 24500);

  console.log('PASS: clean Home + 3D cards + Wallet recharge, Ask AI, AI Store direct buy + Split cash, Payment cycle graph, Contact PayPal AI, minimal Profile leah@paypal QR + Dark mode + FAQs, bidirectional FX, and reset.');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
