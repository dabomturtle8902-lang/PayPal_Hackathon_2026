// SplitSync AI Web App — Medfarm visual system, PhonePe action-first payments, bidirectional FX, staggered notifications, and super.money Store

const CURR_SYM = { USD: '$', GBP: '£', CAD: 'CA$', EUR: '€', JPY: '¥', INR: '₹' };
let FX_RATES = { USD: 1, GBP: 0.74501, CAD: 1.4136, EUR: 0.89174, JPY: 158.18, INR: 93.93 };
let fxRateDate = '2026-11-10';
const CURRENCIES = ['USD', 'GBP', 'CAD', 'EUR', 'JPY', 'INR'];
const names = ['Maya', 'Arun', 'Leah'];

function applyFxRates(rates, date) {
  if (typeof date !== 'string' || date < fxRateDate ||
      !CURRENCIES.every(code => Number.isFinite(rates?.[code]) && rates[code] > 0)) return;
  FX_RATES = rates;
  fxRateDate = date;
}

function equalShare(total, count, currency) {
  const unit = currency === 'JPY' ? 100 : 1;
  return Math.floor(total / unit / count) * unit;
}

function totalInCurrency(rows, currency) {
  return rows.reduce((sum, row) => sum + convertCents(row.amountCents, row.currency, currency), 0);
}

function normCurr(code, fallback = 'USD') {
  const c = String(code || '').trim().toUpperCase();
  return FX_RATES[c] ? c : fallback;
}

function decimalsFor(curr) {
  return normCurr(curr, 'USD') === 'JPY' ? 0 : 2;
}

function formatCentsInput(amountCents, curr = 'USD') {
  const d = decimalsFor(curr);
  return ((Number(amountCents) || 0) / 100).toFixed(d);
}

function parseMajorToCents(value, curr = 'USD') {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return normCurr(curr, 'USD') === 'JPY' ? Math.round(n) * 100 : Math.round(n * 100);
}

function money(n, curr = 'USD', withCode = true) {
  const c = normCurr(curr, 'USD');
  const sym = CURR_SYM[c] || '$';
  const val = Number(n || 0);
  const str = c === 'JPY'
    ? Math.round(val).toLocaleString('en-US')
    : val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sym}${str}${withCode ? ` ${c}` : ''}`;
}

const cents = (c, curr = 'USD', withCode = true) => money((Number(c) || 0) / 100, curr, withCode);

function convertCents(amountCents, fromCurr = 'USD', toCurr = 'USD') {
  const from = normCurr(fromCurr, 'USD');
  const to = normCurr(toCurr, 'USD');
  const raw = Math.max(0, Number(amountCents) || 0);
  if (from === to) return to === 'JPY' ? Math.round(raw / 100) * 100 : Math.round(raw);
  const usdMajor = (raw / 100) / FX_RATES[from];
  const targetMajor = usdMajor * FX_RATES[to];
  return to === 'JPY' ? Math.round(targetMajor) * 100 : Math.round(targetMajor * 100);
}

function fxQuote(amountCents, fromCurr = 'USD', toCurr = 'USD', enteredSide = 'send') {
  const sourceCurrency = normCurr(fromCurr, 'USD');
  const targetCurrency = normCurr(toCurr, sourceCurrency);
  const norm = (val, curr) => curr === 'JPY'
    ? Math.max(0, Math.round((Number(val) || 0) / 100) * 100)
    : Math.max(0, Math.round(Number(val) || 0));
  const rate = FX_RATES[targetCurrency] / FX_RATES[sourceCurrency];
  if (enteredSide === 'receive') {
    const targetAmountCents = norm(amountCents, targetCurrency);
    const sourceAmountCents = convertCents(targetAmountCents, targetCurrency, sourceCurrency);
    const inrEquivalentCents = convertCents(sourceAmountCents, sourceCurrency, 'INR');
    return { enteredSide: 'receive', sourceAmountCents, sourceCurrency, targetAmountCents, targetCurrency, inrEquivalentCents, rate, rateDate: fxRateDate };
  }
  const sourceAmountCents = norm(amountCents, sourceCurrency);
  const targetAmountCents = convertCents(sourceAmountCents, sourceCurrency, targetCurrency);
  const inrEquivalentCents = convertCents(sourceAmountCents, sourceCurrency, 'INR');
  return { enteredSide: 'send', sourceAmountCents, sourceCurrency, targetAmountCents, targetCurrency, inrEquivalentCents, rate, rateDate: fxRateDate };
}

function defaultContacts() {
  return [
    { id: 'allen', name: 'Allen', country: 'United Kingdom', flag: '🇬🇧', currency: 'GBP', handle: 'allen@demo.local', phone: '+44-20-7946-0112', note: 'London · Friend' },
    { id: 'maya', name: 'Maya', country: 'United States', flag: '🇺🇸', currency: 'USD', handle: 'maya@demo.local', phone: '+1-555-0141', note: 'Roommate' },
    { id: 'arun', name: 'Arun', country: 'Canada', flag: '🇨🇦', currency: 'CAD', handle: 'arun@demo.local', phone: '+1-416-555-0142', note: 'Toronto · Roommate' },
    { id: 'sofia', name: 'Sofia', country: 'Germany', flag: '🇩🇪', currency: 'EUR', handle: 'sofia@demo.local', phone: '+49-30-5550-0143', note: 'Berlin · Designer' },
    { id: 'yuki', name: 'Yuki', country: 'Japan', flag: '🇯🇵', currency: 'JPY', handle: 'yuki@demo.local', phone: '+81-3-5550-0144', note: 'Tokyo · Friend' },
    { id: 'leah', name: 'Leah', country: 'United States', flag: '🇺🇸', currency: 'USD', handle: 'leah@demo.local', phone: '+1-555-0145', note: 'Organizer' },
  ];
}

// 11 Real, Identifiable Storefront Products + 3 Honest External Retailers
const storeCatalog = [
  { id: 'kit-essentials', name: 'Move-In Kitchen Essentials Bundle', priceCents: 12000, seller: 'Demo Merchant', paypalEligible: true, category: 'Kitchen', img: 'assets/products/kit-essentials.jpg', availability: 'Demo price · In stock (fixture)', desc: 'Multi-piece stainless steel cookware set for shared kitchens. Pairs with Matte LED Task Desk Lamp for the SS-001 $150 PayPal Sandbox split.' },
  { id: 'desk-lamp', name: 'Matte LED Task Desk Lamp', priceCents: 3000, seller: 'Demo Merchant', paypalEligible: true, category: 'Lighting', img: 'assets/products/desk-lamp.jpg', availability: 'Demo price · In stock (fixture)', desc: 'Articulated aluminum and matte navy study lamp with weighted base. Eligible for Demo Merchant SS-001 PayPal Sandbox checkout.' },
  { id: 'electric-kettle', name: 'Glass & Steel Electric Kettle (1.7L)', priceCents: 3800, seller: 'Demo Merchant', paypalEligible: true, category: 'Kitchen', img: 'assets/products/electric-kettle.jpg', availability: 'Demo price · Ships in 2 days (fixture)', desc: 'Borosilicate glass and brushed stainless 1.7L fast-boil kettle with auto shutoff for shared mornings.' },
  { id: 'ceramic-dinnerware', name: 'Stoneware Dinnerware Set (12-Piece)', priceCents: 5400, seller: 'Kiln & Table Demo', paypalEligible: false, category: 'Kitchen', img: 'assets/products/ceramic-dinnerware.jpg', availability: 'Demo price · Sample catalog fixture', desc: 'Dishwasher-safe speckled ceramic service for four: dinner plates, salad plates, and deep soup bowls.' },
  { id: 'french-press', name: 'Double-Wall Insulated French Press', priceCents: 3400, seller: 'RoastCraft Demo', paypalEligible: false, category: 'Kitchen', img: 'assets/products/french-press.jpg', availability: 'Demo price · Sample catalog fixture', desc: '34 oz thermal stainless steel coffee carafe with dual mesh filtration for roommates.' },
  { id: 'hepa-purifier', name: 'Compact HEPA Room Air Purifier', priceCents: 8400, seller: 'PureAir Demo', paypalEligible: false, category: 'Appliances', img: 'assets/products/hepa-purifier.jpg', availability: 'Demo price · Sample catalog fixture', desc: 'Cylindrical H13 HEPA tabletop purifier for living rooms and bedrooms up to 240 sq ft with quiet night mode.' },
  { id: 'bamboo-organizer', name: 'Expandable Bamboo Drawer Organizer', priceCents: 2800, seller: 'TidyNest Demo', paypalEligible: false, category: 'Storage', img: 'assets/products/bamboo-organizer.jpg', availability: 'Demo price · Sample catalog fixture', desc: 'Adjustable natural bamboo utensil tray that expands from 13 to 22 inches for shared kitchen drawers.' },
  { id: 'pantry-containers', name: 'Glass Dry Pantry Containers (5-Pack)', priceCents: 3600, seller: 'TidyNest Demo', paypalEligible: false, category: 'Storage', img: 'assets/products/pantry-containers.jpg', availability: 'Demo price · Sample catalog fixture', desc: 'Sealed clear glass canister set for pasta, muesli, oats, nuts, and coffee on shared pantry shelves.' },
  { id: 'microfiber-kit', name: 'Reusable Microfiber Cleaning Cloths (8-Pack)', priceCents: 2400, seller: 'Demo Merchant', paypalEligible: true, category: 'Cleaning', img: 'assets/products/microfiber-kit.jpg', availability: 'Demo price · In stock (fixture)', desc: 'Washable textured microfiber cloths designed for streak-free counter, glass, and stove cleanup.' },
  { id: 'usb-c-strip', name: 'Wall Surge Protector with Dual USB', priceCents: 3200, seller: 'VoltDock Demo', paypalEligible: false, category: 'Electronics', img: 'assets/products/usb-c-strip.jpg', availability: 'Demo price · Sample catalog fixture', desc: '900-joule compact 3-outlet surge block with dual integrated USB charging ports for shared desks.' },
  { id: 'bath-towels', name: 'Combed Cotton Bath Towel Set (4-Pack)', priceCents: 4200, seller: 'LoomWorks Demo', paypalEligible: false, category: 'Home', img: 'assets/products/bath-towels.jpg', availability: 'Demo price · Sample catalog fixture', desc: 'Quick-dry 600 GSM long-staple cotton towels in slate teal and crisp white for shared guest baths.' },
];

const externalRetailers = [
  { id: 'ikea', name: 'IKEA Home Furnishings', category: 'Storage', seller: 'External retailer', url: 'https://www.ikea.com/', desc: 'Browse sofas, desks, lamps, and modular storage directly on ikea.com.' },
  { id: 'target', name: 'Target Apartment Basics', category: 'Cleaning', seller: 'External retailer', url: 'https://www.target.com/', desc: 'Compare household essentials, pickup inventory, and bedding on target.com.' },
  { id: 'bestbuy', name: 'Best Buy Small Appliances', category: 'Appliances', seller: 'External retailer', url: 'https://www.bestbuy.com/', desc: 'Shop air purifiers, surge protectors, and kettles directly on bestbuy.com.' },
];

const sponsoredShowcaseItem = {
  id: 'usb-c-strip',
  badge: 'Sponsored · Paid placement disclosure',
  headline: 'Featured workspace power upgrade',
  copy: 'Shown only when sponsored showcase mode is enabled in Developer Tools.',
};

// Core workspace state (clean start by default)
let organizerKeyDraft = '';
let authErrorKind = '';
let authErrorMessage = '';
let authBusy = false;
let staticPreviewMode = false;
let backendMode = false;
let paypalConfigured = false;
let providers = { paypalConfigured: false, aiConfigured: false, ttsConfigured: false, sttConfigured: true, emailConfigured: false, smsConfigured: false };
let ledger = null;
let contactsList = loadContactsFromStorage();
let reimbursementsList = JSON.parse(localStorage.getItem('splitsync-reimbursements') || '[]');
let demoTransactions = JSON.parse(localStorage.getItem('splitsync-demo-tx') || '[]');
let savedRentRule = JSON.parse(localStorage.getItem('splitsync-rent-rule') || 'null');
let savedElectricRule = JSON.parse(localStorage.getItem('splitsync-electric-rule') || 'null');
let ss001Active = localStorage.getItem('splitsync-ss001-active') === 'true';
let lamp = localStorage.getItem('splitsync-lamp') || 'Maya';
let published = localStorage.getItem('splitsync-published') === 'true';
let sponsoredEnabled = localStorage.getItem('splitsync-sponsored') === 'true' || new URLSearchParams(location.search || '').get('sponsored') === '1';
let instructionDraft = 'Split the $120 kitchen essentials evenly between Maya, Arun and Leah. The $30 lamp is for Leah.';
let pastedLinkDraft = '';
let selectedQrName = 'Maya';
let selectedReqQr = { reqId: '', recipientId: '' };
let draftLamp = null;
let aiState = 'idle';
let aiError = '';
let chatStoreBuy = null;
let manualDisconnect = false;
let themeMode = localStorage.getItem('splitsync-theme') || 'system';
let receiveQrForm = { amountStr: '', currency: 'USD' };
let walletBalanceCents = Math.max(0, Number(localStorage.getItem('splitsync-wallet-cents') || '24500') || 24500);
let activeCardIdx = Math.max(0, Number(localStorage.getItem('splitsync-card-idx') || '0') || 0) % 3;
let paymentSource = 'wallet';
let cycleRange = '30D';
let rechargeModalOpen = false;
let rechargeAmountStr = '50.00';
let helpHistory = [];
let helpComposerText = '';
let helpBusy = false;
let cards3dController = null;
let appUnlocked = localStorage.getItem('splitsync-unlocked') === 'true';
let pinEntry = '';
let pinError = '';
let pinObscured = true;
let bioVerifying = false;

function pinAppend(digit) {
  if (appUnlocked || bioVerifying) return;
  const d = String(digit || '').replace(/\D/g, '').slice(0, 1);
  if (!d || pinEntry.length >= 4) return;
  pinError = '';
  pinEntry += d;
  if (pinEntry.length === 4) {
    if (pinEntry === '1234') {
      appUnlocked = true;
      localStorage.setItem('splitsync-unlocked', 'true');
      pinEntry = '';
      pinError = '';
      if ((location.hash || '').startsWith('#login')) location.hash = '#home';
      toast('Unlocked with PIN');
      render();
      return;
    }
    pinError = 'Incorrect PIN. Hint: use 1234 or phone authenticator.';
    pinEntry = '';
  }
  render();
}

function pinBackspace() {
  if (!pinEntry) return;
  pinEntry = pinEntry.slice(0, -1);
  pinError = '';
  render();
}

function togglePinObscure() {
  pinObscured = !pinObscured;
  render();
}

async function usePhoneAuthenticator() {
  if (bioVerifying) return;
  pinError = '';
  const hasWebAuthn = typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && navigator.credentials?.create
    && typeof PublicKeyCredential !== 'undefined';
  if (!hasWebAuthn) {
    pinError = 'Phone authenticator unavailable in this browser — enter 4-digit PIN (1234).';
    render();
    return;
  }
  bioVerifying = true;
  render();
  try {
    await navigator.credentials.create({
      publicKey: {
        challenge: new Uint8Array(16),
        rp: { name: 'PayPal · SplitSync AI' },
        user: {
          id: new Uint8Array([1, 2, 3, 4]),
          name: 'leah@paypal',
          displayName: 'Leah',
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
        authenticatorSelection: { userVerification: 'preferred' },
        timeout: 45000,
      },
    });
    bioVerifying = false;
    appUnlocked = true;
    localStorage.setItem('splitsync-unlocked', 'true');
    pinEntry = '';
    pinError = '';
    if ((location.hash || '').startsWith('#login')) location.hash = '#home';
    toast('Unlocked with authenticator · Welcome back, Leah');
    render();
  } catch {
    bioVerifying = false;
    pinError = 'Device verification cancelled — enter PIN 1234.';
    render();
  }
}

function lockWallet() {
  appUnlocked = false;
  localStorage.removeItem('splitsync-unlocked');
  pinEntry = '';
  pinError = '';
  bioVerifying = false;
  toast('Wallet locked');
  render();
}

function medfarmLoginView() {
  const boxes = [0, 1, 2, 3].map(i => {
    const ch = pinEntry[i] || '';
    const filled = Boolean(ch);
    const active = i === pinEntry.length;
    const cls = ['pin-box', active ? 'active' : '', pinError ? 'error' : ''].filter(Boolean).join(' ');
    const inner = filled
      ? (pinObscured ? '<span class="pin-dot"></span>' : escapeHtml(ch))
      : '';
    return `<div class="${cls}" data-pin-box="${i}">${inner}</div>`;
  }).join('');

  return `<div class="medfarm-login-shell" id="medfarm-login-screen">
    <div class="medfarm-login-dome">
      <div class="medfarm-login-mark"><img id="login-paypal-icon" src="assets/paypal.png" alt="PayPal"></div>
      <h1 style="margin:0;color:#fff;font-size:27px">Welcome, Leah</h1>
      <div class="medfarm-login-pill">leah@paypal · PIN 1234</div>
    </div>
    <div class="medfarm-login-body">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <strong style="font-size:14px">Enter passcode</strong>
        <button type="button" class="btn-ghost-sm" onclick="togglePinObscure()">${pinObscured ? 'Show' : 'Hide'}</button>
      </div>
      <div class="pin-boxes" aria-label="4-digit PIN display">${boxes}</div>
      ${pinError ? `<div id="pin-error-msg" class="callout error" style="margin-top:0;margin-bottom:12px" role="alert">${svg('alert')}<span>${escapeHtml(pinError)}</span></div>` : ''}
      <div class="pin-keypad">
        ${['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d =>
          `<button type="button" class="pin-key" id="pin-key-${d}" onclick="pinAppend('${d}')">${d}</button>`
        ).join('')}
        <div></div>
        <button type="button" class="pin-key" id="pin-key-0" onclick="pinAppend('0')">0</button>
        <button type="button" class="pin-key" id="pin-key-backspace" onclick="pinBackspace()" aria-label="Delete digit">⌫</button>
      </div>
      <div style="text-align:center;margin-top:8px">
        <button type="button" id="phone-auth-btn" class="btn-ghost-sm" onclick="usePhoneAuthenticator()" ${bioVerifying ? 'disabled' : ''}>
          ${svg('wallet')}<span>${bioVerifying ? 'Verifying with device…' : 'Use phone authenticator'}</span>
        </button>
      </div>
    </div>
  </div>`;
}

function applyThemeMode(mode = themeMode) {
  themeMode = ['system', 'light', 'dark'].includes(mode) ? mode : 'system';
  localStorage.setItem('splitsync-theme', themeMode);
  if (typeof document !== 'undefined' && document.documentElement?.dataset) {
    if (themeMode === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = themeMode;
  }
}

function setThemeMode(mode) {
  applyThemeMode(mode);
  render();
}

function receiveQrUrl() {
  const curr = normCurr(receiveQrForm.currency, 'USD');
  const centsVal = parseMajorToCents(receiveQrForm.amountStr, curr);
  const params = new URLSearchParams({ currency: curr });
  if (centsVal > 0) params.set('amount', formatCentsInput(centsVal, curr));
  const base = (typeof location !== 'undefined' && location.href)
    ? location.href.split('#')[0]
    : '';
  return `${base}#receive/leah?${params.toString()}`;
}

applyThemeMode(themeMode);

// Navigation history, tab state & transitions
let navStack = ['home'];
const tabScrollY = { home: 0, activity: 0, store: 0, 'contact-paypal': 0, profile: 0 };
let lastRouteKey = '';
let routeTransitionPending = false;

// Staggered notifications & deduplication persisted in storage
let settleTimerId = null;
const notifiedSettlementIds = new Set(JSON.parse(localStorage.getItem('splitsync-notified-ids') || '[]'));
const justSettledIds = new Set();

// Activity filters
let activityFilter = 'All';
let activityQuery = '';

// Scan & Pay (camera unopened by default)
let scannerState = 'ready';
let scannerMessage = '';
let activeStream = null;
let scanEpoch = 0;

// Send & Editable Review + Request forms
let contactSearch = '';
let transferForm = {
  contactId: '',
  amountStr: '',
  enteredSide: 'send',
  sourceCurrency: 'USD',
  targetCurrency: 'GBP',
  note: '',
  clientTxId: '',
  busy: false,
  error: '',
  reviewSourceCents: 0,
  reviewTargetCents: 0,
  reviewRate: 0,
  reviewRateDate: fxRateDate,
  returnParent: 'send',
};
let activeTxReceiptId = '';
let manualReqForm = { multi: false, contactId: '', contactIds: [], amountStr: '', currency: 'USD', note: '', channel: 'demo', busy: false, error: '', clientRequestId: '', review: null };

// Blank Rent & Electricity forms
let rentForm = { creating: false, contactIds: [], amountStr: '', currency: 'USD', dueDate: '', mode: 'equal', customAmounts: {}, saveRule: false, busy: false, error: '', review: false, clientRequestId: '' };
let electricityForm = { creating: false, provider: '', contactIds: [], amountStr: '', currency: 'USD', dueDate: '', mode: 'equal', customAmounts: {}, saveRule: false, busy: false, error: '', review: false, clientRequestId: '' };

// Scan a Bill flow
let billStream = null;
let billCameraState = 'ready';
let billCameraMessage = '';
let billRawImage = '';
let billCroppedImage = '';
let billExtractState = 'idle';
let billExtractError = '';
let billDraft = null;
let billRecipientIds = [];

// Ask SplitSync conversation
let chatHistory = [];
let groupPaymentReceipt = [];
let chatDraft = null;
let chatAttachedBill = null;
let chatAttachedImg = '';
let chatAttachedRawImg = '';
let chatShowCrop = false;
let chatCropTop = 0;
let chatCropBottom = 0;
let chatExtractState = 'idle';
let chatExtractError = '';
let askComposerText = '';
let askVoiceOn = localStorage.getItem('splitsync-voice-on') !== 'false';
let askAutoSendMic = false;
let askBusy = false;
let askConfirmSheetOpen = false;
let askConfirmChannel = 'demo';

// Mic + Chatterbox autoplay & cancellation
let micState = 'idle';
let micError = '';
let micRecorder = null;
let micChunks = [];
let speechRecognition = null;
let ttsEpoch = 0;
let ttsAbortCtrl = null;
let activeAudioEl = null;
let askAudioState = 'idle';
let askAudioSrc = '';
let askAudioError = '';
let askAudioMsgId = '';
let pendingSendTransitionTimer = null;

// Storefront, Product qty & Checkout
let storeCategory = 'All';
let storeQuery = '';
let productDetailQty = 1;
let sharedCart = JSON.parse(localStorage.getItem('splitsync-cart') || '[]');
let checkoutOrderError = '';
let checkoutBusy = false;

// Private payer isolated state
let buyer = null;
let buyerToken = '';
let buyerActionMessage = '';

function loadContactsFromStorage() {
  const saved = JSON.parse(localStorage.getItem('splitsync-contacts') || 'null');
  if (!Array.isArray(saved) || !saved.length) return defaultContacts();
  const seeds = new Map(defaultContacts().map(c => [c.id, c]));
  const merged = saved.filter(c => c && c.id !== 'samir').map(c => ({ ...(seeds.get(c.id) || {}), ...c }));
  for (const s of defaultContacts()) if (!merged.some(c => c.id === s.id)) merged.push(s);
  return merged;
}

function saveLocalState() {
  if (backendMode) return;
  localStorage.setItem('splitsync-contacts', JSON.stringify(contactsList));
  localStorage.setItem('splitsync-reimbursements', JSON.stringify(reimbursementsList));
  localStorage.setItem('splitsync-demo-tx', JSON.stringify(demoTransactions));
  localStorage.setItem('splitsync-rent-rule', JSON.stringify(savedRentRule));
  localStorage.setItem('splitsync-electric-rule', JSON.stringify(savedElectricRule));
  localStorage.setItem('splitsync-wallet-cents', String(walletBalanceCents));
  localStorage.setItem('splitsync-card-idx', String(activeCardIdx));
}

function persistNotifiedIds() {
  localStorage.setItem('splitsync-notified-ids', JSON.stringify([...notifiedSettlementIds].slice(-200)));
}

function escapeHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Unified SVG Iconography & Crisp Country Flag SVGs
function flagSvg(currencyOrCountry) {
  const key = String(currencyOrCountry || '').toUpperCase();
  const svgs = {
    GBP: '<svg viewBox="0 0 24 18" aria-hidden="true"><rect width="24" height="18" fill="#012169"/><path d="M0 0l24 18M24 0L0 18" stroke="#fff" stroke-width="3.2"/><path d="M0 0l24 18M24 0L0 18" stroke="#C8102E" stroke-width="1.6"/><path d="M12 0v18M0 9h24" stroke="#fff" stroke-width="5"/><path d="M12 0v18M0 9h24" stroke="#C8102E" stroke-width="3"/></svg>',
    USD: '<svg viewBox="0 0 24 18" aria-hidden="true"><rect width="24" height="18" fill="#fff"/><path d="M0 1h24M0 4.5h24M0 8h24M0 11.5h24M0 15h24" stroke="#B22234" stroke-width="1.6"/><rect width="11" height="9.5" fill="#3C3B6E"/><circle cx="3" cy="3" r=".7" fill="#fff"/><circle cx="6" cy="3" r=".7" fill="#fff"/><circle cx="9" cy="3" r=".7" fill="#fff"/><circle cx="4.5" cy="5.5" r=".7" fill="#fff"/><circle cx="7.5" cy="5.5" r=".7" fill="#fff"/><circle cx="3" cy="7.5" r=".7" fill="#fff"/><circle cx="6" cy="7.5" r=".7" fill="#fff"/></svg>',
    CAD: '<svg viewBox="0 0 24 18" aria-hidden="true"><rect width="24" height="18" fill="#fff"/><rect width="6" height="18" fill="#D80621"/><rect x="18" width="6" height="18" fill="#D80621"/><path d="M12 4l1.2 3 2.5-.6-.8 2.2 1.8 1.2-2.2.8.3 2H12.7v2h-1.4v-2H9.2l.3-2-2.2-.8 1.8-1.2-.8-2.2 2.5.6z" fill="#D80621"/></svg>',
    EUR: '<svg viewBox="0 0 24 18" aria-hidden="true"><rect width="24" height="6" fill="#111"/><rect y="6" width="24" height="6" fill="#DD0000"/><rect y="12" width="24" height="6" fill="#FFCE00"/></svg>',
    JPY: '<svg viewBox="0 0 24 18" aria-hidden="true"><rect width="24" height="18" fill="#fff"/><circle cx="12" cy="9" r="5" fill="#BC002D"/></svg>',
    INR: '<svg viewBox="0 0 24 18" aria-hidden="true"><rect width="24" height="6" fill="#FF9933"/><rect y="6" width="24" height="6" fill="#fff"/><rect y="12" width="24" height="6" fill="#138808"/><circle cx="12" cy="9" r="2" fill="none" stroke="#000080" stroke-width="1"/></svg>',
  };
  return svgs[key] || svgs.USD;
}

function contactAvatarHtml(contact, small = false) {
  const name = contact?.name || '?';
  const id = String(contact?.id || name).toLowerCase().replace(/[^a-z0-9]/g, '');
  const curr = normCurr(contact?.currency, 'USD');
  return `<span class="avatar-wrap ${small ? 'sm' : ''}">
    <span class="avatar-circle c-${escapeHtml(id)}">${escapeHtml(name[0].toUpperCase())}</span>
    <span class="flag-badge" title="${escapeHtml(contact?.country || curr)}">${flagSvg(curr)}</span>
  </span>`;
}

function svg(name) {
  const icons = {
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h3"/>',
    'send-req': '<circle cx="12" cy="12" r="9"/><path d="M9.5 14.5L14.5 9.5"/><path d="M10.5 9.5h4v4"/>',
    'send-out': '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
    'receipt-camera': '<path d="M4 7V5a1 1 0 0 1 1-1h3l2-2h4l2 2h3a1 1 0 0 1 1 1v2"/><rect x="4" y="7" width="16" height="13" rx="2"/><circle cx="12" cy="13.5" r="3"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/><path d="M8 21h8"/>',
    sparkles: '<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/>',
    bolt: '<polygon points="13 2 4 14 11 14 10 22 20 10 13 10 13 2"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    bag: '<path d="M5 8h14l1 12H4L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2l2.4 11h10.8l2-8H6.5"/>',
    store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M9 12.2l2 2 4-4.2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><circle cx="12" cy="16.5" r=".5" fill="currentColor"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    external: '<path d="M14 5h5v5"/><path d="M10 14L19 5"/><path d="M19 14v5H5V5h5"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M10.85 12.15L19 4"/><path d="M16 7l2 2"/>',
    volume: '<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
    mute: '<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M22 9l-6 6"/><path d="M16 9l6 6"/>',
    play: '<polygon points="6 4 20 12 6 20 6 4"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    paperclip: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    'arrow-left': '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
    'arrow-right': '<path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M7 7l1 13h8l1-13"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.7l6.8-4.4"/><path d="M8.6 13.3l6.8 4.4"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h4"/>',
    swap: '<path d="M7 16V4m0 0L3 8m4-4l4 4"/><path d="M17 8v12m0 0l4-4m-4 4l-4-4"/>',
    photo: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5L5 20"/>',
    'send-arrow': '<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>',
    wallet: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M16 12h6"/><circle cx="16.5" cy="12" r="1"/>',
    support: '<path d="M4 13v-2a8 8 0 0 1 16 0v2"/><rect x="2" y="13" width="4" height="6" rx="1.5"/><rect x="18" y="13" width="4" height="6" rx="1.5"/><path d="M18 19a4 4 0 0 1-4 4h-2"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    fingerprint: '<path d="M12 11v4"/><path d="M9 11a3 3 0 0 1 6 0v3"/><path d="M6 12a6 6 0 0 1 12 0v2"/><path d="M3 13a9 9 0 0 1 18 0"/><path d="M12 18v3"/><path d="M9 18v2"/><path d="M15 17v3"/>',
  };
  return `<svg class="ss-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.sparkles}</svg>`;
}

const badge = (text, kind = '') => `<span class="badge ${kind}">${escapeHtml(text)}</span>`;
const statusClass = s => ({
  Created: 'created',
  Sent: 'sent',
  'Awaiting payment': 'awaiting',
  'Waiting for payment': 'pending',
  Processing: 'processing',
  Paid: 'paid',
  'Payment received': 'paid',
  Completed: 'paid',
  'Demo transfer': 'paid',
  Failed: 'failed',
  Cancelled: 'error',
}[s] || 'created');
const pill = s => `<span class="pill ${statusClass(s)}">${escapeHtml(s)}</span>`;

function screenHeader(title, subtitle, fallbackBack = 'home', rightHtml = '') {
  return `<div class="screen-top">
    <div class="screen-top-left">
      <button type="button" class="btn-back" onclick="goBack('${escapeHtml(fallbackBack)}')" aria-label="Back">${svg('arrow-left')}</button>
      <div>
        <h1>${title}</h1>
        ${subtitle ? `<p class="screen-sub">${subtitle}</p>` : ''}
      </div>
    </div>
    ${rightHtml ? `<div>${rightHtml}</div>` : ''}
  </div>`;
}

function toast(text) {
  const el = document.querySelector('#toast');
  if (!el) return;
  el.textContent = text;
  el.style.display = 'block';
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3400);
}

function fireDemoSettlementAlert(rec, req) {
  const bodyText = `Payment received from ${rec.name} · ${cents(rec.amountCents, rec.currency, true)}`;
  toast(bodyText);
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('AI · Payment received', {
        body: bodyText + (req?.title ? ` (${req.title})` : ''),
        tag: `splitsync-settled-${rec.id}`,
      });
    }
  } catch {}
}

async function api(path, body, timeoutMs = 28000, signal = undefined) {
  let response;
  const combinedSignal = signal ? AbortSignal.any([AbortSignal.timeout(timeoutMs), signal]) : AbortSignal.timeout(timeoutMs);
  try {
    response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: combinedSignal,
    });
  } catch (err) {
    if (err?.name === 'AbortError' && signal?.aborted) throw err;
    throw Object.assign(new Error('Could not reach the backend server. Check that Node is running on this origin.'), { status: 0, network: true, cause: err });
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'Request failed.'), { status: response.status });
  return data;
}

/** Downscales oversized receipt photos in the browser so uploads stay well below serverless body limits. */
async function compressReceiptDataUrl(dataUrl, maxDim = 1600) {
  if (typeof Image !== 'function' || typeof document?.createElement !== 'function') return dataUrl;
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/') || dataUrl.length <= 1200000) return dataUrl;
  return await new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
      const w = Math.max(1, Math.round((img.width || 1) * scale));
      const h = Math.max(1, Math.round((img.height || 1) * scale));
      const canvas = document.createElement('canvas');
      if (!canvas?.getContext) { resolve(dataUrl); return; }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function extractReceipt(imageDataUrl) {
  const prepared = await compressReceiptDataUrl(imageDataUrl);
  try {
    return await api('/api/organizer/extract-bill', { imageDataUrl: prepared }, 45000);
  } catch (error) {
    if (error.status === 503) {
      throw new Error('Automatic receipt scanning is unavailable: NVIDIA_API_KEY is not configured on the backend.');
    }
    if ([0, 404, 405].includes(error.status)) {
      throw new Error('Automatic receipt scanning is unavailable (backend API route not reachable on this host).');
    }
    if ([401, 403].includes(error.status)) {
      throw new Error(`Automatic receipt scanning is unavailable (${error.message || 'authorization failed'}).`);
    }
    throw error;
  }
}

// ---------- Navigation & Stream Lifecycle ----------
function stopStreams() {
  scanEpoch++;
  if (activeStream) { activeStream.getTracks().forEach(t => t.stop()); activeStream = null; }
  if (billStream) { billStream.getTracks().forEach(t => t.stop()); billStream = null; }
}

function cancelAskSpeech() {
  ttsEpoch += 1;
  clearTimeout(pendingSendTransitionTimer);
  pendingSendTransitionTimer = null;
  try { ttsAbortCtrl?.abort(); } catch {}
  ttsAbortCtrl = null;
  if (activeAudioEl) {
    try { activeAudioEl.pause(); activeAudioEl.currentTime = 0; } catch {}
    activeAudioEl = null;
  }
  if (askAudioState === 'loading' || askAudioState === 'playing') {
    askAudioState = askAudioSrc ? 'ready' : 'idle';
  }
}

function go(route) {
  const currentTab = (location.hash || '#home').slice(1).split('/')[0] || 'home';
  if (['home', 'activity', 'store', 'profile'].includes(currentTab) && typeof window.scrollY === 'number') {
    tabScrollY[currentTab] = window.scrollY;
  }
  if (!['ask', 'talk'].includes(route.split('/')[0])) cancelAskSpeech();
  const prevTop = navStack[navStack.length - 1];
  if (prevTop !== route) {
    navStack.push(route);
    if (navStack.length > 30) navStack = navStack.slice(-30);
    routeTransitionPending = true;
  }
  location.hash = '#' + route;
}

function goBack(fallbackRoute = 'home') {
  const current = (location.hash || '#home').slice(1);
  if (navStack.length > 1) {
    navStack.pop();
    const parent = navStack[navStack.length - 1];
    if (parent && parent !== current) {
      routeTransitionPending = true;
      location.hash = '#' + parent;
      return;
    }
  }
  navStack = [fallbackRoute];
  routeTransitionPending = true;
  location.hash = '#' + fallbackRoute;
}

// ---------- Workspace Sync & Staggered Settlement ----------
function reconcileLocalDemoSettlements() {
  const newlySettled = [];
  const now = Date.now();
  for (const req of reimbursementsList) {
    for (const r of req.recipients || []) {
      if (r.status === 'Waiting for payment' && Number.isFinite(r.settleAt) && now >= r.settleAt) {
        r.status = 'Paid';
        r.demoSettled = true;
        r.settledAt ||= new Date(r.settleAt).toISOString();
        r.receiptRef ||= 'DEMO-' + Math.random().toString(16).slice(2, 6).toUpperCase();
        newlySettled.push({ rec: r, req });
      }
    }
  }
  if (newlySettled.length) saveLocalState();
  return newlySettled;
}

function processNewlySettledAlerts(prevList, nextList) {
  const prevPaid = new Set();
  for (const req of prevList) for (const r of req.recipients || []) if (r.status === 'Paid') prevPaid.add(r.id);
  for (const req of nextList) {
    for (const r of req.recipients || []) {
      if (r.status === 'Paid' && r.demoSettled && !prevPaid.has(r.id) && !notifiedSettlementIds.has(r.id)) {
        notifiedSettlementIds.add(r.id);
        justSettledIds.add(req.id);
        persistNotifiedIds();
        fireDemoSettlementAlert(r, req);
      }
    }
  }
}

function scheduleSettlementTicker() {
  clearTimeout(settleTimerId);
  const now = Date.now();
  let earliest = Infinity;
  for (const req of reimbursementsList) {
    for (const r of req.recipients || []) {
      if (r.status === 'Waiting for payment' && Number.isFinite(r.settleAt)) {
        earliest = Math.min(earliest, r.settleAt);
      }
    }
  }
  if (!Number.isFinite(earliest)) return;
  const delay = Math.max(150, Math.min(60000, earliest - now + 120));
  settleTimerId = setTimeout(async () => {
    const snapshot = JSON.parse(JSON.stringify(reimbursementsList));
    if (backendMode && ledger) {
      try { await loadWorkspaceState(); } catch {}
    } else {
      reconcileLocalDemoSettlements();
    }
    processNewlySettledAlerts(snapshot, reimbursementsList);
    render();
  }, delay);
}

async function detectBackend() {
  try {
    const r = await fetch('/api/health', { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return false;
    const data = await r.json();
    if (data.mode === 'sandbox') {
      backendMode = true;
      paypalConfigured = Boolean(data.configured);
      providers = { ...providers, ...data, paypalConfigured: Boolean(data.configured) };
      const hash = typeof location !== 'undefined' ? (location.hash || '') : '';
      if (data.localOrganizerAutoLogin && !manualDisconnect && !/^#(?:pay|req)\//i.test(hash) && !ledger) {
        try {
          await loadWorkspaceState();
          staticPreviewMode = false;
        } catch {}
      }
      return true;
    }
  } catch {}
  backendMode = false;
  return false;
}

async function reconnectEnvSession() {
  manualDisconnect = false;
  const ok = await detectBackend();
  if (ok && ledger) {
    toast('Connected via server .env organizer session.');
    render();
    return;
  }
  toast('Could not auto-connect .env session. Enter key manually.');
  go('welcome');
}

async function loadWorkspaceState() {
  const prevReimbs = JSON.parse(JSON.stringify(reimbursementsList));
  const data = await api('/api/organizer/state');
  applyFxRates(data.fxRates, data.fxRateDate);
  ledger = data.purchase;
  if (Array.isArray(data.contacts)) contactsList = data.contacts;
  if (Array.isArray(data.reimbursements)) reimbursementsList = data.reimbursements;
  if (Array.isArray(data.demoTransactions)) demoTransactions = data.demoTransactions;
  if ('savedRentRule' in data) savedRentRule = data.savedRentRule;
  if (data.providers) providers = { ...providers, ...data.providers };
  lamp = ledger.lamp;
  published = ledger.published;
  if (published || ledger.participants.some(p => p.orders?.length || p.status !== 'Awaiting payment')) {
    ss001Active = true;
  }
  processNewlySettledAlerts(prevReimbs, reimbursementsList);
  return data;
}

// ---------- Auth / Welcome ----------
function authView() {
  return `<div class="auth-shell">
    <section class="auth-hero">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <span class="brand-mark sm" aria-hidden="true">${svg('send-req')}</span>
          <b style="font-size:17px">AI</b>
        </div>
        ${badge(backendMode ? 'Demo mode · Sandbox connected' : 'Demo preview', 'navy')}
        <h1 style="margin-top:14px">Send, request, and split shared bills.</h1>
        <p style="margin-top:8px">Send across borders with instant demo rates, talk or scan bills in Ask AI, and track settlements cleanly.</p>
      </div>
      <div>
        <div class="auth-feature">${svg('qr')}<div><b>Scan &amp; Pay + International Sends</b><small>Pay Demo Merchant Sandbox QR links or send demo transfers worldwide.</small></div></div>
        <div class="auth-feature">${svg('mic')}<div><b>Ask AI Assistant</b><small>Speak, type, or attach a receipt and confirm details by voice.</small></div></div>
        <div class="auth-feature">${svg('bag')}<div><b>AI Store</b><small>Browse sample household items, build a shared cart, and optionally split.</small></div></div>
      </div>
    </section>

    <section class="card">
      <h2>Connect organizer workspace</h2>
      <p style="margin-top:6px">Enter the organizer key from your Node terminal to unlock server AI, Chatterbox speech, and Sandbox persistence.</p>
      ${authErrorMessage ? `<div class="callout error" role="alert">${svg('alert')}<div><b>${authErrorKind === 'invalid' ? 'Invalid organizer key' : 'Backend unavailable'}</b><br>${escapeHtml(authErrorMessage)}</div></div>` : ''}
      <form onsubmit="event.preventDefault(); signInOrganizer()">
        <div class="field-group">
          <label for="organizer-key">Organizer access key</label>
          <div class="input-wrap">
            <input id="organizer-key" type="password" value="${escapeHtml(organizerKeyDraft)}" oninput="organizerKeyDraft = this.value" placeholder="Paste organizer key from terminal" autocomplete="off" required>
            <button type="button" class="input-action" onclick="toggleKeyVis(this)">Show</button>
          </div>
        </div>
        <div class="actions">
          <button type="submit" class="btn btn-primary full" ${authBusy ? 'disabled' : ''}><span>${authBusy ? 'Connecting…' : 'Connect workspace'}</span>${svg('arrow-right')}</button>
        </div>
      </form>
      <div class="rule"></div>
      <button type="button" class="link-coral" onclick="enterStaticPreview()">Continue in Demo preview (offline)</button>
    </section>
  </div>`;
}

function toggleKeyVis(btn) {
  const el = document.querySelector('#organizer-key');
  if (!el) return;
  const show = el.type === 'password';
  el.type = show ? 'text' : 'password';
  btn.textContent = show ? 'Hide' : 'Show';
}

async function signInOrganizer() {
  const input = document.querySelector('#organizer-key');
  const key = (input?.value || organizerKeyDraft).trim();
  organizerKeyDraft = key;
  if (!key) { authErrorKind = 'invalid'; authErrorMessage = 'Enter the organizer access key from the Node terminal.'; render(); return; }
  authBusy = true; authErrorKind = ''; authErrorMessage = ''; manualDisconnect = false; render();
  try {
    const ok = await detectBackend();
    if (!ok) { authErrorKind = 'unavailable'; authErrorMessage = 'Local Node server did not respond on /api/health.'; authBusy = false; render(); return; }
    await api('/api/organizer/session', { token: key });
    await loadWorkspaceState();
    staticPreviewMode = false; organizerKeyDraft = ''; authBusy = false;
    go('home');
  } catch (e) {
    authBusy = false; authErrorKind = e.status === 401 ? 'invalid' : 'unavailable'; authErrorMessage = e.message; render();
  }
}

async function signOutOrganizer() {
  manualDisconnect = true;
  if (backendMode) { try { await api('/api/organizer/logout', {}); } catch {} }
  ledger = null;
  staticPreviewMode = true;
  contactsList = loadContactsFromStorage();
  reimbursementsList = JSON.parse(localStorage.getItem('splitsync-reimbursements') || '[]');
  demoTransactions = JSON.parse(localStorage.getItem('splitsync-demo-tx') || '[]');
  savedRentRule = JSON.parse(localStorage.getItem('splitsync-rent-rule') || 'null');
  savedElectricRule = JSON.parse(localStorage.getItem('splitsync-electric-rule') || 'null');
  ss001Active = localStorage.getItem('splitsync-ss001-active') === 'true';
  published = localStorage.getItem('splitsync-published') === 'true';
  lamp = localStorage.getItem('splitsync-lamp') || 'Maya';
  go('profile');
}

function enterStaticPreview() {
  staticPreviewMode = true; authErrorKind = ''; authErrorMessage = ''; go('home'); render();
}

async function resetDemoSession() {
  clearTimeout(settleTimerId);
  notifiedSettlementIds.clear();
  justSettledIds.clear();
  cancelAskSpeech();
  if (backendMode && ledger) {
    try { await api('/api/organizer/reset-demo', {}); await loadWorkspaceState(); } catch (e) { toast(e.message); go('profile'); return; }
  }
  demoTransactions = [];
  if (!ledger) {
    reimbursementsList = [];
    ss001Active = false;
    published = false;
    lamp = 'Maya';
  }
  savedRentRule = null;
  savedElectricRule = null;
  localStorage.removeItem('splitsync-reimbursements');
  localStorage.removeItem('splitsync-demo-tx');
  localStorage.removeItem('splitsync-rent-rule');
  localStorage.removeItem('splitsync-electric-rule');
  localStorage.removeItem('splitsync-ss001-active');
  localStorage.removeItem('splitsync-published');
  localStorage.removeItem('splitsync-cart');
  localStorage.removeItem('splitsync-notified-ids');
  localStorage.removeItem('splitsync-wallet-cents');
  localStorage.removeItem('splitsync-card-idx');
  walletBalanceCents = 24500;
  activeCardIdx = 0;
  paymentSource = 'wallet';
  helpHistory = [];
  helpComposerText = '';
  sharedCart = [];
  chatHistory = []; chatDraft = null; chatAttachedBill = null; chatAttachedImg = ''; chatAttachedRawImg = ''; askComposerText = '';
  billRawImage = ''; billCroppedImage = ''; billDraft = null; billRecipientIds = [];
  transferForm = { contactId: '', amountStr: '', enteredSide: 'send', sourceCurrency: 'USD', targetCurrency: 'GBP', note: '', clientTxId: '', busy: false, error: '', reviewSourceCents: 0, reviewTargetCents: 0, reviewRate: 0, reviewRateDate: fxRateDate, returnParent: 'send' };
  manualReqForm = { multi: false, contactId: '', contactIds: [], amountStr: '', currency: 'USD', note: '', channel: 'demo', busy: false, error: '', clientRequestId: '', review: null };
  rentForm = { creating: false, contactIds: [], amountStr: '', currency: 'USD', dueDate: '', mode: 'equal', customAmounts: {}, saveRule: false, busy: false, error: '', review: false, clientRequestId: '' };
  electricityForm = { creating: false, provider: '', contactIds: [], amountStr: '', currency: 'USD', dueDate: '', mode: 'equal', customAmounts: {}, saveRule: false, busy: false, error: '', review: false, clientRequestId: '' };
  scannerState = 'ready'; scannerMessage = ''; pastedLinkDraft = '';
  navStack = ['home'];
  toast('Clean demo session ready.');
  go('home');
}

// ---------- Shared Data Helpers ----------
function activeSsShares() {
  const l = draftLamp || ledger?.lamp || lamp;
  if (ledger && !draftLamp) return Object.fromEntries(ledger.participants.map(p => [p.name, p.amountCents / 100]));
  return { Maya: 40 + (l === 'Maya' ? 30 : 0), Arun: 40 + (l === 'Arun' ? 30 : 0), Leah: 40 + (l === 'Leah' ? 30 : 0) };
}
function ssStatus(n) {
  if (ledger) return ledger.participants.find(p => p.name === n)?.status || 'Awaiting payment';
  return 'Awaiting payment';
}

function buildUnifiedActivity() {
  const rows = [];
  for (const tx of demoTransactions) {
    const isStore = tx.type === 'store-demo';
    const isRecharge = tx.type === 'wallet-recharge';
    const contact = contactsList.find(c => c.id === tx.contactId || c.name === tx.recipientName);
    rows.push({
      id: tx.id,
      kind: isRecharge ? 'recharge' : (isStore ? 'store' : 'transfer'),
      direction: isRecharge ? 'Incoming' : 'Sent',
      contact,
      counterparty: tx.recipientName,
      title: isRecharge ? 'Wallet recharge' : (isStore ? `Store order · ${tx.recipientName}` : `Sent to ${tx.recipientName}`),
      subtitle: tx.note || (isRecharge ? 'PayPal Wallet top-up' : 'Demo transfer'),
      date: (tx.createdAt || '').slice(0, 10) || 'Today',
      primaryAmount: cents(tx.sourceAmountCents, tx.sourceCurrency, true),
      secondaryAmount: tx.sourceCurrency !== tx.targetCurrency ? `→ ${cents(tx.targetAmountCents, tx.targetCurrency, true)}` : '',
      status: 'Completed',
      filterBucket: isRecharge ? 'Payment received' : 'Sent',
      route: `tx/${tx.id}`,
      sortTs: Date.parse(tx.createdAt || '') || Date.now(),
    });
  }
  for (const req of reimbursementsList) {
    const recs = req.recipients || [];
    const paidCount = recs.filter(r => r.status === 'Paid').length;
    const waitCount = recs.filter(r => r.status === 'Waiting for payment').length;
    const curr = req.currency || recs[0]?.currency || 'USD';
    const totalReq = totalInCurrency(recs, curr);
    const owed = totalInCurrency(recs.filter(r => r.status !== 'Paid'), curr);
    let aggStatus = 'Created';
    if (recs.length && paidCount === recs.length) aggStatus = recs.some(r => r.demoSettled) ? 'Payment received' : 'Paid';
    else if (waitCount > 0) aggStatus = 'Waiting for payment';
    else if (recs.some(r => r.status === 'Sent')) aggStatus = 'Sent';
    const namesSummary = recs.map(r => r.name).join(', ');
    const receivedBanner = paidCount > 0 && recs.length === 1 && recs[0].demoSettled
      ? `Payment received from ${recs[0].name}`
      : (paidCount > 0 && paidCount < recs.length ? `${paidCount}/${recs.length} received · ${cents(owed, curr, true)} waiting` : `${recs.length} recipient${recs.length === 1 ? '' : 's'} · ${req.kind === 'rent' ? 'Rent' : req.kind === 'electricity' ? 'Electricity' : 'Request'}`);
    rows.push({
      id: req.id,
      kind: req.kind || 'request',
      direction: 'Receiving',
      contact: contactsList.find(c => c.name === recs[0]?.name),
      counterparty: namesSummary || req.merchant || req.title,
      title: req.title || req.merchant || 'Request',
      subtitle: receivedBanner,
      date: (req.createdAt || '').slice(0, 10) || 'Today',
      primaryAmount: cents(totalReq, curr, true),
      secondaryAmount: paidCount > 0 && owed > 0 ? `${cents(totalReq - owed, curr, true)} collected` : '',
      status: aggStatus,
      filterBucket: aggStatus === 'Payment received' || aggStatus === 'Paid' ? 'Payment received' : 'Awaiting payment',
      route: `request/${req.id}`,
      sortTs: Date.parse(req.createdAt || '') || Date.now(),
      flash: justSettledIds.has(req.id),
    });
  }
  if (ss001Active) {
    const paidC = names.filter(n => ssStatus(n) === 'Paid').length;
    const status = paidC === 3 ? 'Paid' : names.some(n => ssStatus(n) === 'Processing') ? 'Processing' : 'Awaiting payment';
    rows.push({
      id: 'SS-001',
      kind: 'sandbox',
      direction: 'Merchant',
      counterparty: 'Demo Merchant · SS-001',
      title: 'Move-in essentials (SS-001)',
      subtitle: `PayPal Sandbox · ${paidC}/3 paid`,
      date: 'Sandbox',
      primaryAmount: '$150.00 USD',
      secondaryAmount: '',
      status,
      filterBucket: 'Sandbox',
      route: 'dashboard',
      sortTs: 0,
    });
  }
  return rows.sort((a, b) => b.sortTs - a.sortTs);
}

function waitingRequestsSummary() {
  let pendingPeople = 0;
  let awaitingUsdCents = 0;
  let collectedUsdCents = 0;
  let latestPendingReq = null;
  for (const req of reimbursementsList) {
    for (const r of req.recipients || []) {
      const usdCents = convertCents(r.amountCents, r.currency || req.currency || 'USD', 'USD');
      if (r.status === 'Waiting for payment' || r.status === 'Sent' || r.status === 'Created') {
        pendingPeople++;
        awaitingUsdCents += usdCents;
        latestPendingReq ||= req;
      } else if (r.status === 'Paid') {
        collectedUsdCents += usdCents;
      }
    }
  }
  return { pendingPeople, awaitingUsdCents, collectedUsdCents, latestPendingReq };
}

const WALLET_CARDS = [
  { id: 'pp-balance', brand: 'PayPal Wallet', title: 'PayPal Balance Card', last4: '4829', badge: 'Primary · USD' },
  { id: 'pp-cashback', brand: 'Mastercard', title: 'PayPal Cashback', last4: '9104', badge: '3% Cashback' },
  { id: 'pp-travel', brand: 'PayPal Global', title: 'Multi-Currency Travel', last4: '3318', badge: 'USD · GBP · EUR' },
];

function shuffleWalletCard() {
  activeCardIdx = (activeCardIdx + 1) % WALLET_CARDS.length;
  localStorage.setItem('splitsync-card-idx', String(activeCardIdx));
  if (cards3dController?.update) cards3dController.update(activeCardIdx, walletBalanceCents);
  render();
}

function selectWalletCard(i) {
  activeCardIdx = ((Number(i) || 0) % WALLET_CARDS.length + WALLET_CARDS.length) % WALLET_CARDS.length;
  localStorage.setItem('splitsync-card-idx', String(activeCardIdx));
  if (cards3dController?.update) cards3dController.update(activeCardIdx, walletBalanceCents);
  render();
}

function openRechargeModal() { rechargeModalOpen = true; render(); }
function closeRechargeModal() { rechargeModalOpen = false; render(); }

function confirmRechargeWallet() {
  const amtCents = parseMajorToCents(rechargeAmountStr, 'USD');
  if (amtCents <= 0) { toast('Enter a positive USD recharge amount.'); return; }
  walletBalanceCents += amtCents;
  const tx = {
    id: 'RCH-' + Math.random().toString(16).slice(2, 8).toUpperCase(),
    clientTxId: 'rch-' + Date.now().toString(36),
    type: 'wallet-recharge',
    direction: 'incoming',
    recipientName: 'PayPal Wallet',
    sourceAmountCents: amtCents,
    sourceCurrency: 'USD',
    targetAmountCents: amtCents,
    targetCurrency: 'USD',
    fundingSource: 'Linked Card •••• 9104',
    note: 'Wallet recharge',
    status: 'Completed',
    demo: true,
    createdAt: new Date().toISOString(),
  };
  demoTransactions.unshift(tx);
  saveLocalState();
  if (cards3dController?.update) cards3dController.update(activeCardIdx, walletBalanceCents);
  rechargeModalOpen = false;
  toast(`Added ${cents(amtCents, 'USD', true)} to PayPal Wallet.`);
  render();
}

function renderRechargeModal() {
  if (!rechargeModalOpen) return '';
  const amtCents = parseMajorToCents(rechargeAmountStr, 'USD');
  return `<div class="recharge-modal-backdrop" role="dialog" aria-modal="true" aria-label="Recharge PayPal Wallet" onclick="if(event.target===this)closeRechargeModal()">
    <div class="recharge-modal">
      <div class="section-title"><h2>Recharge PayPal Wallet</h2><button type="button" class="btn-ghost-sm" onclick="closeRechargeModal()">Close</button></div>
      <p class="sub" style="margin-top:4px">Current balance: <b class="money">${cents(walletBalanceCents, 'USD', true)}</b></p>
      <div class="chip-row" style="margin-top:12px">
        ${[2500, 5000, 10000, 25000].map(a => `<button type="button" class="chip ${amtCents === a ? 'selected' : ''}" onclick="rechargeAmountStr='${(a / 100).toFixed(2)}'; render()">+$${a / 100}</button>`).join('')}
      </div>
      <div class="field-group">
        <label for="recharge-amt-input">Top-up amount (USD)</label>
        <input id="recharge-amt-input" type="number" min="1" step="0.01" value="${escapeHtml(rechargeAmountStr)}" oninput="rechargeAmountStr = this.value; render()">
      </div>
      <div class="actions">
        <button type="button" class="btn btn-primary full" onclick="confirmRechargeWallet()" ${amtCents <= 0 ? 'disabled' : ''}>${amtCents > 0 ? 'Add from Linked Card' : 'Enter amount'}</button>
      </div>
    </div>
  </div>`;
}

function canFundWithSource(requiredUsdCents) {
  return paymentSource !== 'wallet' || walletBalanceCents >= (Number(requiredUsdCents) || 0);
}

function deductWalletIfSelected(requiredUsdCents) {
  if (paymentSource === 'wallet' && requiredUsdCents > 0) {
    walletBalanceCents = Math.max(0, walletBalanceCents - requiredUsdCents);
    localStorage.setItem('splitsync-wallet-cents', String(walletBalanceCents));
    if (cards3dController?.update) cards3dController.update(activeCardIdx, walletBalanceCents);
  }
}

function currentFundingLabel() {
  return paymentSource === 'wallet' ? 'PayPal Wallet' : 'PayPal Cashback •••• 9104';
}

function renderPaymentSourceSelector(requiredUsdCents) {
  const walletSel = paymentSource === 'wallet';
  const shortCents = Math.max(0, (Number(requiredUsdCents) || 0) - walletBalanceCents);
  return `<div class="payment-source-grid" role="group" aria-label="Payment method">
    <button type="button" class="payment-source-opt" aria-pressed="${walletSel}" onclick="paymentSource='wallet'; render()">
      <div><b>PayPal Wallet</b><br><small class="sub">Available ${cents(walletBalanceCents, 'USD', true)}</small></div>
      <b>${walletSel ? 'Selected' : 'Use'}</b>
    </button>
    <button type="button" class="payment-source-opt" aria-pressed="${!walletSel}" onclick="paymentSource='card'; render()">
      <div><b>PayPal Cashback •••• 9104</b><br><small class="sub">Linked demo card · Instant backup</small></div>
      <b>${!walletSel ? 'Selected' : 'Use'}</b>
    </button>
    ${walletSel && shortCents > 0 ? `<div class="callout warning" style="margin-top:4px">${svg('alert')}<div>Wallet balance is ${cents(shortCents, 'USD', true)} short. <button type="button" class="btn-ghost-sm" style="margin-left:6px" onclick="openRechargeModal()">Recharge Wallet</button></div></div>` : ''}
  </div>`;
}

// ---------- Home (Immediate Payment Utility + 3D Cards + Quick Contacts + Activity + Bills + Store + Bottom QR) ----------
function homeScreen() {
  const items = buildUnifiedActivity();
  const quickContacts = contactsList.filter(c => c.id !== 'leah').slice(0, 5);
  const wait = waitingRequestsSummary();
  const storeSample = storeCatalog.slice(0, 4);
  const activeCard = WALLET_CARDS[activeCardIdx] || WALLET_CARDS[0];

  return `<div class="home-compact-head">
    <div>
      <h1>Hello, Leah</h1>
    </div>
    <button id="profile-avatar-btn" type="button" class="leah-avatar-btn" onclick="go('profile')" aria-label="Profile">
      <span class="leah-avatar-inner">L</span>
    </button>
  </div>

  <section aria-label="Primary payment actions">
    <div class="action-quad">
      <button type="button" class="action-tile primary" onclick="openScanPay()">
        <span class="tile-ico">${svg('qr')}</span>
        <b>Scan &amp; Pay</b>
      </button>
      <button type="button" class="action-tile" onclick="openSendMoney()">
        <span class="tile-ico">${svg('send-out')}</span>
        <b>Send Money</b>
      </button>
      <button type="button" class="action-tile" onclick="openManualRequest()">
        <span class="tile-ico">${svg('send-req')}</span>
        <b>Request Money</b>
      </button>
      <button type="button" class="action-tile" onclick="openScanBillEntry()">
        <span class="tile-ico">${svg('receipt')}</span>
        <b>Split a Bill</b>
      </button>
    </div>
  </section>

  <section class="card wallet-card" style="margin-top:14px;margin-bottom:14px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div>
        <small class="sub" style="font-weight:800">PayPal Wallet</small>
        <div id="home-wallet-balance" class="money" style="font-size:24px;font-weight:800;margin-top:2px">${cents(walletBalanceCents, 'USD', true)}</div>
      </div>
      <button id="recharge-wallet-btn" type="button" class="btn btn-primary" style="min-height:42px;padding:8px 14px" onclick="openRechargeModal()">${svg('plus')}<span>Recharge</span></button>
    </div>
    <div id="wallet-3d-stage" class="wallet-3d-stage" onclick="shuffleWalletCard()" title="Tap to shuffle cards">
      <canvas id="wallet-3d-canvas" aria-label="Interactive 3D PayPal credit card stack"></canvas>
      <div class="cards-fallback-stage">
        <div class="fallback-card" data-card="${activeCardIdx}">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="badge navy" style="background:rgba(255,255,255,0.16);color:#fff">${escapeHtml(activeCard.brand)}</span>
            <small style="opacity:.85;font-weight:700">${escapeHtml(activeCard.badge)}</small>
          </div>
          <div>
            <div style="font-size:12px;opacity:.85">${escapeHtml(activeCard.title)}</div>
            <div style="font-size:17px;font-weight:800;letter-spacing:1.2px;margin-top:2px">•••• •••• •••• ${escapeHtml(activeCard.last4)}</div>
          </div>
        </div>
      </div>
    </div>
    <div class="wallet-deck-footer">
      <div class="deck-dots">${WALLET_CARDS.map((c, i) => `<button type="button" class="deck-dot ${i === activeCardIdx ? 'active' : ''}" onclick="event.stopPropagation(); selectWalletCard(${i})" aria-label="Select ${escapeHtml(c.title)}"></button>`).join('')}</div>
      <small class="sub">${escapeHtml(activeCard.title)} · •••• ${escapeHtml(activeCard.last4)}</small>
      <button id="shuffle-card-btn" type="button" class="btn-ghost-sm" onclick="shuffleWalletCard()">${svg('swap')}<span>Shuffle card</span></button>
    </div>
  </section>

  <h2 style="margin-top:16px">Quick contacts</h2>
  <div class="contact-strip" style="margin-top:8px" aria-label="Quick contacts">
    ${quickContacts.map(c => `<button type="button" class="contact-pill" onclick="openSendMoney('${escapeHtml(c.id)}')">
      ${contactAvatarHtml(c, true)}
      <span>${escapeHtml(c.name)}</span>
      <small class="sub">${escapeHtml(c.currency)}</small>
    </button>`).join('')}
  </div>

  ${wait.pendingPeople > 0 ? `<div class="awaiting-card ${justSettledIds.size ? 'settled' : ''}" role="region" aria-label="Requests awaiting payment">
    <div class="section-title" style="margin-bottom:4px">
      <h2>Requests awaiting payment</h2>
      <b class="money" style="color:var(--amber)">${cents(wait.awaitingUsdCents, 'USD', true)}</b>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <small class="sub">${wait.pendingPeople} pending share${wait.pendingPeople === 1 ? '' : 's'} · ${cents(wait.collectedUsdCents, 'USD', true)} collected</small>
      ${wait.latestPendingReq ? `<button type="button" class="btn-ghost-sm" onclick="go('request/${escapeHtml(wait.latestPendingReq.id)}')">View receiving</button>` : ''}
    </div>
  </div>` : ''}

  <section class="card" style="margin-bottom:14px">
    <div class="section-title" style="margin-bottom:8px">
      <h2>Recent transactions</h2>
      <a class="section-link" href="#activity" onclick="event.preventDefault(); go('activity')">See all ${svg('arrow-right')}</a>
    </div>
    ${items.length === 0
      ? `<p class="sub">No activity yet. Tap a contact above, Scan &amp; Pay, or Request Money.</p>`
      : items.slice(0, 3).map(it => `<div class="row ${it.flash ? 'settled-flash' : ''}" style="cursor:pointer" onclick="go('${escapeHtml(it.route)}')">
          ${it.contact ? contactAvatarHtml(it.contact, true) : `<span class="icon-box" style="width:36px;height:36px">${svg(it.kind === 'sandbox' ? 'store' : it.kind === 'electricity' ? 'bolt' : it.kind === 'rent' ? 'calendar' : 'receipt')}</span>`}
          <div class="grow">
            <b>${escapeHtml(it.title)}</b><br>
            <small class="sub">${escapeHtml(it.direction)} · ${escapeHtml(it.subtitle)}</small>
          </div>
          <div style="text-align:right">
            <b class="money">${escapeHtml(it.primaryAmount)}</b>
            ${it.secondaryAmount ? `<div><small class="sub">${escapeHtml(it.secondaryAmount)}</small></div>` : ''}
            <div style="margin-top:3px">${pill(it.status)}</div>
          </div>
        </div>`).join('')}
  </section>

  <div class="section-title" style="margin-bottom:8px">
    <h2>Bills &amp; household</h2>
  </div>
  <div class="home-section-grid">
    <button type="button" class="bill-action-btn" onclick="openElectricityFlow()">
      <span class="icon-box">${svg('bolt')}</span>
      <span><b>Electricity</b><small>Blank bill split</small></span>
    </button>
    <button type="button" class="bill-action-btn" onclick="openRentFlow()">
      <span class="icon-box">${svg('calendar')}</span>
      <span><b>Rent</b><small>Monthly split</small></span>
    </button>
    <button type="button" class="bill-action-btn" onclick="openScanBillEntry()">
      <span class="icon-box">${svg('receipt-camera')}</span>
      <span><b>Scan a Bill</b><small>Receipt OCR</small></span>
    </button>
    <button type="button" class="bill-action-btn" onclick="openAskSplitSync()">
      <span class="icon-box">${svg('sparkles')}</span>
      <span><b>Split a Bill</b><small>AI assistant</small></span>
    </button>
  </div>

  <section class="card" style="margin-top:14px" aria-label="Home Store showcase">
    <div class="section-title" style="margin-bottom:12px">
      <h2>Store</h2>
      <a class="section-link" href="#store" onclick="event.preventDefault(); go('store')">Browse Store ${svg('arrow-right')}</a>
    </div>
    ${storeSample.length >= 4 ? `<div class="store-bento">
      <button type="button" class="store-bento-card store-bento-big" id="home-store-card-0" onclick="openProductDetail('${escapeHtml(storeSample[0].id)}')" aria-label="${escapeHtml(storeSample[0].name)}" title="${escapeHtml(storeSample[0].name)}">
        <img src="${escapeHtml(storeSample[0].img)}" alt="${escapeHtml(storeSample[0].name)}">
      </button>
      <button type="button" class="store-bento-card store-bento-tr" id="home-store-card-1" onclick="openProductDetail('${escapeHtml(storeSample[1].id)}')" aria-label="${escapeHtml(storeSample[1].name)}" title="${escapeHtml(storeSample[1].name)}">
        <img src="${escapeHtml(storeSample[1].img)}" alt="${escapeHtml(storeSample[1].name)}">
      </button>
      <div class="store-bento-br">
        <button type="button" class="store-bento-card store-bento-sm" id="home-store-card-2" onclick="openProductDetail('${escapeHtml(storeSample[2].id)}')" aria-label="${escapeHtml(storeSample[2].name)}" title="${escapeHtml(storeSample[2].name)}">
          <img src="${escapeHtml(storeSample[2].img)}" alt="${escapeHtml(storeSample[2].name)}">
        </button>
        <button type="button" class="store-bento-card store-bento-sm" id="home-store-card-3" onclick="openProductDetail('${escapeHtml(storeSample[3].id)}')" aria-label="${escapeHtml(storeSample[3].name)}" title="${escapeHtml(storeSample[3].name)}">
          <img src="${escapeHtml(storeSample[3].img)}" alt="${escapeHtml(storeSample[3].name)}">
        </button>
      </div>
    </div>` : ''}
  </section>

  <section class="card" style="margin-top:14px;text-align:center" aria-label="Home Receive Money QR">
    <div class="section-title" style="margin-bottom:14px">
      <h2>Receive Money QR</h2>
    </div>
    <div style="display:flex;justify-content:center">
      <div id="home-receive-qr" class="qr-box qr-box-lg" aria-label="Leah receive QR code"></div>
    </div>
    <div><span class="leah-handle-pill">leah@paypal</span></div>
  </section>`;
}

// ---------- Send Money + Bidirectional FX + Editable Review + Receipt ----------
function computeTransferQuote() {
  const rawCents = parseMajorToCents(transferForm.amountStr, transferForm.enteredSide === 'receive' ? transferForm.targetCurrency : transferForm.sourceCurrency);
  return fxQuote(rawCents, transferForm.sourceCurrency, transferForm.targetCurrency, transferForm.enteredSide);
}

function setTransferSide(side) {
  const prevQ = computeTransferQuote();
  transferForm.enteredSide = side;
  const activeCents = side === 'receive' ? prevQ.targetAmountCents : prevQ.sourceAmountCents;
  const activeCurr = side === 'receive' ? transferForm.targetCurrency : transferForm.sourceCurrency;
  if (activeCents > 0) {
    transferForm.amountStr = formatCentsInput(activeCents, activeCurr);
  }
  render();
}

function openSendMoney(contactId = '') {
  contactSearch = '';
  const c = contactsList.find(x => x.id === contactId);
  transferForm = {
    contactId: c?.id || '',
    amountStr: '',
    enteredSide: 'send',
    sourceCurrency: 'USD',
    targetCurrency: c?.currency || 'USD',
    note: '',
    clientTxId: `tx-${Date.now().toString(36)}`,
    busy: false,
    error: '',
    reviewSourceCents: 0,
    reviewTargetCents: 0,
    reviewRate: 0,
    reviewRateDate: fxRateDate,
    returnParent: 'send',
  };
  go('send');
}

function selectSendContact(id) {
  const c = contactsList.find(x => x.id === id);
  if (!c) return;
  transferForm.contactId = c.id;
  transferForm.targetCurrency = c.currency || 'USD';
  transferForm.error = '';
  render();
}

function sendMoneyScreen() {
  const filtered = contactsList.filter(c => c.id !== 'leah' && (!contactSearch.trim() || `${c.name} ${c.country} ${c.currency}`.toLowerCase().includes(contactSearch.trim().toLowerCase())));
  const selected = contactsList.find(c => c.id === transferForm.contactId);
  const quote = computeTransferQuote();
  const activeCurr = transferForm.enteredSide === 'receive' ? transferForm.targetCurrency : transferForm.sourceCurrency;
  const activeStep = decimalsFor(activeCurr) === 0 ? '1' : '0.01';

  return screenHeader('Send Money', 'Enter either side of the conversion · Demo rate', 'home', badge('Demo mode', 'preview'))
    + `<div class="narrow card">
      <div class="field-group" style="margin-top:0">
        <label for="send-contact-search">Choose recipient</label>
        <input id="send-contact-search" type="search" value="${escapeHtml(contactSearch)}" oninput="contactSearch = this.value; render()" placeholder="Search Allen, Maya, Arun, Sofia, Yuki…">
      </div>
      <div class="contact-cards" style="margin:12px 0 16px">
        ${filtered.map(c => `<button type="button" class="contact-card" aria-pressed="${transferForm.contactId === c.id}" onclick="selectSendContact('${escapeHtml(c.id)}')">${contactAvatarHtml(c, true)}<span><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.currency || 'USD')}</small></span></button>`).join('')}
      </div>
      ${selected ? `<div class="fx-side-tabs" role="group" aria-label="Which side you are entering">
        <button type="button" class="fx-side-btn" aria-pressed="${transferForm.enteredSide === 'send'}" onclick="setTransferSide('send')">You send (${escapeHtml(transferForm.sourceCurrency)})</button>
        <button type="button" class="fx-side-btn" aria-pressed="${transferForm.enteredSide === 'receive'}" onclick="setTransferSide('receive')">${escapeHtml(selected.name)} receives (${escapeHtml(transferForm.targetCurrency)})</button>
      </div>
      <div class="bill-adjacent-fields" style="margin-top:8px">
        <div class="field-group" style="margin-top:0">
          <label for="send-amount">${transferForm.enteredSide === 'receive' ? `${escapeHtml(selected.name)} receives (${escapeHtml(transferForm.targetCurrency)})` : `You send (${escapeHtml(transferForm.sourceCurrency)})`}</label>
          <input id="send-amount" type="number" min="0" step="${activeStep}" value="${escapeHtml(transferForm.amountStr)}" oninput="transferForm.amountStr = this.value; render()" placeholder="${decimalsFor(activeCurr) === 0 ? '0' : '0.00'}">
        </div>
        <div class="field-group" style="margin-top:0">
          <label for="send-currency">Your currency</label>
          <select id="send-currency" onchange="transferForm.sourceCurrency = this.value; render()">
            ${CURRENCIES.map(curr => `<option value="${curr}" ${transferForm.sourceCurrency === curr ? 'selected' : ''}>${curr}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field-group">
        <label for="send-target-curr">Recipient receives (${escapeHtml(selected.name)})</label>
        <select id="send-target-curr" onchange="transferForm.targetCurrency = this.value; render()">
          ${CURRENCIES.map(curr => `<option value="${curr}" ${transferForm.targetCurrency === curr ? 'selected' : ''}>${curr}</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label for="send-note">Note (optional)</label>
        <input id="send-note" value="${escapeHtml(transferForm.note)}" oninput="transferForm.note = this.value" placeholder="Thanks for coffee">
      </div>
      ${quote.sourceAmountCents > 0 ? `<div class="fx-box">
        <div class="row" style="padding:4px 0"><span>You send ${transferForm.enteredSide === 'send' ? badge('Entered', '') : ''}</span><b class="money">${cents(quote.sourceAmountCents, quote.sourceCurrency, true)}</b></div>
        <div class="row" style="padding:4px 0"><span>${escapeHtml(selected.name)} receives ${transferForm.enteredSide === 'receive' ? badge('Entered', '') : ''}</span><b class="money" style="color:var(--primary-ink)">${cents(quote.targetAmountCents, quote.targetCurrency, true)}</b></div>
        <div class="row" style="padding:4px 0"><span>Demo exchange rate</span><small class="sub">1 ${quote.sourceCurrency} ≈ ${quote.rate.toFixed(quote.targetCurrency === 'JPY' ? 2 : 5)} ${quote.targetCurrency} · Demo rate (${fxRateDate})</small></div>
        ${quote.sourceCurrency !== 'INR' ? `<div class="row" style="padding:4px 0"><span>INR display estimate</span><small class="sub money">${cents(quote.inrEquivalentCents, 'INR', true)} (demo rate)</small></div>` : ''}
      </div>` : ''}
      ${transferForm.error ? `<div class="callout error" role="alert">${svg('alert')}<span>${escapeHtml(transferForm.error)}</span></div>` : ''}
      <div class="actions">
        <button type="button" class="btn btn-primary full" onclick="proceedToReviewTransfer()"><span>Review payment</span>${svg('arrow-right')}</button>
      </div>` : `<p class="sub">Select a contact above to enter an amount in either currency.</p>`}
    </div>`;
}

function proceedToReviewTransfer(backTarget = 'send') {
  if (!transferForm.contactId) { transferForm.error = 'Choose a contact first.'; render(); return; }
  const q = computeTransferQuote();
  if (q.sourceAmountCents <= 0 || q.targetAmountCents <= 0) { transferForm.error = 'Enter an amount greater than 0.'; render(); return; }
  transferForm.error = '';
  transferForm.reviewSourceCents = q.sourceAmountCents;
  transferForm.reviewTargetCents = q.targetAmountCents;
  transferForm.reviewRate = q.rate;
  transferForm.reviewRateDate = fxRateDate;
  transferForm.returnParent = backTarget;
  transferForm.clientTxId ||= `tx-${Date.now().toString(36)}`;
  go('review-transfer');
}

function reviewTransferScreen() {
  const c = contactsList.find(x => x.id === transferForm.contactId);
  if (!c) return screenHeader('Review payment', '', 'send') + `<div class="narrow card"><p>No transfer selected.</p><div class="actions"><button type="button" class="btn btn-primary" onclick="go('send')">Choose recipient</button></div></div>`;
  const quote = computeTransferQuote();
  transferForm.reviewSourceCents = quote.sourceAmountCents;
  transferForm.reviewTargetCents = quote.targetAmountCents;
  transferForm.reviewRate = quote.rate;
  transferForm.reviewRateDate = fxRateDate;
  const activeCurr = transferForm.enteredSide === 'receive' ? transferForm.targetCurrency : transferForm.sourceCurrency;
  const activeStep = decimalsFor(activeCurr) === 0 ? '1' : '0.01';

  return screenHeader('Review payment', 'Verify the recipient and amount before you pay.', transferForm.returnParent || 'send', badge('Demo mode', 'preview'))
    + `<div class="narrow card">
      <div class="callout">${svg('alert')}<div><b>Verify the recipient and amount before you pay</b><br>Uses the labeled Demo rate. This contact transfer stays in the Demo mode ledger.</div></div>
      <div class="field-group">
        <label for="rev-contact">Recipient</label>
        <select id="rev-contact" onchange="transferForm.contactId = this.value; const x = contactsList.find(p => p.id === this.value); if (x) transferForm.targetCurrency = x.currency; render()">
          ${contactsList.filter(p => p.id !== 'leah').map(p => `<option value="${escapeHtml(p.id)}" ${p.id === c.id ? 'selected' : ''}>${escapeHtml(p.name)} (${escapeHtml(p.currency || 'USD')})</option>`).join('')}
        </select>
      </div>
      <div class="fx-side-tabs" role="group" aria-label="Entered conversion side">
        <button type="button" class="fx-side-btn" aria-pressed="${transferForm.enteredSide === 'send'}" onclick="setTransferSide('send')">You send (${escapeHtml(transferForm.sourceCurrency)})</button>
        <button type="button" class="fx-side-btn" aria-pressed="${transferForm.enteredSide === 'receive'}" onclick="setTransferSide('receive')">${escapeHtml(c.name)} receives (${escapeHtml(transferForm.targetCurrency)})</button>
      </div>
      <div class="bill-adjacent-fields" style="margin-top:8px">
        <div class="field-group" style="margin-top:0">
          <label for="rev-amt">${transferForm.enteredSide === 'receive' ? `Recipient amount (${escapeHtml(transferForm.targetCurrency)})` : `Send amount (${escapeHtml(transferForm.sourceCurrency)})`}</label>
          <input id="rev-amt" type="number" min="0" step="${activeStep}" value="${escapeHtml(transferForm.amountStr)}" oninput="transferForm.amountStr = this.value; render()">
        </div>
        <div class="field-group" style="margin-top:0">
          <label for="rev-curr">${transferForm.enteredSide === 'receive' ? 'Recipient currency' : 'Your currency'}</label>
          <select id="rev-curr" onchange="if(transferForm.enteredSide==='receive'){transferForm.targetCurrency=this.value;}else{transferForm.sourceCurrency=this.value;} render()">
            ${CURRENCIES.map(curr => `<option value="${curr}" ${activeCurr === curr ? 'selected' : ''}>${curr}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field-group">
        <label for="rev-note">Note</label>
        <input id="rev-note" value="${escapeHtml(transferForm.note)}" oninput="transferForm.note = this.value">
      </div>
      <div class="fx-box">
        <div class="row" style="padding:4px 0"><span>You send</span><b class="money">${cents(quote.sourceAmountCents, quote.sourceCurrency, true)}</b></div>
        <div class="row" style="padding:4px 0"><span>${escapeHtml(c.name)} receives</span><b class="money" style="color:var(--primary-ink);font-size:18px">${cents(quote.targetAmountCents, quote.targetCurrency, true)}</b></div>
        <div class="row" style="padding:4px 0"><span>Demo exchange rate</span><small class="sub">1 ${quote.sourceCurrency} ≈ ${quote.rate.toFixed(quote.targetCurrency === 'JPY' ? 2 : 5)} ${quote.targetCurrency} · Demo rate (${fxRateDate}) · INR ${cents(quote.inrEquivalentCents, 'INR', true)}</small></div>
      </div>
      ${renderPaymentSourceSelector(convertCents(quote.sourceAmountCents, quote.sourceCurrency, 'USD'))}
      ${transferForm.error ? `<div class="callout error" role="alert">${svg('alert')}<span>${escapeHtml(transferForm.error)}</span></div>` : ''}
      <div class="actions">
        <button type="button" class="btn btn-secondary" onclick="goBack('${escapeHtml(transferForm.returnParent || 'send')}')" ${transferForm.busy ? 'disabled' : ''}>Back</button>
        <button type="button" class="btn btn-primary" id="demo-pay-btn" onclick="executeDemoPay()" ${transferForm.busy || quote.sourceAmountCents <= 0 || !canFundWithSource(convertCents(quote.sourceAmountCents, quote.sourceCurrency, 'USD')) ? 'disabled' : ''}>
          ${transferForm.busy ? '<span>Paying…</span>' : `<span>Pay</span>${svg('arrow-right')}`}
        </button>
      </div>
    </div>`;
}

async function executeDemoPay() {
  if (transferForm.busy) return;
  const c = contactsList.find(x => x.id === transferForm.contactId);
  const quote = computeTransferQuote();
  if (!c || quote.sourceAmountCents <= 0 || quote.targetAmountCents <= 0) { transferForm.error = 'Enter a positive amount first.'; render(); return; }
  const requiredUsd = convertCents(quote.sourceAmountCents, quote.sourceCurrency, 'USD');
  if (!canFundWithSource(requiredUsd)) { transferForm.error = 'PayPal Wallet balance too low. Recharge or switch card.'; render(); return; }
  const fundingSource = currentFundingLabel();
  transferForm.busy = true; transferForm.error = ''; render();
  const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reducedMotion) await new Promise(r => setTimeout(r, 420));
  try {
    let tx;
    if (backendMode && ledger) {
      const res = await api('/api/organizer/demo-pay', {
        contactId: c.id,
        recipientName: c.name,
        enteredSide: quote.enteredSide,
        sourceAmountCents: quote.sourceAmountCents,
        sourceCurrency: quote.sourceCurrency,
        targetAmountCents: quote.targetAmountCents,
        targetCurrency: quote.targetCurrency,
        reviewedRate: quote.rate,
        reviewedRateDate: quote.rateDate,
        fundingSource,
        note: transferForm.note || 'Payment',
        clientTxId: transferForm.clientTxId,
      });
      tx = res.transaction;
      deductWalletIfSelected(requiredUsd);
      tx.fundingSource ||= fundingSource;
      await loadWorkspaceState();
    } else {
      const existing = demoTransactions.find(t => t.clientTxId === transferForm.clientTxId);
      if (existing) tx = existing;
      else {
        deductWalletIfSelected(requiredUsd);
        tx = {
          id: 'DTX-' + Math.random().toString(16).slice(2, 8).toUpperCase(),
          clientTxId: transferForm.clientTxId,
          type: 'demo-send',
          direction: 'outgoing',
          enteredSide: quote.enteredSide,
          recipientName: c.name,
          contactId: c.id,
          country: c.country || '',
          flag: c.flag || '',
          sourceAmountCents: quote.sourceAmountCents,
          sourceCurrency: quote.sourceCurrency,
          targetAmountCents: quote.targetAmountCents,
          targetCurrency: quote.targetCurrency,
          inrEquivalentCents: quote.inrEquivalentCents,
          rate: quote.rate,
          rateDate: quote.rateDate,
          rateLabel: 'Demo rate',
          fundingSource,
          note: transferForm.note || 'Payment',
          status: 'Completed',
          demo: true,
          createdAt: new Date().toISOString(),
        };
        demoTransactions.unshift(tx);
        saveLocalState();
      }
    }
    transferForm.busy = false;
    if (chatDraft?.intent === 'send' && chatDraft.recipients.length === 1 && chatDraft.recipients[0].contactId === c.id) chatDraft = null;
    activeTxReceiptId = tx.id;
    toast(`Demo payment sent: ${cents(tx.sourceAmountCents, tx.sourceCurrency, true)} to ${tx.recipientName}`);
    go(`tx/${tx.id}`);
  } catch (e) {
    transferForm.busy = false;
    transferForm.error = e.message;
    render();
  }
}

function txReceiptScreen(txId) {
  const tx = demoTransactions.find(x => x.id === txId);
  if (!tx) return screenHeader('Transaction not found', '', 'activity') + `<div class="narrow card"><p>Transaction not found in Activity.</p></div>`;
  const isStore = tx.type === 'store-demo';
  const contact = contactsList.find(c => c.id === tx.contactId || c.name === tx.recipientName) || { name: tx.recipientName, currency: tx.targetCurrency, country: tx.country };
  const rateText = tx.rate ? `1 ${tx.sourceCurrency} ≈ ${Number(tx.rate).toFixed(tx.targetCurrency === 'JPY' ? 2 : 5)} ${tx.targetCurrency} · Demo rate` : 'Same currency';

  return screenHeader(isStore ? 'Store purchase receipt' : 'Payment receipt', `Demo mode · ${tx.id}`, 'activity', pill('Completed'))
    + `<div class="narrow card">
      <div class="center">
        <div class="result-icon">${svg('check')}</div>
        <h2 style="font-size:24px">${isStore ? 'Purchased' : 'Sent'} ${escapeHtml(cents(tx.sourceAmountCents, tx.sourceCurrency, true))}</h2>
        <div style="display:inline-flex;align-items:center;gap:8px;margin-top:6px">
          ${contactAvatarHtml(contact, true)}
          <span class="sub">${isStore ? '' : 'to '}<b>${escapeHtml(tx.recipientName)}</b>${tx.country ? ` (${escapeHtml(tx.country)})` : ''}</span>
        </div>
      </div>
      <div class="rule"></div>
      <div class="row"><span>Direction</span><b>Outgoing · Sent</b></div>
      <div class="row"><span>Receipt reference</span><code>${escapeHtml(tx.id)}</code></div>
      <div class="row"><span>Date</span><b>${escapeHtml((tx.createdAt || '').replace('T', ' ').slice(0, 16))}</b></div>
      <div class="row"><span>Entered side</span><b>${tx.enteredSide === 'receive' ? `Recipient amount (${tx.targetCurrency})` : `Send amount (${tx.sourceCurrency})`}</b></div>
      <div class="row"><span>You sent</span><b class="money">${escapeHtml(cents(tx.sourceAmountCents, tx.sourceCurrency, true))}</b></div>
      ${tx.sourceCurrency !== tx.targetCurrency ? `<div class="row"><span>${escapeHtml(tx.recipientName)} receives</span><b class="money">${escapeHtml(cents(tx.targetAmountCents, tx.targetCurrency, true))}</b></div>
      <div class="row"><span>Conversion rate</span><small class="sub">${escapeHtml(rateText)}</small></div>` : ''}
      ${tx.inrEquivalentCents && tx.sourceCurrency !== 'INR' ? `<div class="row"><span>INR estimate</span><small class="sub money">${escapeHtml(cents(tx.inrEquivalentCents, 'INR', true))}</small></div>` : ''}
      <div class="row"><span>Note</span><b>${escapeHtml(tx.note || 'Payment')}</b></div>
      ${tx.fundingSource ? `<div class="row"><span>Funded with</span><b>${escapeHtml(tx.fundingSource)}</b></div>` : ''}
      <div class="row"><span>Ledger</span>${pill(isStore ? 'Demo store purchase' : 'Demo transfer')}</div>
      <div class="actions">
        ${isStore ? `<button type="button" class="btn btn-primary" onclick="splitStoreReceipt('${escapeHtml(tx.id)}')">${svg('swap')}<span>Split cash</span></button>` : ''}
        <button type="button" class="btn btn-secondary" onclick="go('activity')">Open Activity</button>
        <button type="button" class="btn ${isStore ? 'btn-secondary' : 'btn-primary'}" onclick="go('home')">Done</button>
      </div>
    </div>`;
}

function splitStoreReceipt(txId) {
  const tx = demoTransactions.find(x => x.id === txId);
  if (!tx) return;
  const total = Number(tx.sourceAmountCents) || 0;
  if (total <= 0) return;
  const curr = normCurr(tx.sourceCurrency, 'USD');
  const note = String(tx.note || tx.recipientName || 'Store purchase').trim();
  const peers = contactsList.filter(c => c.id === 'maya' || c.id === 'arun');
  const per = equalShare(total, peers.length + 1, curr);
  chatStoreBuy = null;
  chatAttachedBill = {
    merchant: note,
    date: new Date().toISOString().slice(0, 10),
    currency: curr,
    items: [{ name: note, amountCents: total }],
    taxCents: 0,
    tipCents: 0,
    totalCents: total,
  };
  chatDraft = {
    intent: 'request',
    needsClarification: false,
    modelUsed: 'Store Purchase Split',
    recipients: peers.map((p, idx) => ({
      id: `draft-${idx + 1}`,
      name: p.name,
      contactId: p.id,
      known: true,
      ambiguous: false,
      amountCents: per,
      currency: curr,
      targetCurrency: p.currency || curr,
      reason: note,
    })),
  };
  chatHistory = [
    ...chatHistory,
    {
      id: `a-split-${Date.now()}`,
      role: 'assistant',
      text: `Ready to split ${note} (${cents(total, curr, true)}) evenly with ${peers.map(p => p.name).join(' and ')}. Review shares below.`,
      modelUsed: 'Store Purchase Split',
    },
  ];
  go('ask');
}

// ---------- Manual Request Money ----------
function openManualRequest(contactId = '') {
  contactSearch = '';
  const c = contactsList.find(x => x.id === contactId);
  manualReqForm = {
    multi: false,
    contactId: c?.id || '',
    contactIds: c ? [c.id] : [],
    amountStr: '',
    currency: 'USD',
    note: '',
    channel: 'demo',
    busy: false,
    error: '',
    clientRequestId: `req-${Date.now().toString(36)}`,
    review: null,
  };
  go('request-new');
}

function toggleReqContact(id) {
  manualReqForm.review = null;
  if (!manualReqForm.multi) {
    manualReqForm.contactId = id;
  } else {
    const idx = manualReqForm.contactIds.indexOf(id);
    if (idx >= 0) manualReqForm.contactIds.splice(idx, 1);
    else manualReqForm.contactIds.push(id);
  }
  render();
}

function manualRequestScreen() {
  const filtered = contactsList.filter(c => c.id !== 'leah' && (!contactSearch.trim() || `${c.name} ${c.country} ${c.currency}`.toLowerCase().includes(contactSearch.trim().toLowerCase())));
  const chosen = manualReqForm.multi
    ? contactsList.filter(c => manualReqForm.contactIds.includes(c.id))
    : contactsList.filter(c => c.id === manualReqForm.contactId);
  const totalCents = parseMajorToCents(manualReqForm.amountStr, manualReqForm.currency);
  const step = decimalsFor(manualReqForm.currency) === 0 ? '1' : '0.01';

  return screenHeader('Request Money', 'Choose contacts, enter amount and note, then track receipts', 'home', badge('Demo mode', 'preview'))
    + `<div class="narrow card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px">
        <label for="req-contact-search" style="font-size:13px;font-weight:800">Select contact${manualReqForm.multi ? 's (group split)' : ''}</label>
        <button type="button" class="btn-ghost-sm" onclick="manualReqForm.multi = !manualReqForm.multi; manualReqForm.review = null; render()">${manualReqForm.multi ? 'Single person' : 'Split group'}</button>
      </div>
      <div class="field-group" style="margin-top:0">
        <input id="req-contact-search" type="search" value="${escapeHtml(contactSearch)}" oninput="contactSearch = this.value; render()" placeholder="Search contacts…">
      </div>
      <div class="contact-cards" style="margin:12px 0 16px">
        ${filtered.map(c => {
          const on = manualReqForm.multi ? manualReqForm.contactIds.includes(c.id) : manualReqForm.contactId === c.id;
          return `<button type="button" class="contact-card" aria-pressed="${on}" onclick="toggleReqContact('${escapeHtml(c.id)}')">${contactAvatarHtml(c, true)}<span><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.currency || 'USD')}</small></span></button>`;
        }).join('')}
      </div>
      ${chosen.length ? `<div class="split-grid" style="gap:10px">
        <div class="field-group" style="margin-top:0">
          <label for="req-amt">${manualReqForm.multi ? `Total amount (${escapeHtml(manualReqForm.currency)})` : `Amount (${escapeHtml(manualReqForm.currency)})`}</label>
          <input id="req-amt" type="number" min="0" step="${step}" value="${escapeHtml(manualReqForm.amountStr)}" oninput="manualReqForm.amountStr = this.value; manualReqForm.review = null; render()" placeholder="${decimalsFor(manualReqForm.currency) === 0 ? '0' : '0.00'}">
        </div>
        <div class="field-group" style="margin-top:0">
          <label for="req-curr">Currency</label>
          <select id="req-curr" onchange="manualReqForm.currency = this.value; manualReqForm.review = null; render()">
            ${CURRENCIES.map(curr => `<option value="${curr}" ${manualReqForm.currency === curr ? 'selected' : ''}>${curr}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field-group">
        <label for="req-note">Note (optional)</label>
        <input id="req-note" value="${escapeHtml(manualReqForm.note)}" oninput="manualReqForm.note = this.value" placeholder="Dinner, cab, groceries…">
      </div>
      ${totalCents > 0 && chosen.length === 1 && chosen[0].currency !== manualReqForm.currency ? `<div class="fx-box">
        <div class="row" style="padding:4px 0"><span>Equivalent (${escapeHtml(chosen[0].name)})</span><b class="money">${cents(convertCents(totalCents, manualReqForm.currency, chosen[0].currency), chosen[0].currency, true)} · Demo rate</b></div>
      </div>` : ''}
      ${manualReqForm.error ? `<div class="callout error" role="alert">${svg('alert')}<span>${escapeHtml(manualReqForm.error)}</span></div>` : ''}
      <div class="actions">
        <button type="button" class="btn btn-primary full" onclick="submitManualRequest()" ${manualReqForm.busy ? 'disabled' : ''}><span>Review request</span>${svg('arrow-right')}</button>
      </div>` : `<p class="sub">Pick a contact above to create a payment request.</p>`}
      ${manualReqForm.review ? `<section class="card card-tint" style="margin-top:14px" aria-label="Review request">
        <div class="section-title"><h2>Review request</h2><button type="button" class="btn-ghost-sm" onclick="manualReqForm.review = null; render()">Edit</button></div>
        ${manualReqForm.review.map(r => `<div class="row"><span>${escapeHtml(r.name)} owes</span><b class="money">${cents(r.amountCents, r.currency, true)}</b></div>`).join('')}
        ${totalCents > totalInCurrency(manualReqForm.review, manualReqForm.currency) ? `<div class="row"><span>Your share</span><b class="money">${cents(totalCents - totalInCurrency(manualReqForm.review, manualReqForm.currency), manualReqForm.currency, true)}</b></div>` : ''}
        <p class="sub">Demo requests settle at staggered intervals and trigger receipt alerts.</p>
        <button type="button" id="manual-confirm" class="btn btn-primary full" onclick="submitManualRequest(true)" ${manualReqForm.busy ? 'disabled' : ''}>${manualReqForm.busy ? 'Creating request…' : 'Create request'}</button>
      </section>` : ''}
    </div>`;
}

async function submitManualRequest(confirmed = false) {
  if (manualReqForm.busy) return;
  const chosen = manualReqForm.multi
    ? contactsList.filter(c => manualReqForm.contactIds.includes(c.id))
    : contactsList.filter(c => c.id === manualReqForm.contactId);
  const totalCents = parseMajorToCents(manualReqForm.amountStr, manualReqForm.currency);
  if (!chosen.length || totalCents <= 0) { manualReqForm.error = 'Select contact(s) and enter a positive amount.'; render(); return; }
  const baseShare = equalShare(totalCents, chosen.length, manualReqForm.currency);
  const recipients = chosen.filter(c => c.id !== 'leah').map(c => ({
    name: c.name,
    contactId: c.id,
    amountCents: baseShare,
    currency: manualReqForm.currency,
    targetCurrency: c.currency || manualReqForm.currency,
    reason: manualReqForm.note.trim() || 'Shared request',
  }));
  if (!recipients.length || recipients.some(r => r.amountCents <= 0)) { manualReqForm.error = 'Enter an amount that gives each contact a positive share.'; render(); return; }
  if (!confirmed) {
    manualReqForm.review = recipients;
    manualReqForm.error = '';
    render();
    document.querySelector('#manual-confirm')?.focus();
    return;
  }
  manualReqForm.busy = true; manualReqForm.error = ''; render();
  const created = await persistRequestRecord({
    title: chosen.length === 1 ? `Request from ${chosen[0].name}` : `${chosen.map(c => c.name).join(', ')}`,
    merchant: manualReqForm.note.trim() || 'Money request',
    kind: 'request',
    currency: manualReqForm.currency,
    totalCents,
    recipients,
    channel: 'demo',
    demoAutoSettle: true,
    clientRequestId: manualReqForm.clientRequestId,
  });
  manualReqForm.busy = false;
  if (created) go(`request/${created.id}`);
}

// ---------- Shared Request Persistence + Receiving Screen ----------
async function persistRequestRecord(payload) {
  payload = { ...payload, recipients: payload.recipients.filter(r => r.contactId !== 'leah') };
  if (!payload.recipients.length) { toast('Choose someone to request money from.'); return null; }
  const channel = payload.channel || 'demo';
  const demoAutoSettle = Boolean(payload.demoAutoSettle || channel === 'demo');
  if (backendMode && ledger) {
    try {
      const res = await api('/api/organizer/requests', { ...payload, channel, demoAutoSettle });
      await loadWorkspaceState();
      scheduleSettlementTicker();
      return res.request;
    } catch (e) {
      toast(e.message);
      return null;
    }
  }
  const existing = payload.clientRequestId && reimbursementsList.find(r => r.clientRequestId === payload.clientRequestId);
  if (existing) return existing;
  const now = Date.now();
  const reqId = 'REQ-' + Math.random().toString(16).slice(2, 8).toUpperCase();
  const recs = (payload.recipients || []).map((r, i) => {
    const token = 'demo-' + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
    const quote = fxQuote(r.amountCents, r.currency || 'USD', r.targetCurrency || r.currency || 'USD');
    const delayMs = 2200 + (i * 2300) + ((i * 537) % 700);
    return {
      id: `REC-${i + 1}`,
      name: r.name,
      contactId: r.contactId || null,
      amountCents: r.amountCents,
      currency: quote.sourceCurrency,
      targetCurrency: quote.targetCurrency,
      targetAmountCents: quote.targetAmountCents,
      reason: r.reason || 'Shared expense',
      shareToken: token,
      shareUrl: location.href.split('#')[0] + '#req/' + token,
      status: demoAutoSettle ? 'Waiting for payment' : 'Created',
      deliveryStatus: channel === 'email' || channel === 'sms' ? 'Failed' : (demoAutoSettle ? 'Sent' : 'Created'),
      deliveryMessage: channel === 'email' || channel === 'sms'
        ? `${channel.toUpperCase()} gateway not configured. Copy link or Show QR instead.`
        : (demoAutoSettle ? 'Demo request active — awaiting scheduled receipt.' : 'Share via Copy link or QR.'),
      settleAt: demoAutoSettle ? now + delayMs : null,
      settledAt: null,
      demoSettled: false,
      receiptRef: null,
    };
  });
  const record = {
    id: reqId,
    clientRequestId: payload.clientRequestId || `local-${now}`,
    createdAt: new Date().toISOString(),
    mode: demoAutoSettle ? 'demo-request' : 'reimbursement',
    kind: payload.kind || 'request',
    demo: demoAutoSettle,
    dueDate: payload.dueDate || '',
    title: payload.title || 'Request',
    merchant: payload.merchant || 'Personal request',
    billDate: payload.billDate || '',
    currency: payload.currency || 'USD',
    items: payload.items || [],
    taxCents: payload.taxCents || 0,
    tipCents: payload.tipCents || 0,
    totalCents: payload.totalCents || totalInCurrency(recs, payload.currency || 'USD'),
    ownShareCents: Math.max(0, (payload.totalCents || 0) - totalInCurrency(recs, payload.currency || 'USD')),
    evidenceImageDataUrl: payload.evidenceImageDataUrl || '',
    transcript: payload.transcript || '',
    recipients: recs,
  };
  reimbursementsList.unshift(record);
  saveLocalState();
  scheduleSettlementTicker();
  return record;
}

async function requestBrowserAlerts() {
  if (typeof Notification === 'undefined') { toast('OS notifications unavailable here — in-app alerts stay active.'); render(); return; }
  try {
    const res = await Notification.requestPermission();
    toast(res === 'granted' ? 'Browser payment alerts enabled.' : 'OS notification permission denied — using in-app alerts.');
  } catch {
    toast('OS notifications unavailable here — in-app alerts stay active.');
  }
  render();
}

function requestDetailScreen(reqId) {
  const req = reimbursementsList.find(r => r.id === reqId);
  if (!req) return screenHeader('Request not found', '', 'activity') + `<div class="narrow card"><p>Request not found.</p></div>`;
  const recs = req.recipients || [];
  const curr = req.currency || recs[0]?.currency || 'USD';
  const totalReq = totalInCurrency(recs, curr);
  const collected = totalInCurrency(recs.filter(r => r.status === 'Paid'), curr);
  const waitingCount = recs.filter(r => r.status === 'Waiting for payment').length;
  const activeQr = recs.find(r => r.id === selectedReqQr.recipientId) || recs[0];
  const pct = totalReq > 0 ? Math.min(1, collected / totalReq).toFixed(4) : '0';
  const notifState = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';

  return screenHeader(escapeHtml(req.title || req.merchant), `${req.id} · ${req.demo ? 'Demo mode Receiving' : 'External link/gateway'}`, 'activity', badge(waitingCount > 0 ? `${waitingCount} waiting` : `${recs.length - waitingCount}/${recs.length} received`, waitingCount > 0 ? 'preview' : ''))
    + `<div class="split-grid">
      <section class="card">
        <h2>Receiving summary</h2>
        <div class="row"><span>Amount collected</span><b class="money" style="color:var(--teal-ink)">${cents(collected, curr, true)} / ${cents(totalReq, curr, true)}</b></div>
        ${req.ownShareCents > 0 ? `<div class="row"><span>Your share</span><b class="money">${cents(req.ownShareCents, curr, true)}</b></div>` : ''}
        <div class="progress"><i style="transform:scaleX(${pct})"></i></div>
        ${req.dueDate ? `<div class="row"><span>Due date</span><b>${escapeHtml(req.dueDate)}</b></div>` : ''}
        ${req.evidenceImageDataUrl ? `<img src="${escapeHtml(req.evidenceImageDataUrl)}" alt="Receipt evidence" class="crop-canvas" style="margin:10px 0">` : ''}
        ${(req.items || []).map(i => `<div class="row"><span>${escapeHtml(i.name)}</span><b class="money">${cents(i.amountCents, curr, true)}</b></div>`).join('')}
        ${req.demo && waitingCount > 0 ? `<div class="callout">${svg('clock')}<div><span>Demo payments arrive at short staggered intervals and notify automatically.</span>${notifState === 'default' ? `<br><button type="button" class="btn-ghost-sm" style="margin-top:8px" onclick="requestBrowserAlerts()">Allow OS notifications</button>` : notifState === 'denied' ? '<br><small class="sub">OS alerts blocked; in-app notifications active.</small>' : ''}</div></div>` : ''}
        ${!req.demo ? `<div class="callout">${svg('alert')}<span>Personal reimbursement link. PayPal Sandbox commercial checkout applies only to Demo Merchant (SS-001).</span></div>` : ''}
      </section>

      <section class="card">
        <div class="section-title"><h2>Individual shares (${recs.length})</h2><b class="money">${cents(totalReq, curr, true)}</b></div>
        ${recs.map(r => {
          const contact = contactsList.find(c => c.id === r.contactId || c.name === r.name) || { name: r.name, currency: r.currency || curr };
          const label = r.status === 'Paid' && r.demoSettled ? `Payment received from ${r.name}` : r.status;
          const flash = r.status === 'Paid' && r.demoSettled && justSettledIds.has(req.id) ? 'settled-flash' : '';
          return `<div class="draft-row-card ${r.deliveryStatus === 'Failed' ? 'needs-fix' : ''} ${flash}">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <div style="display:flex;align-items:center;gap:10px">
                ${contactAvatarHtml(contact, true)}
                <div>
                  <b>${escapeHtml(r.name)} ${r.status === 'Paid' ? 'paid' : 'owes'} <span class="money">${cents(r.amountCents, r.currency || curr, true)}</span></b><br>
                  <small class="sub">${escapeHtml(r.reason)}${r.receiptRef ? ` · Receipt: <code>${escapeHtml(r.receiptRef)}</code>` : ''}</small>
                </div>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                ${pill(r.status === 'Paid' && r.demoSettled ? 'Payment received' : r.status)}
                ${r.deliveryStatus === 'Failed' ? pill('Failed') : ''}
              </div>
            </div>
            ${r.deliveryStatus === 'Failed' ? `<p class="sub" style="margin-top:6px;color:var(--error)">${escapeHtml(r.deliveryMessage)}</p>` : ''}
            ${r.status === 'Paid' && r.demoSettled ? `<p class="sub" style="margin-top:6px;color:var(--teal-ink);font-weight:700">${escapeHtml(label)}${r.settledAt ? ` · ${escapeHtml(r.settledAt.slice(11, 19))}` : ''}</p>` : ''}
            <div class="chip-row" style="margin-top:10px">
              <button type="button" class="btn-ghost-sm" onclick="copyReqLink('${escapeHtml(req.id)}', '${escapeHtml(r.id)}')">${svg('copy')}<span>Copy link</span></button>
              <button type="button" class="btn-ghost-sm" onclick="selectedReqQr = {reqId:'${escapeHtml(req.id)}', recipientId:'${escapeHtml(r.id)}'}; render()">${svg('qr')}<span>Show QR</span></button>
              <button type="button" class="btn-ghost-sm" onclick="shareReqLink('${escapeHtml(req.id)}', '${escapeHtml(r.id)}')">${svg('share')}<span>Share</span></button>
            </div>
          </div>`;
        }).join('')}
        ${activeQr ? `<div class="card card-tint" style="margin-top:12px">
          <div class="qr-spotlight">
            <div class="qr-box" id="req-qr"></div>
            <div class="qr-meta">
              <h3>${escapeHtml(activeQr.name)} · ${cents(activeQr.amountCents, activeQr.currency || curr, true)}</h3>
              <p class="sub" style="margin-bottom:10px">${escapeHtml(activeQr.reason)}</p>
              <a class="btn btn-secondary" href="${escapeHtml(activeQr.shareUrl || (location.href.split('#')[0] + '#req/' + activeQr.shareToken))}">${svg('external')}<span>Open link</span></a>
            </div>
          </div>
        </div>` : ''}
      </section>
    </div>`;
}

async function copyReqLink(reqId, recId) {
  const req = reimbursementsList.find(r => r.id === reqId);
  const rec = req?.recipients?.find(x => x.id === recId);
  if (!rec) return;
  const u = rec.shareUrl || (location.href.split('#')[0] + '#req/' + rec.shareToken);
  try { await navigator.clipboard.writeText(u); toast(`Copied ${rec.name}'s request link`); } catch { prompt(`Copy ${rec.name}'s link`, u); }
}

async function shareReqLink(reqId, recId) {
  const req = reimbursementsList.find(r => r.id === reqId);
  const rec = req?.recipients?.find(x => x.id === recId);
  if (!rec) return;
  const u = rec.shareUrl || (location.href.split('#')[0] + '#req/' + rec.shareToken);
  if (navigator.share) { try { await navigator.share({ title: `AI · ${req.title}`, text: `${rec.name}: ${cents(rec.amountCents, rec.currency || 'USD', true)} for ${rec.reason}`, url: u }); return; } catch {} }
  await copyReqLink(reqId, recId);
}

// ---------- Activity Payment Cycle Graph + Activity Screen ----------
function renderPaymentCycleCard() {
  const is7 = cycleRange === '7D';
  const base = is7
    ? [48, 86, 59, 108, 72, 118, 89, 134]
    : [42, 68, 51, 88, 64, 96, 58, 118, 81, 105, 74, 132, 95, 124];
  let inflow = is7 ? 18500 : 42800;
  let outflow = is7 ? 9250 : 24650;
  for (const tx of demoTransactions) {
    const usd = convertCents(tx.sourceAmountCents || 0, tx.sourceCurrency || 'USD', 'USD');
    if (tx.type === 'wallet-recharge') inflow += usd;
    else outflow += usd;
  }
  for (const req of reimbursementsList) {
    for (const r of req.recipients || []) {
      if (r.status === 'Paid') inflow += convertCents(r.amountCents || 0, r.currency || 'USD', 'USD');
    }
  }
  const seed = demoTransactions.length + reimbursementsList.length;
  const tailBoost = Math.max(-35, Math.min(60, (inflow - outflow) / 100));
  const pts = base.map((v, i) => Math.max(14, Math.min(210, v + Math.sin(i * 1.7 + seed * 0.4) * 14 + (i >= base.length - 2 ? tailBoost * (i === base.length - 1 ? 1 : 0.45) : 0))));
  const w = 520;
  const h = 152;
  const minV = Math.min(...pts) - 12;
  const maxV = Math.max(...pts) + 12;
  const span = Math.max(1, maxV - minV);
  const coords = pts.map((v, i) => [
    8 + (i / (pts.length - 1)) * (w - 16),
    h - ((v - minV) / span) * (h - 24) - 12,
  ]);
  const secCoords = coords.map(([x, y], i) => [x, Math.max(12, Math.min(h - 12, y + Math.cos(i * 1.4) * 16 + 14))]);
  const bezier = (list) => list.reduce((acc, [x, y], i) => {
    if (i === 0) return `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    const [px, py] = list[i - 1];
    const mx = ((px + x) / 2).toFixed(1);
    return `${acc} C ${mx} ${py.toFixed(1)}, ${mx} ${y.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
  }, '');
  const linePath = bezier(coords);
  const areaPath = `${linePath} L ${coords.at(-1)[0].toFixed(1)} ${h} L ${coords[0][0].toFixed(1)} ${h} Z`;
  const secPath = bezier(secCoords);
  const peakIdx = pts.indexOf(Math.max(...pts));
  const net = inflow - outflow;
  const labels = is7 ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Wk 1', 'Wk 2', 'Wk 3', 'Now'];

  return `<section id="payment-cycle-card" class="card" style="margin-bottom:14px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div>
        <h2>Payment cycle</h2>
        <small class="sub">Inflow &amp; spending waves (${cycleRange})</small>
      </div>
      <div class="fx-side-tabs" style="margin:0;width:auto" role="group" aria-label="Cycle timeframe">
        <button type="button" class="fx-side-btn" style="min-height:36px;padding:0 12px" aria-pressed="${cycleRange === '7D'}" onclick="cycleRange='7D'; render()">7D</button>
        <button type="button" class="fx-side-btn" style="min-height:36px;padding:0 12px" aria-pressed="${cycleRange === '30D'}" onclick="cycleRange='30D'; render()">30D</button>
      </div>
    </div>
    <svg class="cycle-chart-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="Payment cycle chart">
      <defs>
        <linearGradient id="cycleGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1457D9" stop-opacity="0.34"/>
          <stop offset="100%" stop-color="#1457D9" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      <line x1="0" y1="${h * 0.25}" x2="${w}" y2="${h * 0.25}" stroke="var(--line)" stroke-opacity="0.5"/>
      <line x1="0" y1="${h * 0.5}" x2="${w}" y2="${h * 0.5}" stroke="var(--line)" stroke-opacity="0.5"/>
      <line x1="0" y1="${h * 0.75}" x2="${w}" y2="${h * 0.75}" stroke="var(--line)" stroke-opacity="0.5"/>
      <path d="${secPath}" fill="none" stroke="var(--teal)" stroke-width="2" stroke-opacity="0.6"/>
      <path d="${areaPath}" fill="url(#cycleGrad)"/>
      <path d="${linePath}" fill="none" stroke="#1457D9" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${coords[peakIdx][0].toFixed(1)}" cy="${coords[peakIdx][1].toFixed(1)}" r="5" fill="var(--surface)" stroke="var(--teal)" stroke-width="2.5"/>
      <circle cx="${coords.at(-1)[0].toFixed(1)}" cy="${coords.at(-1)[1].toFixed(1)}" r="5" fill="var(--surface)" stroke="#1457D9" stroke-width="2.5"/>
    </svg>
    <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:var(--muted);margin-top:4px">
      ${labels.map(l => `<span>${l}</span>`).join('')}
    </div>
    <div class="cycle-stats-grid">
      <div><small>Inflow</small><b class="money" style="color:var(--teal)">+${cents(inflow, 'USD', false)}</b></div>
      <div><small>Outflow</small><b class="money" style="color:var(--coral)">-${cents(outflow, 'USD', false)}</b></div>
      <div><small>Net cycle</small><b class="money" style="color:${net >= 0 ? 'var(--primary-ink)' : 'var(--coral)'}">${net >= 0 ? '+' : '-'}${cents(Math.abs(net), 'USD', false)}</b></div>
    </div>
  </section>`;
}

// ---------- Activity Screen ----------
function activityScreen() {
  const filters = ['All', 'Awaiting payment', 'Payment received', 'Sent', 'Sandbox'];
  const q = activityQuery.trim().toLowerCase();
  const entries = buildUnifiedActivity().filter(it => {
    const matchTab = activityFilter === 'All' || it.filterBucket === activityFilter;
    const matchSearch = !q || `${it.counterparty} ${it.title} ${it.subtitle} ${it.id} ${it.direction}`.toLowerCase().includes(q);
    return matchTab && matchSearch;
  });

  return `<div class="hub-top">
    <div><h1>Activity</h1><p class="screen-sub">Payment cycle overview, transfers, requests, and PayPal Sandbox ledger.</p></div>
    ${backendMode ? `<button type="button" class="btn-ghost-sm" onclick="loadWorkspaceState().then(render)">${svg('refresh')}<span>Refresh</span></button>` : ''}
  </div>
  ${renderPaymentCycleCard()}
  <div class="store-toolbar">
    <div class="store-search">
      ${svg('search')}
      <input id="activity-search" name="activity-search" type="search" aria-label="Search activity" value="${escapeHtml(activityQuery)}" oninput="activityQuery = this.value; render()" placeholder="Search counterparty, note, reference…">
    </div>
  </div>
  <div class="category-strip" role="tablist" aria-label="Filter activity">
    ${filters.map(f => `<button type="button" class="chip ${activityFilter === f ? 'selected' : ''}" onclick="activityFilter = '${f}'; render()">${f}</button>`).join('')}
  </div>
  <div class="card">
    ${entries.length === 0 ? `<p class="sub">${activityQuery ? 'No matching activity.' : 'No activity yet. Send Money, Request Money, or pay a Sandbox QR to see history here.'}</p>` : entries.map(e => `
      <div class="row ${e.flash ? 'settled-flash' : ''}" style="cursor:pointer" onclick="go('${escapeHtml(e.route)}')">
        ${e.contact ? contactAvatarHtml(e.contact, true) : `<span class="icon-box" style="width:36px;height:36px">${svg(e.kind === 'sandbox' ? 'store' : e.kind === 'electricity' ? 'bolt' : e.kind === 'rent' ? 'calendar' : 'receipt')}</span>`}
        <div class="grow">
          <b>${escapeHtml(e.title)}</b><br>
          <small class="sub">${escapeHtml(e.direction)} · ${escapeHtml(e.counterparty)} · ${escapeHtml(e.subtitle)} · ${escapeHtml(e.date)}</small>
        </div>
        <div style="text-align:right">
          <div class="money" style="font-weight:800">${escapeHtml(e.primaryAmount)}</div>
          ${e.secondaryAmount ? `<small class="sub money">${escapeHtml(e.secondaryAmount)}</small>` : ''}
          <div style="margin-top:4px">${pill(e.status)}</div>
        </div>
      </div>`).join('')}
  </div>`;
}

// ---------- Ask AI Conversation (#ask / #talk) ----------
function openAskSplitSync() { go('ask'); }

function askScreen() {
  return screenHeader('Ask AI', 'Buy store items, send money, or split', 'home', `<button type="button" class="btn-ghost-sm" onclick="toggleAskVoice()">${svg(askVoiceOn ? 'volume' : 'mute')}<span>Voice ${askVoiceOn ? 'ON' : 'OFF'}</span></button>`)
    + `<div class="chat-shell">
      <div class="chip-row" style="margin-top:0">
        <button type="button" class="chip" onclick="submitAskTurn('Buy 2 desk lamps')">Buy 2 desk lamps</button>
        <button type="button" class="chip" onclick="submitAskTurn('Send Allen $20 for coffee')">Send Allen $20 for coffee</button>
        <button type="button" class="chip" onclick="submitAskTurn('Ask Maya $20 for dinner')">Ask Maya $20 for dinner</button>
        <button type="button" class="chip" onclick="useAskSampleReceipt()">Use sample receipt</button>
      </div>
      ${chatAttachedBill || chatAttachedImg ? renderAskReceiptCard() : ''}
      <div class="chat-thread" aria-live="polite">
        ${chatHistory.length === 0 && !chatAttachedImg ? `<div class="card card-tint">
          <b>Ask AI to buy, send, or split.</b>
          <p class="sub" style="margin-top:6px">Tap a quick prompt above, attach a receipt photo below, or type or dictate your request.</p>
        </div>` : ''}
        ${chatHistory.map(m => m.role === 'user'
          ? `<div class="chat-bubble user"><small style="opacity:.75;font-weight:700;display:block;margin-bottom:4px">Leah</small><div>${escapeHtml(m.text)}</div></div>`
          : renderAssistantBubble(m)).join('')}
        ${askBusy ? `<div class="chat-bubble assistant"><div class="callout" style="margin-top:0">${svg('sparkles')}<span>Understanding &amp; validating amounts…</span></div></div>` : ''}
      </div>
      ${askConfirmSheetOpen ? renderAskConfirmSheet() : ''}
      <div class="chat-composer">
        ${micError ? `<div class="callout warning" style="margin-top:0;margin-bottom:8px" role="alert">${svg('alert')}<span>${escapeHtml(micError)}</span></div>` : ''}
        ${micState === 'listening' ? `<div class="callout" style="margin-top:0;margin-bottom:8px">${svg('mic')}<span><b>Listening…</b> Speak now, then tap Stop.</span></div>` : ''}
        ${micState === 'transcribing' ? `<div class="callout" style="margin-top:0;margin-bottom:8px">${svg('sparkles')}<span>Transcribing voice…</span></div>` : ''}
        <div class="composer-row">
          <button type="button" class="composer-icon-btn" onclick="triggerAskAttachmentMenu()" aria-label="Upload receipt photo" title="Upload receipt">${svg('photo')}</button>
          <input id="ask-attach-file" type="file" accept="image/png,image/jpeg,image/webp" hidden onchange="handleAskFileUpload(this)">
          <button type="button" class="composer-icon-btn ${micState === 'listening' ? 'recording' : ''}" onclick="${micState === 'listening' ? 'stopAskMic()' : 'startAskMic()'}" ${micState === 'transcribing' ? 'disabled' : ''} aria-label="${micState === 'listening' ? 'Stop recording' : 'Start voice recording'}" title="Microphone">
            ${svg(micState === 'listening' ? 'stop' : 'mic')}
          </button>
          <label for="ask-input" class="sr-only">Message Ask AI</label>
          <textarea id="ask-input" rows="1" value="${escapeHtml(askComposerText)}" oninput="askComposerText = this.value" placeholder="Ask AI…" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submitAskTurn();}">${escapeHtml(askComposerText)}</textarea>
          <button type="button" class="composer-send-btn" onclick="submitAskTurn()" ${askBusy || micState === 'listening' || micState === 'transcribing' ? 'disabled' : ''} aria-label="Send">${svg('send-arrow')}</button>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;flex-wrap:wrap;gap:8px">
          <label style="display:inline-flex;align-items:center;gap:8px;min-height:38px;font-size:12px;color:var(--muted);cursor:pointer">
            <input type="checkbox" ${askAutoSendMic ? 'checked' : ''} onchange="askAutoSendMic = this.checked" style="width:16px;height:16px">
            Auto-send after mic transcription
          </label>
          <button type="button" class="btn-ghost-sm" onclick="useAskSampleReceipt()">${svg('receipt')}<span>Use sample receipt</span></button>
        </div>
      </div>
    </div>`;
}

function toggleAskVoice() {
  askVoiceOn = !askVoiceOn;
  localStorage.setItem('splitsync-voice-on', String(askVoiceOn));
  if (!askVoiceOn) cancelAskSpeech();
  render();
}

function triggerAskAttachmentMenu() { document.querySelector('#ask-attach-file')?.click(); }

function handleAskFileUpload(input) {
  const f = input?.files?.[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { chatAttachedRawImg = String(r.result || ''); chatAttachedImg = chatAttachedRawImg; chatShowCrop = false; extractAskAttachedBill(false); };
  r.readAsDataURL(f);
}

function useAskSampleReceipt() {
  chatAttachedRawImg = createSampleReceiptDataUrl(); chatAttachedImg = chatAttachedRawImg; chatShowCrop = false;
  extractAskAttachedBill(true);
}

function renderAssistantBubble(msg) {
  const isLatest = chatHistory.filter(x => x.role === 'assistant').at(-1)?.id === msg.id;
  const showStore = isLatest && chatStoreBuy?.product;
  const showDraft = isLatest && chatDraft && chatDraft.recipients?.length;
  return `<div class="chat-bubble assistant">
    <small class="sub" style="font-weight:800;display:block;margin-bottom:4px">AI</small>
    <p style="color:var(--navy);font-weight:600">${escapeHtml(msg.text)}</p>
    ${isLatest ? `<div class="chip-row" style="margin-top:10px;align-items:center">
      ${askAudioState === 'loading' ? `<small class="sub">Synthesizing voice…</small><button type="button" class="btn-ghost-sm" onclick="stopAskPlayback()">Stop audio</button>` : ''}
      ${askAudioState === 'playing' ? `<button type="button" class="btn-ghost-sm" onclick="stopAskPlayback()">${svg('stop')}<span>Stop audio</span></button><small class="sub" style="color:var(--teal-ink);font-weight:700">Playing…</small>` : ''}
      ${askAudioState === 'blocked' ? `<button type="button" class="btn btn-secondary" onclick="playCurrentAskAudio(true, ttsEpoch, chatDraft?.intent === 'send' && chatDraft.recipients.length === 1 && !chatDraft.needsClarification)">${svg('play')}<span>Play reply</span></button>` : ''}
      ${['ready', 'idle', 'unavailable'].includes(askAudioState) && askAudioSrc ? `<button type="button" class="btn-ghost-sm" onclick="playCurrentAskAudio(true, ttsEpoch, chatDraft?.intent === 'send' && chatDraft.recipients.length === 1 && !chatDraft.needsClarification)">${svg('volume')}<span>Replay</span></button>` : ''}
      ${askAudioState === 'unavailable' && askAudioError ? `<small class="sub" style="color:var(--amber)">${escapeHtml(askAudioError)}</small>` : ''}
    </div>` : ''}
    ${showStore ? `<div class="fx-box">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <img src="${escapeHtml(chatStoreBuy.product.img)}" alt="${escapeHtml(chatStoreBuy.product.name)}" style="width:52px;height:52px;border-radius:10px;object-fit:contain;background:#fff;padding:3px;flex-shrink:0">
        <div class="grow">
          <b>${chatStoreBuy.qty} × ${escapeHtml(chatStoreBuy.product.name)}</b><br>
          <small class="sub">${escapeHtml(chatStoreBuy.product.seller)} · <b class="money">${cents(chatStoreBuy.product.priceCents * chatStoreBuy.qty, 'USD', true)}</b></small>
        </div>
      </div>
      <div class="actions" style="margin-top:10px">
        <button type="button" class="btn btn-secondary" onclick="addToCart('${escapeHtml(chatStoreBuy.product.id)}', true, ${chatStoreBuy.qty})">Add to Cart</button>
        <button type="button" class="btn btn-primary" onclick="buyNowStoreItem('${escapeHtml(chatStoreBuy.product.id)}', ${chatStoreBuy.qty})"><span>Buy now</span>${svg('arrow-right')}</button>
      </div>
    </div>` : ''}
    ${showDraft ? renderInlineAskDraft() : ''}
  </div>`;
}

function validAskPaymentGroup() {
  const rows = chatDraft?.recipients || [];
  return chatDraft?.intent === 'send' && rows.length > 1 && rows.length <= 20 &&
    new Set(rows.map(r => r.contactId)).size === rows.length &&
    rows.every(r => r.known && !r.ambiguous && contactsList.some(c => c.id === r.contactId) &&
      Number.isInteger(r.amountCents) && r.amountCents > 0 && r.amountCents <= 100000000 &&
      CURRENCIES.includes(r.currency));
}

function openGroupPaymentReview() {
  if (askBusy || !validAskPaymentGroup()) { toast('Check recipients and amounts before continuing.'); return; }
  chatDraft.attemptId ||= 'group-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  go('review-payment-draft');
}

function groupPaymentReviewScreen() {
  if (!validAskPaymentGroup()) return screenHeader('Review payments', '', 'ask');
  const rows = chatDraft.recipients;
  const totals = new Map();
  let totalUsdCents = 0;
  const payments = rows.map(r => {
    const contact = contactsList.find(c => c.id === r.contactId);
    const quote = fxQuote(r.amountCents, r.currency, contact.currency);
    totals.set(r.currency, (totals.get(r.currency) || 0) + r.amountCents);
    totalUsdCents += convertCents(r.amountCents, r.currency, 'USD');
    return `<div class="row" style="gap:10px">${contactAvatarHtml(contact, true)}<div class="grow"><b>${escapeHtml(contact.name)}</b>
      ${quote.sourceCurrency === quote.targetCurrency ? '' : `<br><small class="sub">Demo rate · ${cents(quote.targetAmountCents, quote.targetCurrency, true)}</small>`}</div>
      <b class="money">${cents(r.amountCents, r.currency, true)}</b></div>`;
  }).join('');
  return screenHeader('Review ' + rows.length + ' payments', 'Verify each recipient and amount before paying.', 'ask', badge('Demo mode', 'preview')) +
    `<section class="narrow card">
      ${payments}
      <div class="rule"></div>
      ${[...totals].map(([currency, total]) => `<div class="row"><b>Total (${currency})</b><b class="money">${cents(total, currency, true)}</b></div>`).join('')}
      ${renderPaymentSourceSelector(totalUsdCents)}
      ${chatDraft.error ? `<p role="alert" style="color:var(--error)">${escapeHtml(chatDraft.error)}</p>` : ''}
      <div class="actions"><button type="button" class="btn btn-primary full" onclick="confirmGroupPayments()" ${chatDraft.paying || !canFundWithSource(totalUsdCents) ? 'disabled' : ''}>${chatDraft.paying ? 'Paying…' : 'Confirm demo payments'}</button></div>
    </section>`;
}

async function confirmGroupPayments() {
  const draft = chatDraft;
  if (draft?.paying || !draft?.attemptId || !validAskPaymentGroup()) return;
  const totalUsd = draft.recipients.reduce((s, r) => s + convertCents(r.amountCents, r.currency, 'USD'), 0);
  if (!canFundWithSource(totalUsd)) { draft.error = 'PayPal Wallet balance too low. Recharge or switch card.'; render(); return; }
  const fundingSource = currentFundingLabel();
  draft.paying = true; draft.error = ''; render();
  const payments = draft.recipients.map((r, index) => ({
    clientTxId: draft.attemptId + '-' + index,
    contactId: r.contactId,
    sourceAmountCents: r.amountCents,
    sourceCurrency: r.currency,
    fundingSource,
    note: r.reason,
  }));
  try {
    const isConn = backendMode && ledger;
    const transactions = isConn
      ? (await api('/api/organizer/demo-pay', { payments })).transactions
      : payments.map(p => {
          const contact = contactsList.find(c => c.id === p.contactId);
          return { ...p, ...fxQuote(p.sourceAmountCents, p.sourceCurrency, contact.currency), id: p.clientTxId, type: 'demo-send', recipientName: contact.name, country: contact.country || '', flag: contact.flag || '', status: 'Completed', demo: true, createdAt: new Date().toISOString() };
        });
    deductWalletIfSelected(totalUsd);
    transactions.forEach(tx => { tx.fundingSource ||= fundingSource; });
    const ids = new Set(transactions.map(tx => tx.id));
    demoTransactions = [...transactions, ...demoTransactions.filter(tx => !ids.has(tx.id))];
    if (!isConn) saveLocalState();
    groupPaymentReceipt = transactions;
    if (chatDraft === draft) chatDraft = null;
    go('payment-draft-receipt');
  } catch {
    draft.error = 'Could not confirm the demo payments. Try again.';
  } finally {
    draft.paying = false; render();
  }
}

function groupPaymentReceiptScreen() {
  if (!groupPaymentReceipt.length) return activityScreen();
  return screenHeader(groupPaymentReceipt.length + ' demo payments completed', '', 'activity', badge('Demo mode', 'preview')) +
    `<section class="narrow card">
      ${groupPaymentReceipt.map(tx => `<div class="row"><b>${escapeHtml(tx.recipientName)}</b><b class="money">${cents(tx.targetAmountCents ?? tx.sourceAmountCents, tx.targetCurrency || tx.sourceCurrency, true)}</b></div>`).join('')}
      <div class="actions"><a class="btn btn-primary full" href="#activity" onclick="event.preventDefault(); go('activity')">View Activity</a></div>
    </section>`;
}

function renderInlineAskDraft() {
  if (chatDraft.intent === 'send' && !chatDraft.needsClarification && chatDraft.recipients.length === 1) {
    const r = chatDraft.recipients[0];
    const contact = contactsList.find(x => x.id === r.contactId) || { name: r.name, currency: r.targetCurrency || r.currency };
    const q = fxQuote(r.amountCents, r.currency || 'USD', r.targetCurrency || r.currency || 'USD');
    return `<div class="fx-box">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:10px">
          ${contactAvatarHtml(contact, true)}
          <div>
            <b>${escapeHtml(r.name)}</b> · <b class="money">${cents(q.sourceAmountCents, q.sourceCurrency, true)}</b>
            ${q.sourceCurrency !== q.targetCurrency ? `<span class="sub"> (≈ ${cents(q.targetAmountCents, q.targetCurrency, true)} Demo rate)</span>` : ''}
            <div class="sub">Note: “${escapeHtml(r.reason)}”</div>
          </div>
        </div>
        <button type="button" class="btn btn-primary" onclick="handoffSendToReview()"><span>Review payment</span>${svg('arrow-right')}</button>
      </div>
    </div>`;
  }
  if (!chatDraft.editing && !chatDraft.needsClarification && validAskPaymentGroup()) {
    return `<div class="fx-box">
      <h2>Payment draft</h2>
      ${chatDraft.recipients.map(r => `<div class="row"><b>${escapeHtml(r.name)}</b><b class="money">${cents(r.amountCents, r.currency, true)}</b></div>`).join('')}
      <div class="actions">
        <button type="button" class="btn btn-secondary" onclick="chatDraft.editing = true; render()">Edit draft</button>
        <button type="button" class="btn btn-primary" onclick="openGroupPaymentReview()">Review ${chatDraft.recipients.length} payments</button>
      </div>
    </div>`;
  }
  const alloc = totalInCurrency(chatDraft.recipients.filter(r => r.contactId !== 'leah'), chatAttachedBill?.currency || chatDraft.recipients[0]?.currency || 'USD');
  const billTotal = chatAttachedBill?.totalCents || 0;
  return `<div style="margin-top:12px">
    ${chatDraft.needsClarification ? `<div class="callout warning" style="margin-top:0;margin-bottom:10px" role="alert">${svg('alert')}<span>${escapeHtml(chatDraft.clarificationPrompt || 'Confirm recipient details below or answer in chat.')}</span></div>` : ''}
    ${chatDraft.recipients.map((r, idx) => {
      const step = decimalsFor(r.currency || 'USD') === 0 ? '1' : '0.01';
      return `<div class="draft-row-card ${r.ambiguous || !r.known ? 'needs-fix' : ''}">
      <div class="draft-grid">
        <div class="field-group" style="margin-top:0"><label for="ask-rec-name-${idx}">Recipient</label><input id="ask-rec-name-${idx}" value="${escapeHtml(r.name)}" oninput="updateChatDraftRow(${idx}, 'name', this.value)"></div>
        <div class="field-group" style="margin-top:0"><label for="ask-rec-amt-${idx}">${escapeHtml(r.currency || 'USD')}</label><input id="ask-rec-amt-${idx}" type="number" min="0" step="${step}" value="${formatCentsInput(r.amountCents || 0, r.currency || 'USD')}" oninput="updateChatDraftRow(${idx}, 'amount', this.value)"></div>
        <div class="field-group" style="margin-top:0"><label for="ask-rec-reason-${idx}">Reason</label><input id="ask-rec-reason-${idx}" value="${escapeHtml(r.reason)}" oninput="updateChatDraftRow(${idx}, 'reason', this.value)"></div>
        <button type="button" class="btn-ghost-sm" onclick="chatDraft.recipients.splice(${idx},1); render()" aria-label="Remove">${svg('trash')}</button>
      </div>
      ${!r.known ? `<div class="chip-row" style="margin-top:8px"><small class="sub">Pick contact:</small>${contactsList.filter(c => c.id !== 'leah').map(c => `<button type="button" class="chip" onclick="resolveChatDraftContact(${idx}, '${escapeHtml(c.id)}')">${escapeHtml(c.name)} (${escapeHtml(c.currency)})</button>`).join('')}</div>` : ''}
    </div>`;
    }).join('')}
    ${billTotal > 0 ? `<div class="row"><span>Your share</span><b class="money" style="color:${billTotal - alloc === 0 ? 'var(--teal-ink)' : 'var(--amber)'}">${cents(Math.max(0, billTotal - alloc), chatAttachedBill.currency, true)}</b></div>` : ''}
    <div class="actions" style="margin-top:10px">
      <button type="button" class="btn btn-secondary" onclick="addChatDraftRow()">${svg('plus')}<span>Add person</span></button>
      ${chatDraft.intent === 'send'
        ? `<button type="button" class="btn btn-primary" onclick="openGroupPaymentReview()"><span>Review ${chatDraft.recipients.length} payments</span>${svg('arrow-right')}</button>`
        : `<button type="button" class="btn btn-primary" onclick="askConfirmSheetOpen = true; render()"><span>Create requests</span>${svg('arrow-right')}</button>`}
    </div>
  </div>`;
}

function renderAskConfirmSheet() {
  const recs = chatDraft?.recipients || [];
  const curr = recs[0]?.currency || 'USD';
  const total = totalInCurrency(recs, curr);
  return `<section class="card card-tint">
    <div class="section-title"><h2>Confirm requests</h2><button type="button" class="btn-ghost-sm" onclick="askConfirmSheetOpen = false; render()">Close</button></div>
    <p class="sub">Creates ${recs.length} request${recs.length === 1 ? '' : 's'} totaling <b class="money">${cents(total, curr, true)}</b>.</p>
    <div class="field-group">
      <label for="ask-confirm-channel">Settlement / delivery mode</label>
      <select id="ask-confirm-channel" onchange="askConfirmChannel = this.value">
        <option value="demo" ${askConfirmChannel === 'demo' ? 'selected' : ''}>Demo mode (auto-settles on Receiving screen)</option>
        <option value="link" ${askConfirmChannel === 'link' ? 'selected' : ''}>Private link &amp; QR (stays Created until shared)</option>
        <option value="email" ${askConfirmChannel === 'email' ? 'selected' : ''}>Email gateway (${providers.emailConfigured ? 'configured' : 'not configured — stays Created'})</option>
        <option value="sms" ${askConfirmChannel === 'sms' ? 'selected' : ''}>SMS gateway (${providers.smsConfigured ? 'configured' : 'not configured — stays Created'})</option>
      </select>
    </div>
    <div class="actions"><button type="button" class="btn btn-primary full" onclick="confirmAskRequests()"><span>Confirm &amp; create</span>${svg('check')}</button></div>
  </section>`;
}

function renderAskReceiptCard() {
  const b = chatAttachedBill;
  return `<section class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:10px">
        ${chatAttachedImg ? `<img src="${escapeHtml(chatAttachedImg)}" alt="Attached receipt" style="width:54px;height:54px;object-fit:cover;border-radius:10px;border:1px solid var(--line)">` : ''}
        <div><b>Attached receipt</b><br><small class="sub">${chatExtractState === 'loading' ? 'Extracting items &amp; total…' : escapeHtml(b?.merchant || 'Ready to edit')}</small></div>
      </div>
      <div style="display:flex;gap:6px">
        <button type="button" class="btn-ghost-sm" onclick="chatAttachedBill = null; chatAttachedImg = ''; chatAttachedRawImg = ''; render()">Remove</button>
      </div>
    </div>
    ${b && chatExtractState !== 'loading' ? `<div style="margin-top:10px">
      <div class="row"><span>Merchant</span><b>${escapeHtml(b.merchant)}</b></div>
      <div class="row"><span>Total</span><b class="money">${cents(b.totalCents, b.currency || 'USD', true)}</b></div>
    </div>` : ''}
  </section>`;
}

async function extractAskAttachedBill(sample = false) {
  chatExtractState = 'loading'; chatExtractError = ''; chatAttachedBill = null; render();
  if (sample) {
    chatAttachedBill = { merchant: 'Olive Kitchen', date: '2026-11-10', currency: 'USD', items: [{ name: 'Pasta Dinner Bowl', amountCents: 2000 }, { name: 'Craft Drinks (2)', amountCents: 1500 }, { name: 'Shared Herb Flatbread', amountCents: 700 }], taxCents: 0, tipCents: 0, totalCents: 4200, unreadableFields: [], totalMismatch: false };
    chatExtractState = 'ready'; render(); return;
  }
  try {
    chatAttachedBill = await extractReceipt(chatAttachedImg);
    chatExtractState = 'ready'; render();
  } catch (e) {
    chatExtractState = 'error'; chatExtractError = e.message;
    chatAttachedBill = { merchant: '', date: '', currency: 'USD', items: [], taxCents: 0, tipCents: 0, totalCents: 0, unreadableFields: ['merchant', 'total'] };
    render();
  }
}

async function startAskMic() {
  cancelAskSpeech();
  micError = '';
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    try {
      micState = 'listening'; render();
      speechRecognition = new SR();
      speechRecognition.lang = 'en-US'; speechRecognition.interimResults = true;
      speechRecognition.onresult = e => { askComposerText = [...e.results].map(r => r[0].transcript).join(' ').trim(); const el = document.querySelector('#ask-input'); if (el) el.value = askComposerText; };
      speechRecognition.onerror = ev => { micState = ev.error === 'not-allowed' ? 'denied' : 'unavailable'; micError = ev.error === 'not-allowed' ? 'Microphone denied. Type below.' : 'Speech unavailable. Type below.'; render(); };
      speechRecognition.onend = () => { if (micState === 'listening') { micState = 'idle'; if (askAutoSendMic && askComposerText.trim()) submitAskTurn(askComposerText); else render(); } };
      speechRecognition.start();
      return;
    } catch {}
  }
  try {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw Object.assign(new Error('No mic'), { name: 'NotFoundError' });
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micChunks = []; micRecorder = new MediaRecorder(stream);
    micRecorder.ondataavailable = e => { if (e.data.size) micChunks.push(e.data); };
    micRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      micState = 'transcribing'; render();
      try {
        const blob = new Blob(micChunks, { type: micRecorder.mimeType || 'audio/webm' });
        const b64 = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result || '').split(',')[1] || ''); r.onerror = reject; r.readAsDataURL(blob); });
        const res = await api('/api/organizer/transcribe', { audioBase64: b64, mimeType: blob.type });
        askComposerText = (res.transcript || '').trim(); micState = 'idle';
        if (askAutoSendMic && askComposerText) await submitAskTurn(askComposerText); else render();
      } catch (e) { micState = 'unavailable'; micError = e.message; render(); }
    };
    micRecorder.start(); micState = 'listening'; render();
  } catch (e) {
    const denied = e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError';
    micState = denied ? 'denied' : 'unavailable';
    micError = denied ? 'Microphone permission denied. Type your message below.' : 'Microphone unavailable in this browser. Type your message below.';
    render();
  }
}

function stopAskMic() {
  try { speechRecognition?.stop(); } catch {}
  try { if (micRecorder && micRecorder.state === 'recording') micRecorder.stop(); else micState = 'idle'; } catch { micState = 'idle'; }
  render();
}

function askTurnIntent(text, parsedIntent) {
  const command = text.match(/\b(send|pay|transfer|give|request|charge|owes?|split|ask(?=\s+\w+\s+for\b))\b/i)?.[1].toLowerCase();
  if (command) return ['send', 'pay', 'transfer', 'give'].includes(command) ? 'send' : 'request';
  return chatDraft?.intent || parsedIntent || 'request';
}

function parseLocalTurn(text) {
  const raw = String(text || '').trim();
  const low = raw.toLowerCase();
  const sendIntent = askTurnIntent(low) === 'send';
  const wordNum = { ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, eighty: 80, hundred: 100 };
  const rows = [];
  const segs = sendIntent && !/\band\b[^.]*?\d/i.test(raw) ? [raw] : raw.split(/\band\b|;/i);
  const amountPattern = /-?[$¥£€₹]?(-?\d+(?:,\d{3})*(?:\.\d{1,2})?)|\b(ten|fifteen|twenty|thirty|forty|fifty|eighty|hundred)\b/gi;
  const amounts = [...raw.matchAll(amountPattern)];
  const sharedAmount = amounts.length === 1 && /\b(each|apiece)\b/i.test(raw) ? amounts[0] : null;
  for (const seg of segs) {
    const localAmount = [...seg.matchAll(amountPattern)][0];
    const mAmt = localAmount || sharedAmount;
    const matched = contactsList.find(c => new RegExp('\\b' + c.name.split(' ')[0] + '\\b', 'i').test(seg));
    if (!mAmt && (!matched || !amounts.length)) continue;
    const valMajor = !mAmt || mAmt[0].startsWith('-') ? 0 : mAmt[1] ? Number(mAmt[1].replaceAll(',', '')) : wordNum[mAmt[2].toLowerCase()];
    const valCents = Math.round(valMajor * 100);
    const wordAfter = seg.match(/\b(?:ask|for|from|send|pay|give|to)\s+([A-Z][a-z]+)\b/);
    const rawName = matched ? matched.name : (wordAfter?.[1] || '');
    const context = localAmount ? seg : raw;
    const before = mAmt ? context.slice(0, mAmt.index) : '';
    const after = mAmt ? context.slice(mAmt.index + mAmt[0].length) : '';
    const prefix = before.match(/(?:\b(?:USD|GBP|CAD|EUR|JPY|INR)|CA|US)\s*$/i)?.[0] || '';
    const suffix = after.match(/^\s*(?:USD|GBP|CAD|EUR|JPY|INR|yen|pounds?|euros?|rupees?|dollars?)\b/i)?.[0] || '';
    const currencyText = prefix + (mAmt?.[0] || '') + suffix;
    const code = currencyText.match(/\b(USD|GBP|CAD|EUR|JPY|INR)\b/i)?.[1];
    const currency = code?.toUpperCase()
      || (/¥|\byen\b/i.test(currencyText) ? 'JPY' : '')
      || (/£|\bpounds?\b/i.test(currencyText) ? 'GBP' : '')
      || (/€|\beuros?\b/i.test(currencyText) ? 'EUR' : '')
      || (/₹|\brupees?\b/i.test(currencyText) ? 'INR' : '')
      || (currencyText.includes('CA$') ? 'CAD' : '')
      || (/\$|\bdollars?\b/i.test(currencyText) ? 'USD' : '')
      || (sendIntent ? matched?.currency : chatAttachedBill?.currency)
      || 'USD';
    const noteMatch = seg.match(/(?:saying|for|note)\s+(.+)$/i) || raw.match(/(?:saying|for)\s+(.+)$/i);
    const note = (noteMatch?.[1] || (sendIntent ? 'Thanks' : 'Shared expense')).replace(/[.?!]+$/, '').trim();
    const q = fxQuote(valCents, currency, matched?.currency || currency);
    rows.push({
      id: `draft-${rows.length + 1}`,
      name: matched?.name || rawName || 'Unknown',
      contactId: matched?.id || null,
      country: matched?.country || '',
      flag: matched?.flag || '',
      known: Boolean(matched),
      unknownContact: Boolean(rawName && !matched),
      ambiguous: !matched || valCents <= 0,
      amountCents: valCents,
      currency,
      targetCurrency: matched?.currency || currency,
      targetAmountCents: q.targetAmountCents,
      reason: note,
    });
  }
  if (!rows.length && chatDraft?.recipients?.some(r => !r.known)) {
    const clarifyMatch = contactsList.find(c => new RegExp('\\b' + c.name + '\\b', 'i').test(raw));
    if (clarifyMatch) {
      const updated = chatDraft.recipients.map(r => r.known ? r : { ...r, name: clarifyMatch.name, contactId: clarifyMatch.id, country: clarifyMatch.country, flag: clarifyMatch.flag, known: true, unknownContact: false, ambiguous: false, targetCurrency: clarifyMatch.currency });
      const parts = updated.map(r => `${r.name} owes ${cents(r.amountCents, r.currency, true)} for ${r.reason}`);
      return { intent: chatDraft.intent, recipients: updated, resolvedContact: true, needsClarification: false, clarificationPrompt: '', modelUsed: 'Offline parser', replyText: `${parts.join(' and ')}. Ready to create both requests?` };
    }
  }
  const intent = sendIntent ? 'send' : 'request';
  const needsClarification = rows.length === 0 || rows.some(r => r.ambiguous);
  let replyText = '';
  if (needsClarification) {
    const u = rows.find(r => r.unknownContact);
    replyText = u ? `Did you mean someone in your contacts instead of "${u.name}"?` : 'Who is this for, and what amount?';
  } else if (intent === 'send' && rows.length === 1) {
    const r = rows[0];
    const q = fxQuote(r.amountCents, r.currency, r.targetCurrency);
    replyText = `Prepared ${cents(q.sourceAmountCents, q.sourceCurrency, true)}${q.sourceCurrency !== q.targetCurrency ? ` (about ${cents(q.targetAmountCents, q.targetCurrency, true)} Demo rate)` : ''} for ${r.name}${r.country ? ` in ${r.country}` : ''} saying ${r.reason}. Verify the recipient and amount before you pay.`;
  } else if (intent === 'send') {
    replyText = 'Review the payments when you’re ready.';
  } else {
    const parts = rows.map(r => `${r.name} owes ${cents(r.amountCents, r.currency, true)} for ${r.reason}`);
    replyText = parts.length === 2 ? `${parts[0]} and ${parts[1]}. Ready to create both requests?` : `${parts.join(', ')}. Ready to create?`;
  }
  return { intent, recipients: rows, needsClarification, clarificationPrompt: needsClarification ? replyText : '', modelUsed: 'Offline parser', replyText };
}

function equalReceiptDraft(text) {
  if (!(chatAttachedBill?.totalCents > 0)) return null;
  const match = text.match(/^split\b[^0-9]*?\b(?:between|among|with)\s+(.+?)[.!?]?$/i);
  if (!match) return null;
  const people = match[1].split(/\band\b|,/i).map(name => name.trim().toLowerCase()).filter(Boolean);
  const selected = people.map(name => contactsList.find(c => c.name.toLowerCase() === name || (name === 'me' && c.id === 'leah')));
  if (selected.includes(undefined)) return null;
  const contacts = [...new Set(selected)];
  if (contacts.length < 2) return null;
  const { currency, totalCents, merchant } = chatAttachedBill;
  const share = equalShare(totalCents, contacts.length, currency);
  const recipients = contacts.map(contact => ({ name: contact.name, contactId: contact.id, known: true, amountCents: contact.id === 'leah' ? totalCents - share * (contacts.length - 1) : share, currency, targetCurrency: contact.currency, reason: merchant || 'Receipt split' }));
  return { intent: 'request', recipients, needsClarification: share <= 0, replyText: share > 0 ? 'I split the receipt evenly. Your share includes the remainder.' : 'This total is too small to split evenly.' };
}

function parseStoreBuyLocal(text) {
  const low = String(text || '').trim().toLowerCase();
  if (!low || !/\b(buy|order|purchase|shop|get)\b/i.test(low)) return null;
  const kwMap = {
    'kit-essentials': ['kitchen', 'essentials', 'cookware', 'bundle', 'pots', 'pans'],
    'desk-lamp': ['lamp', 'desk lamp', 'light'],
    'electric-kettle': ['kettle', 'electric kettle', 'boiler'],
    'ceramic-dinnerware': ['dinnerware', 'plates', 'bowls', 'stoneware', 'dishes'],
    'french-press': ['french press', 'coffee carafe', 'carafe', 'coffee press'],
    'hepa-purifier': ['purifier', 'hepa', 'air filter'],
    'bamboo-organizer': ['bamboo', 'organizer', 'drawer', 'tray'],
    'pantry-containers': ['pantry', 'containers', 'canister', 'jars'],
    'microfiber-kit': ['microfiber', 'cloths', 'cleaning cloths'],
    'usb-c-strip': ['surge', 'usb', 'power strip', 'outlet'],
    'bath-towels': ['bath towel', 'bath towels', 'towel', 'towels'],
  };
  let best = null;
  let bestScore = 0;
  for (const product of storeCatalog) {
    let score = 0;
    if (low.includes(product.name.toLowerCase())) score += 10;
    if (low.includes(product.id.toLowerCase())) score += 8;
    for (const kw of (kwMap[product.id] || [])) {
      if (low.includes(kw)) score += kw.includes(' ') ? 5 : 3;
    }
    if (score > bestScore) { bestScore = score; best = product; }
  }
  if (!best || bestScore <= 0) return null;
  const wordQty = { two: 2, three: 3, four: 4, five: 5 };
  const m = low.match(/\b(?:buy|order|purchase|get)\s+(?:(\d{1,2})|(two|three|four|five))\b/i);
  const rawQty = m ? (m[1] ? Number(m[1]) : wordQty[m[2].toLowerCase()] || 1) : 1;
  return { product: best, qty: Math.max(1, Math.min(20, rawQty)) };
}

async function submitAskTurn(overrideText = null) {
  const inputEl = document.querySelector('#ask-input');
  const text = String(overrideText ?? (inputEl?.value ?? askComposerText)).trim();
  if (!text || askBusy || chatDraft?.paying || micState === 'listening' || micState === 'transcribing') return;
  cancelAskSpeech();
  askComposerText = '';
  if (inputEl) inputEl.value = '';
  chatHistory.push({ id: `u-${Date.now()}`, role: 'user', text });
  const storeBuy = chatAttachedBill ? null : parseStoreBuyLocal(text);
  if (storeBuy) {
    chatStoreBuy = storeBuy;
    chatDraft = null;
    askConfirmSheetOpen = false;
    const subtotal = storeBuy.product.priceCents * storeBuy.qty;
    const msgId = 'a-' + Date.now();
    const replyText = `Prepared ${storeBuy.qty} × ${storeBuy.product.name} (${cents(subtotal, 'USD', true)}). Tap Buy now to purchase, or Add to Cart.`;
    chatHistory.push({ id: msgId, role: 'assistant', text: replyText, modelUsed: 'Store AI' });
    askAudioMsgId = msgId;
    render();
    if (askVoiceOn && backendMode && ledger && ['#ask', '#talk'].includes(location.hash)) {
      await synthesizeAndPlayAskReply(replyText, msgId, false);
    }
    return;
  }
  chatStoreBuy = null;
  askBusy = true; render();

  const equalDraft = equalReceiptDraft(text);
  let parsed = equalDraft;
  if (!parsed && (!backendMode || !ledger)) parsed = parseLocalTurn(text);
  else if (!parsed) {
    try { parsed = await api('/api/organizer/parse-request', { transcript: text, bill: chatAttachedBill, currentDraft: chatDraft?.recipients || null, lastIntent: chatDraft?.intent || '' }); }
    catch (e) { parsed = parseLocalTurn(text); parsed.modelUsed = `Fallback (${e.message})`; }
  }

  askBusy = false;
  const intent = askTurnIntent(text, parsed.intent);
  const replace = equalDraft || /\b(start over|replace (?:the |this )?draft|only (?:send|pay|give|request|charge))\b/i.test(text);
  const updates = parsed.recipients || [];
  const rows = !replace && !parsed.resolvedContact && intent === chatDraft?.intent ? [...(chatDraft?.recipients || [])] : [];
  for (const row of updates) {
    const index = rows.findIndex(prior => prior.contactId && row.contactId ? prior.contactId === row.contactId : prior.name.trim().toLowerCase() === row.name.trim().toLowerCase());
    if (index < 0) rows.push(row); else rows[index] = row;
  }
  askConfirmSheetOpen = false;
  chatDraft = { intent, recipients: rows, needsClarification: Boolean(parsed.needsClarification) || rows.some(r => r.ambiguous), clarificationPrompt: parsed.clarificationPrompt || '', modelUsed: parsed.modelUsed || '' };
  const msgId = 'a-' + Date.now();
  const fullReply = intent === 'send' && rows.length > 1 && !chatDraft.needsClarification
    ? 'Your draft has ' + rows.length + ' payments. Review the payments when you’re ready.'
    : parsed.replyText || 'Draft updated.';
  const replyText = fullReply.length > 390 ? fullReply.slice(0, 387) + '…' : fullReply;
  chatHistory.push({ id: msgId, role: 'assistant', text: replyText, modelUsed: parsed.modelUsed || '' });
  askAudioMsgId = msgId;

  if (chatDraft.intent === 'send' && !chatDraft.needsClarification && chatDraft.recipients.length === 1) {
    const r = chatDraft.recipients[0];
    const c = contactsList.find(x => x.id === r.contactId) || contactsList.find(x => x.name.toLowerCase() === r.name.toLowerCase());
    if (c) {
      const q = fxQuote(r.amountCents, r.currency || 'USD', c.currency || r.currency || 'USD', 'send');
      transferForm = {
        contactId: c.id,
        amountStr: formatCentsInput(q.sourceAmountCents, q.sourceCurrency),
        enteredSide: 'send',
        sourceCurrency: q.sourceCurrency,
        targetCurrency: q.targetCurrency,
        note: r.reason || '',
        clientTxId: `tx-${Date.now().toString(36)}`,
        busy: false,
        error: '',
        reviewSourceCents: q.sourceAmountCents,
        reviewTargetCents: q.targetAmountCents,
        reviewRate: q.rate,
        reviewRateDate: fxRateDate,
        returnParent: 'ask',
      };
    }
  }

  render();
  const advance = chatDraft.intent === 'send' && chatDraft.recipients.length === 1 && !chatDraft.needsClarification && Boolean(transferForm.contactId);
  if (askVoiceOn && backendMode && ledger && ['#ask', '#talk'].includes(location.hash)) {
    await synthesizeAndPlayAskReply(replyText, msgId, advance);
  } else if (advance) {
    go('review-transfer');
  }
}

async function synthesizeAndPlayAskReply(text, msgId, autoTransitionSend = false) {
  const myEpoch = ++ttsEpoch;
  ttsAbortCtrl = new AbortController();
  askAudioState = 'loading'; askAudioError = ''; askAudioSrc = ''; render();
  if (!backendMode || !ledger) { askAudioState = 'unavailable'; askAudioError = 'Voice synthesis requires connected backend.'; render(); return; }
  try {
    const res = await api('/api/organizer/read-text', { text }, 24000, ttsAbortCtrl.signal);
    if (myEpoch !== ttsEpoch) return;
    askAudioSrc = 'data:audio/wav;base64,' + res.audio; askAudioMsgId = msgId;
    await playCurrentAskAudio(false, myEpoch, autoTransitionSend);
  } catch (e) {
    if (e?.name === 'AbortError' || myEpoch !== ttsEpoch) return;
    askAudioState = 'unavailable'; askAudioError = e.message; render();
  }
}

async function playCurrentAskAudio(fromUserTap = false, expectedEpoch = ttsEpoch, autoTransitionSend = false) {
  if (!askAudioSrc || expectedEpoch !== ttsEpoch) return;
  if (activeAudioEl) { try { activeAudioEl.pause(); activeAudioEl.currentTime = 0; } catch {} }
  if (typeof Audio === 'undefined') { askAudioState = 'ready'; render(); return; }
  const audio = new Audio(askAudioSrc); activeAudioEl = audio;
  audio.onended = () => {
    if (expectedEpoch !== ttsEpoch) return;
    askAudioState = 'ready'; activeAudioEl = null; render();
    if (autoTransitionSend && location.hash.startsWith('#ask')) {
      pendingSendTransitionTimer = setTimeout(() => { if (location.hash.startsWith('#ask') && transferForm.contactId) go('review-transfer'); }, 350);
    }
  };
  try {
    askAudioState = 'playing'; render(); await audio.play();
  } catch {
    if (expectedEpoch !== ttsEpoch) return;
    askAudioState = fromUserTap ? 'unavailable' : 'blocked';
    if (fromUserTap) askAudioError = 'Playback failed in browser audio output.';
    render();
  }
}

function stopAskPlayback() { cancelAskSpeech(); render(); }
function handoffSendToReview() { cancelAskSpeech(); transferForm.returnParent = 'ask'; go('review-transfer'); }

function updateChatDraftRow(idx, field, val) {
  const r = chatDraft?.recipients?.[idx]; if (!r) return;
  if (field === 'amount') { r.amountCents = parseMajorToCents(val, r.currency || 'USD'); r.ambiguous = !r.known || r.amountCents <= 0; }
  else if (field === 'name') {
    r.name = val;
    const match = contactsList.find(c => c.name.toLowerCase() === val.trim().toLowerCase());
    r.known = Boolean(match); r.contactId = match?.id || null; r.ambiguous = !match;
    if (match) { r.flag = match.flag; r.country = match.country; r.targetCurrency = match.currency; }
  } else r[field] = val;
  chatDraft.attemptId = null;
}

function resolveChatDraftContact(idx, contactId) {
  const c = contactsList.find(x => x.id === contactId); if (!c || !chatDraft?.recipients?.[idx]) return;
  const r = chatDraft.recipients[idx];
  chatDraft.recipients[idx] = { ...r, name: c.name, contactId: c.id, flag: c.flag, country: c.country, targetCurrency: c.currency, known: true, unknownContact: false, ambiguous: false };
  chatDraft.needsClarification = chatDraft.recipients.some(x => x.ambiguous);
  chatDraft.attemptId = null; render();
}

function addChatDraftRow() {
  chatDraft ||= { intent: 'request', recipients: [], needsClarification: false };
  chatDraft.recipients.push({ id: `draft-${chatDraft.recipients.length + 1}`, name: 'Maya', contactId: 'maya', known: true, ambiguous: false, amountCents: 1000, currency: 'USD', targetCurrency: 'USD', reason: 'Shared expense' });
  render();
}

async function confirmAskRequests() {
  if (!chatDraft?.recipients?.length) return;
  cancelAskSpeech();
  const valid = chatDraft.recipients.filter(r => r.contactId !== 'leah' && r.name.trim() && r.amountCents > 0);
  if (!valid.length) { toast('Add at least one recipient with a positive amount.'); return; }
  const currency = chatAttachedBill?.currency || valid[0].currency || 'USD';
  const total = totalInCurrency(valid, currency);
  const created = await persistRequestRecord({
    title: chatAttachedBill?.merchant || (valid.length === 1 ? `Request from ${valid[0].name}` : valid.map(r => r.name).join(', ')),
    merchant: chatAttachedBill?.merchant || 'Ask AI request',
    billDate: chatAttachedBill?.date || '',
    kind: chatAttachedBill ? 'receipt' : 'request',
    currency,
    items: chatAttachedBill?.items || [],
    taxCents: chatAttachedBill?.taxCents || 0,
    tipCents: chatAttachedBill?.tipCents || 0,
    totalCents: chatAttachedBill?.totalCents || total,
    evidenceImageDataUrl: chatAttachedImg || '',
    transcript: chatHistory.filter(x => x.role === 'user').at(-1)?.text || '',
    channel: askConfirmChannel,
    demoAutoSettle: askConfirmChannel === 'demo',
    recipients: valid,
  });
  askConfirmSheetOpen = false;
  if (created) go(`request/${created.id}`);
}

// ---------- Standalone Scan a Bill (#scan-bill) ----------
function openScanBillEntry() {
  billRawImage = ''; billCroppedImage = ''; billDraft = null; billExtractState = 'idle'; billExtractError = ''; billRecipientIds = [];
  go('scan-bill');
}

function scanBillScreen() {
  const hasPhoto = Boolean(billCroppedImage || billRawImage);
  let cameraFrame = '';
  if (billCameraState === 'scanning') cameraFrame = `<span class="camera-badge">Live receipt camera</span><video id="bill-cam-video" autoplay playsinline muted></video>`;
  else if (hasPhoto) cameraFrame = `<span class="camera-badge">Captured receipt</span><img src="${escapeHtml(billCroppedImage || billRawImage)}" alt="Captured receipt" class="crop-canvas">`;
  else if (billCameraState === 'denied') cameraFrame = `<div class="center"><div class="result-icon cancelled">${svg('receipt-camera')}</div><h2 style="color:#fff">Camera permission unavailable</h2><p style="color:#DCE1E8;margin-top:6px">Upload a receipt image or enter fields manually below.</p></div>`;
  else cameraFrame = `<span class="camera-badge">Receipt capture</span><div class="center"><div class="icon-box" style="width:56px;height:56px;margin:0 auto 12px">${svg('receipt-camera')}</div><h2 style="color:#fff">Capture or upload a receipt</h2><p style="color:#DCE1E8;margin-top:6px">Align merchant, items, and total, or choose an image file.</p></div>`;

  return screenHeader('Scan a Bill', 'Photograph or upload a receipt, edit fields, then split', 'home', badge('Demo mode', 'preview'))
    + `<div class="split-grid">
      <div>
        <div class="camera-frame">${cameraFrame}</div>
        <div class="card bill-capture-actions">
          <div class="actions">
            ${billCameraState === 'scanning'
              ? `<button type="button" class="btn btn-primary" onclick="captureStandaloneBillPhoto()">${svg('receipt-camera')}<span>Capture photo</span></button><button type="button" class="btn btn-secondary" onclick="stopStandaloneBillCamera()">Stop camera</button>`
              : `<button type="button" class="btn btn-primary" onclick="startStandaloneBillCamera()">${svg('receipt-camera')}<span>${hasPhoto ? 'Retake photo' : 'Open camera'}</span></button><button type="button" class="btn btn-secondary" onclick="useStandaloneDemoReceipt()">${svg('receipt')}<span>Use sample receipt</span></button>`}
          </div>
          <div class="field-group">
            <label for="standalone-bill-upload">Upload receipt photo (PNG / JPEG / WebP)</label>
            <input id="standalone-bill-upload" type="file" accept="image/png,image/jpeg,image/webp" onchange="handleStandaloneBillUpload(this)">
          </div>
          ${billCameraMessage ? `<div class="callout warning" role="alert">${svg('alert')}<span>${escapeHtml(billCameraMessage)}</span></div>` : ''}
          ${!billDraft && billExtractState === 'idle' ? `<div class="actions"><button type="button" class="btn-ghost-sm" onclick="billDraft = {merchant:'',date:'',currency:'USD',items:[{name:'',amountCents:0}],taxCents:0,tipCents:0,totalCents:0}; billExtractState='ready'; render()">Enter receipt manually</button></div>` : ''}
        </div>
      </div>
      <div class="card">
        <h2>Extracted details</h2>
        ${billExtractState === 'idle' && !billDraft ? `<p class="sub" style="margin-top:8px">Capture or upload a receipt photo (or tap <b>Use sample receipt</b>) to extract editable fields.</p>` : ''}
        ${billExtractState === 'loading' ? `<div class="callout">${svg('sparkles')}<span>Extracting merchant, date, items, and total…</span></div><div class="skeleton" style="margin-top:10px;width:85%"></div><div class="skeleton" style="width:65%"></div>` : ''}
        ${billExtractState === 'error' ? `<div class="callout warning" role="alert">${svg('alert')}<span>${escapeHtml(billExtractError)} Enter the receipt details below.</span></div>` : ''}
        ${billDraft && billExtractState !== 'loading' ? renderStandaloneBillEditor() : ''}
      </div>
    </div>`;
}

function billAmountCents(value) { return parseMajorToCents(value, billDraft.currency || 'USD'); }
function changeBillCurrency(currency) {
  billDraft.currency = currency;
  if (currency === 'JPY') {
    billDraft.totalCents = Math.round((billDraft.totalCents || 0) / 100) * 100;
    for (const item of billDraft.items || []) item.amountCents = Math.round((item.amountCents || 0) / 100) * 100;
  }
  render();
}

function renderStandaloneBillEditor() {
  const b = billDraft;
  const currency = normCurr(b.currency);
  const dec = decimalsFor(currency);
  const step = dec ? '0.01' : '1';
  const sum = (b.items || []).reduce((s, i) => s + (i.amountCents || 0), 0) + (b.taxCents || 0) + (b.tipCents || 0);
  const mismatch = b.totalCents > 0 && sum > 0 && Math.abs(b.totalCents - sum) > 1;
  const chosen = contactsList.filter(c => billRecipientIds.includes(c.id));
  return `<div class="bill-editor">
    ${mismatch ? `<div class="callout error">${svg('alert')}<span>Items = ${cents(sum, currency, true)} vs total ${cents(b.totalCents, currency, true)}.</span><button type="button" class="btn-ghost-sm" onclick="billDraft.totalCents=${sum}; render()">Match</button></div>` : ''}
    <div class="bill-fields">
      <div class="field-group"><label for="sb-merch">Merchant</label><input id="sb-merch" value="${escapeHtml(b.merchant)}" oninput="billDraft.merchant = this.value"></div>
      <div class="bill-adjacent-fields">
        <div class="field-group"><label for="sb-date">Bill date</label><input id="sb-date" type="date" value="${escapeHtml(b.date || '')}" oninput="billDraft.date = this.value"></div>
        <div class="field-group"><label for="sb-currency">Currency</label><select id="sb-currency" onchange="changeBillCurrency(this.value)">${CURRENCIES.map(code => `<option value="${code}" ${code === currency ? 'selected' : ''}>${code}</option>`).join('')}</select></div>
      </div>
      <div class="field-group"><label for="sb-total">Total (${currency})</label><input id="sb-total" type="number" min="0" step="${step}" value="${formatCentsInput(b.totalCents || 0, currency)}" oninput="billDraft.totalCents = billAmountCents(this.value)"></div>
    </div>
    <div class="section-title" style="margin:12px 0 6px"><h3>Line items</h3><button type="button" class="btn-ghost-sm" onclick="billDraft.items.push({name:'',amountCents:0}); render()">+ Add item</button></div>
    ${(b.items || []).map((it, idx) => `<div class="bill-adjacent-fields bill-item">
      <div class="field-group"><label for="bill-item-${idx}">Item name</label><input id="bill-item-${idx}" value="${escapeHtml(it.name)}" oninput="billDraft.items[${idx}].name = this.value"></div>
      <div style="display:flex;gap:6px;align-items:end"><div class="field-group" style="flex:1"><label for="bill-amount-${idx}">Amount (${currency})</label><input id="bill-amount-${idx}" type="number" min="0" step="${step}" value="${formatCentsInput(it.amountCents || 0, currency)}" oninput="billDraft.items[${idx}].amountCents = billAmountCents(this.value)"></div>${b.items.length > 1 ? `<button type="button" class="btn-ghost-sm" onclick="billDraft.items.splice(${idx},1); render()" aria-label="Remove item">${svg('trash')}</button>` : ''}</div>
    </div>`).join('')}
    <h3 style="margin-top:12px">Split with contacts</h3>
    <div class="contact-cards" style="margin-top:8px">
      ${contactsList.filter(c => c.id !== 'leah').map(c => `<button type="button" class="contact-card" aria-pressed="${billRecipientIds.includes(c.id)}" onclick="toggleBillRecipient('${escapeHtml(c.id)}')">${contactAvatarHtml(c, true)}<span><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.currency || 'USD')}</small></span></button>`).join('')}
    </div>
    <div class="actions">
      <button type="button" class="btn btn-secondary" onclick="handoffBillToAsk()">${svg('mic')}<span>Split in Ask AI</span></button>
      <button type="button" class="btn btn-primary" onclick="createRequestsFromBill()" ${!chosen.length || !(b.totalCents > 0) ? 'disabled' : ''}><span>Create requests</span>${svg('arrow-right')}</button>
    </div>
  </div>`;
}

function toggleBillRecipient(id) { const i = billRecipientIds.indexOf(id); if (i >= 0) billRecipientIds.splice(i, 1); else billRecipientIds.push(id); render(); }
function handoffBillToAsk() { chatAttachedRawImg = billRawImage; chatAttachedImg = billCroppedImage || billRawImage; chatAttachedBill = billDraft; chatExtractState = 'ready'; go('ask'); }
async function createRequestsFromBill() {
  const chosen = contactsList.filter(c => billRecipientIds.includes(c.id));
  if (!chosen.length || !billDraft || !(billDraft.totalCents > 0)) return;
  const total = billDraft.totalCents;
  const share = equalShare(total, chosen.length, billDraft.currency);
  if (share <= 0) { toast('Total is too small for positive shares.'); return; }
  const recs = chosen.map(c => ({ name: c.name, contactId: c.id, amountCents: share, currency: billDraft.currency || 'USD', targetCurrency: c.currency || 'USD', reason: billDraft.merchant || 'Receipt split' }));
  const created = await persistRequestRecord({ title: billDraft.merchant || 'Receipt split', merchant: billDraft.merchant || 'Photographed bill', billDate: billDraft.date || '', kind: 'receipt', currency: billDraft.currency || 'USD', items: billDraft.items || [], taxCents: billDraft.taxCents || 0, tipCents: billDraft.tipCents || 0, totalCents: total, evidenceImageDataUrl: billCroppedImage || billRawImage, channel: 'demo', demoAutoSettle: true, recipients: recs });
  if (created) go(`request/${created.id}`);
}

async function startStandaloneBillCamera() {
  billCameraState = 'scanning'; billCameraMessage = ''; render();
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('No camera'), { name: 'NotFoundError' });
    billStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const v = document.querySelector('#bill-cam-video'); if (v) v.srcObject = billStream;
  } catch (e) {
    const denied = e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError';
    billCameraState = denied ? 'denied' : 'unavailable';
    billCameraMessage = denied ? 'Camera permission denied. Upload a photo or use manual entry.' : 'Camera hardware unavailable. Upload a receipt photo or use sample receipt.';
    render();
  }
}
function stopStandaloneBillCamera() { stopStreams(); billCameraState = 'ready'; render(); }
function captureStandaloneBillPhoto() {
  const v = document.querySelector('#bill-cam-video'); if (!v || !v.videoWidth) { toast('Waiting for camera frame…'); return; }
  const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0);
  billRawImage = c.toDataURL('image/jpeg', 0.88); billCroppedImage = billRawImage; stopStreams(); billCameraState = 'ready'; extractStandaloneBill();
}
function handleStandaloneBillUpload(input) {
  const f = input?.files?.[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { billRawImage = String(r.result || ''); billCroppedImage = billRawImage; extractStandaloneBill(); };
  r.readAsDataURL(f);
}
function useStandaloneDemoReceipt() {
  stopStreams(); billCameraState = 'ready'; billRawImage = createSampleReceiptDataUrl(); billCroppedImage = billRawImage; extractStandaloneBill(true);
}
async function extractStandaloneBill(sample = false) {
  billExtractState = 'loading'; billExtractError = ''; billDraft = null; render();
  if (sample) {
    billDraft = { merchant: 'Olive Kitchen', date: '2026-11-10', currency: 'USD', items: [{ name: 'Pasta Dinner Bowl', amountCents: 2000 }, { name: 'Craft Drinks (2)', amountCents: 1500 }, { name: 'Shared Herb Flatbread', amountCents: 700 }], taxCents: 0, tipCents: 0, totalCents: 4200, unreadableFields: [], totalMismatch: false };
    billExtractState = 'ready'; render(); return;
  }
  try { billDraft = await extractReceipt(billCroppedImage); billExtractState = 'ready'; render(); }
  catch (e) { billExtractState = 'error'; billExtractError = e.message; billDraft = { merchant: '', date: '', currency: 'USD', items: [{ name: '', amountCents: 0 }], taxCents: 0, tipCents: 0, totalCents: 0 }; render(); }
}

// ---------- Shared Blank Household Bill Flow: Electricity (#electricity) & Rent (#rent) ----------
function openRentFlow() {
  rentForm = { creating: false, contactIds: [], amountStr: '', currency: 'USD', dueDate: '', mode: 'equal', customAmounts: {}, saveRule: false, busy: false, error: '', review: false, clientRequestId: '' };
  go('rent');
}
function openElectricityFlow() {
  electricityForm = { creating: false, provider: '', contactIds: [], amountStr: '', currency: 'USD', dueDate: '', mode: 'equal', customAmounts: {}, saveRule: false, busy: false, error: '', review: false, clientRequestId: '' };
  go('electricity');
}

function householdBillScreen(kind) {
  const isElec = kind === 'electricity';
  const form = isElec ? electricityForm : rentForm;
  const savedRule = isElec ? savedElectricRule : savedRentRule;
  const label = isElec ? 'Electricity' : 'Rent';
  const formRef = isElec ? 'electricityForm' : 'rentForm';

  if (!form.creating) {
    return screenHeader(label, `Create and track shared ${label.toLowerCase()} bill requests`, 'home', badge('Demo mode', 'preview'))
      + `<div class="narrow card center">
        <h2>No active ${label.toLowerCase()} bill</h2>
        <p class="sub" style="margin-top:6px">Starts blank. Choose household contacts, enter total ${label.toLowerCase()} amount and due date, and create requests.</p>
        ${savedRule ? `<div class="callout">${svg(isElec ? 'bolt' : 'calendar')}<span>Saved rule: ${cents(savedRule.totalCents, savedRule.currency, true)} across ${savedRule.contactIds.length} contacts.</span><button type="button" class="btn-ghost-sm" onclick="applySavedHouseholdRule('${kind}')">Use saved rule</button></div>` : ''}
        <div class="actions"><button type="button" class="btn btn-primary full" onclick="${formRef}.creating = true; render()">${svg('plus')}<span>Create ${label.toLowerCase()} request</span></button></div>
      </div>`;
  }
  const chosen = contactsList.filter(c => form.contactIds.includes(c.id));
  const totalCents = parseMajorToCents(form.amountStr, form.currency);
  const perShare = chosen.length ? equalShare(totalCents, chosen.length, form.currency) : 0;
  const step = decimalsFor(form.currency) === 0 ? '1' : '0.01';

  return screenHeader(`Create ${label.toLowerCase()} request`, 'Choose contacts, amount, currency, and due date', 'home', badge('Demo mode', 'preview'))
    + `<div class="narrow card">
      ${isElec ? `<div class="field-group" style="margin-top:0"><label for="${kind}-prov">Electric utility / meter note (optional)</label><input id="${kind}-prov" value="${escapeHtml(form.provider || '')}" oninput="${formRef}.provider = this.value" placeholder="e.g. City Electric · Apt 4B"></div>` : ''}
      <label style="font-size:13px;font-weight:800;display:block;margin:12px 0 6px">Household contacts</label>
      <div class="chip-row" style="margin-bottom:12px;margin-top:0">
        ${contactsList.map(c => `<button type="button" class="chip ${form.contactIds.includes(c.id) ? 'selected' : ''}" onclick="toggleHouseholdContact('${kind}', '${escapeHtml(c.id)}')">${escapeHtml(c.name)} · ${escapeHtml(c.currency)}</button>`).join('')}
      </div>
      <div class="split-grid" style="gap:10px">
        <div class="field-group" style="margin-top:0"><label for="${kind}-amt">${label} amount (${form.currency})</label><input id="${kind}-amt" type="number" min="0" step="${step}" value="${escapeHtml(form.amountStr)}" oninput="${formRef}.amountStr = this.value; ${formRef}.review = false; render()" placeholder="${decimalsFor(form.currency) === 0 ? '0' : '0.00'}"></div>
        <div class="field-group" style="margin-top:0"><label for="${kind}-curr">Currency</label><select id="${kind}-curr" onchange="${formRef}.currency = this.value; ${formRef}.review = false; render()">${CURRENCIES.map(c => `<option value="${c}" ${form.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      </div>
      <div class="split-grid" style="gap:10px;margin-top:10px">
        <div class="field-group" style="margin-top:0"><label for="${kind}-due">Due date</label><input id="${kind}-due" type="date" value="${escapeHtml(form.dueDate)}" oninput="${formRef}.dueDate = this.value; ${formRef}.review = false;"></div>
        <div class="field-group" style="margin-top:0">
          <label>Share method</label>
          <div class="chip-row" style="margin-top:0">
            <button type="button" class="chip ${form.mode === 'equal' ? 'selected' : ''}" onclick="${formRef}.mode='equal'; ${formRef}.review = false; render()">Equal</button>
            <button type="button" class="chip ${form.mode === 'custom' ? 'selected' : ''}" onclick="${formRef}.mode='custom'; ${formRef}.review = false; render()">Custom</button>
          </div>
        </div>
      </div>
      ${chosen.length && totalCents > 0 ? `<div class="rule"></div>${chosen.map(c => {
        const eq = c.id === 'leah' ? totalCents - perShare * (chosen.length - 1) : perShare;
        const val = form.mode === 'custom' ? (form.customAmounts[c.id] ?? formatCentsInput(eq, form.currency)) : formatCentsInput(eq, form.currency);
        return `<div class="row"><span><b>${escapeHtml(c.name)}</b></span>${form.mode === 'custom' ? `<input aria-label="Share for ${escapeHtml(c.name)}" type="number" min="0" step="${step}" style="width:110px;min-height:44px;padding:6px 10px;border:1px solid var(--line);border-radius:8px" value="${escapeHtml(val)}" oninput="${formRef}.customAmounts['${escapeHtml(c.id)}'] = this.value; ${formRef}.review = false;">` : `<b class="money">${cents(eq, form.currency, true)}</b>`}</div>`;
      }).join('')}` : ''}
      <label class="row" style="cursor:pointer;margin-top:8px"><span style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700"><input type="checkbox" ${form.saveRule ? 'checked' : ''} onchange="${formRef}.saveRule = this.checked" style="width:18px;height:18px">Save rule for future months</span></label>
      ${form.error ? `<div class="callout error" role="alert">${svg('alert')}<span>${escapeHtml(form.error)}</span></div>` : ''}
      <div class="actions"><button type="button" class="btn btn-primary full" onclick="submitHouseholdBill('${kind}')" ${form.busy ? 'disabled' : ''}><span>${form.review ? `Confirm & create ${label.toLowerCase()} requests` : `Review ${label.toLowerCase()} requests`}</span>${svg('arrow-right')}</button></div>
    </div>`;
}

function applySavedHouseholdRule(kind) {
  const form = kind === 'electricity' ? electricityForm : rentForm;
  const savedRule = kind === 'electricity' ? savedElectricRule : savedRentRule;
  if (!savedRule) return;
  form.creating = true;
  form.contactIds = [...(savedRule.contactIds || [])];
  form.currency = savedRule.currency || 'USD';
  form.amountStr = formatCentsInput(savedRule.totalCents || 0, form.currency);
  form.mode = savedRule.mode || 'equal';
  form.customAmounts = Object.fromEntries(Object.entries(savedRule.customShares || {}).map(([id, c]) => [id, formatCentsInput(c, form.currency)]));
  render();
}

function toggleHouseholdContact(kind, id) {
  const form = kind === 'electricity' ? electricityForm : rentForm;
  form.review = false;
  const i = form.contactIds.indexOf(id);
  if (i >= 0) form.contactIds.splice(i, 1); else form.contactIds.push(id);
  render();
}

async function submitHouseholdBill(kind) {
  const isElec = kind === 'electricity';
  const form = isElec ? electricityForm : rentForm;
  if (form.busy) return;
  const chosen = contactsList.filter(c => form.contactIds.includes(c.id));
  const totalCents = parseMajorToCents(form.amountStr, form.currency);
  if (!chosen.length || totalCents <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(form.dueDate)) {
    form.error = `Select contacts, enter a positive ${kind} amount, and choose a due date.`; render(); return;
  }
  const unit = form.currency === 'JPY' ? 100 : 1;
  const per = equalShare(totalCents, chosen.length, form.currency);
  const recipients = chosen.map(c => {
    const equal = c.id === 'leah' ? totalCents - per * (chosen.length - 1) : per;
    const shareCents = form.mode === 'custom'
      ? parseMajorToCents(form.customAmounts[c.id] ?? formatCentsInput(equal, form.currency), form.currency)
      : equal;
    return { name: c.name, contactId: c.id, amountCents: shareCents, currency: form.currency, targetCurrency: c.currency || form.currency, reason: `${isElec ? (form.provider || 'Electricity') : 'Rent'} (${form.dueDate})` };
  });
  if (recipients.some(r => r.amountCents <= 0 || r.amountCents % unit !== 0) || recipients.reduce((s, r) => s + r.amountCents, 0) > totalCents) {
    form.error = 'Enter valid positive shares that do not exceed the bill total.'; render(); return;
  }
  if (!form.review) { form.review = true; form.error = ''; render(); return; }
  form.busy = true; form.error = ''; render();
  const title = isElec ? `${form.provider || 'Electricity bill'} due ${form.dueDate}` : `Rent due ${form.dueDate}`;
  const merchant = isElec ? (form.provider || 'Electric Utility') : 'Monthly Rent';
  const created = await persistRequestRecord({ title, merchant, dueDate: form.dueDate, kind, currency: form.currency, totalCents, recipients, channel: 'demo', demoAutoSettle: true, clientRequestId: form.clientRequestId ||= `${kind}-${Date.now().toString(36)}` });
  form.busy = false;
  if (!created) { render(); return; }
  if (form.saveRule) {
    const rule = { contactIds: form.contactIds, totalCents, currency: form.currency, mode: form.mode, dayOfMonth: Number(form.dueDate.slice(-2)), customShares: form.mode === 'custom' ? Object.fromEntries(recipients.map(r => [r.contactId, r.amountCents])) : {} };
    if (isElec) { savedElectricRule = rule; saveLocalState(); }
    else {
      savedRentRule = rule;
      if (backendMode && ledger) { try { await api('/api/organizer/rent-rule', rule); } catch { toast('Created requests; rent rule save failed.'); } }
      else saveLocalState();
    }
  }
  go(`request/${created.id}`);
}

const submitRentRequest = () => submitHouseholdBill('rent');

// ---------- Scan & Pay (Merchant QR + PayPal Sandbox SS-001) ----------
function openScanPay() { stopStreams(); scannerState = 'ready'; scannerMessage = ''; pastedLinkDraft = ''; go('scan'); }

function scanQrScreen() {
  let camera = '';
  if (scannerState === 'denied') camera = `<div class="center"><div class="result-icon cancelled">${svg('qr')}</div><h2 style="color:#fff">Camera permission unavailable</h2><p style="color:#DCE1E8;margin-top:6px">Allow camera access or paste a supported payment link below.</p></div>`;
  else if (scannerState === 'unavailable') camera = `<div class="center"><div class="result-icon processing">${svg('alert')}</div><h2 style="color:#fff">Camera unavailable</h2><p style="color:#DCE1E8;margin-top:6px">Paste a supported payment QR link below.</p></div>`;
  else if (scannerState === 'scanning') camera = `<span class="camera-badge">Live camera preview</span><video id="cam" autoplay playsinline muted></video>`;
  else camera = `<span class="camera-badge">Merchant QR scanner</span><div class="center"><div class="icon-box" style="width:54px;height:54px;margin:0 auto 10px">${svg('qr')}</div><h2 style="color:#fff">Ready to scan</h2><p style="color:#DCE1E8;margin-top:6px">Open camera or paste a link such as <code>#purchase/SS-001</code>.</p></div>`;

  return screenHeader('Scan & Pay', 'Pay supported Demo Merchant PayPal Sandbox links', 'home', badge('PayPal Sandbox', ''))
    + `<div class="split-grid">
      <div class="camera-frame">${camera}</div>
      <div class="card">
        <h2>Scan or paste code</h2>
        <div class="actions">
          ${scannerState === 'scanning'
            ? `<button type="button" class="btn btn-secondary" onclick="stopCamera()">Stop camera</button>`
            : `<button type="button" class="btn btn-primary" onclick="startCamera()">${svg('qr')}<span>Open camera</span></button>`}
          <button type="button" class="btn btn-secondary" onclick="openSs001DemoMerchant()">Open Demo Merchant (SS-001)</button>
        </div>
        <div class="field-group">
          <label for="purchase-link">Paste link or code</label>
          <input id="purchase-link" value="${escapeHtml(pastedLinkDraft)}" oninput="pastedLinkDraft = this.value" placeholder="#purchase/SS-001">
        </div>
        <div class="actions"><button type="button" class="btn btn-secondary full" onclick="pasteLink()">Open link</button></div>
        ${scannerMessage ? `<div class="callout error" role="alert">${svg('alert')}<span>${escapeHtml(scannerMessage)}</span></div>` : ''}
      </div>
    </div>`;
}

async function startCamera() {
  const epoch = ++scanEpoch;
  const current = () => epoch === scanEpoch && location.hash === '#scan';
  scannerState = 'scanning'; scannerMessage = ''; render();
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('No camera'), { name: 'NotFoundError' });
    if (!globalThis.BarcodeDetector) { scannerState = 'unavailable'; scannerMessage = 'QR scanning unavailable in this browser. Paste a supported link below.'; render(); return; }
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    if (!current()) { stream.getTracks().forEach(track => track.stop()); return; }
    activeStream = stream;
    async function readFrame() {
      if (!current()) return;
      const video = document.querySelector('#cam');
      if (video && video.srcObject !== stream) video.srcObject = stream;
      try {
        const codes = video?.readyState >= 2 ? await detector.detect(video) : [];
        if (!current()) return;
        if (codes[0]?.rawValue) { stopStreams(); openMerchantCode(codes[0].rawValue); return; }
      } catch {}
      setTimeout(readFrame, 180);
    }
    readFrame();
  } catch (e) {
    if (!current()) return;
    const denied = e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError';
    scannerState = denied ? 'denied' : 'unavailable';
    scannerMessage = denied ? 'Camera permission denied. Paste #purchase/SS-001 instead.' : 'Camera unavailable in this browser. Paste #purchase/SS-001 instead.';
    render();
  }
}
function stopCamera() { stopStreams(); scannerState = 'ready'; scannerMessage = ''; render(); }
function openSs001DemoMerchant() { ss001Active = true; localStorage.setItem('splitsync-ss001-active', 'true'); go('review'); }
function openReceiveLink(fragment) {
  const clean = String(fragment || '').replace(/^#/, '');
  if (!clean.startsWith('receive/')) return false;
  const [pathPart, queryPart = ''] = clean.split('?');
  const segs = pathPart.split('/');
  const targetId = decodeURIComponent(segs[1] || '').trim().toLowerCase();
  if (!targetId) return false;
  const qp = new URLSearchParams(queryPart);
  const rawCurr = (qp.get('currency') || '').trim().toUpperCase();
  const matched = contactsList.find(c => c.id.toLowerCase() === targetId || c.name.toLowerCase() === targetId);
  const contact = matched || {
    id: targetId,
    name: targetId === 'leah' ? 'Leah' : targetId[0].toUpperCase() + targetId.slice(1),
    country: 'United States',
    currency: CURRENCIES.includes(rawCurr) ? rawCurr : 'USD',
  };
  const payCurr = CURRENCIES.includes(rawCurr) ? rawCurr : normCurr(contact.currency, 'USD');
  const amtCents = parseMajorToCents(qp.get('amount') || '', payCurr);
  contactSearch = '';
  transferForm = {
    contactId: contact.id,
    amountStr: amtCents > 0 ? formatCentsInput(amtCents, payCurr) : '',
    enteredSide: 'send',
    sourceCurrency: payCurr,
    targetCurrency: normCurr(contact.currency, 'USD'),
    note: `QR payment to ${contact.name}`,
    clientTxId: `tx-${Date.now().toString(36)}`,
    busy: false,
    error: '',
    reviewSourceCents: 0,
    reviewTargetCents: 0,
    reviewRate: 0,
    reviewRateDate: fxRateDate,
    returnParent: 'home',
  };
  scannerState = 'ready';
  scannerMessage = '';
  go('send');
  return true;
}

function pasteLink() { openMerchantCode(document.querySelector('#purchase-link')?.value || ''); }
function openMerchantCode(value) {
  const raw = value.trim(); pastedLinkDraft = raw;
  const fragment = raw.startsWith('#') ? raw : raw.match(/^https?:\/\/[^#]+(#[^#]+)$/i)?.[1];
  if (fragment && fragment.startsWith('#receive/') && openReceiveLink(fragment)) return;
  if (fragment && /^#(?:req|pay)\/[A-Za-z0-9-]+$/.test(fragment)) { scannerState = 'ready'; location.hash = fragment; return; }
  if (raw === 'SS-001' || fragment === '#purchase/SS-001') { scannerState = 'ready'; openSs001DemoMerchant(); return; }
  scannerState = 'invalid';
  scannerMessage = raw ? 'Unsupported code. Use Demo Merchant #purchase/SS-001 or an AI payment link.' : 'Scan a QR or paste a link first.';
  render();
}

function receiptCard() {
  const activeLamp = draftLamp || ledger?.lamp || lamp;
  return `<div class="card">
    <div class="section-title"><h2>Demo Merchant · SS-001</h2>${badge('PayPal Sandbox', '')}</div>
    <div class="row"><span>Shared kitchen essentials (3 ways)</span><b class="money">$120.00 USD</b></div>
    <div class="row"><span>Desk lamp (${escapeHtml(activeLamp)})</span><b class="money">$30.00 USD</b></div>
    <div class="row total"><span>Total</span><span class="money">$150.00 USD</span></div>
  </div>`;
}
function reviewScreen() {
  ss001Active = true;
  const cur = activeSsShares();
  const activeLamp = draftLamp || ledger?.lamp || lamp;
  return screenHeader('Review merchant purchase', 'Demo Merchant · SS-001 · PayPal Sandbox checkout', 'scan', badge('PayPal Sandbox', ''))
    + `<div class="split-grid">
      ${receiptCard()}
      <div class="card">
        <h2>Participants</h2>
        ${names.map(n => `<div class="row"><span class="person ${n.toLowerCase()}">${n[0]}</span><div class="grow"><b>${n}</b><br><small class="sub">${n === activeLamp ? '$40.00 USD + $30.00 USD lamp' : '$40.00 USD shared'}</small></div><b class="money">${money(cur[n], 'USD', true)}</b></div>`).join('')}
        <div class="field-group"><label for="instruction">Split instruction</label><textarea id="instruction" rows="2" oninput="instructionDraft = this.value">${escapeHtml(instructionDraft)}</textarea></div>
        <div class="actions"><button type="button" class="btn btn-primary full" onclick="prepareSs001()"><span>Prepare AI split</span>${svg('arrow-right')}</button></div>
      </div>
    </div>`;
}
async function prepareSs001() {
  const ta = document.querySelector('#instruction'); if (ta) instructionDraft = ta.value;
  if (!backendMode) { const owner = names.find(n => new RegExp('\\b' + n + '\\b', 'i').test(instructionDraft)) || 'Leah'; lamp = owner; localStorage.setItem('splitsync-lamp', owner); aiState = 'ready'; go('split'); return; }
  aiState = 'loading'; aiError = ''; go('split'); await render();
  try {
    const r = await api('/api/organizer/suggest-split', { instruction: instructionDraft });
    if (names.includes(r.lamp)) { draftLamp = r.lamp; lamp = r.lamp; aiState = 'ready'; await render(); }
    else { aiState = 'clarify'; go('clarify'); await render(); }
  } catch (e) { aiState = 'unavailable'; aiError = e.message; await render(); }
}
function splitScreen(clarify = false) {
  const l = draftLamp || ledger?.lamp || lamp;
  const cur = activeSsShares();
  return screenHeader(clarify ? 'Clarify lamp owner' : 'Review split', 'Move-in essentials · $150.00 USD', 'review', badge('PayPal Sandbox', ''))
    + `<div class="split-grid">
      ${receiptCard()}
      <div class="card">
        <div class="chip-row" style="margin-bottom:10px">${names.map(n => `<button type="button" class="chip ${n === l ? 'selected' : ''}" onclick="setLamp('${n}')">${n} ($${n === l ? 70 : 40} USD)</button>`).join('')}</div>
        ${names.map(n => `<div class="row"><span class="person ${n.toLowerCase()}">${n[0]}</span><div class="grow"><b>${n}</b></div><b class="money">${money(cur[n], 'USD', true)}</b></div>`).join('')}
        <div class="actions"><button type="button" class="btn btn-primary full" onclick="confirmSplit()"><span>Confirm &amp; get PayPal links</span>${svg('arrow-right')}</button></div>
      </div>
    </div>`;
}
function setLamp(n) { if (!names.includes(n)) return; draftLamp = n; lamp = n; selectedQrName = n; localStorage.setItem('splitsync-lamp', n); render(); }
async function confirmSplit() {
  if (backendMode && ledger) { try { await api('/api/organizer/split', { lamp: draftLamp || lamp }); draftLamp = null; await loadWorkspaceState(); go('requests'); } catch (e) { toast(e.message); } return; }
  published = true; localStorage.setItem('splitsync-published', 'true'); go('requests');
}
function paymentLink(n) { return ledger ? (ledger.published ? ledger.participants.find(p => p.name === n)?.shareUrl : null) : `${location.href.split('#')[0]}#share/${n.toLowerCase()}`; }
function requestsScreen(qrName) {
  const raw = qrName || selectedQrName || lamp || 'Maya';
  const active = names.find(x => x.toLowerCase() === String(raw).toLowerCase()) || raw;
  selectedQrName = active;
  const u = paymentLink(active);
  return screenHeader('PayPal Sandbox links', 'SS-001 · Verified PayPal Orders v2 checkout', 'split', badge('PayPal Sandbox', ''))
    + `<div class="split-grid">
      <div class="card">${names.map(n => `<div class="row"><span class="person ${n.toLowerCase()}">${n[0]}</span><div class="grow"><b>${n}</b><br><small class="sub">${money(activeSsShares()[n], 'USD', true)} · ${pill(ssStatus(n))}</small></div><button type="button" class="btn-ghost-sm" onclick="navigator.clipboard?.writeText('${escapeHtml(paymentLink(n) || '')}');toast('Copied ${n}')">Copy</button><button type="button" class="btn-ghost-sm" onclick="go('qr/${n.toLowerCase()}')">QR</button></div>`).join('')}</div>
      <div class="card card-tint"><div class="qr-spotlight"><div class="qr-box" id="qr"></div><div class="qr-meta"><h3>${escapeHtml(active)} · ${money(activeSsShares()[active], 'USD', true)}</h3>${u ? `<a class="btn btn-primary" style="margin-top:8px" href="${escapeHtml(u)}">Open ${escapeHtml(active)}’s checkout</a>` : '<p class="sub">Confirm split first.</p>'}</div></div></div>
    </div>`;
}
function dashboardScreen() {
  const paid = names.filter(n => ssStatus(n) === 'Paid').reduce((s, n) => s + activeSsShares()[n], 0);
  return screenHeader('SS-001 Sandbox ledger', 'Demo Merchant · PayPal Orders v2', 'activity', badge('PayPal Sandbox', ''))
    + `<div class="split-grid">${receiptCard()}<div class="card"><div style="font-size:26px;font-weight:800" class="money">${money(paid, 'USD', true)} / $150.00 USD</div><div class="rule"></div>${names.map(n => `<div class="row"><b>${n}</b><span>${money(activeSsShares()[n], 'USD', true)} ${pill(ssStatus(n))}</span></div>`).join('')}<div class="actions"><button type="button" class="btn btn-primary full" onclick="go('requests')">Share PayPal links</button></div></div></div>`;
}

// ---------- Store (super.money interaction + 11 products + Hidden Sponsored + Qty + Cart + Checkout Review) ----------
function cartCount() { return sharedCart.reduce((s, i) => s + (i.qty || 1), 0); }
function updateCartBadges() {
  const n = cartCount();
  for (const id of ['#rail-cart-badge', '#mobile-cart-badge']) { const el = document.querySelector(id); if (el) { el.textContent = String(n); el.hidden = n <= 0; } }
}

function storeScreen() {
  const cats = ['All', 'Kitchen', 'Lighting', 'Appliances', 'Storage', 'Cleaning', 'Electronics', 'Home', 'Retailers'];
  const q = storeQuery.trim().toLowerCase();
  const prods = storeCategory !== 'Retailers'
    ? storeCatalog.filter(p => (storeCategory === 'All' || p.category === storeCategory) && (!q || `${p.name} ${p.seller} ${p.desc}`.toLowerCase().includes(q)))
    : [];
  const retailers = ['All', 'Retailers'].includes(storeCategory)
    ? externalRetailers.filter(r => !q || `${r.name} ${r.desc}`.toLowerCase().includes(q))
    : [];
  const sponsoredProd = storeCatalog.find(p => p.id === sponsoredShowcaseItem.id);

  return `<div class="hub-top">
    <div><h1>Store ${badge('Demo fixtures', 'preview')}</h1><p class="screen-sub">Household essentials, shared cart, optional split, and Demo Merchant PayPal checkout.</p></div>
    <button type="button" class="btn btn-primary" onclick="go('cart')">${svg('cart')}<span>Cart (${cartCount()})</span></button>
  </div>
  <div class="store-toolbar"><div class="store-search">${svg('search')}<input id="store-search" type="search" aria-label="Search store" value="${escapeHtml(storeQuery)}" oninput="storeQuery = this.value; render()" placeholder="Search kettle, lamp, dinnerware, purifiers, retailers…"></div></div>
  <div class="category-strip">${cats.map(c => `<button type="button" class="chip ${storeCategory === c ? 'selected' : ''}" onclick="storeCategory='${c}'; render()">${c}</button>`).join('')}</div>
  ${sponsoredEnabled && sponsoredProd ? `<section class="sponsored-section" aria-label="Sponsored placement">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <div>${badge(sponsoredShowcaseItem.badge, '')}<h2 style="margin-top:6px">${escapeHtml(sponsoredProd.name)}</h2><p class="sub">${escapeHtml(sponsoredShowcaseItem.copy)}</p></div>
      <button type="button" class="btn btn-secondary" onclick="openProductDetail('${escapeHtml(sponsoredProd.id)}')">View item</button>
    </div>
  </section>` : ''}
  <div class="store-grid" style="margin-top:16px">
    ${prods.map(p => `<article class="product-card">
      <div>
        <div class="product-art" style="cursor:pointer" onclick="openProductDetail('${escapeHtml(p.id)}')"><img src="${escapeHtml(p.img)}" alt="${escapeHtml(p.name)}" loading="lazy"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-top:10px">${badge(p.paypalEligible ? `${p.seller} · PayPal` : p.seller, p.paypalEligible ? '' : 'preview')}<small class="sub">${escapeHtml(p.category)}</small></div>
        <h2 style="margin-top:8px"><a href="#product/${escapeHtml(p.id)}" onclick="event.preventDefault(); openProductDetail('${escapeHtml(p.id)}')">${escapeHtml(p.name)}</a></h2>
        <p style="margin-top:4px;font-size:14px">${escapeHtml(p.desc)}</p>
      </div>
      <div>
        <div class="sub" style="font-size:12px;margin-bottom:8px">${escapeHtml(p.availability)}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <b class="money">${cents(p.priceCents, 'USD', true)}</b>
          <div style="display:flex;gap:6px">
            <button type="button" class="btn-ghost-sm" onclick="openProductDetail('${escapeHtml(p.id)}')">View</button>
            <button type="button" class="btn btn-primary" style="min-height:44px;padding:8px 14px" onclick="addToCart('${escapeHtml(p.id)}', false, 1)">Add</button>
          </div>
        </div>
      </div>
    </article>`).join('')}
    ${retailers.map(r => `<article class="product-card"><div><div class="product-art" style="background:#EEF2F7;color:var(--navy)">${svg('store')}</div><div style="margin-top:10px">${badge(r.seller, 'preview')}</div><h2 style="margin-top:8px">${escapeHtml(r.name)}</h2><p style="margin-top:4px;font-size:14px">${escapeHtml(r.desc)}</p></div><a class="btn btn-secondary full" href="${escapeHtml(r.url)}" target="_blank" rel="noopener"><span>Open on retailer site</span>${svg('external')}</a></article>`).join('')}
  </div>`;
}

function openProductDetail(id) {
  productDetailQty = 1;
  go(`product/${id}`);
}

function productDetailScreen(id) {
  const p = storeCatalog.find(x => x.id === id) || storeCatalog[0];
  const ext = externalRetailers.find(r => r.category === p.category) || externalRetailers[0];
  return `<div class="has-sticky-bar">`
    + screenHeader(escapeHtml(p.name), `${escapeHtml(p.seller)} · ${escapeHtml(p.category)}`, 'store', `<button type="button" class="btn-ghost-sm" onclick="go('cart')">${svg('cart')}<span>Cart (${cartCount()})</span></button>`)
    + `<div class="split-grid">
      <div class="card"><div class="product-detail-media"><img src="${escapeHtml(p.img)}" alt="${escapeHtml(p.name)}"></div></div>
      <div class="card">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${badge(p.paypalEligible ? `${p.seller} · PayPal Sandbox` : `${p.seller} · Demo fixture`, p.paypalEligible ? '' : 'preview')}
          ${badge(p.availability, 'preview')}
        </div>
        <h2 class="money" style="margin-top:12px;font-size:28px">${cents(p.priceCents, 'USD', true)}</h2>
        <p style="margin-top:10px">${escapeHtml(p.desc)}</p>
        <div class="rule"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div><b>Quantity</b><br><small class="sub">Line subtotal: <span class="money">${cents(p.priceCents * productDetailQty, 'USD', true)}</span></small></div>
          <div class="qty-stepper" aria-label="Quantity selector">
            <button type="button" onclick="productDetailQty = Math.max(1, productDetailQty - 1); render()" aria-label="Decrease quantity">−</button>
            <span id="detail-qty">${productDetailQty}</span>
            <button type="button" onclick="productDetailQty = Math.min(20, productDetailQty + 1); render()" aria-label="Increase quantity">+</button>
          </div>
        </div>
        ${!p.paypalEligible ? `<div class="callout">${svg('store')}<span>Sold as a demo fixture by <b>${escapeHtml(p.seller)}</b>. Commercial PayPal checkout applies only to Demo Merchant catalog items; shop externally on ${escapeHtml(ext.name)} or add to cart to split with roommates.</span></div>` : `<div class="callout">${svg('check')}<span>Eligible for <b>Demo Merchant</b> PayPal Sandbox checkout review or shared purchase split.</span></div>`}
      </div>
    </div>
    <div class="sticky-buy-bar" role="region" aria-label="Product actions">
      <div class="sticky-buy-inner">
        <div><b class="money" style="font-size:16px">${cents(p.priceCents * productDetailQty, 'USD', true)}</b><small class="sub" style="display:block">${productDetailQty} × ${cents(p.priceCents, 'USD', true)}</small></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;flex:1;justify-content:flex-end">
          <button type="button" class="btn btn-secondary" onclick="addToCart('${escapeHtml(p.id)}', false, productDetailQty)">${svg('cart')}<span>Add to Cart</span></button>
          <button type="button" class="btn btn-primary" onclick="buyNowStoreItem('${escapeHtml(p.id)}', productDetailQty)"><span>Buy now</span>${svg('arrow-right')}</button>
        </div>
      </div>
    </div>
  </div>`;
}

function addToCart(id, openCart = false, qty = 1) {
  const n = Math.max(1, Math.min(20, Math.round(Number(qty) || 1)));
  const ex = sharedCart.find(i => i.id === id);
  if (ex) ex.qty += n; else sharedCart.push({ id, qty: n });
  localStorage.setItem('splitsync-cart', JSON.stringify(sharedCart));
  updateCartBadges();
  const prod = storeCatalog.find(x => x.id === id);
  toast(`Added ${n} × ${prod?.name || 'item'} to Cart.`);
  if (openCart) go('cart'); else render();
}

function buyNowStoreItem(id, qty = 1) {
  const prod = storeCatalog.find(x => x.id === id);
  if (!prod) return;
  sharedCart = [{ id, qty: Math.max(1, Math.min(20, Math.round(Number(qty) || 1))) }];
  localStorage.setItem('splitsync-cart', JSON.stringify(sharedCart));
  chatStoreBuy = null;
  updateCartBadges();
  go('checkout-review');
}

function buyNowWithPayPal(id, qty = 1) { buyNowStoreItem(id, qty); }

function removeFromCart(id) {
  sharedCart = sharedCart.filter(c => c.id !== id);
  localStorage.setItem('splitsync-cart', JSON.stringify(sharedCart));
  updateCartBadges();
  render();
}

function cartScreen() {
  const rows = sharedCart.map(c => ({ ...c, product: storeCatalog.find(p => p.id === c.id) })).filter(c => c.product);
  const total = rows.reduce((s, r) => s + r.product.priceCents * r.qty, 0);
  const hasPayPalItems = rows.some(r => r.product.paypalEligible);
  return screenHeader('Cart', `${cartCount()} item${cartCount() === 1 ? '' : 's'}`, 'store')
    + `<div class="narrow card">${rows.length === 0
      ? `<p class="sub">Your cart is empty.</p><div class="actions"><button type="button" class="btn btn-primary" onclick="go('store')">Browse Store</button></div>`
      : `${rows.map(r => `<div class="row">
          <img src="${escapeHtml(r.product.img)}" alt="${escapeHtml(r.product.name)}" style="width:48px;height:48px;border-radius:10px;object-fit:cover;flex-shrink:0">
          <div class="grow"><b>${escapeHtml(r.product.name)}</b><br><small class="sub">${escapeHtml(r.product.seller)} · ${cents(r.product.priceCents, 'USD', true)} each</small></div>
          <div style="display:flex;gap:6px;align-items:center">
            <button type="button" class="btn-ghost-sm" style="padding:4px 10px" onclick="adjustCart('${escapeHtml(r.id)}', -1)" aria-label="Decrease quantity">−</button>
            <b class="money">${r.qty}</b>
            <button type="button" class="btn-ghost-sm" style="padding:4px 10px" onclick="adjustCart('${escapeHtml(r.id)}', 1)" aria-label="Increase quantity">+</button>
            <button type="button" class="btn-ghost-sm" onclick="removeFromCart('${escapeHtml(r.id)}')" aria-label="Remove item">${svg('trash')}</button>
          </div>
          <b class="money" style="min-width:86px;text-align:right">${cents(r.product.priceCents * r.qty, 'USD', true)}</b>
        </div>`).join('')}
        <div class="row total"><span>Subtotal</span><span class="money">${cents(total, 'USD', true)}</span></div>
        <div class="actions">
          <button type="button" class="btn btn-secondary" onclick="clearCart()">Clear</button>
          <button type="button" class="btn btn-secondary" onclick="splitCartWithPeople()"><span>Split this purchase</span></button>
          <button type="button" class="btn btn-primary" onclick="go('checkout-review')"><span>${hasPayPalItems ? 'Checkout review' : 'Review fixture order'}</span>${svg('arrow-right')}</button>
        </div>`}</div>`;
}

function adjustCart(id, delta) {
  const row = sharedCart.find(c => c.id === id); if (!row) return;
  row.qty += delta;
  if (row.qty <= 0) sharedCart = sharedCart.filter(c => c.id !== id);
  localStorage.setItem('splitsync-cart', JSON.stringify(sharedCart));
  updateCartBadges(); render();
}
function clearCart() { sharedCart = []; localStorage.setItem('splitsync-cart', '[]'); updateCartBadges(); render(); }

function splitCartWithPeople() {
  const rows = sharedCart.map(c => ({ ...c, product: storeCatalog.find(p => p.id === c.id) })).filter(c => c.product);
  const total = rows.reduce((s, r) => s + r.product.priceCents * r.qty, 0);
  const per = equalShare(total, 3, 'USD');
  chatAttachedBill = { merchant: 'AI Store Cart', date: '2026-11-10', currency: 'USD', items: rows.map(r => ({ name: `${r.product.name} x${r.qty}`, amountCents: r.product.priceCents * r.qty })), taxCents: 0, tipCents: 0, totalCents: total };
  chatDraft = {
    intent: 'request', needsClarification: false, modelUsed: 'Store Cart',
    recipients: [
      { id: 'draft-1', name: 'Maya', contactId: 'maya', known: true, ambiguous: false, amountCents: per, currency: 'USD', targetCurrency: 'USD', reason: rows[0]?.product?.name || 'Store purchase' },
      { id: 'draft-2', name: 'Arun', contactId: 'arun', known: true, ambiguous: false, amountCents: per, currency: 'USD', targetCurrency: 'CAD', reason: rows[0]?.product?.name || 'Store purchase' },
      { id: 'draft-3', name: 'Leah', contactId: 'leah', known: true, ambiguous: false, amountCents: total - per * 2, currency: 'USD', targetCurrency: 'USD', reason: rows[0]?.product?.name || 'Store purchase' },
    ],
  };
  chatHistory = [{ id: 'a-cart', role: 'assistant', text: `Prepared ${cents(total, 'USD', true)} shared cart split across Maya, Arun, and Leah. Ready to create requests?`, modelUsed: 'Store Cart' }];
  go('ask');
}

function checkoutReviewScreen() {
  const rows = sharedCart.map(c => ({ ...c, product: storeCatalog.find(p => p.id === c.id) })).filter(c => c.product);
  if (!rows.length) return cartScreen();
  const paypalRows = rows.filter(r => r.product.paypalEligible);
  const fixtureRows = rows.filter(r => !r.product.paypalEligible);
  const paypalTotal = paypalRows.reduce((s, r) => s + r.product.priceCents * r.qty, 0);
  const fixtureTotal = fixtureRows.reduce((s, r) => s + r.product.priceCents * r.qty, 0);
  const total = paypalTotal + fixtureTotal;

  return screenHeader('Checkout review', 'Verify merchant scope before paying', 'cart', badge(paypalRows.length ? 'PayPal Sandbox + Store' : 'Demo fixture', paypalRows.length ? '' : 'preview'))
    + `<div class="narrow card">
      ${rows.map(r => `<div class="row"><div class="grow"><b>${escapeHtml(r.product.name)} × ${r.qty}</b><br><small class="sub">${escapeHtml(r.product.seller)}</small></div><b class="money">${cents(r.product.priceCents * r.qty, 'USD', true)}</b></div>`).join('')}
      <div class="row total"><span>Total</span><span class="money">${cents(total, 'USD', true)}</span></div>
      ${renderPaymentSourceSelector(total)}
      ${paypalRows.length ? `<div class="callout">${svg('check')}<div><b>Demo Store Direct Checkout</b><br>Demo Merchant items (${cents(paypalTotal, 'USD', true)}) record an instant Store purchase receipt. On the next receipt screen you can click <b>Split cash</b> to divide it with friends, or open Scan &amp; Pay (#purchase/SS-001) for the 3-way PayPal Sandbox checkout.</div></div>` : ''}
      ${fixtureRows.length ? `<div class="callout warning">${svg('alert')}<div><b>External / Non-PayPal Fixture Items (${cents(fixtureTotal, 'USD', true)})</b><br>Sample fixture items record a Demo Store receipt in Activity. On the next receipt screen you can click <b>Split cash</b> to request shares.</div></div>` : ''}
      ${checkoutOrderError ? `<div class="callout error">${svg('alert')}<span>${escapeHtml(checkoutOrderError)}</span></div>` : ''}
      <div class="actions">
        <button type="button" class="btn btn-secondary" onclick="splitCartWithPeople()">Split this purchase</button>
        <button type="button" class="btn btn-primary" onclick="completeDemoStoreOrder(${total})" ${checkoutBusy || !canFundWithSource(total) ? 'disabled' : ''}>${checkoutBusy ? 'Recording purchase…' : 'Complete purchase'}</button>
      </div>
    </div>`;
}

function openSs001FromStore() {
  ss001Active = true;
  localStorage.setItem('splitsync-ss001-active', 'true');
  go('review');
}

async function completeDemoStoreOrder(totalCents) {
  if (checkoutBusy || totalCents <= 0) return;
  if (!canFundWithSource(totalCents)) { checkoutOrderError = 'PayPal Wallet balance too low. Recharge or switch card.'; render(); return; }
  const fundingSource = currentFundingLabel();
  checkoutBusy = true; checkoutOrderError = ''; render();
  const rows = sharedCart.map(c => ({ ...c, product: storeCatalog.find(p => p.id === c.id) })).filter(c => c.product);
  const namesDesc = rows.map(r => `${r.product.name} x${r.qty}`).join(', ').slice(0, 120);
  const clientTxId = 'store-' + Date.now().toString(36);
  try {
    let tx;
    if (backendMode && ledger) {
      const res = await api('/api/organizer/demo-pay', { type: 'store-demo', recipientName: 'AI Store (Demo)', sourceAmountCents: totalCents, sourceCurrency: 'USD', targetCurrency: 'USD', fundingSource, note: namesDesc || 'Store demo order', clientTxId });
      tx = res.transaction;
      deductWalletIfSelected(totalCents);
      tx.fundingSource ||= fundingSource;
      await loadWorkspaceState();
    } else {
      deductWalletIfSelected(totalCents);
      tx = { id: 'DTX-' + Math.random().toString(16).slice(2, 8).toUpperCase(), clientTxId, type: 'store-demo', direction: 'outgoing', recipientName: 'AI Store (Demo)', sourceAmountCents: totalCents, sourceCurrency: 'USD', targetAmountCents: totalCents, targetCurrency: 'USD', fundingSource, note: namesDesc || 'Store demo order', status: 'Completed', demo: true, createdAt: new Date().toISOString() };
      demoTransactions.unshift(tx);
      saveLocalState();
    }
    sharedCart = []; localStorage.setItem('splitsync-cart', '[]'); updateCartBadges();
    checkoutBusy = false; activeTxReceiptId = tx.id;
    toast(`Demo store receipt recorded: ${cents(totalCents, 'USD', true)}`);
    go(`tx/${tx.id}`);
  } catch (e) {
    checkoutBusy = false; checkoutOrderError = e.message; render();
  }
}

// ---------- Contact PayPal AI Help (#contact-paypal) & Profile + Minimal QR ----------
function paypalHelpReply(question) {
  const q = String(question || '').toLowerCase();
  if (q.includes('recharge') || q.includes('wallet') || q.includes('add money')) {
    return `PayPal Wallet (${cents(walletBalanceCents, 'USD', true)} available): Tap + Recharge on Home, choose +$25/+$50/+$100/+$250 or any custom USD amount from Linked Card •••• 9104. All Store, Send, and Split payments can deduct directly from Wallet.`;
  }
  if (q.includes('split cash') || q.includes('store') || q.includes('buy')) {
    return 'Store & Split cash: Buy items directly using PayPal Wallet or Linked Card. Right on the receipt screen, click Split cash to divide the order evenly or assign custom shares with friends.';
  }
  if (q.includes('qr') || q.includes('leah@paypal') || q.includes('receive')) {
    return 'Receive Money QR (leah@paypal): Your QR sits at the bottom of Home and in Profile. Friends scan it with Scan & Pay to send funds directly to Leah.';
  }
  if (q.includes('rate') || q.includes('fx') || q.includes('sandbox')) {
    return 'Demo exchange rates convert transparently across USD, GBP, CAD, EUR, JPY, and INR. Demo Merchant SS-001 uses the real PayPal Sandbox approval & capture checkout.';
  }
  return 'Hi Leah! Ask PayPal AI about Wallet recharges, Split cash after Store orders, your leah@paypal Receive QR, or demo FX rates.';
}

async function submitPaypalHelpTurn(overrideText = null) {
  const raw = overrideText ?? helpComposerText;
  const text = String(raw || '').trim();
  if (!text || helpBusy) return;
  if (overrideText === null) helpComposerText = '';
  helpHistory.push({ id: 'hu-' + Date.now(), role: 'user', text });
  helpBusy = true; render();
  const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reducedMotion) await new Promise(r => setTimeout(r, 180));
  helpHistory.push({ id: 'ha-' + Date.now(), role: 'assistant', text: paypalHelpReply(text) });
  helpBusy = false; render();
}

function contactPaypalScreen() {
  return `<div class="chat-shell">
    <div class="hub-top" style="margin-bottom:4px">
      <div style="display:flex;align-items:center;gap:12px">
        <img src="assets/paypal.png" alt="" style="width:38px;height:38px;border-radius:10px;background:#fff;padding:4px;border:1px solid var(--line)">
        <div><h1>Contact PayPal</h1><p class="screen-sub">AI Support Assistant · Wallet, QR &amp; Payments</p></div>
      </div>
      <button type="button" class="btn-ghost-sm" onclick="go('profile')">FAQs</button>
    </div>
    <div class="chip-row" style="margin-top:0">
      <button type="button" class="chip" onclick="submitPaypalHelpTurn('How do I recharge wallet?')">How do I recharge wallet?</button>
      <button type="button" class="chip" onclick="submitPaypalHelpTurn('Explain Split cash')">Explain Split cash</button>
      <button type="button" class="chip" onclick="submitPaypalHelpTurn('How does leah@paypal QR work?')">How does leah@paypal QR work?</button>
      <button type="button" class="chip" onclick="submitPaypalHelpTurn('Demo rates & Sandbox')">Demo rates &amp; Sandbox</button>
    </div>
    <div class="chat-thread" aria-live="polite">
      ${helpHistory.length === 0 ? `<div class="card card-tint"><b>Ask PayPal AI for help.</b><p class="sub" style="margin-top:6px">Tap any topic above or type a question about PayPal Wallet, transfers, receipts, or Sandbox mode.</p></div>` : ''}
      ${helpHistory.map(m => m.role === 'user'
        ? `<div class="chat-bubble user"><small style="opacity:.75;font-weight:700;display:block;margin-bottom:4px">Leah</small><div>${escapeHtml(m.text)}</div></div>`
        : `<div class="chat-bubble assistant"><small class="sub" style="font-weight:800;display:block;margin-bottom:4px">PayPal AI</small><p style="color:var(--navy);font-weight:600">${escapeHtml(m.text)}</p></div>`).join('')}
      ${helpBusy ? `<div class="chat-bubble assistant"><div class="callout" style="margin-top:0">${svg('support')}<span>Checking PayPal guide…</span></div></div>` : ''}
    </div>
    <div class="chat-composer">
      <div class="composer-row">
        <label for="help-input" class="sr-only">Ask PayPal support</label>
        <textarea id="help-input" rows="1" value="${escapeHtml(helpComposerText)}" oninput="helpComposerText = this.value" placeholder="Ask PayPal…" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submitPaypalHelpTurn();}">${escapeHtml(helpComposerText)}</textarea>
        <button type="button" class="composer-send-btn" onclick="submitPaypalHelpTurn()" ${helpBusy ? 'disabled' : ''} aria-label="Send question">${svg('send-arrow')}</button>
      </div>
    </div>
  </div>`;
}

function profileScreen() {
  return screenHeader('Profile', 'Receive QR, Medfarm theme, .env connection, and FAQs.', 'home', badge(backendMode && ledger ? 'Sandbox connected' : 'Demo mode', backendMode && ledger ? '' : 'preview'))
  + `<div class="split-grid">
    <section class="card">
      <h2>Appearance</h2>
      <p class="sub" style="margin-top:4px">Medfarm Light &amp; Dark palette</p>
      <div class="theme-segmented" role="group" aria-label="Color theme">
        <button type="button" class="theme-seg-btn" aria-pressed="${themeMode === 'system'}" onclick="setThemeMode('system')">System</button>
        <button type="button" class="theme-seg-btn" aria-pressed="${themeMode === 'light'}" onclick="setThemeMode('light')">Light</button>
        <button type="button" class="theme-seg-btn" aria-pressed="${themeMode === 'dark'}" onclick="setThemeMode('dark')">Dark</button>
      </div>
      <div class="rule"></div>
      <h2>Workspace &amp; voice</h2>
      <div class="row"><span>Backend session</span><b>${backendMode && ledger ? 'Connected (.env auto-linked)' : 'Offline preview'}</b></div>
      <div class="row"><span>Auto-play Chatterbox voice</span><button type="button" class="btn-ghost-sm" onclick="toggleAskVoice()">${askVoiceOn ? 'ON' : 'OFF'}</button></div>
      <div class="row"><span>AI Extract &amp; Split</span><b>${providers.aiConfigured ? 'Configured' : 'Offline parser'}</b></div>
      <div class="row"><span>PayPal Sandbox (SS-001)</span><b>${providers.paypalConfigured ? 'Configured' : 'Unconfigured'}</b></div>
      <div class="actions">
        ${backendMode && ledger
          ? `<button type="button" class="btn btn-secondary" onclick="signOutOrganizer()">Disconnect</button>`
          : `<button type="button" class="btn btn-primary" onclick="reconnectEnvSession()">Auto-connect .env</button><button type="button" class="btn btn-secondary" onclick="go('welcome')">Enter key</button>`}
      </div>
      <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <a class="section-link" href="#dev" onclick="event.preventDefault(); go('dev')">Developer tools</a>
        <button id="lock-wallet-btn" type="button" class="btn-ghost-sm" onclick="lockWallet()">${svg('lock')}<span>Lock wallet</span></button>
      </div>
    </section>
    <div style="display:flex;flex-direction:column;gap:16px">
      <section class="card" style="text-align:center">
        <div class="section-title"><h2>Receive Money QR</h2></div>
        <div style="display:flex;justify-content:center;margin-top:14px">
          <div id="profile-receive-qr" class="qr-box qr-box-lg" aria-label="Receive money QR code"></div>
        </div>
        <div><span class="leah-handle-pill">leah@paypal</span></div>
      </section>
      <section class="card">
        <h2>Help &amp; FAQs</h2>
        <p class="sub" style="margin-top:4px;margin-bottom:8px">Quick answers for Wallet, QR, and splitting bills.</p>
        <details class="faq-item"><summary>How do I add funds with Recharge Wallet?</summary><p>Tap + Recharge on the Home PayPal Wallet card and pick a quick top-up amount or custom USD value.</p></details>
        <details class="faq-item"><summary>How does Split cash work after buying from Store?</summary><p>Complete your direct purchase from Wallet or Linked Card, then click Split cash right on the receipt screen.</p></details>
        <details class="faq-item"><summary>How do friends pay my leah@paypal QR?</summary><p>Friends scan your QR in Scan &amp; Pay to pre-fill Leah and confirm a demo payment.</p></details>
        <details class="faq-item"><summary>Demo mode vs PayPal Sandbox SS-001?</summary><p>Contact transfers run in Demo mode for instant walkthroughs, while SS-001 runs real PayPal Sandbox Checkout.</p></details>
        <div class="actions"><button type="button" class="btn btn-secondary full" onclick="go('contact-paypal')">${svg('support')}<span>Contact PayPal AI Support</span></button></div>
      </section>
      <section class="card">
        <h2>International contacts (${contactsList.length})</h2>
        ${contactsList.map(c => `<div class="row profile-contact">${contactAvatarHtml(c)}<div class="grow"><b>${escapeHtml(c.name)}</b><br><small class="sub">${escapeHtml(c.country || '')} · ${escapeHtml(c.note || '')}</small></div><b>${escapeHtml(c.currency || 'USD')}</b></div>`).join('')}
      </section>
    </div>
  </div>`;
}

function devToolsScreen() {
  return screenHeader('Developer tools', 'Separate presenter controls (hidden from end-user payment flows)', 'profile', badge('Dev entry point', 'preview'))
    + `<div class="narrow card">
      <h2>Session reset</h2>
      <p class="sub" style="margin-top:6px">Clears demo transfers, pending requests, saved bill rules, and cart while keeping PayPal Merchant SS-001 tokens.</p>
      <div class="actions"><button type="button" class="btn btn-primary full" onclick="resetDemoSession()">${svg('refresh')}<span>Reset demo session</span></button></div>
      <div class="rule"></div>
      <h2>Storefront sponsored placement preview</h2>
      <p class="sub" style="margin-top:6px">Sponsored cards are hidden on the normal storefront by default.</p>
      <div class="row"><span>Show sponsored card in Store</span><button type="button" class="btn-ghost-sm" onclick="toggleSponsoredPlacement()">${sponsoredEnabled ? 'Visible (with disclosure)' : 'Hidden (default)'}</button></div>
    </div>`;
}

function toggleSponsoredPlacement() {
  sponsoredEnabled = !sponsoredEnabled;
  localStorage.setItem('splitsync-sponsored', String(sponsoredEnabled));
  toast(sponsoredEnabled ? 'Sponsored placement visible in Store with disclosure.' : 'Sponsored placement hidden (default).');
  render();
}

// ---------- Isolated Payer Pages (#pay/:token & #req/:token) ----------
function buyerPage(shareData, query) {
  const paid = shareData.status === 'Paid';
  const pending = shareData.status === 'Processing';
  const cancelled = query.get('cancelled') === '1' && !paid && !pending;
  const amount = money(shareData.amountCents / 100, 'USD', true);
  const ownsLamp = shareData.name === shareData.lamp;
  return `<div class="hub-top"><div><h1>Your share · ${amount}</h1><p class="screen-sub">Hi ${escapeHtml(shareData.name)}, ${escapeHtml(shareData.merchant)} (${escapeHtml(shareData.purchaseTitle)}).</p></div>${badge('PayPal Sandbox')}</div>
  <div class="split-grid">
    <div class="card"><div class="section-title"><h2>Your items</h2>${badge('Private link')}</div><div class="row"><span>Shared essentials</span><b>$40.00 USD</b></div>${ownsLamp ? `<div class="row"><span>Desk lamp</span><b>$30.00 USD</b></div>` : ''}<div class="row total"><span>Total</span><span>${amount}</span></div></div>
    <div class="card card-tint payment-summary${paid || pending || cancelled ? ' is-priority' : ''}"><div class="section-title"><h2>Payment</h2>${pill(cancelled ? 'Cancelled' : shareData.status)}</div><div class="row"><span>Total</span><b class="money">${amount}</b></div>${!paid && !pending ? `<div class="actions"><button type="button" class="btn btn-paypal full" id="pay-button" onclick="startCheckout()"><img class="checkout-icon" src="assets/paypal.png" alt="">${cancelled ? 'Retry with PayPal' : 'Pay with PayPal'}</button></div>` : ''}<div class="actions"><button type="button" class="btn btn-secondary full" onclick="refreshBuyer()">Refresh payment status</button></div><p id="payment-message" role="status" class="sub" style="color:var(--error);margin-top:8px"></p></div>
  </div>`;
}
function reimbursementBuyerPage(data) {
  const status = data.demo && data.status === 'Paid' ? 'Payment received' : data.status;
  return `<div class="hub-top"><div><h1>Request · ${cents(data.amountCents, data.currency, true)}</h1><p class="screen-sub">Hi ${escapeHtml(data.recipientName)}, from Leah for ${escapeHtml(data.reason)}.</p></div>${badge(data.demo ? 'Demo mode' : 'Personal link', 'preview')}</div>
  <div class="split-grid">
    <div class="card"><h2>${escapeHtml(data.merchant)}</h2>${data.evidenceImageDataUrl ? `<img src="${escapeHtml(data.evidenceImageDataUrl)}" alt="Receipt" class="crop-canvas" style="margin:10px 0">` : ''}${(data.items || []).map(i => `<div class="row"><span>${escapeHtml(i.name)}</span><b>${cents(i.amountCents, data.currency, true)}</b></div>`).join('')}<div class="row total"><span>Bill total</span><span>${cents(data.totalBillCents || data.totalCents, data.currency, true)}</span></div></div>
    <div class="card card-tint"><div class="section-title"><h2>Your portion</h2>${pill(status)}</div><div class="row"><span>Amount</span><b class="money">${cents(data.amountCents, data.currency, true)}</b></div><div class="row"><span>Reason</span><b>${escapeHtml(data.reason)}</b></div><div class="callout">${svg('alert')}<span>${escapeHtml(data.demo ? 'Demo request with simulated settlement. No real money moves.' : data.note)}</span></div></div>
  </div>`;
}

function staticSharePage(n) { return `<div class="narrow card"><h1>${escapeHtml(n)} · ${money(activeSsShares()[n], 'USD', true)}</h1><p class="sub">Demo Merchant SS-001 checkout requires connecting the Node backend with PayPal Sandbox credentials.</p><div class="actions"><button type="button" class="btn btn-secondary" onclick="go('requests')">Back to links</button></div></div>`; }
function handoffPage(n) { return staticSharePage(n); }
function resultPage(n, s) { return `<div class="narrow card center"><h1>${escapeHtml(s)}</h1><p>${escapeHtml(n)} · ${money(activeSsShares()[n], 'USD', true)}</p><div class="actions"><button type="button" class="btn btn-primary" onclick="go('home')">Home</button></div></div>`; }

// ---------- Router & Chrome Visibility ----------
function setChromeMode(route) {
  const primaryTabs = ['home', 'activity', 'store', 'contact-paypal'];
  const payerRoutes = ['share', 'handoff', 'result', 'pay', 'req'];
  const isWelcome = route === 'welcome' || (!ledger && !staticPreviewMode && !payerRoutes.includes(route));
  const isPayer = payerRoutes.includes(route);
  const isFocused = !isWelcome && !isPayer && !primaryTabs.includes(route);
  document.body.dataset.page = route;
  document.body.classList.toggle('welcome', isWelcome);
  document.body.classList.toggle('payer', isPayer);
  document.body.classList.toggle('focused', isFocused);
  const activeTab = primaryTabs.includes(route) ? route : ['product', 'cart', 'checkout-review'].includes(route) ? 'store' : 'home';
  document.querySelectorAll('.nav-rail a[data-tab], .bottom-nav a[data-tab]').forEach(a => {
    const active = !isFocused && !isPayer && !isWelcome && a.dataset.tab === activeTab;
    a.classList.toggle('active', active);
    a.setAttribute('aria-current', active ? 'page' : 'false');
  });
  const fabEl = document.querySelector?.('#fab-ask-ai');
  if (fabEl) fabEl.hidden = isWelcome || isPayer || isFocused || activeTab === 'contact-paypal';
  updateCartBadges();
}

async function renderBuyer() {
  setChromeMode('pay');
  const [token, search = ''] = location.hash.slice(5).split('?');
  buyerToken = token || '';
  const appEl = document.querySelector('#app');
  try {
    buyer = await api('/api/shares/' + buyerToken);
    const query = new URLSearchParams(location.search || '');
    for (const [k, v] of new URLSearchParams(search)) query.set(k, v);
    if (query.get('returned') === '1' && query.get('order') && buyer.status !== 'Paid') {
      try { buyer = await api('/api/shares/' + buyerToken + '/capture', { orderId: query.get('order') }); } catch (e) { buyerActionMessage = e.message; }
    }
    if (appEl) appEl.innerHTML = buyerPage(buyer, query);
  } catch (e) {
    if (appEl) appEl.innerHTML = `<div class="narrow card center"><h1>Link unavailable</h1><p>${escapeHtml(e.message)}</p></div>`;
  }
}

async function renderReimbursementBuyer() {
  setChromeMode('req');
  const token = location.hash.slice(5).split('?')[0];
  buyerToken = token || '';
  const appEl = document.querySelector('#app');
  if (token.startsWith('demo-')) {
    const req = reimbursementsList.find(r => r.recipients.some(x => x.shareToken === token));
    const rec = req?.recipients?.find(x => x.shareToken === token);
    if (req && rec && appEl) { appEl.innerHTML = reimbursementBuyerPage({ ...req, totalBillCents: req.totalCents, recipientName: rec.name, amountCents: rec.amountCents, currency: rec.currency || req.currency, reason: rec.reason, status: rec.status, note: 'Personal reimbursement link.' }); return; }
  }
  try {
    const data = await api('/api/reimbursements/' + encodeURIComponent(token));
    if (appEl) appEl.innerHTML = reimbursementBuyerPage(data);
  } catch (e) {
    if (appEl) appEl.innerHTML = `<div class="narrow card center"><h1>Request not found</h1><p>${escapeHtml(e.message)}</p></div>`;
  }
}

async function startCheckout() {
  const b = document.querySelector('#pay-button'); if (b) b.disabled = true;
  try { const res = await api('/api/shares/' + buyerToken + '/orders', {}); if (res.alreadyPaid || res.pending) { buyer = res.share; await renderBuyer(); return; } location.href = res.approvalUrl; }
  catch (e) { if (b) b.disabled = false; const m = document.querySelector('#payment-message'); if (m) m.textContent = e.message; }
}
async function refreshBuyer() { try { buyer = await api('/api/shares/' + buyerToken + '/refresh', {}); await renderBuyer(); } catch {} }

/** Dynamically loads the QR encoder and injects the SVG into `selector` when a real DOM box exists. */
async function renderQrSvgInto(selector, url) {
  const box = document.querySelector(selector);
  if (!box || !url || !('innerHTML' in box)) return;
  try {
    const { default: QR } = await import('./qrcode.js');
    const live = document.querySelector(selector);
    if (live && 'innerHTML' in live) live.innerHTML = QR(url);
  } catch {}
}

let autoCamTriggeredRoute = '';
async function render() {
  applyThemeMode(themeMode);
  if (location.hash.startsWith('#pay/')) return renderBuyer();
  if (location.hash.startsWith('#req/')) return renderReimbursementBuyer();

  const rawHash = (location.hash || '#home').slice(1);
  const [rawRoute, a, b] = rawHash.split('/');
  const route = rawRoute || 'home';

  if (route === 'receive' && openReceiveLink(rawHash)) return;
  if (route === 'dev-reset') { await resetDemoSession(); return; }
  if ((!appUnlocked || route === 'login') && !['welcome', 'share', 'handoff', 'result'].includes(route)) {
    if (appUnlocked && route === 'login') { location.hash = '#home'; return; }
    setChromeMode('welcome');
    const el = document.querySelector('#app');
    if (el) el.innerHTML = medfarmLoginView();
    return;
  }
  if (!ledger && !staticPreviewMode && !['welcome', 'share', 'handoff', 'result'].includes(route)) {
    if (backendMode) {
      try { await loadWorkspaceState(); } catch { staticPreviewMode = true; }
    } else {
      // Static deployments (e.g., Vercel) have no Node backend, so enter demo preview mode after PIN unlock.
      staticPreviewMode = true;
    }
  }
  if (route === 'welcome' && backendMode && providers.localOrganizerAutoLogin && !manualDisconnect) {
    try { if (!ledger) await loadWorkspaceState(); staticPreviewMode = false; go('home'); return; } catch {}
  }
  if (route === 'welcome') { setChromeMode('welcome'); const el = document.querySelector('#app'); if (el) el.innerHTML = authView(); return; }

  if (route !== 'scan' && activeStream) stopStreams();
  if (route !== 'scan-bill' && billStream) stopStreams();
  if (!['ask', 'talk'].includes(route)) cancelAskSpeech();

  reconcileLocalDemoSettlements();
  scheduleSettlementTicker();
  setChromeMode(route);

  const views = {
    home: homeScreen,
    activity: activityScreen,
    store: storeScreen,
    shop: storeScreen,
    'contact-paypal': contactPaypalScreen,
    profile: profileScreen,
    dev: devToolsScreen,
    welcome: authView,
    send: () => { if (a && transferForm.contactId !== a) selectSendContact(a); return sendMoneyScreen(); },
    'review-transfer': reviewTransferScreen,
    'review-payment-draft': groupPaymentReviewScreen,
    'payment-draft-receipt': groupPaymentReceiptScreen,
    tx: () => txReceiptScreen(a || activeTxReceiptId),
    'request-new': manualRequestScreen,
    request: () => requestDetailScreen(a),
    ask: askScreen,
    talk: askScreen,
    'scan-bill': scanBillScreen,
    rent: () => householdBillScreen('rent'),
    electricity: () => householdBillScreen('electricity'),
    scan: scanQrScreen,
    review: reviewScreen,
    split: () => splitScreen(false),
    clarify: () => splitScreen(true),
    edit: () => splitScreen(false),
    requests: () => requestsScreen(),
    qr: () => requestsScreen(a),
    dashboard: dashboardScreen,
    product: () => productDetailScreen(a),
    cart: cartScreen,
    'checkout-review': checkoutReviewScreen,
    share: () => staticSharePage(names.find(x => x.toLowerCase() === a) || 'Maya'),
    handoff: () => handoffPage(names.find(x => x.toLowerCase() === a) || 'Maya'),
    result: () => resultPage(names.find(x => x.toLowerCase() === a) || 'Maya', b || 'processing'),
  };

  const appEl = document.querySelector('#app');
  const routeKey = location.hash || '#home';
  const sameRoute = routeKey === lastRouteKey;
  const focused = sameRoute && appEl?.contains?.(document.activeElement) ? document.activeElement : null;
  const fieldId = focused?.id;
  const selection = typeof focused?.selectionStart === 'number' ? [focused.selectionStart, focused.selectionEnd] : null;
  if (appEl) {
    const html = (views[route] || homeScreen)() + renderRechargeModal();
    if (!sameRoute && routeTransitionPending) {
      appEl.classList?.remove?.('screen-enter');
      appEl.innerHTML = `<div class="screen-enter">${html}</div>`;
      routeTransitionPending = false;
    } else {
      appEl.innerHTML = html;
    }
  }
  if (!sameRoute) {
    if (['home', 'activity', 'store', 'contact-paypal', 'profile'].includes(route)) {
      window.scrollTo(0, tabScrollY[route] || 0);
    } else {
      window.scrollTo(0, 0);
    }
  }
  if (fieldId) {
    const replacement = document.getElementById(fieldId);
    replacement?.focus({ preventScroll: true });
    if (selection) replacement?.setSelectionRange?.(...selection);
  }
  lastRouteKey = routeKey;

  if (route === 'scan-bill' && autoCamTriggeredRoute !== 'scan-bill' && !billRawImage && !billDraft && billCameraState === 'ready') {
    autoCamTriggeredRoute = 'scan-bill';
    startStandaloneBillCamera();
  } else if (route !== 'scan-bill') {
    autoCamTriggeredRoute = '';
  }

  if (route === 'requests' || route === 'qr') {
    await renderQrSvgInto('#qr', paymentLink(selectedQrName || lamp || 'Maya'));
  }
  if (route === 'request') {
    const req = reimbursementsList.find(r => r.id === a);
    const rec = req?.recipients?.find(x => x.id === selectedReqQr.recipientId) || req?.recipients?.[0];
    const url = rec ? (rec.shareUrl || (location.href.split('#')[0] + '#req/' + rec.shareToken)) : '';
    await renderQrSvgInto('#req-qr', url);
  }
  if (route === 'home') {
    await renderQrSvgInto('#home-receive-qr', receiveQrUrl());
    const canvas = document.querySelector('#wallet-3d-canvas');
    const stage = document.querySelector('#wallet-3d-stage');
    if (canvas && stage && typeof WebGLRenderingContext !== 'undefined') {
      try {
        const { mountWallet3DCards } = await import('./cards3d.js');
        const ctrl = mountWallet3DCards(canvas, { activeCardIndex: activeCardIdx, walletBalanceCents });
        if (ctrl) {
          cards3dController = ctrl;
          stage.classList.add('has-webgl');
        }
      } catch {}
    }
  }
  if (route === 'profile') {
    await renderQrSvgInto('#profile-receive-qr', receiveQrUrl());
  }
}

function createSampleReceiptDataUrl() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return '';
  const c = document.createElement('canvas'); if (!c || typeof c.getContext !== 'function') return '';
  c.width = 440; c.height = 560; const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 440, 560);
  ctx.strokeStyle = '#DCE1E8'; ctx.lineWidth = 4; ctx.strokeRect(18, 18, 404, 524);
  ctx.fillStyle = '#242E49'; ctx.font = 'bold 26px system-ui,sans-serif'; ctx.fillText('OLIVE KITCHEN', 42, 74);
  ctx.fillStyle = '#5D6A85'; ctx.font = '15px system-ui,sans-serif'; ctx.fillText('Date: 2026-11-10   Currency: USD', 42, 108);
  ctx.fillStyle = '#242E49'; ctx.font = 'bold 18px system-ui,sans-serif';
  ctx.fillText('Pasta Dinner Bowl', 42, 200); ctx.fillText('$20.00', 325, 200);
  ctx.fillText('Craft Drinks (2)', 42, 244); ctx.fillText('$15.00', 325, 244);
  ctx.fillText('Shared Herb Flatbread', 42, 288); ctx.fillText('$7.00', 336, 288);
  ctx.fillStyle = '#0A4EC4'; ctx.font = 'bold 24px system-ui,sans-serif'; ctx.fillText('TOTAL USD', 42, 464); ctx.fillText('$42.00', 310, 464);
  return c.toDataURL('image/png');
}

window.addEventListener('hashchange', () => {
  const next = (location.hash || '#home').slice(1);
  if (next && navStack[navStack.length - 1] !== next) {
    const existingIdx = navStack.lastIndexOf(next);
    if (existingIdx >= 0) navStack = navStack.slice(0, existingIdx + 1);
    else navStack.push(next);
    routeTransitionPending = true;
  }
  render();
});
window.addEventListener('keydown', e => {
  if (appUnlocked || bioVerifying) return;
  if (/^[0-9]$/.test(e.key)) { e.preventDefault(); pinAppend(e.key); }
  else if (e.key === 'Backspace') { e.preventDefault(); pinBackspace(); }
});
window.addEventListener('focus', () => {
  if (backendMode && ledger) loadWorkspaceState().then(render).catch(() => {});
});
detectBackend().then(render);
