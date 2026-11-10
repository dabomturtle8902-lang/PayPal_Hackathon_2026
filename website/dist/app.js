// SplitSync AI Web App — Payment-first hub, multi-turn voice assistant, FX & self-settling demo engine

const CURR_SYM = { USD: '$', GBP: '£', CAD: 'CA$', EUR: '€', JPY: '¥', INR: '₹' };
const FX_RATES = { USD: 1, GBP: 0.79, CAD: 1.39, EUR: 0.92, JPY: 153.5, INR: 84.4 };
const CURRENCIES = ['USD', 'GBP', 'CAD', 'EUR', 'JPY', 'INR'];
const names = ['Maya', 'Arun', 'Leah'];

function normCurr(code, fallback = 'USD') {
  const c = String(code || '').trim().toUpperCase();
  return FX_RATES[c] ? c : fallback;
}

function money(n, curr = 'USD', withCode = false) {
  const c = normCurr(curr, 'USD');
  const sym = CURR_SYM[c] || '$';
  const val = Number(n || 0);
  const str = c === 'JPY'
    ? Math.round(val).toLocaleString('en-US')
    : val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sym}${str}${withCode ? ` ${c}` : ''}`;
}

const cents = (c, curr = 'USD', withCode = false) => money((Number(c) || 0) / 100, curr, withCode);

function convertCents(amountCents, fromCurr = 'USD', toCurr = 'USD') {
  const from = normCurr(fromCurr, 'USD');
  const to = normCurr(toCurr, 'USD');
  const raw = Math.max(0, Number(amountCents) || 0);
  if (from === to) return to === 'JPY' ? Math.round(raw / 100) * 100 : Math.round(raw);
  const usdMajor = (raw / 100) / FX_RATES[from];
  const targetMajor = usdMajor * FX_RATES[to];
  return to === 'JPY' ? Math.round(targetMajor) * 100 : Math.round(targetMajor * 100);
}

function fxQuote(amountCents, fromCurr = 'USD', toCurr = 'USD') {
  const sourceCurrency = normCurr(fromCurr, 'USD');
  const targetCurrency = normCurr(toCurr, sourceCurrency);
  const sourceAmountCents = sourceCurrency === 'JPY'
    ? Math.round((Number(amountCents) || 0) / 100) * 100
    : Math.max(0, Math.round(Number(amountCents) || 0));
  const targetAmountCents = convertCents(sourceAmountCents, sourceCurrency, targetCurrency);
  const inrEquivalentCents = convertCents(sourceAmountCents, sourceCurrency, 'INR');
  const rate = Number((FX_RATES[targetCurrency] / FX_RATES[sourceCurrency]).toFixed(targetCurrency === 'JPY' ? 2 : 4));
  return { sourceAmountCents, sourceCurrency, targetAmountCents, targetCurrency, inrEquivalentCents, rate, demoQuote: true };
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

const storeCatalog = [
  { id: 'kit-essentials', name: 'Kitchen essentials bundle', priceCents: 12000, seller: 'Demo Merchant', category: 'Kitchen', demoLinked: true, art: 'bag', desc: 'Cookware, storage containers, and cleaning basics. Pairs with Desk lamp for the $150 Demo Merchant Sandbox flow.' },
  { id: 'desk-lamp', name: 'Matte task desk lamp', priceCents: 3000, seller: 'Demo Merchant', category: 'Lighting', demoLinked: true, art: 'lamp', desc: 'Warm LED desk lamp with weighted base for shared study spaces. Pairs with Kitchen essentials for SS-001.' },
  { id: 'bamboo-tray', name: 'Modular bamboo organizer', priceCents: 2800, seller: 'Studio Living Demo', category: 'Kitchen', demoLinked: false, art: 'grid', desc: 'Expandable drawer divider set for shared kitchen flatware and utensils.' },
  { id: 'hepa-purifier', name: 'Compact HEPA air purifier', priceCents: 8400, seller: 'PureHome Demo', category: 'Furniture', demoLinked: false, art: 'wind', desc: 'Whisper-quiet bedroom and living-room air cleaner with washable pre-filter.' },
  { id: 'microfiber-kit', name: 'Move-in cleaning kit', priceCents: 2400, seller: 'Demo Merchant', category: 'Cleaning', demoLinked: false, art: 'sparkles', desc: 'Plant-safe surface spray, scrub sponges, and 8 microfiber cloths.' },
  { id: 'pantry-bins', name: 'Stackable pantry bins (6 pack)', priceCents: 3600, seller: 'TidyNest Demo', category: 'Kitchen', demoLinked: false, art: 'box', desc: 'Clear BPA-free fridge and dry-pantry bins with grip handles.' },
];

const externalRetailers = [
  { id: 'ikea', name: 'IKEA home furnishings', category: 'Furniture', seller: 'External retailer', url: 'https://www.ikea.com/', desc: 'Browse sofas, desks, lighting, and flat-pack storage directly on ikea.com.' },
  { id: 'target', name: 'Target apartment basics', category: 'Cleaning', seller: 'External retailer', url: 'https://www.target.com/', desc: 'Check local apartment delivery and store pickup stock on target.com.' },
  { id: 'container-store', name: 'The Container Store', category: 'Kitchen', seller: 'External retailer', url: 'https://www.containerstore.com/', desc: 'Compare closet and kitchen shelving dimensions on containerstore.com.' },
];

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
let ss001Active = localStorage.getItem('splitsync-ss001-active') === 'true';
let lamp = localStorage.getItem('splitsync-lamp') || 'Maya';
let published = localStorage.getItem('splitsync-published') === 'true';
let instructionDraft = 'Split the $120 kitchen essentials evenly between Maya, Arun and Leah. The $30 lamp is for Leah.';
let pastedLinkDraft = '';
let selectedQrName = 'Maya';
let selectedReqQr = { reqId: '', recipientId: '' };
let confirmBusy = false;
let draftLamp = null;
let aiState = 'idle';
let aiError = '';
let ttsState = 'idle';
let ttsError = '';
let ttsAudioSrc = '';
let ttsAudioLamp = '';

// Settlement background timer & deduplicated notifications
let settleTimerId = null;
const notifiedSettlementIds = new Set();
const justSettledIds = new Set();

// Activity search & filters
let activityFilter = 'All';
let activityQuery = '';

// Scan & Pay (camera unopened by default)
let scannerState = 'ready';
let scannerMessage = '';
let activeStream = null;

// Send / Request forms (clean/empty initial values)
let contactSearch = '';
let transferForm = { contactId: '', amountStr: '', sourceCurrency: 'USD', targetCurrency: 'GBP', note: '', clientTxId: '', busy: false, error: '', showInrQuote: true };
let activeTxReceiptId = '';
let manualReqForm = { multi: false, contactId: '', contactIds: [], amountStr: '', currency: 'USD', note: '', channel: 'demo', busy: false, error: '', clientRequestId: '' };

// Rent screen (clean empty default unless explicitly saved by user)
let rentForm = { creating: false, contactIds: [], amountStr: '', currency: 'USD', dueDate: '2026-12-01', mode: 'equal', customAmounts: {}, saveRule: false, busy: false, error: '' };

// Scan Bill standalone flow (starts blank; opens camera on entry)
let billStream = null;
let billCameraState = 'ready';
let billCameraMessage = '';
let billRawImage = '';
let billCroppedImage = '';
let billCropTopPct = 0;
let billCropBottomPct = 0;
let billExtractState = 'idle';
let billExtractError = '';
let billDraft = null;
let billRecipientIds = [];

// Ask SplitSync Multi-turn Conversation State (clean empty thread)
let chatHistory = [];
let chatDraft = null; // { intent, recipients, needsClarification, clarificationPrompt, modelUsed }
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
let askAutoSendMic = true;
let askBusy = false;
let askConfirmSheetOpen = false;
let askConfirmChannel = 'demo';

// Mic + Chatterbox Autoplay & Cancellation Control
let micState = 'idle'; // idle | listening | transcribing | denied | unavailable
let micError = '';
let micRecorder = null;
let micChunks = [];
let speechRecognition = null;
let ttsEpoch = 0;
let ttsAbortCtrl = null;
let activeAudioEl = null;
let askAudioState = 'idle'; // idle | loading | playing | blocked | ready | unavailable
let askAudioSrc = '';
let askAudioError = '';
let askAudioMsgId = '';
let pendingSendTransitionTimer = null;

// Storefront & Cart
let storeCategory = 'All';
let storeQuery = '';
let sharedCart = JSON.parse(localStorage.getItem('splitsync-cart') || '[]');

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
}

function escapeHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function svg(name) {
  const icons = {
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h3"/>',
    'send-req': '<circle cx="12" cy="12" r="9"/><path d="M9.5 14.5L14.5 9.5"/><path d="M10.5 9.5h4v4"/>',
    'receipt-camera': '<path d="M4 7V5a1 1 0 0 1 1-1h3l2-2h4l2 2h3a1 1 0 0 1 1 1v2"/><rect x="4" y="7" width="16" height="13" rx="2"/><circle cx="12" cy="13.5" r="3"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/><path d="M8 21h8"/>',
    sparkles: '<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    bag: '<path d="M5 8h14l1 12H4L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2l2.4 11h10.8l2-8H6.5"/>',
    store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M9 12.2l2 2 4-4.2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
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
    lamp: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3z"/>',
    grid: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
    wind: '<path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M17.7 7.7A2.5 2.5 0 1 1 19 12H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>',
    box: '<path d="M3 8l9-4 9 4v8l-9 4-9-4V8z"/><path d="M3 8l9 4 9-4"/><path d="M12 12v8"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h4"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.sparkles}</svg>`;
}

const badge = (text, kind = '') => `<span class="badge ${kind}">${escapeHtml(text)}</span>`;
const statusClass = s => ({
  Created: 'created',
  Sent: 'sent',
  'Awaiting payment': 'awaiting',
  'Waiting for payment': 'processing',
  Processing: 'processing',
  Paid: 'paid',
  'Payment received': 'paid',
  Completed: 'paid',
  Failed: 'failed',
  Cancelled: 'error',
}[s] || 'created');
const pill = s => `<span class="pill ${statusClass(s)}">${escapeHtml(s)}</span>`;

function screenHeader(title, subtitle, backRoute = 'home', rightHtml = '') {
  return `<div class="screen-top">
    <div class="screen-top-left">
      <button type="button" class="btn-back" onclick="go('${backRoute}')" aria-label="Back">${svg('arrow-left')}</button>
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
  window.toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3200);
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

// ---------- Workspace Sync & Settlement Ticker ----------
function stopStreams() {
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
  if (!['ask', 'talk'].includes(route.split('/')[0])) cancelAskSpeech();
  location.hash = '#' + route;
}

function reconcileLocalDemoSettlements() {
  let newlySettled = [];
  const now = Date.now();
  for (const req of reimbursementsList) {
    for (const r of req.recipients || []) {
      if (r.status === 'Waiting for payment' && Number.isFinite(r.settleAt) && now >= r.settleAt) {
        r.status = 'Paid';
        r.demoSettled = true;
        r.settledAt = new Date(r.settleAt).toISOString();
        r.receiptRef ||= 'DEMO-' + Math.random().toString(16).slice(2, 6).toUpperCase();
        newlySettled.push(r);
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
        toast(`Payment received from ${r.name} (${cents(r.amountCents, r.currency)})`);
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
      return true;
    }
  } catch {}
  backendMode = false;
  return false;
}

async function loadWorkspaceState() {
  const prevReimbs = JSON.parse(JSON.stringify(reimbursementsList));
  const data = await api('/api/organizer/state');
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

// ---------- Auth / Welcome & Profile & Dev Reset ----------
function authView() {
  return `<div class="auth-shell">
    <section class="auth-hero">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <span class="brand-mark sm" aria-hidden="true">${svg('arrow-right')}</span>
          <b style="font-size:17px">SplitSync AI</b>
        </div>
        ${badge(backendMode ? 'Demo mode · Sandbox ready' : 'Demo preview', 'navy')}
        <h1 style="margin-top:14px">Pay, request, and split by voice or camera.</h1>
        <p style="margin-top:8px">Send across borders with instant quotes, talk or photograph bills in Ask SplitSync, and settle shared purchases cleanly.</p>
      </div>
      <div>
        <div class="auth-feature">${svg('qr')}<div><b>Scan &amp; pay + International sends</b><small>Pay supported Sandbox merchant links or send demo transfers to international contacts.</small></div></div>
        <div class="auth-feature">${svg('mic')}<div><b>Conversational Ask SplitSync</b><small>Speak, type, or attach a receipt and hear Chatterbox confirm validated details.</small></div></div>
        <div class="auth-feature">${svg('bag')}<div><b>splitStore shared shopping</b><small>Browse sample household items, build a shared cart, and split when ready.</small></div></div>
      </div>
    </section>

    <section class="card">
      <h2>Connect workspace</h2>
      <p style="margin-top:6px">Enter the SplitSync organizer key from your Node terminal to unlock server AI, Chatterbox speech, and Sandbox persistence.</p>
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
  authBusy = true; authErrorKind = ''; authErrorMessage = ''; render();
  try {
    const ok = await detectBackend();
    if (!ok) { authErrorKind = 'unavailable'; authErrorMessage = 'Local Node server did not respond on /api/health.'; authBusy = false; render(); return; }
    await api('/api/organizer/session', { token: key });
    await loadWorkspaceState();
    staticPreviewMode = false; organizerKeyDraft = ''; authBusy = false;
    go('home'); await render();
  } catch (e) {
    authBusy = false; authErrorKind = e.status === 401 ? 'invalid' : 'unavailable'; authErrorMessage = e.message; render();
  }
}

async function signOutOrganizer() {
  if (backendMode) { try { await api('/api/organizer/logout', {}); } catch {} }
  ledger = null; staticPreviewMode = false; go('welcome'); await render();
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
    try { await api('/api/organizer/reset-demo', {}); await loadWorkspaceState(); } catch (e) { toast(e.message); }
  }
  demoTransactions = [];
  reimbursementsList = [];
  savedRentRule = null;
  ss001Active = false;
  published = false;
  lamp = 'Maya';
  localStorage.removeItem('splitsync-reimbursements');
  localStorage.removeItem('splitsync-demo-tx');
  localStorage.removeItem('splitsync-rent-rule');
  localStorage.removeItem('splitsync-ss001-active');
  localStorage.removeItem('splitsync-published');
  localStorage.removeItem('splitsync-cart');
  sharedCart = [];
  chatHistory = []; chatDraft = null; chatAttachedBill = null; chatAttachedImg = ''; chatAttachedRawImg = ''; askComposerText = '';
  billRawImage = ''; billCroppedImage = ''; billDraft = null; billRecipientIds = [];
  transferForm = { contactId: '', amountStr: '', sourceCurrency: 'USD', targetCurrency: 'GBP', note: '', clientTxId: '', busy: false, error: '', showInrQuote: true };
  manualReqForm = { multi: false, contactId: '', contactIds: [], amountStr: '', currency: 'USD', note: '', channel: 'demo', busy: false, error: '', clientRequestId: '' };
  rentForm = { creating: false, contactIds: [], amountStr: '', currency: 'USD', dueDate: '2026-12-01', mode: 'equal', customAmounts: {}, saveRule: false, busy: false, error: '' };
  scannerState = 'ready'; scannerMessage = ''; pastedLinkDraft = '';
  toast('Clean demo session ready.');
  go('home');
  render();
}

// ---------- Home: PhonePe Action-First + Quick Contacts + Latest Activity ----------
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
    rows.push({
      id: tx.id,
      kind: 'transfer',
      counterparty: `${tx.flag || ''} ${tx.recipientName}`.trim(),
      title: `Sent to ${tx.recipientName}`,
      subtitle: tx.note || 'Demo transfer',
      date: (tx.createdAt || '').slice(0, 10) || 'Today',
      primaryAmount: cents(tx.sourceAmountCents, tx.sourceCurrency, true),
      secondaryAmount: tx.sourceCurrency !== tx.targetCurrency ? `→ ${cents(tx.targetAmountCents, tx.targetCurrency, true)}` : '',
      status: 'Demo transfer',
      filterBucket: 'Transfers',
      route: `tx/${tx.id}`,
      sortTs: Date.parse(tx.createdAt || '') || 0,
    });
  }
  for (const req of reimbursementsList) {
    const recs = req.recipients || [];
    const paidCount = recs.filter(r => r.status === 'Paid').length;
    const waitCount = recs.filter(r => r.status === 'Waiting for payment').length;
    const totalReq = recs.reduce((s, r) => s + r.amountCents, 0);
    const owed = recs.filter(r => r.status !== 'Paid').reduce((s, r) => s + r.amountCents, 0);
    let aggStatus = 'Created';
    if (recs.length && paidCount === recs.length) aggStatus = recs.some(r => r.demoSettled) ? 'Payment received' : 'Paid';
    else if (waitCount > 0) aggStatus = 'Waiting for payment';
    else if (recs.some(r => r.status === 'Sent')) aggStatus = 'Sent';
    const curr = req.currency || recs[0]?.currency || 'USD';
    const namesSummary = recs.map(r => r.name).join(', ');
    const receivedBanner = paidCount > 0 && recs.length === 1 && recs[0].demoSettled
      ? `Payment received from ${recs[0].name}`
      : (paidCount > 0 && paidCount < recs.length ? `${paidCount}/${recs.length} received · ${cents(owed, curr)} waiting` : `${recs.length} recipient${recs.length === 1 ? '' : 's'} · ${req.kind === 'rent' ? 'Rent' : 'Request'}`);
    rows.push({
      id: req.id,
      kind: req.kind || 'request',
      counterparty: namesSummary || req.merchant || req.title,
      title: req.title || req.merchant || 'Request',
      subtitle: receivedBanner,
      date: (req.createdAt || '').slice(0, 10) || 'Today',
      primaryAmount: cents(totalReq, curr, true),
      secondaryAmount: '',
      status: aggStatus,
      filterBucket: aggStatus === 'Payment received' || aggStatus === 'Paid' ? 'Received' : (aggStatus === 'Waiting for payment' ? 'Waiting' : 'Waiting'),
      route: `request/${req.id}`,
      sortTs: Date.parse(req.createdAt || '') || 0,
      flash: justSettledIds.has(req.id),
    });
  }
  if (ss001Active) {
    const paidC = names.filter(n => ssStatus(n) === 'Paid').length;
    const status = paidC === 3 ? 'Paid' : names.some(n => ssStatus(n) === 'Processing') ? 'Processing' : 'Awaiting payment';
    rows.push({
      id: 'SS-001',
      kind: 'sandbox',
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

function homeScreen() {
  const items = buildUnifiedActivity();
  const quickContacts = contactsList.filter(c => c.id !== 'leah').slice(0, 5);
  const storeSample = storeCatalog.slice(0, 2);

  return `<div class="hub-top">
    <div>
      <h1>Hello, Leah</h1>
      <p class="screen-sub">${badge(backendMode ? 'Demo mode · Sandbox connected' : 'Demo mode', 'preview')}</p>
    </div>
    <button type="button" class="btn-ghost-sm" onclick="go('profile')" aria-label="Profile settings">${svg('key')}<span>Profile</span></button>
  </div>

  <section class="hub-card" aria-label="Everyday payment actions">
    <div class="hub-actions-grid">
      <button type="button" class="hub-tile" onclick="openScanPay()">
        <span class="hub-tile-icon">${svg('qr')}</span>
        <b>Scan &amp; pay</b>
      </button>
      <button type="button" class="hub-tile" onclick="openManualRequest()">
        <span class="hub-tile-icon teal">${svg('send-req')}</span>
        <b>Request money</b>
      </button>
      <button type="button" class="hub-tile" onclick="openSendMoney()">
        <span class="hub-tile-icon tint">${svg('arrow-right')}</span>
        <b>Send money</b>
      </button>
    </div>
    <button type="button" class="ask-banner" onclick="openAskSplitSync()">
      <span style="display:flex;align-items:center;gap:10px">
        <span class="hub-tile-icon" style="width:36px;height:36px;border-radius:10px">${svg('mic')}</span>
        <span>
          <b style="display:block;font-size:14px">Ask SplitSync</b>
          <small style="color:#DCE1E8;font-size:12px">Voice assistant, quick send, or snap a receipt</small>
        </span>
      </span>
      ${svg('arrow-right')}
    </button>
  </section>

  <div class="contact-strip" aria-label="Quick international contacts">
    ${quickContacts.map(c => `<button type="button" class="contact-pill" onclick="openSendMoney('${escapeHtml(c.id)}')">
      <span>${escapeHtml(c.flag || '')}</span>
      <span>${escapeHtml(c.name)}</span>
      <small class="sub">${escapeHtml(c.currency)}</small>
    </button>`).join('')}
  </div>

  <section class="card" style="margin-bottom:16px">
    <div class="section-title">
      <h2>Latest activity</h2>
      <a class="section-link" href="#activity">See all ${svg('arrow-right')}</a>
    </div>
    ${items.length === 0 ? `<p class="sub">No activity yet. Scan &amp; pay a merchant QR, send to an international contact, or request money.</p>` : items.slice(0, 4).map(it => `
      <div class="row ${it.flash ? 'settled-flash' : ''}" style="cursor:pointer" onclick="go('${escapeHtml(it.route)}')">
        <span class="icon-box">${svg(it.kind === 'sandbox' ? 'store' : it.kind === 'transfer' ? 'arrow-right' : 'receipt')}</span>
        <div class="grow">
          <b>${escapeHtml(it.title)}</b><br>
          <small class="sub">${escapeHtml(it.counterparty)} · ${escapeHtml(it.subtitle)}</small>
        </div>
        <div style="text-align:right">
          <b class="money">${escapeHtml(it.primaryAmount)}</b>
          ${it.secondaryAmount ? `<div><small class="sub">${escapeHtml(it.secondaryAmount)}</small></div>` : ''}
          <div style="margin-top:3px">${pill(it.status)}</div>
        </div>
      </div>`).join('')}
  </section>

  <div class="section-title" style="margin-bottom:10px">
    <h2 style="font-size:16px">Household actions</h2>
  </div>
  <div class="shortcuts-grid" style="margin-top:0">
    <button type="button" class="shortcut-card" onclick="openRentFlow()">
      <span class="icon-box">${svg('calendar')}</span>
      <span class="grow"><span class="shortcut-title"><b>Rent</b></span><small class="sub">Create rent request</small></span>
    </button>
    <button type="button" class="shortcut-card" onclick="openAskSplitSync()">
      <span class="icon-box">${svg('sparkles')}</span>
      <span class="grow"><span class="shortcut-title"><b>Split expense</b></span><small class="sub">Voice or custom split</small></span>
    </button>
    <button type="button" class="shortcut-card" onclick="openScanBillEntry()">
      <span class="icon-box">${svg('receipt-camera')}</span>
      <span class="grow"><span class="shortcut-title"><b>Scan bill</b></span><small class="sub">Capture receipt camera</small></span>
    </button>
  </div>

  <section class="card" style="margin-top:16px">
    <div class="section-title">
      <div><h2>splitStore ${badge('Sample · Demo mode', 'preview')}</h2></div>
      <a class="section-link" href="#store">Browse Store ${svg('arrow-right')}</a>
    </div>
    <div class="split-grid" style="gap:12px">
      ${storeSample.map(p => `<div class="row" style="border:1px solid var(--line);border-radius:12px;padding:12px;border-bottom:1px solid var(--line)">
        <span class="icon-box">${svg(p.art)}</span>
        <div class="grow"><b>${escapeHtml(p.name)}</b><br><small class="sub">${escapeHtml(p.seller)} · <span class="money">${cents(p.priceCents)}</span></small></div>
        <button type="button" class="btn-ghost-sm" onclick="go('product/${escapeHtml(p.id)}')">View</button>
      </div>`).join('')}
    </div>
  </section>`;
}

// ---------- Send Money + International FX + Review Payment ----------
function openSendMoney(contactId = '') {
  contactSearch = '';
  const c = contactsList.find(x => x.id === contactId);
  transferForm = {
    contactId: c?.id || '',
    amountStr: '',
    sourceCurrency: 'USD',
    targetCurrency: c?.currency || 'USD',
    note: '',
    clientTxId: `tx-${Date.now().toString(36)}`,
    busy: false,
    error: '',
    showInrQuote: true,
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
  const srcMajor = Number(transferForm.amountStr) || 0;
  const quote = fxQuote(Math.round(srcMajor * 100), transferForm.sourceCurrency, transferForm.targetCurrency);

  return screenHeader('Send money', 'International demo transfers with instant FX quote', 'home', badge('Demo mode', 'preview'))
    + `<div class="narrow card">
      <div class="field-group" style="margin-top:0">
        <label for="send-contact-search">Choose contact</label>
        <input id="send-contact-search" type="search" value="${escapeHtml(contactSearch)}" oninput="contactSearch = this.value; render()" placeholder="Search Allen (UK), Maya (US), Arun (CA), Sofia (DE), Yuki (JP)…">
      </div>
      <div class="chip-row" style="margin-bottom:14px">
        ${filtered.map(c => `<button type="button" class="chip ${transferForm.contactId === c.id ? 'selected' : ''}" onclick="selectSendContact('${escapeHtml(c.id)}')">${escapeHtml(c.flag || '')} ${escapeHtml(c.name)} · ${escapeHtml(c.country || '')} (${escapeHtml(c.currency || 'USD')})</button>`).join('')}
      </div>
      ${selected ? `<div class="split-grid" style="gap:12px">
        <div class="field-group" style="margin-top:0">
          <label for="send-amount">You send (${escapeHtml(transferForm.sourceCurrency)})</label>
          <input id="send-amount" type="number" step="0.01" value="${escapeHtml(transferForm.amountStr)}" oninput="transferForm.amountStr = this.value; render()" placeholder="0.00">
        </div>
        <div class="field-group" style="margin-top:0">
          <label for="send-currency">Send currency</label>
          <select id="send-currency" onchange="transferForm.sourceCurrency = this.value; render()">
            ${CURRENCIES.map(curr => `<option value="${curr}" ${transferForm.sourceCurrency === curr ? 'selected' : ''}>${curr}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field-group">
        <label for="send-target-curr">Recipient receives (${escapeHtml(selected.name)} · ${escapeHtml(selected.flag || '')} ${escapeHtml(selected.country || '')})</label>
        <select id="send-target-curr" onchange="transferForm.targetCurrency = this.value; render()">
          ${CURRENCIES.map(curr => `<option value="${curr}" ${transferForm.targetCurrency === curr ? 'selected' : ''}>${curr}</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label for="send-note">Note (optional)</label>
        <input id="send-note" value="${escapeHtml(transferForm.note)}" oninput="transferForm.note = this.value" placeholder="Thanks for coffee">
      </div>
      ${srcMajor > 0 ? `<div class="fx-box">
        <div class="row" style="padding:4px 0"><span>You send</span><b class="money">${cents(quote.sourceAmountCents, quote.sourceCurrency, true)}</b></div>
        <div class="row" style="padding:4px 0"><span>${escapeHtml(selected.name)} receives</span><b class="money" style="color:var(--primary-ink)">${cents(quote.targetAmountCents, quote.targetCurrency, true)}</b></div>
        <div class="row" style="padding:4px 0"><span>Demo FX quote</span><small class="sub">1 ${quote.sourceCurrency} = ${quote.rate} ${quote.targetCurrency} · Demo fixture rate</small></div>
        ${quote.sourceCurrency !== 'INR' ? `<div class="row" style="padding:4px 0"><span>INR sender quote (India context)</span><small class="sub money">${cents(quote.inrEquivalentCents, 'INR', true)} (demo quote)</small></div>` : ''}
      </div>` : ''}
      ${transferForm.error ? `<div class="callout error" role="alert">${svg('alert')}<span>${escapeHtml(transferForm.error)}</span></div>` : ''}
      <div class="actions">
        <button type="button" class="btn btn-primary full" onclick="proceedToReviewTransfer()"><span>Review payment</span>${svg('arrow-right')}</button>
      </div>` : `<p class="sub">Select a recipient above to enter an amount and see live FX conversion.</p>`}
    </div>`;
}

function proceedToReviewTransfer() {
  if (!transferForm.contactId) { transferForm.error = 'Choose a contact first.'; render(); return; }
  const amt = Number(transferForm.amountStr);
  if (!Number.isFinite(amt) || amt <= 0) { transferForm.error = 'Enter an amount greater than 0.'; render(); return; }
  transferForm.error = '';
  transferForm.clientTxId ||= `tx-${Date.now().toString(36)}`;
  go('review-transfer');
}

function reviewTransferScreen() {
  const c = contactsList.find(x => x.id === transferForm.contactId);
  if (!c) return screenHeader('Review payment', '', 'send') + `<div class="narrow card"><p>No transfer selected.</p><div class="actions"><button type="button" class="btn btn-primary" onclick="go('send')">Choose recipient</button></div></div>`;
  const srcCents = Math.max(0, Math.round((Number(transferForm.amountStr) || 0) * 100));
  const quote = fxQuote(srcCents, transferForm.sourceCurrency, transferForm.targetCurrency);

  return screenHeader('Review payment', 'Verify the recipient and amount before you pay.', 'ask', badge('Demo mode', 'preview'))
    + `<div class="narrow card">
      <div class="callout">${svg('alert')}<div><b>Verify the recipient and amount before you pay</b><br>This transfers in Demo mode using saved fixture FX rates. PayPal merchant checkout applies separately to Demo Merchant links.</div></div>
      <div class="row" style="margin-top:12px">
        <span class="person">${escapeHtml(c.flag || c.name[0])}</span>
        <div class="grow"><b>${escapeHtml(c.name)}</b><br><small class="sub">${escapeHtml(c.country || '')} · ${escapeHtml(c.handle || c.note || '')}</small></div>
        ${badge(c.currency, '')}
      </div>
      <div class="split-grid" style="gap:10px;margin-top:8px">
        <div class="field-group" style="margin-top:0">
          <label for="rev-amt">Amount (${escapeHtml(transferForm.sourceCurrency)})</label>
          <input id="rev-amt" type="number" step="0.01" value="${escapeHtml(transferForm.amountStr)}" oninput="transferForm.amountStr = this.value; render()">
        </div>
        <div class="field-group" style="margin-top:0">
          <label for="rev-curr">Currency</label>
          <select id="rev-curr" onchange="transferForm.sourceCurrency = this.value; render()">
            ${CURRENCIES.map(curr => `<option value="${curr}" ${transferForm.sourceCurrency === curr ? 'selected' : ''}>${curr}</option>`).join('')}
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
        <div class="row" style="padding:4px 0"><span>Demo quote</span><small class="sub">1 ${quote.sourceCurrency} = ${quote.rate} ${quote.targetCurrency} · INR ${cents(quote.inrEquivalentCents, 'INR')}</small></div>
      </div>
      ${transferForm.error ? `<div class="callout error" role="alert">${svg('alert')}<span>${escapeHtml(transferForm.error)}</span></div>` : ''}
      <div class="actions">
        <button type="button" class="btn btn-secondary" onclick="go('send')" ${transferForm.busy ? 'disabled' : ''}>Edit details</button>
        <button type="button" class="btn btn-primary" id="demo-pay-btn" onclick="executeDemoPay()" ${transferForm.busy ? 'disabled' : ''}>
          ${transferForm.busy ? '<span>Processing demo payment…</span>' : `<span>Pay ${escapeHtml(cents(quote.sourceAmountCents, quote.sourceCurrency, true))}</span>${svg('arrow-right')}`}
        </button>
      </div>
    </div>`;
}

async function executeDemoPay() {
  if (transferForm.busy) return;
  const c = contactsList.find(x => x.id === transferForm.contactId);
  const srcCents = Math.round((Number(transferForm.amountStr) || 0) * 100);
  if (!c || srcCents <= 0) { transferForm.error = 'Enter a positive amount first.'; render(); return; }
  transferForm.busy = true; transferForm.error = ''; render();
  const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reducedMotion) await new Promise(r => setTimeout(r, 550));
  try {
    let tx;
    if (backendMode && ledger) {
      const res = await api('/api/organizer/demo-pay', {
        contactId: c.id,
        recipientName: c.name,
        sourceAmountCents: srcCents,
        sourceCurrency: transferForm.sourceCurrency,
        targetCurrency: transferForm.targetCurrency,
        note: transferForm.note || 'Payment',
        clientTxId: transferForm.clientTxId,
      });
      tx = res.transaction;
      await loadWorkspaceState();
    } else {
      const existing = demoTransactions.find(t => t.clientTxId === transferForm.clientTxId);
      if (existing) tx = existing;
      else {
        const quote = fxQuote(srcCents, transferForm.sourceCurrency, transferForm.targetCurrency);
        tx = {
          id: 'DTX-' + Math.random().toString(16).slice(2, 8).toUpperCase(),
          clientTxId: transferForm.clientTxId,
          type: 'demo-send',
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
    activeTxReceiptId = tx.id;
    go(`tx/${tx.id}`);
  } catch (e) {
    transferForm.busy = false;
    transferForm.error = e.message;
    render();
  }
}

function txReceiptScreen(txId) {
  const tx = demoTransactions.find(x => x.id === txId);
  if (!tx) return screenHeader('Receipt not found', '', 'activity') + `<div class="narrow card"><p>Transaction not found.</p></div>`;
  return screenHeader('Demo receipt', 'Demo transfer · Simulated fixture quote', 'activity', badge('Demo mode', 'preview'))
    + `<div class="narrow card center">
      <div class="result-icon">${svg('check')}</div>
      <h1>Sent ${escapeHtml(cents(tx.sourceAmountCents, tx.sourceCurrency, true))}</h1>
      <p class="sub" style="margin-top:4px">to ${escapeHtml(tx.flag || '')} ${escapeHtml(tx.recipientName)} (${escapeHtml(tx.country || '')})</p>
      <div class="rule"></div>
      <div class="row"><span>Receipt ID</span><code>${escapeHtml(tx.id)}</code></div>
      <div class="row"><span>You sent</span><b class="money">${escapeHtml(cents(tx.sourceAmountCents, tx.sourceCurrency, true))}</b></div>
      ${tx.sourceCurrency !== tx.targetCurrency ? `<div class="row"><span>${escapeHtml(tx.recipientName)} received (demo quote)</span><b class="money">${escapeHtml(cents(tx.targetAmountCents, tx.targetCurrency, true))}</b></div>` : ''}
      <div class="row"><span>Note</span><b>${escapeHtml(tx.note || 'Payment')}</b></div>
      <div class="row"><span>Settlement ledger</span>${pill('Demo transfer')}</div>
      <div class="actions">
        <button type="button" class="btn btn-secondary" onclick="go('activity')">View in Activity</button>
        <button type="button" class="btn btn-primary" onclick="go('home')">Done</button>
      </div>
    </div>`;
}

// ---------- Manual Request Money (Independent of AI) ----------
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
  };
  go('request-new');
}

function toggleReqContact(id) {
  if (!manualReqForm.multi) {
    manualReqForm.contactId = id;
    const c = contactsList.find(x => x.id === id);
    if (c && !manualReqForm.amountStr) manualReqForm.currency = 'USD';
  } else {
    const idx = manualReqForm.contactIds.indexOf(id);
    if (idx >= 0) manualReqForm.contactIds.splice(idx, 1);
    else manualReqForm.contactIds.push(id);
  }
  render();
}

function manualRequestScreen() {
  const filtered = contactsList.filter(c => c.id !== 'leah' && (!contactSearch.trim() || `${c.name} ${c.country}`.toLowerCase().includes(contactSearch.trim().toLowerCase())));
  const chosen = manualReqForm.multi
    ? contactsList.filter(c => manualReqForm.contactIds.includes(c.id))
    : contactsList.filter(c => c.id === manualReqForm.contactId);
  const amt = Number(manualReqForm.amountStr) || 0;
  const totalCents = Math.round(amt * 100);

  return screenHeader('Request money', 'Choose a contact, enter amount, and track settlement automatically', 'home', badge('Demo mode', 'preview'))
    + `<div class="narrow card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px">
        <label for="req-contact-search" style="font-size:13px;font-weight:800">Select contact${manualReqForm.multi ? 's (group split)' : ''}</label>
        <button type="button" class="btn-ghost-sm" onclick="manualReqForm.multi = !manualReqForm.multi; render()">${manualReqForm.multi ? 'Single person' : 'Split group'}</button>
      </div>
      <div class="field-group" style="margin-top:0">
        <input id="req-contact-search" type="search" value="${escapeHtml(contactSearch)}" oninput="contactSearch = this.value; render()" placeholder="Search contacts…">
      </div>
      <div class="chip-row" style="margin-bottom:14px">
        ${filtered.map(c => {
          const on = manualReqForm.multi ? manualReqForm.contactIds.includes(c.id) : manualReqForm.contactId === c.id;
          return `<button type="button" class="chip ${on ? 'selected' : ''}" onclick="toggleReqContact('${escapeHtml(c.id)}')">${escapeHtml(c.flag || '')} ${escapeHtml(c.name)} (${escapeHtml(c.currency)})</button>`;
        }).join('')}
      </div>
      ${chosen.length ? `<div class="split-grid" style="gap:10px">
        <div class="field-group" style="margin-top:0">
          <label for="req-amt">${manualReqForm.multi ? 'Total amount to split' : 'Amount'}</label>
          <input id="req-amt" type="number" step="0.01" value="${escapeHtml(manualReqForm.amountStr)}" oninput="manualReqForm.amountStr = this.value; render()" placeholder="0.00">
        </div>
        <div class="field-group" style="margin-top:0">
          <label for="req-curr">Currency</label>
          <select id="req-curr" onchange="manualReqForm.currency = this.value; render()">
            ${CURRENCIES.map(curr => `<option value="${curr}" ${manualReqForm.currency === curr ? 'selected' : ''}>${curr}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field-group">
        <label for="req-note">Note (optional)</label>
        <input id="req-note" value="${escapeHtml(manualReqForm.note)}" oninput="manualReqForm.note = this.value" placeholder="Dinner, cab, groceries…">
      </div>
      ${totalCents > 0 && chosen.length === 1 && chosen[0].currency !== manualReqForm.currency ? `<div class="fx-box">
        <div class="row" style="padding:4px 0"><span>Demo FX display (${escapeHtml(chosen[0].name)})</span><b class="money">${cents(convertCents(totalCents, manualReqForm.currency, chosen[0].currency), chosen[0].currency, true)}</b></div>
      </div>` : ''}
      ${manualReqForm.error ? `<div class="callout error" role="alert">${svg('alert')}<span>${escapeHtml(manualReqForm.error)}</span></div>` : ''}
      <div class="actions">
        <button type="button" class="btn btn-primary full" onclick="submitManualRequest()" ${manualReqForm.busy ? 'disabled' : ''}>
          <span>${manualReqForm.busy ? 'Creating request…' : 'Create request'}</span>${svg('arrow-right')}
        </button>
      </div>` : `<p class="sub">Pick a contact above to create a payment request.</p>`}
    </div>`;
}

async function submitManualRequest() {
  const chosen = manualReqForm.multi
    ? contactsList.filter(c => manualReqForm.contactIds.includes(c.id))
    : contactsList.filter(c => c.id === manualReqForm.contactId);
  const totalCents = Math.round((Number(manualReqForm.amountStr) || 0) * 100);
  if (!chosen.length || totalCents <= 0) { manualReqForm.error = 'Select contact(s) and enter a positive amount.'; render(); return; }
  const baseShare = Math.floor(totalCents / chosen.length);
  const recipients = chosen.map((c, idx) => ({
    name: c.name,
    contactId: c.id,
    amountCents: idx === 0 ? totalCents - baseShare * (chosen.length - 1) : baseShare,
    currency: manualReqForm.currency,
    targetCurrency: c.currency || manualReqForm.currency,
    reason: manualReqForm.note.trim() || 'Shared request',
  }));
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

// ---------- Shared Request Persistence + Detail Screen ----------
async function persistRequestRecord(payload) {
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
        : (demoAutoSettle ? 'Demo request active — awaiting simulated payer confirmation.' : 'Share via Copy link or QR.'),
      settleAt: demoAutoSettle ? now + 2400 + (i * 2500) : null,
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
    totalCents: payload.totalCents || recs.reduce((s, x) => s + x.amountCents, 0),
    evidenceImageDataUrl: payload.evidenceImageDataUrl || '',
    transcript: payload.transcript || '',
    recipients: recs,
  };
  reimbursementsList.unshift(record);
  saveLocalState();
  scheduleSettlementTicker();
  return record;
}

function requestDetailScreen(reqId) {
  const req = reimbursementsList.find(r => r.id === reqId);
  if (!req) return screenHeader('Request not found', '', 'activity') + `<div class="narrow card"><p>Request not found.</p></div>`;
  const recs = req.recipients || [];
  const totalReq = recs.reduce((s, r) => s + r.amountCents, 0);
  const collected = recs.filter(r => r.status === 'Paid').reduce((s, r) => s + r.amountCents, 0);
  const waitingCount = recs.filter(r => r.status === 'Waiting for payment').length;
  const activeQr = recs.find(r => r.id === selectedReqQr.recipientId) || recs[0];
  const curr = req.currency || recs[0]?.currency || 'USD';
  const pct = totalReq > 0 ? Math.min(1, collected / totalReq).toFixed(4) : '0';

  return screenHeader(escapeHtml(req.title || req.merchant), `${req.id} · ${req.demo ? 'Demo mode' : 'External link/gateway'}`, 'activity', badge(waitingCount > 0 ? `${waitingCount} waiting` : `${recs.length - waitingCount}/${recs.length} settled`, waitingCount > 0 ? 'preview' : ''))
    + `<div class="split-grid">
      <section class="card">
        <h2>Summary &amp; evidence</h2>
        <div class="row"><span>Collected</span><b class="money">${cents(collected, curr, true)} / ${cents(totalReq, curr, true)}</b></div>
        <div class="progress"><i style="transform:scaleX(${pct})"></i></div>
        ${req.dueDate ? `<div class="row"><span>Due date</span><b>${escapeHtml(req.dueDate)}</b></div>` : ''}
        ${req.evidenceImageDataUrl ? `<img src="${escapeHtml(req.evidenceImageDataUrl)}" alt="Receipt evidence" class="crop-canvas" style="margin:10px 0">` : ''}
        ${(req.items || []).map(i => `<div class="row"><span>${escapeHtml(i.name)}</span><b class="money">${cents(i.amountCents, curr)}</b></div>`).join('')}
        <div class="callout">${svg('alert')}<span>${req.demo ? 'Demo requests automatically advance from Waiting for payment and create a simulated receipt.' : 'Personal reimbursement link. PayPal commercial checkout applies only to Demo Merchant SS-001.'}</span></div>
      </section>

      <section class="card">
        <div class="section-title"><h2>Recipients (${recs.length})</h2><b class="money">${cents(totalReq, curr, true)}</b></div>
        ${recs.map(r => {
          const label = r.status === 'Paid' && r.demoSettled ? `Payment received from ${r.name}` : r.status;
          const flash = r.status === 'Paid' && r.demoSettled && justSettledIds.has(req.id) ? 'settled-flash' : '';
          return `<div class="draft-row-card ${r.deliveryStatus === 'Failed' ? 'needs-fix' : ''} ${flash}">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <div>
                <b>${escapeHtml(r.name)} · <span class="money">${cents(r.amountCents, r.currency || curr, true)}</span></b><br>
                <small class="sub">${escapeHtml(r.reason)}${r.receiptRef ? ` · Receipt: <code>${escapeHtml(r.receiptRef)}</code>` : ''}</small>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                ${pill(r.status === 'Paid' && r.demoSettled ? 'Payment received' : r.status)}
                ${r.deliveryStatus === 'Failed' ? pill('Failed') : ''}
              </div>
            </div>
            ${r.deliveryStatus === 'Failed' ? `<p class="sub" style="margin-top:6px;color:var(--error)">${escapeHtml(r.deliveryMessage)}</p>` : ''}
            ${r.status === 'Paid' && r.demoSettled ? `<p class="sub" style="margin-top:6px;color:var(--teal-ink);font-weight:700">${escapeHtml(label)}</p>` : ''}
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
  if (navigator.share) { try { await navigator.share({ title: `SplitSync · ${req.title}`, text: `${rec.name}: ${cents(rec.amountCents, rec.currency || 'USD')} for ${rec.reason}`, url: u }); return; } catch {} }
  await copyReqLink(reqId, recId);
}

// ---------- Activity Screen (Search + Unified Single-Source Feed) ----------
function activityScreen() {
  const filters = ['All', 'Waiting', 'Received', 'Transfers', 'Sandbox'];
  const q = activityQuery.trim().toLowerCase();
  const entries = buildUnifiedActivity().filter(it => {
    const matchTab = activityFilter === 'All' || it.filterBucket === activityFilter;
    const matchSearch = !q || `${it.counterparty} ${it.title} ${it.subtitle} ${it.id}`.toLowerCase().includes(q);
    return matchTab && matchSearch;
  });

  return `<div class="hub-top">
    <div><h1>Activity</h1><p class="screen-sub">Payments, requests, rent, and Sandbox captures.</p></div>
    ${backendMode ? `<button type="button" class="btn-ghost-sm" onclick="loadWorkspaceState().then(render)">${svg('refresh')}<span>Refresh</span></button>` : ''}
  </div>
  <div class="store-toolbar">
    <div class="store-search">
      ${svg('search')}
      <input id="activity-search" name="activity-search" type="search" aria-label="Search activity" value="${escapeHtml(activityQuery)}" oninput="activityQuery = this.value; render()" placeholder="Search person, note, or ID…">
    </div>
  </div>
  <div class="category-strip" role="tablist" aria-label="Filter activity">
    ${filters.map(f => `<button type="button" class="chip ${activityFilter === f ? 'selected' : ''}" onclick="activityFilter = '${f}'; render()">${f}</button>`).join('')}
  </div>
  <div class="card">
    ${entries.length === 0 ? `<p class="sub">${activityQuery ? 'No matching transactions.' : 'No activity yet. Create a transfer, request, rent split, or Sandbox scan to see live updates here.'}</p>` : entries.map(e => `
      <div class="row ${e.flash ? 'settled-flash' : ''}" style="cursor:pointer" onclick="go('${escapeHtml(e.route)}')">
        <span class="icon-box">${svg(e.kind === 'sandbox' ? 'store' : e.kind === 'transfer' ? 'arrow-right' : e.kind === 'rent' ? 'calendar' : 'receipt')}</span>
        <div class="grow">
          <b>${escapeHtml(e.title)}</b><br>
          <small class="sub">${escapeHtml(e.counterparty)} · ${escapeHtml(e.subtitle)} · ${escapeHtml(e.date)}</small>
        </div>
        <div style="text-align:right">
          <div class="money" style="font-weight:800">${escapeHtml(e.primaryAmount)}</div>
          ${e.secondaryAmount ? `<small class="sub">${escapeHtml(e.secondaryAmount)}</small>` : ''}
          <div style="margin-top:4px">${pill(e.status)}</div>
        </div>
      </div>`).join('')}
  </div>`;
}

// ---------- Ask SplitSync: Real Multi-Turn Voice Conversation (#ask) ----------
function openAskSplitSync() {
  go('ask');
}

function askScreen() {
  const voiceSupported = true;
  return screenHeader('Ask SplitSync', 'Speak, type, or attach a bill in one conversation', 'home', `<button type="button" class="btn-ghost-sm" onclick="toggleAskVoice()">${svg(askVoiceOn ? 'volume' : 'mute')}<span>Voice ${askVoiceOn ? 'ON' : 'OFF'}</span></button>`)
    + `<div class="chat-shell">
      ${chatAttachedBill || chatAttachedImg ? renderAskReceiptCard() : ''}
      <div class="chat-thread" aria-live="polite">
        ${chatHistory.length === 0 && !chatAttachedImg ? `<div class="card card-tint">
          <b>Try saying or typing:</b>
          <p class="sub" style="margin-top:6px">• “Allen, send him 20 dollars saying thanks for coffee”</p>
          <p class="sub">• “Ask Maya for $20 for dinner and Arun for $15 for drinks”</p>
          <p class="sub">• Or tap the attachment button below to snap or upload a receipt photo.</p>
        </div>` : ''}
        ${chatHistory.map(m => m.role === 'user'
          ? `<div class="chat-bubble user"><small style="opacity:.75;font-weight:700;display:block;margin-bottom:4px">Leah</small><div>${escapeHtml(m.text)}</div></div>`
          : renderAssistantBubble(m)).join('')}
        ${askBusy ? `<div class="chat-bubble assistant"><div class="callout" style="margin-top:0">${svg('sparkles')}<span>Thinking &amp; validating amounts…</span></div></div>` : ''}
      </div>
      ${askConfirmSheetOpen ? renderAskConfirmSheet() : ''}
      <div class="chat-composer">
        ${micError ? `<div class="callout warning" style="margin-top:0;margin-bottom:8px" role="alert">${svg('alert')}<span>${escapeHtml(micError)}</span></div>` : ''}
        ${micState === 'listening' ? `<div class="callout" style="margin-top:0;margin-bottom:8px">${svg('mic')}<span><b>Listening…</b> Speak now, then tap Stop to transcribe.</span></div>` : ''}
        ${micState === 'transcribing' ? `<div class="callout" style="margin-top:0;margin-bottom:8px">${svg('sparkles')}<span>Transcribing your voice…</span></div>` : ''}
        <div class="composer-row">
          <button type="button" class="btn-ghost-sm" onclick="triggerAskAttachmentMenu()" aria-label="Attach receipt">${svg('paperclip')}</button>
          <input id="ask-attach-file" type="file" accept="image/png,image/jpeg,image/webp" hidden onchange="handleAskFileUpload(this)">
          <label for="ask-input" class="sr-only">Message SplitSync</label>
          <textarea id="ask-input" rows="1" value="${escapeHtml(askComposerText)}" oninput="askComposerText = this.value" placeholder="${voiceSupported ? 'Type or tap Mic to speak…' : 'Type a payment or split request…'}" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submitAskTurn();}">${escapeHtml(askComposerText)}</textarea>
          <button type="button" class="mic-btn ${micState === 'listening' ? 'recording' : ''}" onclick="${micState === 'listening' ? 'stopAskMic()' : 'startAskMic()'}" ${micState === 'transcribing' ? 'disabled' : ''} aria-label="${micState === 'listening' ? 'Stop recording' : 'Start voice recording'}">
            ${svg(micState === 'listening' ? 'stop' : 'mic')}
            <span>${micState === 'listening' ? 'Stop' : micState === 'transcribing' ? '…' : 'Mic'}</span>
          </button>
          <button type="button" class="btn btn-primary" onclick="submitAskTurn()" ${askBusy || !askComposerText.trim() ? '' : ''}>Send</button>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;flex-wrap:wrap;gap:8px">
          <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);cursor:pointer">
            <input type="checkbox" ${askAutoSendMic ? 'checked' : ''} onchange="askAutoSendMic = this.checked" style="width:15px;height:15px">
            Auto-send after mic transcription
          </label>
          <button type="button" class="btn-ghost-sm" onclick="useAskSampleReceipt()">${svg('receipt')}<span>Use demo receipt</span></button>
        </div>
      </div>
    </div>`;
}

function renderAssistantBubble(msg) {
  const isLatest = chatHistory.filter(x => x.role === 'assistant').at(-1)?.id === msg.id;
  const showDraft = isLatest && chatDraft && chatDraft.recipients?.length;
  return `<div class="chat-bubble assistant">
    <small class="sub" style="font-weight:800;display:block;margin-bottom:4px">SplitSync${msg.modelUsed ? ` · ${escapeHtml(msg.modelUsed)}` : ''}</small>
    <p style="color:var(--navy);font-weight:600">${escapeHtml(msg.text)}</p>
    ${isLatest ? `<div class="chip-row" style="margin-top:10px;align-items:center">
      ${askAudioState === 'loading' ? `<small class="sub">Synthesizing voice…</small>` : ''}
      ${askAudioState === 'playing' ? `<button type="button" class="btn-ghost-sm" onclick="stopAskPlayback()">${svg('stop')}<span>Stop audio</span></button><small class="sub" style="color:var(--teal-ink);font-weight:700">Playing…</small>` : ''}
      ${askAudioState === 'blocked' ? `<button type="button" class="btn btn-secondary" onclick="playCurrentAskAudio(true)">${svg('play')}<span>Play reply</span></button>` : ''}
      ${['ready', 'idle', 'unavailable'].includes(askAudioState) && askAudioSrc ? `<button type="button" class="btn-ghost-sm" onclick="playCurrentAskAudio(true)">${svg('volume')}<span>Replay</span></button>` : ''}
      ${askAudioState === 'unavailable' && askAudioError ? `<small class="sub" style="color:var(--amber)">${escapeHtml(askAudioError)}</small>` : ''}
    </div>` : ''}
    ${showDraft ? renderInlineAskDraft() : ''}
  </div>`;
}

function renderInlineAskDraft() {
  if (chatDraft.intent === 'send' && !chatDraft.needsClarification && chatDraft.recipients.length === 1) {
    const r = chatDraft.recipients[0];
    const q = fxQuote(r.amountCents, r.currency || 'USD', r.targetCurrency || r.currency || 'USD');
    return `<div class="fx-box">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <div>
          <b>${escapeHtml(r.flag || '')} ${escapeHtml(r.name)}</b> · <b class="money">${cents(q.sourceAmountCents, q.sourceCurrency, true)}</b>
          ${q.sourceCurrency !== q.targetCurrency ? `<span class="sub"> (≈ ${cents(q.targetAmountCents, q.targetCurrency, true)} demo quote)</span>` : ''}
          <div class="sub">Note: “${escapeHtml(r.reason)}”</div>
        </div>
        <button type="button" class="btn btn-primary" onclick="handoffSendToReview()"><span>Review payment</span>${svg('arrow-right')}</button>
      </div>
    </div>`;
  }
  const alloc = chatDraft.recipients.reduce((s, r) => s + (r.amountCents || 0), 0);
  const billTotal = chatAttachedBill?.totalCents || 0;
  return `<div style="margin-top:12px">
    ${chatDraft.needsClarification ? `<div class="callout warning" style="margin-top:0;margin-bottom:10px" role="alert">${svg('alert')}<span>${escapeHtml(chatDraft.clarificationPrompt || 'Confirm recipient details below or answer in chat.')}</span></div>` : ''}
    ${chatDraft.recipients.map((r, idx) => `<div class="draft-row-card ${r.ambiguous || !r.known ? 'needs-fix' : ''}">
      <div class="draft-grid">
        <div class="field-group" style="margin-top:0">
          <label for="ask-rec-name-${idx}">Recipient</label>
          <input id="ask-rec-name-${idx}" value="${escapeHtml(r.name)}" oninput="updateChatDraftRow(${idx}, 'name', this.value)">
        </div>
        <div class="field-group" style="margin-top:0">
          <label for="ask-rec-amt-${idx}">${escapeHtml(r.currency || 'USD')}</label>
          <input id="ask-rec-amt-${idx}" type="number" step="0.01" value="${((r.amountCents || 0) / 100).toFixed(r.currency === 'JPY' ? 0 : 2)}" oninput="updateChatDraftRow(${idx}, 'amount', this.value)">
        </div>
        <div class="field-group" style="margin-top:0">
          <label for="ask-rec-reason-${idx}">Reason</label>
          <input id="ask-rec-reason-${idx}" value="${escapeHtml(r.reason)}" oninput="updateChatDraftRow(${idx}, 'reason', this.value)">
        </div>
        <button type="button" class="btn-ghost-sm" style="height:46px" onclick="chatDraft.recipients.splice(${idx},1); render()" aria-label="Remove">${svg('trash')}</button>
      </div>
      ${!r.known ? `<div class="chip-row" style="margin-top:8px"><small class="sub">Pick contact:</small>${contactsList.filter(c => c.id !== 'leah').map(c => `<button type="button" class="chip" onclick="resolveChatDraftContact(${idx}, '${escapeHtml(c.id)}')">${escapeHtml(c.flag || '')} ${escapeHtml(c.name)}</button>`).join('')}</div>` : ''}
    </div>`).join('')}
    ${billTotal > 0 ? `<div class="row"><span>Bill remaining unallocated</span><b class="money" style="color:${billTotal - alloc === 0 ? 'var(--teal-ink)' : 'var(--amber)'}">${cents(billTotal - alloc, chatAttachedBill.currency)}</b></div>` : ''}
    <div class="actions" style="margin-top:10px">
      <button type="button" class="btn btn-secondary" onclick="addChatDraftRow()">${svg('plus')}<span>Add person</span></button>
      <button type="button" class="btn btn-primary" onclick="askConfirmSheetOpen = true; render()"><span>Create requests (${cents(alloc)})</span>${svg('arrow-right')}</button>
    </div>
  </div>`;
}

function renderAskConfirmSheet() {
  const recs = chatDraft?.recipients || [];
  const total = recs.reduce((s, r) => s + (r.amountCents || 0), 0);
  return `<section class="card card-tint">
    <div class="section-title"><h2>Confirm requests</h2><button type="button" class="btn-ghost-sm" onclick="askConfirmSheetOpen = false; render()">Close</button></div>
    <p class="sub">Creates ${recs.length} request${recs.length === 1 ? '' : 's'} totaling <b class="money">${cents(total)}</b>.</p>
    <div class="field-group">
      <label for="ask-confirm-channel">Settlement / delivery mode</label>
      <select id="ask-confirm-channel" onchange="askConfirmChannel = this.value">
        <option value="demo" ${askConfirmChannel === 'demo' ? 'selected' : ''}>Demo mode (auto-settles in Activity)</option>
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
  const mismatch = b && b.totalCents > 0 && ((b.items || []).reduce((s, i) => s + (i.amountCents || 0), 0) + (b.taxCents || 0) + (b.tipCents || 0)) !== b.totalCents;
  return `<section class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:10px">
        ${chatAttachedImg ? `<img src="${escapeHtml(chatAttachedImg)}" alt="Attached receipt" style="width:54px;height:54px;object-fit:cover;border-radius:10px;border:1px solid var(--line)">` : ''}
        <div><b>Attached receipt</b><br><small class="sub">${chatExtractState === 'loading' ? 'Extracting items & total…' : escapeHtml(b?.merchant || 'Ready to edit')}</small></div>
      </div>
      <div style="display:flex;gap:6px">
        ${chatAttachedImg ? `<button type="button" class="btn-ghost-sm" onclick="chatShowCrop = !chatShowCrop; render()">${chatShowCrop ? 'Hide crop' : 'Crop / retake'}</button>` : ''}
        <button type="button" class="btn-ghost-sm" onclick="chatAttachedBill = null; chatAttachedImg = ''; chatAttachedRawImg = ''; render()">Remove</button>
      </div>
    </div>
    ${chatShowCrop && chatAttachedImg ? `<div style="margin-top:12px">
      <img id="ask-crop-img" src="${escapeHtml(chatAttachedImg)}" alt="Crop preview" class="crop-canvas">
      <div class="split-grid" style="gap:10px;margin-top:8px">
        <div class="field-group" style="margin-top:0"><label for="ask-ct">Top (${chatCropTop}%)</label><input id="ask-ct" type="range" min="0" max="30" value="${chatCropTop}" oninput="updateAskCrop(this.value, chatCropBottom)"></div>
        <div class="field-group" style="margin-top:0"><label for="ask-cb">Bottom (${chatCropBottom}%)</label><input id="ask-cb" type="range" min="0" max="30" value="${chatCropBottom}" oninput="updateAskCrop(chatCropTop, this.value)"></div>
      </div>
      <div class="actions" style="margin-top:8px">
        <button type="button" class="btn-ghost-sm" onclick="triggerAskAttachmentMenu()">Retake / upload another</button>
        <button type="button" class="btn btn-secondary" onclick="extractAskAttachedBill()">Re-extract receipt</button>
      </div>
    </div>` : ''}
    ${chatExtractState === 'loading' ? `<div class="skeleton" style="margin-top:10px;width:75%"></div>` : ''}
    ${chatExtractState === 'error' ? `<div class="callout warning" role="alert">${svg('alert')}<span>${escapeHtml(chatExtractError)} Edit fields below manually.</span></div>` : ''}
    ${b && chatExtractState !== 'loading' ? `<div style="margin-top:12px">
      ${mismatch ? `<div class="callout error" role="alert">${svg('alert')}<span>Items + tax + tip do not match bill total. Review amounts below.</span></div>` : ''}
      <div class="split-grid" style="gap:8px;margin-top:8px">
        <div class="field-group" style="margin-top:0"><label for="ask-bill-merch">Merchant</label><input id="ask-bill-merch" value="${escapeHtml(b.merchant)}" oninput="chatAttachedBill.merchant = this.value"></div>
        <div class="field-group" style="margin-top:0"><label for="ask-bill-tot">Total (${escapeHtml(b.currency)})</label><input id="ask-bill-tot" type="number" step="0.01" value="${((b.totalCents || 0) / 100).toFixed(2)}" oninput="chatAttachedBill.totalCents = Math.round((Number(this.value)||0)*100)"></div>
      </div>
      ${(b.items || []).map((it, idx) => `<div style="display:flex;gap:6px;margin-top:6px">
        <input aria-label="Receipt item ${idx + 1}" style="flex:2;min-height:38px;padding:6px 10px;border:1px solid var(--line);border-radius:8px" value="${escapeHtml(it.name)}" oninput="chatAttachedBill.items[${idx}].name = this.value">
        <input aria-label="Receipt amount ${idx + 1}" type="number" step="0.01" style="flex:1;min-height:38px;padding:6px 10px;border:1px solid var(--line);border-radius:8px" value="${(it.amountCents / 100).toFixed(2)}" oninput="chatAttachedBill.items[${idx}].amountCents = Math.round((Number(this.value)||0)*100)">
      </div>`).join('')}
    </div>` : ''}
  </section>`;
}

function toggleAskVoice() {
  askVoiceOn = !askVoiceOn;
  localStorage.setItem('splitsync-voice-on', String(askVoiceOn));
  if (!askVoiceOn) cancelAskSpeech();
  render();
}

function triggerAskAttachmentMenu() {
  document.querySelector('#ask-attach-file')?.click();
}

function handleAskFileUpload(input) {
  const file = input?.files?.[0]; if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    chatAttachedRawImg = String(r.result || '');
    chatAttachedImg = chatAttachedRawImg;
    chatCropTop = 0; chatCropBottom = 0;
    extractAskAttachedBill();
  };
  r.readAsDataURL(file);
}

function useAskSampleReceipt() {
  chatAttachedRawImg = createSampleReceiptDataUrl();
  chatAttachedImg = chatAttachedRawImg;
  chatCropTop = 3; chatCropBottom = 3;
  extractAskAttachedBill();
}

function updateAskCrop(topV, botV) {
  chatCropTop = Number(topV); chatCropBottom = Number(botV);
  if (typeof Image === 'undefined') return;
  const img = new Image();
  img.onload = () => {
    const sy = Math.round(img.height * (chatCropTop / 100));
    const eh = Math.max(40, Math.round(img.height * (1 - (chatCropTop + chatCropBottom) / 100)));
    const c = document.createElement('canvas'); c.width = img.width; c.height = eh;
    c.getContext('2d').drawImage(img, 0, sy, img.width, eh, 0, 0, img.width, eh);
    chatAttachedImg = c.toDataURL('image/png');
    const preview = document.querySelector('#ask-crop-img');
    if (preview) preview.src = chatAttachedImg;
  };
  img.src = chatAttachedRawImg;
}

async function extractAskAttachedBill() {
  chatExtractState = 'loading'; chatExtractError = ''; chatAttachedBill = null;
  render();
  if (!backendMode) {
    chatAttachedBill = { merchant: 'Olive Kitchen', date: '2026-11-10', currency: 'USD', items: [{ name: 'Pasta Dinner Bowl', amountCents: 2000 }, { name: 'Craft Drinks (2)', amountCents: 1500 }, { name: 'Shared Herb Flatbread', amountCents: 700 }], taxCents: 0, tipCents: 0, totalCents: 4200, unreadableFields: [], totalMismatch: false };
    chatExtractState = 'ready'; render(); return;
  }
  try {
    const res = await api('/api/organizer/extract-bill', { imageDataUrl: chatAttachedImg });
    chatAttachedBill = res; chatExtractState = 'ready'; render();
  } catch (e) {
    chatExtractState = 'error'; chatExtractError = e.message;
    chatAttachedBill = { merchant: '', date: '', currency: 'USD', items: [], taxCents: 0, tipCents: 0, totalCents: 0, unreadableFields: ['merchant', 'total'] };
    render();
  }
}

async function startAskMic() {
  cancelAskSpeech(); // Do not let microphone capture assistant audio!
  micError = '';
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    try {
      micState = 'listening'; render();
      speechRecognition = new SR();
      speechRecognition.lang = 'en-US';
      speechRecognition.interimResults = true;
      speechRecognition.onresult = e => {
        askComposerText = [...e.results].map(r => r[0].transcript).join(' ').trim();
        const el = document.querySelector('#ask-input');
        if (el) el.value = askComposerText;
      };
      speechRecognition.onerror = ev => {
        micState = ev.error === 'not-allowed' ? 'denied' : 'unavailable';
        micError = ev.error === 'not-allowed' ? 'Microphone access denied. Type your message instead.' : 'Speech recognition unavailable. Type your message instead.';
        render();
      };
      speechRecognition.onend = () => {
        if (micState === 'listening') {
          micState = 'idle';
          if (askAutoSendMic && askComposerText.trim()) submitAskTurn(askComposerText);
          else render();
        }
      };
      speechRecognition.start();
      return;
    } catch {}
  }

  try {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw Object.assign(new Error('No mic'), { name: 'NotFoundError' });
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micChunks = [];
    micRecorder = new MediaRecorder(stream);
    micRecorder.ondataavailable = e => { if (e.data.size) micChunks.push(e.data); };
    micRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      micState = 'transcribing'; render();
      try {
        const blob = new Blob(micChunks, { type: micRecorder.mimeType || 'audio/webm' });
        const b64 = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result || '').split(',')[1] || ''); r.onerror = reject; r.readAsDataURL(blob); });
        const res = await api('/api/organizer/transcribe', { audioBase64: b64, mimeType: blob.type });
        askComposerText = (res.transcript || '').trim();
        micState = 'idle';
        if (askAutoSendMic && askComposerText) await submitAskTurn(askComposerText);
        else render();
      } catch (e) {
        micState = 'unavailable'; micError = e.message; render();
      }
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

function parseLocalTurn(text) {
  const raw = String(text || '').trim();
  const low = raw.toLowerCase();
  const sendIntent = /\bsend\b|\bpay\b/.test(low) && !/\bask\b|\brequest\b|\bsplit\b/.test(low);
  const wordNum = { ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, eighty: 80, hundred: 100 };
  const rows = [];
  const segs = sendIntent ? [raw] : raw.split(/\band\b|,|;/i);

  for (const seg of segs) {
    const mAmt = seg.match(/\$?(\d+(?:\.\d{1,2})?)|\b(ten|fifteen|twenty|thirty|forty|fifty|eighty|hundred)\b/i);
    if (!mAmt) continue;
    const valMajor = mAmt[1] ? Number(mAmt[1]) : (wordNum[mAmt[2].toLowerCase()] || 0);
    const valCents = Math.round(valMajor * 100);
    const matched = contactsList.find(c => new RegExp('\\b' + c.name.split(' ')[0] + '\\b', 'i').test(seg))
      || (segs.length === 1 ? contactsList.find(c => new RegExp('\\b' + c.name.split(' ')[0] + '\\b', 'i').test(raw)) : null);
    const wordAfter = seg.match(/\b(?:ask|for|from|send|pay|to)\s+([A-Z][a-z]+)\b/);
    const rawName = matched ? matched.name : (wordAfter?.[1] || '');
    const explicitUsd = /\bdollars?\b|\busd\b|\$/i.test(seg) || /\bdollars?\b|\busd\b|\$/i.test(raw);
    const currency = explicitUsd ? 'USD' : (sendIntent && matched ? matched.currency : 'USD');
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

  // Handle Turn 2 clarification picking contact name into existing ambiguous draft!
  if (!rows.length && chatDraft?.recipients?.some(r => !r.known)) {
    const clarifyMatch = contactsList.find(c => new RegExp('\\b' + c.name + '\\b', 'i').test(raw));
    if (clarifyMatch) {
      const updated = chatDraft.recipients.map(r => r.known ? r : { ...r, name: clarifyMatch.name, contactId: clarifyMatch.id, country: clarifyMatch.country, flag: clarifyMatch.flag, known: true, unknownContact: false, ambiguous: false, targetCurrency: clarifyMatch.currency });
      const parts = updated.map(r => `${r.name} owes ${cents(r.amountCents, r.currency)} for ${r.reason}`);
      return { intent: chatDraft.intent, recipients: updated, needsClarification: false, clarificationPrompt: '', modelUsed: 'Offline parser', replyText: `${parts.join(' and ')}. Ready to create both requests?` };
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
    replyText = `Prepared ${cents(q.sourceAmountCents, q.sourceCurrency, true)}${q.sourceCurrency !== q.targetCurrency ? ` (about ${cents(q.targetAmountCents, q.targetCurrency, true)})` : ''} for ${r.name}${r.country ? ` in ${r.country}` : ''} for ${r.reason}. Verify the recipient and amount before you pay.`;
  } else {
    const parts = rows.map(r => `${r.name} owes ${cents(r.amountCents, r.currency)} for ${r.reason}`);
    replyText = parts.length === 2 ? `${parts[0]} and ${parts[1]}. Ready to create both requests?` : `${parts.join(', ')}. Ready to create?`;
  }
  return { intent, recipients: rows, needsClarification, clarificationPrompt: needsClarification ? replyText : '', modelUsed: 'Offline parser', replyText };
}

async function submitAskTurn(overrideText = null) {
  const inputEl = document.querySelector('#ask-input');
  const text = String(overrideText ?? (inputEl?.value ?? askComposerText)).trim();
  if (!text || askBusy) return;
  cancelAskSpeech();
  askComposerText = '';
  if (inputEl) inputEl.value = '';
  chatHistory.push({ id: `u-${Date.now()}`, role: 'user', text });
  askBusy = true;
  render();

  let parsed;
  if (!backendMode || !ledger) {
    parsed = parseLocalTurn(text);
  } else {
    try {
      parsed = await api('/api/organizer/parse-request', {
        transcript: text,
        bill: chatAttachedBill,
        currentDraft: chatDraft?.recipients || null,
        lastIntent: chatDraft?.intent || '',
      });
    } catch (e) {
      parsed = parseLocalTurn(text);
      parsed.modelUsed = `Fallback (${e.message})`;
    }
  }

  askBusy = false;
  chatDraft = {
    intent: parsed.intent || 'request',
    recipients: parsed.recipients || [],
    needsClarification: Boolean(parsed.needsClarification),
    clarificationPrompt: parsed.clarificationPrompt || '',
    modelUsed: parsed.modelUsed || '',
  };
  const msgId = `a-${Date.now()}`;
  const replyText = parsed.replyText || 'Draft updated.';
  chatHistory.push({ id: msgId, role: 'assistant', text: replyText, modelUsed: parsed.modelUsed || '' });
  askAudioMsgId = msgId;

  if (chatDraft.intent === 'send' && !chatDraft.needsClarification && chatDraft.recipients.length === 1) {
    const r = chatDraft.recipients[0];
    const c = contactsList.find(x => x.id === r.contactId) || contactsList.find(x => x.name.toLowerCase() === r.name.toLowerCase());
    if (c) {
      transferForm = {
        contactId: c.id,
        amountStr: (r.amountCents / 100).toFixed(r.currency === 'JPY' ? 0 : 2),
        sourceCurrency: r.currency || 'USD',
        targetCurrency: c.currency || r.currency || 'USD',
        note: r.reason || '',
        clientTxId: `tx-${Date.now().toString(36)}`,
        busy: false,
        error: '',
        showInrQuote: true,
      };
    }
  }

  render();
  if (askVoiceOn) {
    await synthesizeAndPlayAskReply(replyText, msgId, chatDraft.intent === 'send' && !chatDraft.needsClarification);
  }
}

async function synthesizeAndPlayAskReply(text, msgId, autoTransitionSend = false) {
  const myEpoch = ++ttsEpoch;
  ttsAbortCtrl = new AbortController();
  askAudioState = 'loading'; askAudioError = ''; askAudioSrc = '';
  render();
  if (!backendMode || !ledger) {
    askAudioState = 'unavailable';
    askAudioError = 'Voice synthesis requires connected backend + NVIDIA_API_KEY.';
    render();
    return;
  }
  try {
    const res = await api('/api/organizer/read-text', { text: text.slice(0, 390) }, 24000, ttsAbortCtrl.signal);
    if (myEpoch !== ttsEpoch) return; // Stale turn ignored cleanly!
    askAudioSrc = 'data:audio/wav;base64,' + res.audio;
    askAudioMsgId = msgId;
    await playCurrentAskAudio(false, myEpoch, autoTransitionSend);
  } catch (e) {
    if (e?.name === 'AbortError' || myEpoch !== ttsEpoch) return;
    askAudioState = 'unavailable';
    askAudioError = e.message;
    render();
  }
}

async function playCurrentAskAudio(fromUserTap = false, expectedEpoch = ttsEpoch, autoTransitionSend = false) {
  if (!askAudioSrc || expectedEpoch !== ttsEpoch) return;
  if (activeAudioEl) { try { activeAudioEl.pause(); activeAudioEl.currentTime = 0; } catch {} }
  if (typeof Audio === 'undefined') { askAudioState = 'ready'; render(); return; }
  const audio = new Audio(askAudioSrc);
  activeAudioEl = audio;
  audio.onended = () => {
    if (expectedEpoch !== ttsEpoch) return;
    askAudioState = 'ready';
    activeAudioEl = null;
    render();
    if (autoTransitionSend && location.hash.startsWith('#ask')) {
      pendingSendTransitionTimer = setTimeout(() => {
        if (location.hash.startsWith('#ask') && transferForm.contactId) go('review-transfer');
      }, 350);
    }
  };
  try {
    askAudioState = 'playing';
    render();
    await audio.play();
  } catch {
    if (expectedEpoch !== ttsEpoch) return;
    askAudioState = fromUserTap ? 'unavailable' : 'blocked';
    if (fromUserTap) askAudioError = 'Playback failed in browser audio output.';
    render();
  }
}

function stopAskPlayback() { cancelAskSpeech(); render(); }

function handoffSendToReview() {
  cancelAskSpeech();
  go('review-transfer');
}

function updateChatDraftRow(idx, field, val) {
  const r = chatDraft?.recipients?.[idx]; if (!r) return;
  if (field === 'amount') r.amountCents = Math.max(0, Math.round((Number(val) || 0) * 100));
  else if (field === 'name') {
    r.name = val;
    const match = contactsList.find(c => c.name.toLowerCase() === val.trim().toLowerCase());
    r.known = Boolean(match); r.contactId = match?.id || null; r.ambiguous = !match;
    if (match) { r.flag = match.flag; r.country = match.country; r.targetCurrency = match.currency; }
  } else r[field] = val;
}

function resolveChatDraftContact(idx, contactId) {
  const c = contactsList.find(x => x.id === contactId);
  if (!c || !chatDraft?.recipients?.[idx]) return;
  const r = chatDraft.recipients[idx];
  chatDraft.recipients[idx] = { ...r, name: c.name, contactId: c.id, flag: c.flag, country: c.country, targetCurrency: c.currency, known: true, unknownContact: false, ambiguous: false };
  chatDraft.needsClarification = chatDraft.recipients.some(x => x.ambiguous);
  render();
}

function addChatDraftRow() {
  chatDraft ||= { intent: 'request', recipients: [], needsClarification: false };
  chatDraft.recipients.push({ id: `draft-${chatDraft.recipients.length + 1}`, name: 'Maya', contactId: 'maya', known: true, ambiguous: false, amountCents: 1000, currency: 'USD', targetCurrency: 'USD', reason: 'Shared expense' });
  render();
}

async function confirmAskRequests() {
  if (!chatDraft?.recipients?.length) return;
  cancelAskSpeech();
  const valid = chatDraft.recipients.filter(r => r.name.trim() && r.amountCents > 0);
  if (!valid.length) { toast('Add at least one recipient with a positive amount.'); return; }
  const total = valid.reduce((s, r) => s + r.amountCents, 0);
  const created = await persistRequestRecord({
    title: chatAttachedBill?.merchant || (valid.length === 1 ? `Request from ${valid[0].name}` : valid.map(r => r.name).join(', ')),
    merchant: chatAttachedBill?.merchant || 'Ask SplitSync request',
    billDate: chatAttachedBill?.date || '',
    kind: chatAttachedBill ? 'receipt' : 'request',
    currency: chatAttachedBill?.currency || valid[0]?.currency || 'USD',
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

// ---------- Standalone Scan Bill (Starts blank, auto-opens camera on tap!) ----------
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
  else cameraFrame = `<span class="camera-badge">Receipt capture</span><div class="center"><div class="icon-box" style="width:56px;height:56px;margin:0 auto 12px">${svg('receipt-camera')}</div><h2 style="color:#fff">Capture a receipt</h2><p style="color:#DCE1E8;margin-top:6px">Align merchant and items, capture, or upload from device.</p></div>`;

  return screenHeader('Scan Bill', 'Photograph or upload a receipt to create requests', 'home', badge('Demo mode', 'preview'))
    + `<div class="split-grid">
      <div>
        <div class="camera-frame">${cameraFrame}</div>
        <div class="card" style="margin-top:14px">
          <div class="actions" style="margin-top:0">
            ${billCameraState === 'scanning'
              ? `<button type="button" class="btn btn-primary" onclick="captureStandaloneBillPhoto()">${svg('receipt-camera')}<span>Capture photo</span></button><button type="button" class="btn btn-secondary" onclick="stopStandaloneBillCamera()">Stop camera</button>`
              : `<button type="button" class="btn btn-primary" onclick="startStandaloneBillCamera()">${svg('receipt-camera')}<span>${hasPhoto ? 'Retake photo' : 'Open camera'}</span></button><button type="button" class="btn btn-secondary" onclick="useStandaloneDemoReceipt()">${svg('receipt')}<span>Use demo receipt</span></button>`}
          </div>
          <div class="field-group">
            <label for="standalone-bill-upload">Upload photo (PNG / JPEG / WebP)</label>
            <input id="standalone-bill-upload" type="file" accept="image/png,image/jpeg,image/webp" onchange="handleStandaloneBillUpload(this)">
          </div>
          ${billCameraMessage ? `<div class="callout warning" role="alert">${svg('alert')}<span>${escapeHtml(billCameraMessage)}</span></div>` : ''}
          ${!billDraft && billExtractState === 'idle' ? `<div class="actions"><button type="button" class="btn-ghost-sm" onclick="billDraft = {merchant:'',date:'',currency:'USD',items:[{name:'',amountCents:0}],taxCents:0,tipCents:0,totalCents:0}; billExtractState='ready'; render()">Enter receipt manually</button></div>` : ''}
        </div>
      </div>
      <div class="card">
        <h2>Extracted details</h2>
        ${billExtractState === 'idle' && !billDraft ? `<p class="sub" style="margin-top:8px">Capture or upload a receipt photo (or tap <b>Use demo receipt</b>) to extract fields.</p>` : ''}
        ${billExtractState === 'loading' ? `<div class="callout">${svg('sparkles')}<span>Extracting merchant, line items, and total…</span></div><div class="skeleton" style="margin-top:10px;width:85%"></div><div class="skeleton" style="width:65%"></div>` : ''}
        ${billExtractState === 'error' ? `<div class="callout warning" role="alert">${svg('alert')}<span>${escapeHtml(billExtractError)} Correct fields below manually.</span></div>` : ''}
        ${billDraft && billExtractState !== 'loading' ? renderStandaloneBillEditor() : ''}
      </div>
    </div>`;
}

function renderStandaloneBillEditor() {
  const b = billDraft;
  const sum = (b.items || []).reduce((s, i) => s + (i.amountCents || 0), 0) + (b.taxCents || 0) + (b.tipCents || 0);
  const mismatch = b.totalCents > 0 && sum > 0 && Math.abs(b.totalCents - sum) > 1;
  const chosen = contactsList.filter(c => billRecipientIds.includes(c.id));
  return `<div style="margin-top:8px">
    ${mismatch ? `<div class="callout error">${svg('alert')}<span>Items + tax + tip = ${cents(sum)} vs total ${cents(b.totalCents)}.</span><button type="button" class="btn-ghost-sm" onclick="billDraft.totalCents=${sum}; render()">Match</button></div>` : ''}
    <div class="split-grid" style="gap:8px;margin-top:8px">
      <div class="field-group" style="margin-top:0"><label for="sb-merch">Merchant</label><input id="sb-merch" value="${escapeHtml(b.merchant)}" oninput="billDraft.merchant = this.value"></div>
      <div class="field-group" style="margin-top:0"><label for="sb-total">Total (${escapeHtml(b.currency || 'USD')})</label><input id="sb-total" type="number" step="0.01" value="${((b.totalCents || 0) / 100).toFixed(2)}" oninput="billDraft.totalCents = Math.round((Number(this.value)||0)*100)"></div>
    </div>
    <label style="font-size:13px;font-weight:800;display:block;margin:10px 0 6px">Items</label>
    ${(b.items || []).map((it, idx) => `<div style="display:flex;gap:6px;margin-bottom:6px">
      <input aria-label="Bill item ${idx + 1}" style="flex:2;min-height:40px;padding:8px;border:1px solid var(--line);border-radius:10px" value="${escapeHtml(it.name)}" oninput="billDraft.items[${idx}].name = this.value">
      <input aria-label="Bill amount ${idx + 1}" type="number" step="0.01" style="flex:1;min-height:40px;padding:8px;border:1px solid var(--line);border-radius:10px" value="${((it.amountCents || 0) / 100).toFixed(2)}" oninput="billDraft.items[${idx}].amountCents = Math.round((Number(this.value)||0)*100)">
    </div>`).join('')}
    <label style="font-size:13px;font-weight:800;display:block;margin:12px 0 6px">Select contacts to split with</label>
    <div class="chip-row">
      ${contactsList.filter(c => c.id !== 'leah').map(c => `<button type="button" class="chip ${billRecipientIds.includes(c.id) ? 'selected' : ''}" onclick="toggleBillRecipient('${escapeHtml(c.id)}')">${escapeHtml(c.flag || '')} ${escapeHtml(c.name)}</button>`).join('')}
    </div>
    <div class="actions">
      <button type="button" class="btn btn-secondary" onclick="handoffBillToAsk()">${svg('mic')}<span>Split in Ask SplitSync</span></button>
      <button type="button" class="btn btn-primary" onclick="createRequestsFromBill()" ${!chosen.length || !(b.totalCents > 0) ? 'disabled' : ''}><span>Create requests</span>${svg('arrow-right')}</button>
    </div>
  </div>`;
}

function toggleBillRecipient(id) {
  const i = billRecipientIds.indexOf(id);
  if (i >= 0) billRecipientIds.splice(i, 1); else billRecipientIds.push(id);
  render();
}
function handoffBillToAsk() {
  chatAttachedRawImg = billRawImage; chatAttachedImg = billCroppedImage || billRawImage; chatAttachedBill = billDraft; chatExtractState = 'ready'; go('ask');
}
async function createRequestsFromBill() {
  const chosen = contactsList.filter(c => billRecipientIds.includes(c.id));
  if (!chosen.length || !billDraft || !(billDraft.totalCents > 0)) return;
  const total = billDraft.totalCents;
  const share = Math.floor(total / chosen.length);
  const recs = chosen.map((c, i) => ({ name: c.name, contactId: c.id, amountCents: i === 0 ? total - share * (chosen.length - 1) : share, currency: billDraft.currency || 'USD', targetCurrency: c.currency || 'USD', reason: billDraft.merchant || 'Receipt split' }));
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
    billCameraMessage = denied ? 'Camera permission denied. Upload a photo or use manual entry.' : 'Camera hardware unavailable here. Upload a photo or use demo receipt.';
    render();
  }
}
function stopStandaloneBillCamera() { stopStreams(); billCameraState = 'ready'; render(); }
function captureStandaloneBillPhoto() {
  const v = document.querySelector('#bill-cam-video'); if (!v || !v.videoWidth) { toast('Waiting for camera frame…'); return; }
  const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0);
  billRawImage = c.toDataURL('image/jpeg', 0.88); billCroppedImage = billRawImage; stopStreams(); billCameraState = 'ready';
  extractStandaloneBill();
}
function handleStandaloneBillUpload(input) {
  const f = input?.files?.[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { billRawImage = String(r.result || ''); billCroppedImage = billRawImage; extractStandaloneBill(); };
  r.readAsDataURL(f);
}
function useStandaloneDemoReceipt() {
  stopStreams(); billCameraState = 'ready'; billRawImage = createSampleReceiptDataUrl(); billCroppedImage = billRawImage;
  extractStandaloneBill();
}
async function extractStandaloneBill() {
  billExtractState = 'loading'; billExtractError = ''; billDraft = null; render();
  if (!backendMode) {
    billDraft = { merchant: 'Olive Kitchen', date: '2026-11-10', currency: 'USD', items: [{ name: 'Pasta Dinner Bowl', amountCents: 2000 }, { name: 'Craft Drinks (2)', amountCents: 1500 }, { name: 'Shared Herb Flatbread', amountCents: 700 }], taxCents: 0, tipCents: 0, totalCents: 4200, unreadableFields: [], totalMismatch: false };
    billExtractState = 'ready'; render(); return;
  }
  try { billDraft = await api('/api/organizer/extract-bill', { imageDataUrl: billCroppedImage }); billExtractState = 'ready'; render(); }
  catch (e) { billExtractState = 'error'; billExtractError = e.message; billDraft = { merchant: '', date: '', currency: 'USD', items: [{ name: '', amountCents: 0 }], taxCents: 0, tipCents: 0, totalCents: 0 }; render(); }
}

// ---------- Rent Flow (Starts Blank with "Create rent request" + Opt-in Save Rule) ----------
function openRentFlow() {
  rentForm = { creating: false, contactIds: [], amountStr: '', currency: 'USD', dueDate: '2026-12-01', mode: 'equal', customAmounts: {}, saveRule: false, busy: false, error: '' };
  go('rent');
}

function applySavedRentRule() {
  if (!savedRentRule) return;
  rentForm.creating = true;
  rentForm.contactIds = [...(savedRentRule.contactIds || [])];
  rentForm.amountStr = ((savedRentRule.totalCents || 0) / 100).toFixed(2);
  rentForm.currency = savedRentRule.currency || 'USD';
  rentForm.mode = savedRentRule.mode || 'equal';
  rentForm.customAmounts = { ...(savedRentRule.customShares || {}) };
  render();
}

function rentScreen() {
  if (!rentForm.creating) {
    return screenHeader('Rent', 'Create and track shared household rent requests', 'home', badge('Demo mode', 'preview'))
      + `<div class="narrow card center">
        <h2>No active rent request</h2>
        <p class="sub" style="margin-top:6px">Choose household roommates, set total rent and due date, and pick equal or custom shares.</p>
        ${savedRentRule ? `<div class="callout">${svg('calendar')}<span>Saved rule found: ${cents(savedRentRule.totalCents, savedRentRule.currency, true)} across ${savedRentRule.contactIds.length} contacts.</span><button type="button" class="btn-ghost-sm" onclick="applySavedRentRule()">Use saved rule</button></div>` : ''}
        <div class="actions"><button type="button" class="btn btn-primary full" onclick="rentForm.creating = true; render()">${svg('plus')}<span>Create rent request</span></button></div>
      </div>`;
  }
  const chosen = contactsList.filter(c => rentForm.contactIds.includes(c.id));
  const totalCents = Math.round((Number(rentForm.amountStr) || 0) * 100);
  const perShare = chosen.length ? Math.floor(totalCents / chosen.length) : 0;
  return screenHeader('Create rent request', 'Select roommates, due date, and share split', 'home', badge('Demo mode', 'preview'))
    + `<div class="narrow card">
      <label style="font-size:13px;font-weight:800;display:block;margin-bottom:6px">Household contacts</label>
      <div class="chip-row" style="margin-bottom:12px">
        ${contactsList.map(c => `<button type="button" class="chip ${rentForm.contactIds.includes(c.id) ? 'selected' : ''}" onclick="toggleRentContact('${escapeHtml(c.id)}')">${escapeHtml(c.flag || '')} ${escapeHtml(c.name)}</button>`).join('')}
      </div>
      <div class="split-grid" style="gap:10px">
        <div class="field-group" style="margin-top:0"><label for="rent-amt">Rent amount</label><input id="rent-amt" type="number" step="0.01" value="${escapeHtml(rentForm.amountStr)}" oninput="rentForm.amountStr = this.value; render()" placeholder="0.00"></div>
        <div class="field-group" style="margin-top:0"><label for="rent-curr">Currency</label><select id="rent-curr" onchange="rentForm.currency = this.value; render()">${CURRENCIES.map(c => `<option value="${c}" ${rentForm.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      </div>
      <div class="split-grid" style="gap:10px;margin-top:10px">
        <div class="field-group" style="margin-top:0"><label for="rent-due">Due date</label><input id="rent-due" type="date" value="${escapeHtml(rentForm.dueDate)}" oninput="rentForm.dueDate = this.value"></div>
        <div class="field-group" style="margin-top:0">
          <label>Share method</label>
          <div class="chip-row" style="margin-top:0">
            <button type="button" class="chip ${rentForm.mode === 'equal' ? 'selected' : ''}" onclick="rentForm.mode='equal'; render()">Equal</button>
            <button type="button" class="chip ${rentForm.mode === 'custom' ? 'selected' : ''}" onclick="rentForm.mode='custom'; render()">Custom</button>
          </div>
        </div>
      </div>
      ${chosen.length && totalCents > 0 ? `<div class="rule"></div>${chosen.map((c, idx) => {
        const eq = idx === 0 ? totalCents - perShare * (chosen.length - 1) : perShare;
        const val = rentForm.mode === 'custom' ? (rentForm.customAmounts[c.id] ?? (eq / 100).toFixed(2)) : (eq / 100).toFixed(2);
        return `<div class="row"><span>${escapeHtml(c.flag || '')} <b>${escapeHtml(c.name)}</b></span>${rentForm.mode === 'custom' ? `<input aria-label="Rent share for ${escapeHtml(c.name)}" type="number" step="0.01" style="width:110px;min-height:38px;padding:6px 10px;border:1px solid var(--line);border-radius:8px" value="${escapeHtml(val)}" oninput="rentForm.customAmounts['${escapeHtml(c.id)}'] = this.value">` : `<b class="money">${cents(eq, rentForm.currency, true)}</b>`}</div>`;
      }).join('')}` : ''}
      <label class="row" style="cursor:pointer;margin-top:8px"><span style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700"><input type="checkbox" ${rentForm.saveRule ? 'checked' : ''} onchange="rentForm.saveRule = this.checked" style="width:17px;height:17px">Save rule for future months</span></label>
      ${rentForm.error ? `<div class="callout error" role="alert">${svg('alert')}<span>${escapeHtml(rentForm.error)}</span></div>` : ''}
      <div class="actions"><button type="button" class="btn btn-primary full" onclick="submitRentRequest()" ${rentForm.busy ? 'disabled' : ''}><span>Review &amp; create rent requests</span>${svg('arrow-right')}</button></div>
    </div>`;
}

function toggleRentContact(id) {
  const i = rentForm.contactIds.indexOf(id);
  if (i >= 0) rentForm.contactIds.splice(i, 1); else rentForm.contactIds.push(id);
  render();
}

async function submitRentRequest() {
  const chosen = contactsList.filter(c => rentForm.contactIds.includes(c.id));
  const totalCents = Math.round((Number(rentForm.amountStr) || 0) * 100);
  if (!chosen.length || totalCents <= 0) { rentForm.error = 'Select household contacts and enter a positive rent amount.'; render(); return; }
  const per = Math.floor(totalCents / chosen.length);
  const recipients = chosen.map((c, idx) => {
    const shareCents = rentForm.mode === 'custom' ? Math.max(100, Math.round((Number(rentForm.customAmounts[c.id]) || 0) * 100)) : (idx === 0 ? totalCents - per * (chosen.length - 1) : per);
    return { name: c.name, contactId: c.id, amountCents: shareCents, currency: rentForm.currency, targetCurrency: c.currency || rentForm.currency, reason: `Rent (${rentForm.dueDate})` };
  });
  rentForm.busy = true; rentForm.error = ''; render();
  if (rentForm.saveRule) {
    const rule = { contactIds: rentForm.contactIds, totalCents, currency: rentForm.currency, mode: rentForm.mode, customShares: rentForm.customAmounts };
    savedRentRule = rule;
    if (backendMode && ledger) { try { await api('/api/organizer/rent-rule', rule); } catch {} }
    else saveLocalState();
  }
  const created = await persistRequestRecord({ title: `Rent due ${rentForm.dueDate}`, merchant: 'Monthly Rent', dueDate: rentForm.dueDate, kind: 'rent', currency: rentForm.currency, totalCents: recipients.reduce((s, r) => s + r.amountCents, 0), recipients, channel: 'demo', demoAutoSettle: true });
  rentForm.busy = false;
  if (created) go(`request/${created.id}`);
}

// ---------- Scan & Pay (Merchant QR + PayPal Sandbox Orders v2 SS-001) ----------
function openScanPay() {
  stopStreams();
  scannerState = 'ready';
  scannerMessage = '';
  go('scan');
}

function scanQrScreen() {
  let camera = '';
  if (scannerState === 'denied') camera = `<div class="center"><div class="result-icon cancelled">${svg('qr')}</div><h2 style="color:#fff">Camera permission unavailable</h2><p style="color:#DCE1E8;margin-top:6px">Allow camera permission or paste a supported SplitSync link below.</p></div>`;
  else if (scannerState === 'unavailable') camera = `<div class="center"><div class="result-icon processing">${svg('alert')}</div><h2 style="color:#fff">Camera unavailable</h2><p style="color:#DCE1E8;margin-top:6px">Paste a supported SplitSync QR link below.</p></div>`;
  else if (scannerState === 'scanning') camera = `<span class="camera-badge">Live camera preview</span><video id="cam" autoplay playsinline muted></video>`;
  else camera = `<span class="camera-badge">Merchant QR scanner</span><div class="center"><div class="icon-box" style="width:54px;height:54px;margin:0 auto 10px">${svg('qr')}</div><h2 style="color:#fff">Ready to scan</h2><p style="color:#DCE1E8;margin-top:6px">Tap Open camera or paste a merchant code like <code>#purchase/SS-001</code>.</p></div>`;

  return screenHeader('Scan & pay', 'Pay supported Demo Merchant Sandbox links', 'home')
    + `<div class="split-grid">
      <div class="camera-frame">${camera}</div>
      <div class="card">
        <h2>Scan or paste code</h2>
        <div class="actions">
          <button type="button" class="btn btn-primary" onclick="${scannerState === 'scanning' ? 'stopCamera()' : 'startCamera()'}">${svg('qr')}<span>${scannerState === 'scanning' ? 'Stop camera' : 'Open camera'}</span></button>
          <button type="button" class="btn btn-secondary" onclick="openSs001DemoMerchant()">Open Demo Merchant (SS-001)</button>
        </div>
        <div class="rule"></div>
        <form onsubmit="event.preventDefault(); pasteLink()">
          <div class="field-group" style="margin-top:0">
            <label for="purchase-link">Paste link or code</label>
            <input id="purchase-link" value="${escapeHtml(pastedLinkDraft)}" oninput="pastedLinkDraft = this.value" placeholder="#purchase/SS-001 or #req/...">
          </div>
          <div class="actions" style="margin-top:10px"><button type="submit" class="btn btn-secondary full">Open link</button></div>
        </form>
        ${['invalid', 'denied', 'unavailable'].includes(scannerState) ? `<div class="callout error" role="alert">${svg('alert')}<span>${escapeHtml(scannerMessage)}</span></div>` : ''}
      </div>
    </div>`;
}

async function startCamera() {
  scannerState = 'scanning'; scannerMessage = ''; render();
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('No camera'), { name: 'NotFoundError' });
    activeStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const v = document.querySelector('#cam'); if (v) v.srcObject = activeStream;
  } catch (e) {
    const denied = e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError';
    scannerState = denied ? 'denied' : 'unavailable';
    scannerMessage = denied ? 'Camera permission denied. Paste #purchase/SS-001 instead.' : 'Camera unavailable in this browser. Paste #purchase/SS-001 instead.';
    render();
  }
}
function stopCamera() { stopStreams(); scannerState = 'ready'; scannerMessage = ''; render(); }
function openSs001DemoMerchant() {
  ss001Active = true;
  localStorage.setItem('splitsync-ss001-active', 'true');
  go('review');
}
function pasteLink() {
  const raw = (document.querySelector('#purchase-link')?.value || '').trim();
  pastedLinkDraft = raw;
  if (!raw) { scannerState = 'invalid'; scannerMessage = 'Paste a SplitSync link or merchant code first.'; render(); return; }
  const reqM = raw.match(/#req\/([A-Za-z0-9-]+)/);
  if (reqM) { scannerState = 'ready'; location.hash = `#req/${reqM[1]}`; return; }
  const payM = raw.match(/#pay\/([a-f0-9]+)/);
  if (payM) { scannerState = 'ready'; location.hash = `#pay/${payM[1]}`; return; }
  if (raw === 'SS-001' || raw.includes('#purchase/SS-001')) { scannerState = 'ready'; openSs001DemoMerchant(); return; }
  scannerState = 'invalid';
  scannerMessage = `Unsupported code "${raw}". Supported: Demo Merchant #purchase/SS-001 or a SplitSync link.`;
  render();
}

// Keep verified SS-001 Review -> AI Split -> Share -> Dashboard -> PayPal Checkout intact!
function receiptCard() {
  const activeLamp = draftLamp || ledger?.lamp || lamp;
  return `<div class="card">
    <div class="section-title"><h2>Demo Merchant · SS-001</h2>${badge('Sandbox', '')}</div>
    <div class="row"><span>Shared kitchen essentials (3 ways)</span><b class="money">$120.00</b></div>
    <div class="row"><span>Desk lamp (${escapeHtml(activeLamp)})</span><b class="money">$30.00</b></div>
    <div class="row total"><span>Total</span><span class="money">$150.00 USD</span></div>
  </div>`;
}
function reviewScreen() {
  ss001Active = true;
  const cur = activeSsShares();
  const activeLamp = draftLamp || ledger?.lamp || lamp;
  return screenHeader('Review merchant purchase', 'Demo Merchant · SS-001 · PayPal Sandbox checkout', 'scan', badge('Sandbox', ''))
    + `<div class="split-grid">
      ${receiptCard()}
      <div class="card">
        <h2>Participants</h2>
        ${names.map(n => `<div class="row"><span class="person ${n.toLowerCase()}">${n[0]}</span><div class="grow"><b>${n}</b><br><small class="sub">${n === activeLamp ? '$40.00 + $30.00 lamp' : '$40.00 shared'}</small></div><b class="money">${money(cur[n])}</b></div>`).join('')}
        <div class="field-group"><label for="instruction">Split instruction</label><textarea id="instruction" rows="2" oninput="instructionDraft = this.value">${escapeHtml(instructionDraft)}</textarea></div>
        <div class="actions"><button type="button" class="btn btn-primary full" onclick="prepareSs001()"><span>Prepare AI split</span>${svg('arrow-right')}</button></div>
      </div>
    </div>`;
}
async function prepareSs001() {
  const ta = document.querySelector('#instruction'); if (ta) instructionDraft = ta.value;
  if (!backendMode) {
    const owner = names.find(n => new RegExp('\\b' + n + '\\b', 'i').test(instructionDraft)) || 'Leah';
    lamp = owner; localStorage.setItem('splitsync-lamp', owner); aiState = 'ready'; go('split'); return;
  }
  aiState = 'loading'; aiError = ''; go('split'); await render();
  try {
    const r = await api('/api/organizer/suggest-split', { instruction: instructionDraft });
    if (names.includes(r.lamp)) { draftLamp = r.lamp; lamp = r.lamp; aiState = 'ready'; await render(); }
    else { aiState = 'clarify'; go('clarify'); await render(); }
  } catch (e) { aiState = 'unavailable'; aiError = e.message; await render(); }
}
function splitScreen(clarify = false, edit = false) {
  const l = draftLamp || ledger?.lamp || lamp;
  const cur = activeSsShares();
  return screenHeader(clarify ? 'Clarify lamp owner' : 'Review split', 'Move-in essentials · $150.00 USD', 'review', badge('Sandbox', ''))
    + `<div class="split-grid">
      ${receiptCard()}
      <div class="card">
        <div class="chip-row" style="margin-bottom:10px">${names.map(n => `<button type="button" class="chip ${n === l ? 'selected' : ''}" onclick="setLamp('${n}')">${n} ($${n === l ? 70 : 40})</button>`).join('')}</div>
        ${names.map(n => `<div class="row"><span class="person ${n.toLowerCase()}">${n[0]}</span><div class="grow"><b>${n}</b></div><b class="money">${money(cur[n])}</b></div>`).join('')}
        <div class="actions"><button type="button" class="btn btn-primary full" onclick="confirmSplit()"><span>Confirm &amp; get PayPal links</span>${svg('arrow-right')}</button></div>
      </div>
    </div>`;
}
function setLamp(n) { if (!names.includes(n)) return; draftLamp = n; lamp = n; selectedQrName = n; localStorage.setItem('splitsync-lamp', n); render(); }
async function confirmSplit() {
  if (backendMode && ledger) {
    try { await api('/api/organizer/split', { lamp: draftLamp || lamp }); draftLamp = null; await loadWorkspaceState(); go('requests'); } catch (e) { toast(e.message); }
    return;
  }
  published = true; localStorage.setItem('splitsync-published', 'true'); go('requests');
}
function paymentLink(n) { return ledger ? (ledger.published ? ledger.participants.find(p => p.name === n)?.shareUrl : null) : `${location.href.split('#')[0]}#share/${n.toLowerCase()}`; }
function requestsScreen(qrName) {
  const active = qrName || selectedQrName || lamp || 'Maya';
  selectedQrName = active;
  const u = paymentLink(active);
  return screenHeader('PayPal Sandbox links', 'SS-001 · Verified PayPal Orders v2 checkout', 'split', badge('Sandbox', ''))
    + `<div class="split-grid">
      <div class="card">${names.map(n => `<div class="row"><span class="person ${n.toLowerCase()}">${n[0]}</span><div class="grow"><b>${n}</b><br><small class="sub">${money(activeSsShares()[n])} · ${pill(ssStatus(n))}</small></div><button type="button" class="btn-ghost-sm" onclick="navigator.clipboard?.writeText('${escapeHtml(paymentLink(n) || '')}');toast('Copied ${n}')">Copy</button><button type="button" class="btn-ghost-sm" onclick="go('qr/${n.toLowerCase()}')">QR</button></div>`).join('')}</div>
      <div class="card card-tint"><div class="qr-spotlight"><div class="qr-box" id="qr"></div><div class="qr-meta"><h3>${escapeHtml(active)} · ${money(activeSsShares()[active])} USD</h3>${u ? `<a class="btn btn-primary" style="margin-top:8px" href="${escapeHtml(u)}">Open ${escapeHtml(active)}’s checkout</a>` : '<p class="sub">Confirm split first.</p>'}</div></div></div>
    </div>`;
}
function dashboardScreen() {
  const paid = names.filter(n => ssStatus(n) === 'Paid').reduce((s, n) => s + activeSsShares()[n], 0);
  return screenHeader('SS-001 Sandbox ledger', 'Demo Merchant · PayPal Orders v2', 'activity', badge('Sandbox', ''))
    + `<div class="split-grid">${receiptCard()}<div class="card"><div style="font-size:26px;font-weight:800" class="money">${money(paid)} / $150.00 USD</div><div class="rule"></div>${names.map(n => `<div class="row"><b>${n}</b><span>${money(activeSsShares()[n])} ${pill(ssStatus(n))}</span></div>`).join('')}<div class="actions"><button type="button" class="btn btn-primary full" onclick="go('requests')">Share PayPal links</button></div></div></div>`;
}

// ---------- Store & Cart (super.money splitStore) ----------
function cartCount() { return sharedCart.reduce((s, i) => s + (i.qty || 1), 0); }
function updateCartBadges() {
  const n = cartCount();
  for (const id of ['#rail-cart-badge', '#mobile-cart-badge']) { const el = document.querySelector(id); if (el) { el.textContent = String(n); el.hidden = n <= 0; } }
}
function storeScreen() {
  const cats = ['All', 'Kitchen', 'Lighting', 'Furniture', 'Cleaning', 'Retailers'];
  const q = storeQuery.trim().toLowerCase();
  const prods = storeCategory !== 'Retailers' ? storeCatalog.filter(p => (storeCategory === 'All' || p.category === storeCategory) && (!q || `${p.name} ${p.seller}`.toLowerCase().includes(q))) : [];
  const retailers = ['All', 'Retailers'].includes(storeCategory) ? externalRetailers.filter(r => !q || r.name.toLowerCase().includes(q)) : [];
  return `<div class="hub-top">
    <div><h1>splitStore ${badge('Sample · Demo mode', 'preview')}</h1><p class="screen-sub">Sample household catalog with shared cart &amp; optional split.</p></div>
    <button type="button" class="btn btn-primary" onclick="go('cart')">${svg('cart')}<span>Cart (${cartCount()})</span></button>
  </div>
  <div class="store-toolbar"><div class="store-search">${svg('search')}<input id="store-search" type="search" aria-label="Search store" value="${escapeHtml(storeQuery)}" oninput="storeQuery = this.value; render()" placeholder="Search lamps, cookware, retailers…"></div></div>
  <div class="category-strip">${cats.map(c => `<button type="button" class="chip ${storeCategory === c ? 'selected' : ''}" onclick="storeCategory='${c}'; render()">${c}</button>`).join('')}</div>
  <div class="store-grid">
    ${prods.map(p => `<article class="product-card"><div><div class="product-art">${svg(p.art)}</div><div style="display:flex;justify-content:space-between;margin-top:10px">${badge(p.seller, p.demoLinked ? '' : 'preview')}<small class="sub">${escapeHtml(p.category)}</small></div><h2 style="margin-top:8px">${escapeHtml(p.name)}</h2><p style="margin-top:4px">${escapeHtml(p.desc)}</p></div><div style="display:flex;justify-content:space-between;align-items:center"><b class="money">${cents(p.priceCents)}</b><div style="display:flex;gap:6px"><button type="button" class="btn-ghost-sm" onclick="go('product/${escapeHtml(p.id)}')">View</button><button type="button" class="btn btn-primary" onclick="addToCart('${escapeHtml(p.id)}')">Add</button></div></div></article>`).join('')}
    ${retailers.map(r => `<article class="product-card"><div><div class="product-art" style="background:#EEF2F7;color:var(--navy)">${svg('store')}</div><div style="margin-top:10px">${badge(r.seller, 'preview')}</div><h2 style="margin-top:8px">${escapeHtml(r.name)}</h2><p style="margin-top:4px">${escapeHtml(r.desc)}</p></div><a class="btn btn-secondary full" href="${escapeHtml(r.url)}" target="_blank" rel="noopener"><span>Open retailer</span>${svg('external')}</a></article>`).join('')}
  </div>`;
}
function productDetailScreen(id) {
  const p = storeCatalog.find(x => x.id === id) || storeCatalog[0];
  return screenHeader(escapeHtml(p.name), `${escapeHtml(p.seller)} · ${escapeHtml(p.category)}`, 'store', `<button type="button" class="btn-ghost-sm" onclick="go('cart')">${svg('cart')}<span>Cart (${cartCount()})</span></button>`)
    + `<div class="split-grid"><div class="card"><div class="product-art" style="height:220px">${svg(p.art)}</div></div><div class="card">${badge('Sample item · Demo mode', 'preview')}<h2 class="money" style="margin-top:10px;font-size:26px">${cents(p.priceCents)} USD</h2><p style="margin-top:8px">${escapeHtml(p.desc)}</p><div class="actions"><button type="button" class="btn btn-primary full" onclick="addToCart('${escapeHtml(p.id)}', true)">${svg('cart')}<span>Add to shared cart</span></button></div></div></div>`;
}
function addToCart(id, openCart = false) {
  const ex = sharedCart.find(i => i.id === id); if (ex) ex.qty += 1; else sharedCart.push({ id, qty: 1 });
  localStorage.setItem('splitsync-cart', JSON.stringify(sharedCart)); updateCartBadges(); toast('Added to cart.');
  if (openCart) go('cart'); else render();
}
function cartScreen() {
  const rows = sharedCart.map(c => ({ ...c, product: storeCatalog.find(p => p.id === c.id) })).filter(c => c.product);
  const total = rows.reduce((s, r) => s + r.product.priceCents * r.qty, 0);
  return screenHeader('Shared cart', `${cartCount()} item${cartCount() === 1 ? '' : 's'}`, 'store')
    + `<div class="narrow card">${rows.length === 0 ? `<p class="sub">Cart is empty.</p>` : `${rows.map(r => `<div class="row"><div class="grow"><b>${escapeHtml(r.product.name)}</b><br><small class="sub">${escapeHtml(r.product.seller)}</small></div><div style="display:flex;gap:6px;align-items:center"><button type="button" class="btn-ghost-sm" onclick="adjustCart('${escapeHtml(r.id)}', -1)">-</button><b>${r.qty}</b><button type="button" class="btn-ghost-sm" onclick="adjustCart('${escapeHtml(r.id)}', 1)">+</button></div><b class="money">${cents(r.product.priceCents * r.qty)}</b></div>`).join('')}<div class="row total"><span>Subtotal</span><span class="money">${cents(total)} USD</span></div><div class="actions"><button type="button" class="btn btn-secondary" onclick="clearCart()">Clear</button><button type="button" class="btn btn-primary" onclick="splitCartWithPeople()"><span>Split this purchase</span>${svg('arrow-right')}</button></div>`}</div>`;
}
function adjustCart(id, delta) { const row = sharedCart.find(c => c.id === id); if (!row) return; row.qty += delta; if (row.qty <= 0) sharedCart = sharedCart.filter(c => c.id !== id); localStorage.setItem('splitsync-cart', JSON.stringify(sharedCart)); updateCartBadges(); render(); }
function clearCart() { sharedCart = []; localStorage.setItem('splitsync-cart', '[]'); updateCartBadges(); render(); }
function splitCartWithPeople() {
  const rows = sharedCart.map(c => ({ ...c, product: storeCatalog.find(p => p.id === c.id) })).filter(c => c.product);
  const total = rows.reduce((s, r) => s + r.product.priceCents * r.qty, 0);
  const per = Math.floor(total / 3);
  chatAttachedBill = { merchant: 'splitStore Shared Cart', date: '2026-11-10', currency: 'USD', items: rows.map(r => ({ name: `${r.product.name} x${r.qty}`, amountCents: r.product.priceCents * r.qty })), taxCents: 0, tipCents: 0, totalCents: total };
  chatDraft = {
    intent: 'request',
    needsClarification: false,
    modelUsed: 'Store Cart',
    recipients: [
      { id: 'draft-1', name: 'Maya', contactId: 'maya', known: true, ambiguous: false, amountCents: total - per * 2, currency: 'USD', targetCurrency: 'USD', reason: rows[0]?.product?.name || 'Store purchase' },
      { id: 'draft-2', name: 'Arun', contactId: 'arun', known: true, ambiguous: false, amountCents: per, currency: 'USD', targetCurrency: 'CAD', reason: rows[0]?.product?.name || 'Store purchase' },
      { id: 'draft-3', name: 'Leah', contactId: 'leah', known: true, ambiguous: false, amountCents: per, currency: 'USD', targetCurrency: 'USD', reason: rows[0]?.product?.name || 'Store purchase' },
    ],
  };
  chatHistory = [{ id: 'a-cart', role: 'assistant', text: `Prepared ${cents(total)} USD shared cart split across Maya, Arun, and Leah. Ready to create requests?`, modelUsed: 'Store Cart' }];
  go('ask');
}

// ---------- Profile & Presenter Reset ----------
function profileScreen() {
  return `<div class="hub-top"><div><h1>Profile</h1><p class="screen-sub">Connection status, international contacts, and presenter controls.</p></div>${badge(backendMode && ledger ? 'Connected Sandbox' : 'Demo mode', backendMode && ledger ? '' : 'preview')}</div>
  <div class="split-grid">
    <section class="card">
      <h2>Workspace &amp; voice</h2>
      <div class="row"><span>Backend connection</span><b>${backendMode && ledger ? 'Connected' : 'Offline preview'}</b></div>
      <div class="row"><span>Auto-play Chatterbox voice</span><button type="button" class="btn-ghost-sm" onclick="toggleAskVoice()">${askVoiceOn ? 'ON' : 'OFF'}</button></div>
      <div class="row"><span>AI Extract &amp; Split (NVIDIA)</span>${pill(providers.aiConfigured ? 'Sent' : 'Created')}</div>
      <div class="row"><span>PayPal Sandbox (SS-001)</span>${pill(providers.paypalConfigured ? 'Paid' : 'Created')}</div>
      <div class="actions">
        ${backendMode && ledger ? `<button type="button" class="btn btn-secondary" onclick="signOutOrganizer()">Disconnect</button>` : `<button type="button" class="btn btn-primary" onclick="go('welcome')">Connect backend</button>`}
        <button type="button" class="btn btn-secondary" onclick="resetDemoSession()">${svg('refresh')}<span>Reset demo session</span></button>
      </div>
    </section>
    <section class="card">
      <h2>International contacts (${contactsList.length})</h2>
      ${contactsList.map(c => `<div class="row"><span class="person">${escapeHtml(c.flag || c.name[0])}</span><div class="grow"><b>${escapeHtml(c.name)}</b><br><small class="sub">${escapeHtml(c.country || '')} · ${escapeHtml(c.note || '')}</small></div><b>${escapeHtml(c.currency || 'USD')}</b></div>`).join('')}
    </section>
  </div>`;
}

// ---------- Isolated Payer Pages (#pay/:token & #req/:token) ----------
function buyerPage(shareData, query) {
  const paid = shareData.status === 'Paid';
  const pending = shareData.status === 'Processing';
  const cancelled = query.get('cancelled') === '1' && !paid && !pending;
  const amount = money(shareData.amountCents / 100);
  const ownsLamp = shareData.name === shareData.lamp;
  return `<div class="hub-top"><div><h1>Your share · ${amount} USD</h1><p class="screen-sub">Hi ${escapeHtml(shareData.name)}, ${escapeHtml(shareData.merchant)} (${escapeHtml(shareData.purchaseTitle)}).</p></div>${badge('Sandbox')}</div>
  <div class="split-grid">
    <div class="card"><div class="section-title"><h2>Your items</h2>${badge('Private link')}</div><div class="row"><span>Shared essentials</span><b>$40.00</b></div>${ownsLamp ? `<div class="row"><span>Desk lamp</span><b>$30.00</b></div>` : ''}<div class="row total"><span>Total</span><span>${amount} USD</span></div></div>
    <div class="card card-tint payment-summary${paid || pending || cancelled ? ' is-priority' : ''}"><div class="section-title"><h2>Payment</h2>${pill(cancelled ? 'Cancelled' : shareData.status)}</div><div class="row"><span>Total</span><b class="money">${amount} USD</b></div>${!paid && !pending ? `<div class="actions"><button type="button" class="btn btn-paypal full" id="pay-button" onclick="startCheckout()">${cancelled ? 'Retry with PayPal' : 'Pay with PayPal'}</button></div>` : ''}<div class="actions"><button type="button" class="btn btn-secondary full" onclick="refreshBuyer()">Refresh payment status</button></div><p id="payment-message" role="status" class="sub" style="color:var(--error);margin-top:8px"></p></div>
  </div>`;
}
function reimbursementBuyerPage(data) {
  return `<div class="hub-top"><div><h1>Request · ${cents(data.amountCents, data.currency, true)}</h1><p class="screen-sub">Hi ${escapeHtml(data.recipientName)}, from Leah for ${escapeHtml(data.reason)}.</p></div>${badge('Personal link', 'preview')}</div>
  <div class="split-grid">
    <div class="card"><h2>${escapeHtml(data.merchant)}</h2>${data.evidenceImageDataUrl ? `<img src="${escapeHtml(data.evidenceImageDataUrl)}" alt="Receipt" class="crop-canvas" style="margin:10px 0">` : ''}${(data.items || []).map(i => `<div class="row"><span>${escapeHtml(i.name)}</span><b>${cents(i.amountCents, data.currency)}</b></div>`).join('')}<div class="row total"><span>Bill total</span><span>${cents(data.totalBillCents || data.totalCents, data.currency, true)}</span></div></div>
    <div class="card card-tint"><div class="section-title"><h2>Your portion</h2>${pill(data.status)}</div><div class="row"><span>Amount</span><b class="money">${cents(data.amountCents, data.currency, true)}</b></div><div class="row"><span>Reason</span><b>${escapeHtml(data.reason)}</b></div><div class="callout">${svg('alert')}<span>${escapeHtml(data.note)}</span></div></div>
  </div>`;
}

function staticSharePage(n) { return `<div class="narrow card"><h1>${escapeHtml(n)} · ${money(activeSsShares()[n])} USD</h1><p class="sub">Static Sandbox checkout preview.</p><div class="actions"><button type="button" class="btn btn-paypal full" onclick="go('handoff/${n.toLowerCase()}')">Pay with PayPal</button></div></div>`; }
function handoffPage(n) { return `<div class="narrow card center"><h1>PayPal Sandbox</h1><p>${escapeHtml(n)} · ${money(activeSsShares()[n])} USD</p><div class="chip-row" style="justify-content:center">${['Processing', 'Paid', 'Cancelled'].map(s => `<button type="button" class="btn btn-secondary" onclick="go('result/${n.toLowerCase()}/${s.toLowerCase()}')">${s}</button>`).join('')}</div></div>`; }
function resultPage(n, s) { return `<div class="narrow card center"><h1>${escapeHtml(s)}</h1><p>${escapeHtml(n)} · ${money(activeSsShares()[n])} USD</p><div class="actions"><button type="button" class="btn btn-primary" onclick="go('home')">Home</button></div></div>`; }

// ---------- Router & Chrome Visibility ----------
function setChromeMode(route) {
  const primaryTabs = ['home', 'activity', 'store', 'profile'];
  const payerRoutes = ['share', 'handoff', 'result', 'pay', 'req'];
  const isWelcome = route === 'welcome' || (!ledger && !staticPreviewMode && !payerRoutes.includes(route));
  const isPayer = payerRoutes.includes(route);
  const isFocused = !isWelcome && !isPayer && !primaryTabs.includes(route);
  document.body.dataset.page = route;
  document.body.classList.toggle('welcome', isWelcome);
  document.body.classList.toggle('payer', isPayer);
  document.body.classList.toggle('focused', isFocused);
  const activeTab = primaryTabs.includes(route) ? route : ['product', 'cart'].includes(route) ? 'store' : 'home';
  document.querySelectorAll('.nav-rail a[data-tab], .bottom-nav a[data-tab]').forEach(a => {
    const active = !isFocused && !isPayer && !isWelcome && a.dataset.tab === activeTab;
    a.classList.toggle('active', active);
    a.setAttribute('aria-current', active ? 'page' : 'false');
  });
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
    if (req && rec && appEl) { appEl.innerHTML = reimbursementBuyerPage({ ...req, totalBillCents: req.totalCents, recipientName: rec.name, amountCents: rec.amountCents, reason: rec.reason, status: rec.status, note: 'Personal reimbursement link.' }); return; }
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

let autoCamTriggeredRoute = '';
async function render() {
  if (location.hash.startsWith('#pay/')) return renderBuyer();
  if (location.hash.startsWith('#req/')) return renderReimbursementBuyer();

  const rawHash = (location.hash || '#home').slice(1);
  const [rawRoute, a, b] = rawHash.split('/');
  const route = rawRoute || 'home';

  if (route === 'dev-reset') { await resetDemoSession(); return; }
  if (backendMode && !ledger && !staticPreviewMode && !['welcome', 'share', 'handoff', 'result'].includes(route)) {
    try { await loadWorkspaceState(); } catch { setChromeMode('welcome'); const el = document.querySelector('#app'); if (el) el.innerHTML = authView(); return; }
  }
  if (route === 'welcome' || (!ledger && !staticPreviewMode && !['share', 'handoff', 'result'].includes(route))) {
    setChromeMode('welcome'); const el = document.querySelector('#app'); if (el) el.innerHTML = authView(); return;
  }

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
    profile: profileScreen,
    welcome: authView,
    send: () => { if (a && transferForm.contactId !== a) selectSendContact(a); return sendMoneyScreen(); },
    'review-transfer': reviewTransferScreen,
    tx: () => txReceiptScreen(a || activeTxReceiptId),
    'request-new': manualRequestScreen,
    request: () => requestDetailScreen(a),
    ask: askScreen,
    talk: askScreen,
    'scan-bill': scanBillScreen,
    rent: rentScreen,
    scan: scanQrScreen,
    review: reviewScreen,
    split: () => splitScreen(false, false),
    clarify: () => splitScreen(true, false),
    edit: () => splitScreen(false, true),
    requests: () => requestsScreen(),
    qr: () => requestsScreen(a),
    dashboard: dashboardScreen,
    product: () => productDetailScreen(a),
    cart: cartScreen,
    share: () => staticSharePage(names.find(x => x.toLowerCase() === a) || 'Maya'),
    handoff: () => handoffPage(names.find(x => x.toLowerCase() === a) || 'Maya'),
    result: () => resultPage(names.find(x => x.toLowerCase() === a) || 'Maya', b || 'processing'),
  };

  const appEl = document.querySelector('#app');
  if (appEl) appEl.innerHTML = (views[route] || homeScreen)();
  window.scrollTo(0, 0);

  if (route === 'scan-bill' && autoCamTriggeredRoute !== 'scan-bill' && !billRawImage && !billDraft && billCameraState === 'ready') {
    autoCamTriggeredRoute = 'scan-bill';
    startStandaloneBillCamera();
  } else if (route !== 'scan-bill') {
    autoCamTriggeredRoute = '';
  }

  if (route === 'requests' || route === 'qr') {
    const url = paymentLink(selectedQrName || lamp || 'Maya');
    const box = document.querySelector('#qr');
    if (box && url) { const { default: QR } = await import('./qrcode.js'); const live = document.querySelector('#qr'); if (live) live.innerHTML = QR(url); }
  }
  if (route === 'request') {
    const req = reimbursementsList.find(r => r.id === a);
    const rec = req?.recipients?.find(x => x.id === selectedReqQr.recipientId) || req?.recipients?.[0];
    const url = rec ? (rec.shareUrl || (location.href.split('#')[0] + '#req/' + rec.shareToken)) : '';
    const box = document.querySelector('#req-qr');
    if (box && url) { const { default: QR } = await import('./qrcode.js'); const live = document.querySelector('#req-qr'); if (live) live.innerHTML = QR(url); }
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

window.addEventListener('hashchange', render);
detectBackend().then(render);
