const money = n => '$' + Number(n || 0).toFixed(2);
const cents = c => money((Number(c) || 0) / 100);
const names = ['Maya', 'Arun', 'Leah'];

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

let organizerKeyDraft = '';
let lamp = localStorage.getItem('splitsync-lamp') || 'Maya';
let published = localStorage.getItem('splitsync-published') === 'true';
let rentReviewed = localStorage.getItem('splitsync-rent-reviewed') === 'true';
let instructionDraft = 'Split the $120 kitchen essentials evenly between Maya, Arun and Leah. The $30 lamp is for Leah.';
let pastedLinkDraft = '';

let selectedQrName = 'Maya';
let selectedReqQr = { reqId: '', recipientId: '' };
let authErrorKind = '';
let authErrorMessage = '';
let authBusy = false;
let confirmBusy = false;
let staticPreviewMode = false;

let backendMode = false;
let paypalConfigured = false;
let providers = {
  paypalConfigured: false,
  aiConfigured: false,
  ttsConfigured: false,
  sttConfigured: true,
  emailConfigured: false,
  smsConfigured: false,
};
let ledger = null;
let contactsList = JSON.parse(localStorage.getItem('splitsync-contacts') || 'null') || [
  { id: 'maya', name: 'Maya', handle: 'maya@house.local', phone: '+1-555-0141', note: 'Roommate' },
  { id: 'arun', name: 'Arun', handle: 'arun@house.local', phone: '+1-555-0142', note: 'Roommate' },
  { id: 'leah', name: 'Leah', handle: 'leah@house.local', phone: 'Organizer' },
  { id: 'samir', name: 'Samir Patel', handle: 'samir@house.local', phone: '+1-555-0144', note: 'Friend' },
];
let reimbursementsList = JSON.parse(localStorage.getItem('splitsync-reimbursements') || '[]');
let activityFilter = 'All';

// QR scanner state
let scannerState = 'ready';
let scannerMessage = '';
let activeStream = null;

// SS-001 AI state
let aiState = 'idle';
let aiError = '';
let draftLamp = null;
let ttsState = 'idle';
let ttsError = '';
let ttsAudioSrc = '';
let ttsAudioLamp = '';

// Scan Bill & Capture/Crop/Extract state
let billStream = null;
let billCameraState = 'ready';
let billCameraMessage = '';
let billRawImage = '';
let billCropTopPct = 4;
let billCropBottomPct = 4;
let billCroppedImage = '';
let billExtractState = 'idle';
let billExtractError = '';
let billDraft = {
  merchant: 'Olive Kitchen',
  date: '2026-11-10',
  currency: 'USD',
  items: [
    { name: 'Pasta Dinner', amountCents: 2000 },
    { name: 'Craft Drinks', amountCents: 1500 },
    { name: 'Shared Flatbread', amountCents: 700 },
  ],
  taxCents: 0,
  tipCents: 0,
  totalCents: 4200,
  unreadableFields: [],
  totalMismatch: false,
  modelUsed: '',
};

// Voice Dictation + Multi-recipient Request Draft state
let micState = 'idle';
let micError = '';
let micRecorder = null;
let micChunks = [];
let speechRecognition = null;
let transcriptDraft = '';
let requestParseState = 'idle';
let requestParseError = '';
let requestModelUsed = '';
let clarificationMessage = '';
let draftRecipients = [];
let selectedDeliveryChannel = 'link';
let requestCreateBusy = false;

// Spoken reply (Chatterbox TTS) state for request flow
let reqTtsState = 'idle';
let reqTtsError = '';
let reqTtsAudioSrc = '';
let reqTtsPhrase = '';

// Storefront & Shared Cart state
let storeCategory = 'All';
let storeQuery = '';
let sharedCart = JSON.parse(localStorage.getItem('splitsync-cart') || '[]');

let buyer = null;
let buyerToken = '';
let payerSubMode = 'pay'; // 'pay' for SS-001 PayPal checkout | 'req' for personal reimbursement
let buyerActionMessage = '';

const seedStatus = { Maya: 'Paid', Arun: 'Processing', Leah: 'Awaiting payment' };

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
    volume: '<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6a8.5 8.5 0 0 1 0 12"/>',
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
    'chevron-down': '<path d="M6 9l6 6 6-6"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.sparkles}</svg>`;
}

const badge = (text, kind = '') => `<span class="badge ${kind}">${escapeHtml(text)}</span>`;
const statusClass = s => ({ Created: 'created', Sent: 'sent', 'Awaiting payment': 'awaiting', Processing: 'processing', Paid: 'paid', Failed: 'failed', Cancelled: 'error', Reviewed: 'paid', Draft: 'created' }[s] || 'created');
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

function stepHeader(step, total, caption) {
  const scale = Math.max(0.05, Math.min(1, step / total)).toFixed(4);
  return `<div class="step-header">
    <div class="step-track" role="progressbar" aria-valuenow="${step}" aria-valuemin="1" aria-valuemax="${total}" aria-label="${escapeHtml(caption)}">
      <div class="step-fill" style="transform:scaleX(${scale})"></div>
    </div>
    <span class="step-caption">${escapeHtml(caption)}</span>
  </div>`;
}

function toast(text) {
  const el = document.querySelector('#toast');
  if (!el) return;
  el.textContent = text;
  el.style.display = 'block';
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2800);
}

async function api(path, body, timeoutMs = 28000) {
  let response;
  try {
    response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw Object.assign(new Error('Could not reach the backend server. Check that Node is running on this origin.'), { status: 0, network: true, cause: err });
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'Request failed.'), { status: response.status });
  return data;
}

// ---------- Ledger & Persistence Helpers ----------
function activeLamp() {
  if (location.hash.startsWith('#split') || location.hash.startsWith('#clarify') || location.hash.startsWith('#edit') || location.hash.startsWith('#review')) {
    return draftLamp || ledger?.lamp || lamp;
  }
  return ledger?.lamp || lamp;
}

function shares() {
  const l = activeLamp();
  if (ledger && !draftLamp) {
    return Object.fromEntries(ledger.participants.map(p => [p.name, p.amountCents / 100]));
  }
  return { Maya: 40 + (l === 'Maya' ? 30 : 0), Arun: 40 + (l === 'Arun' ? 30 : 0), Leah: 40 + (l === 'Leah' ? 30 : 0) };
}

function status(n) {
  if (ledger) return ledger.participants.find(p => p.name === n)?.status || 'Awaiting payment';
  return staticPreviewMode ? seedStatus[n] : 'Awaiting payment';
}

function paidTotal() {
  return names.filter(n => status(n) === 'Paid').reduce((sum, n) => sum + shares()[n], 0);
}

function paidCount() {
  return names.filter(n => status(n) === 'Paid').length;
}

function hasExistingOrders() {
  return Boolean(ledger?.participants?.some(p => p.orders?.length));
}

function paymentLink(n) {
  if (ledger) {
    return ledger.published ? (ledger.participants.find(p => p.name === n)?.shareUrl || null) : null;
  }
  return location.href.split('#')[0] + '#share/' + n.toLowerCase();
}

function activeReimbursements() {
  return backendMode ? reimbursementsList : (reimbursementsList || []);
}

function saveLocalReimbursements() {
  if (!backendMode) localStorage.setItem('splitsync-reimbursements', JSON.stringify(reimbursementsList));
}

function saveLocalContacts() {
  if (!backendMode) localStorage.setItem('splitsync-contacts', JSON.stringify(contactsList));
}

function cartCount() {
  return sharedCart.reduce((s, i) => s + (i.qty || 1), 0);
}

function updateCartBadges() {
  const n = cartCount();
  for (const id of ['#rail-cart-badge', '#mobile-cart-badge']) {
    const el = document.querySelector(id);
    if (!el) continue;
    el.textContent = String(n);
    el.hidden = n <= 0;
  }
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
  const data = await api('/api/organizer/state');
  ledger = data.purchase;
  if (Array.isArray(data.contacts)) contactsList = data.contacts;
  if (Array.isArray(data.reimbursements)) reimbursementsList = data.reimbursements;
  if (data.providers) providers = { ...providers, ...data.providers };
  lamp = ledger.lamp;
  published = ledger.published;
  return data;
}

function stopStreams() {
  if (activeStream) { activeStream.getTracks().forEach(t => t.stop()); activeStream = null; }
  if (billStream) { billStream.getTracks().forEach(t => t.stop()); billStream = null; }
}

function go(route) {
  location.hash = '#' + route;
}

// ---------- Auth / Welcome & Profile ----------
function authView() {
  return `<div class="auth-shell">
    <section class="auth-hero">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <span class="brand-mark sm" aria-hidden="true">${svg('arrow-right')}</span>
          <b style="font-size:17px">SplitSync AI</b>
        </div>
        ${badge(backendMode ? 'Connected Sandbox' : 'Local preview', 'navy')}
        <h1 style="margin-top:14px">Bills scanned, voiced, and settled with roommates.</h1>
        <p style="margin-top:8px">Capture paper receipts, dictate split instructions by voice, hear Chatterbox confirm amounts, and settle shared purchases through verified Sandbox links.</p>
      </div>
      <div>
        <div class="auth-feature">${svg('receipt-camera')}<div><b>Bill photo extraction</b><small>Extract items, tax, tip, and flag mismatches before requesting.</small></div></div>
        <div class="auth-feature">${svg('mic')}<div><b>Voice split + Chatterbox confirmation</b><small>Dictate requests naturally and verify recipient rows before sending.</small></div></div>
        <div class="auth-feature">${svg('qr')}<div><b>Merchant QR + Storefront cart</b><small>Separate PayPal Sandbox merchant checkout from bill reimbursements.</small></div></div>
      </div>
    </section>

    <section class="card">
      <h2>Organizer sign-in</h2>
      <p style="margin-top:6px">Enter the SplitSync organizer access key printed in your Node server terminal to unlock live persistence, AI models, and private links.</p>
      ${authErrorMessage ? `<div class="callout error" role="alert">
        ${svg('alert')}
        <div><b>${authErrorKind === 'invalid' ? 'Invalid organizer key' : 'Backend unavailable'}</b><br>${escapeHtml(authErrorMessage)}</div>
      </div>` : ''}
      <form onsubmit="event.preventDefault(); signInOrganizer()">
        <div class="field-group">
          <label for="organizer-key">SplitSync organizer access key</label>
          <div class="input-wrap">
            <input id="organizer-key" type="password" value="${escapeHtml(organizerKeyDraft)}" oninput="organizerKeyDraft = this.value" placeholder="Paste organizer key from terminal" autocomplete="off" required aria-invalid="${authErrorKind === 'invalid' ? 'true' : 'false'}">
            <button type="button" class="input-action" onclick="toggleKeyVis(this)">Show</button>
          </div>
        </div>
        <div class="actions">
          <button type="submit" class="btn btn-primary full" ${authBusy ? 'disabled' : ''}><span>${authBusy ? 'Connecting…' : 'Sign in as organizer'}</span>${svg('arrow-right')}</button>
        </div>
      </form>
      <p class="sub" style="margin-top:10px">API credentials remain server-side in <code>server/.env</code>.</p>
      <div class="rule"></div>
      <button type="button" class="link-coral" onclick="enterStaticPreview()">Explore static preview (no server)</button>
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
  if (!key) {
    authErrorKind = 'invalid';
    authErrorMessage = 'Enter the organizer access key from the Node terminal.';
    render();
    return;
  }
  authBusy = true; authErrorKind = ''; authErrorMessage = '';
  render();
  try {
    const ok = await detectBackend();
    if (!ok) {
      authErrorKind = 'unavailable';
      authErrorMessage = 'Local Node server did not respond on /api/health. Run npm start in server/ or open static preview.';
      authBusy = false;
      render();
      return;
    }
    await api('/api/organizer/session', { token: key });
    await loadWorkspaceState();
    staticPreviewMode = false;
    organizerKeyDraft = '';
    authBusy = false;
    go('home');
    await render();
  } catch (e) {
    authBusy = false;
    authErrorKind = e.status === 401 ? 'invalid' : 'unavailable';
    authErrorMessage = e.message;
    render();
  }
}

async function signOutOrganizer() {
  if (backendMode) { try { await api('/api/organizer/logout', {}); } catch {} }
  ledger = null;
  staticPreviewMode = false;
  authErrorKind = '';
  authErrorMessage = '';
  go('welcome');
  await render();
}

function enterStaticPreview() {
  staticPreviewMode = true;
  authErrorKind = '';
  authErrorMessage = '';
  go('home');
  render();
}

// ---------- Home (PhonePe Action-First Payment Hub) ----------
function homeScreen() {
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning, Leah' : hr < 17 ? 'Good afternoon, Leah' : 'Good evening, Leah';
  const paid = paidTotal();
  const remaining = Math.max(0, 150 - paid);
  const reimbs = activeReimbursements();
  const cartN = cartCount();

  return `<div class="hub-top">
    <div>
      <h1>${greet}</h1>
      <p class="screen-sub">The new place · Maya, Arun &amp; Leah</p>
    </div>
    <div class="hub-pills">
      ${badge(backendMode ? 'Connected Sandbox' : 'Preview mode', backendMode ? '' : 'preview')}
      ${cartN > 0 ? `<button type="button" class="btn-ghost-sm" onclick="go('cart')">${svg('cart')}<span>Cart (${cartN})</span></button>` : ''}
    </div>
  </div>

  <section class="hub-card" aria-label="Primary payment actions">
    <div class="hub-card-head">
      <h2>Payments &amp; splits</h2>
      <span class="badge navy">${paidCount()}/3 SS-001 settled · ${money(paid)} paid</span>
    </div>
    <div class="hub-actions-grid">
      <button type="button" class="hub-tile" onclick="go('scan')">
        <span class="hub-tile-icon">${svg('qr')}</span>
        <b>Scan &amp; Pay</b>
      </button>
      <button type="button" class="hub-tile" onclick="openVoiceRequestComposer()">
        <span class="hub-tile-icon teal">${svg('send-req')}</span>
        <b>Request Money</b>
      </button>
      <button type="button" class="hub-tile" onclick="go('scan-bill')">
        <span class="hub-tile-icon tint">${svg('receipt-camera')}</span>
        <b>Scan Bill</b>
      </button>
      <button type="button" class="hub-tile" onclick="go('talk')">
        <span class="hub-tile-icon">${svg('mic')}</span>
        <b>Talk to SplitSync</b>
      </button>
    </div>
  </section>

  <div class="shortcuts-grid" aria-label="Quick household shortcuts">
    <button type="button" class="shortcut-card" onclick="go('review')">
      <span class="icon-box">${svg('sparkles')}</span>
      <span class="grow">
        <span class="shortcut-title"><b>Split Expense</b></span>
        <small class="sub">$150.00 Move-in essentials</small>
      </span>
    </button>
    <button type="button" class="shortcut-card" onclick="go('rent')">
      <span class="icon-box">${svg('calendar')}</span>
      <span class="grow">
        <span class="shortcut-title"><b>Rent</b> ${badge('Preview', 'preview')}</span>
        <small class="sub">$2,400 Dec draft · $800/ea</small>
      </span>
    </button>
    <button type="button" class="shortcut-card" onclick="go('store')">
      <span class="icon-box">${svg('bag')}</span>
      <span class="grow">
        <span class="shortcut-title"><b>Store</b> ${badge('Preview', 'preview')}</span>
        <small class="sub">${storeCatalog.length} items &amp; shared cart</small>
      </span>
    </button>
  </div>

  <div class="split-grid">
    <section class="card">
      <div class="section-title">
        <h2>Active requests</h2>
        <a class="section-link" href="#activity">All activity ${svg('arrow-right')}</a>
      </div>
      <div class="row">
        <span class="icon-box">${svg('store')}</span>
        <div class="grow">
          <b>Move-in essentials · Demo Merchant</b><br>
          <small class="sub">SS-001 · ${money(paid)} paid · ${money(remaining)} remaining</small>
        </div>
        <button type="button" class="btn-ghost-sm" onclick="go('dashboard')">Open</button>
      </div>
      ${reimbs.slice(0, 3).map(req => {
        const totalReq = req.recipients.reduce((s, r) => s + r.amountCents, 0);
        const topStatus = req.recipients.every(r => r.status === 'Paid') ? 'Paid'
          : req.recipients.some(r => r.status === 'Sent') ? 'Sent' : 'Created';
        return `<div class="row">
          <span class="icon-box">${svg('receipt')}</span>
          <div class="grow">
            <b>${escapeHtml(req.merchant || req.title)}</b><br>
            <small class="sub">${req.recipients.map(r => escapeHtml(r.name)).join(', ')} · ${cents(totalReq)}</small>
          </div>
          ${pill(topStatus)}
          <button type="button" class="btn-ghost-sm" onclick="go('request/${escapeHtml(req.id)}')">View</button>
        </div>`;
      }).join('')}
      ${reimbs.length === 0 ? `<p class="sub" style="margin-top:8px">Scan a receipt or tap Talk to SplitSync to create a bill reimbursement request.</p>` : ''}
    </section>

    <section class="card">
      <div class="section-title">
        <h2>Recent activity</h2>
        <a class="section-link" href="#requests">Share links ${svg('arrow-right')}</a>
      </div>
      ${names.map(n => `<div class="row">
        <span class="person ${n.toLowerCase()}">${n[0]}</span>
        <div class="grow">
          <b>${n} · Move-in essentials</b><br>
          <small class="sub">${n === activeLamp() ? '$40.00 shared + $30.00 lamp' : '$40.00 kitchen essentials'}</small>
        </div>
        <b class="money">${money(shares()[n])}</b>
        ${pill(status(n))}
      </div>`).join('')}
    </section>
  </div>`;
}

// ---------- Activity & Request Detail ----------
function allActivityEntries() {
  const items = [];
  for (const r of activeReimbursements()) {
    const owed = r.recipients.filter(x => x.status !== 'Paid').reduce((s, x) => s + x.amountCents, 0);
    const aggStatus = r.recipients.every(x => x.status === 'Paid') ? 'Paid'
      : r.recipients.some(x => x.status === 'Processing') ? 'Processing'
      : r.recipients.some(x => x.status === 'Sent') ? 'Sent' : 'Created';
    items.push({
      kind: 'reimbursement',
      id: r.id,
      title: r.merchant || r.title,
      subtitle: `${r.recipients.length} recipient${r.recipients.length === 1 ? '' : 's'} · Photographed bill`,
      totalCents: r.recipients.reduce((s, x) => s + x.amountCents, 0),
      owedCents: owed,
      status: aggStatus,
      statuses: r.recipients.map(x => x.status),
      route: `request/${r.id}`,
    });
  }
  const paid = paidTotal();
  items.push({
    kind: 'merchant',
    id: 'SS-001',
    title: 'Move-in essentials · Demo Merchant',
    subtitle: `PayPal Sandbox merchant order (${paidCount()}/3 paid)`,
    totalCents: 15000,
    owedCents: Math.round((150 - paid) * 100),
    status: paidCount() === 3 ? 'Paid' : names.some(n => status(n) === 'Processing') ? 'Processing' : 'Awaiting payment',
    statuses: names.map(n => status(n)),
    route: 'dashboard',
  });
  return items;
}

function activityScreen() {
  const filters = ['All', 'Created', 'Sent', 'Awaiting payment', 'Processing', 'Paid'];
  const entries = allActivityEntries().filter(item =>
    activityFilter === 'All' || item.status === activityFilter || item.statuses.includes(activityFilter)
  );

  return `<div class="hub-top">
    <div>
      <h1>Activity</h1>
      <p class="screen-sub">Reimbursement requests, PayPal Sandbox orders, and monthly rent.</p>
    </div>
    ${backendMode ? `<button type="button" class="btn-ghost-sm" onclick="refreshWorkspace()">${svg('refresh')}<span>Refresh</span></button>` : ''}
  </div>

  <div class="chip-row" style="margin-bottom:16px" role="tablist" aria-label="Filter activity by status">
    ${filters.map(f => `<button type="button" class="chip ${activityFilter === f ? 'selected' : ''}" onclick="setActivityFilter('${f}')">${f}</button>`).join('')}
  </div>

  <div class="card">
    ${entries.length === 0 ? `<p>No requests match "${escapeHtml(activityFilter)}" yet.</p>` : entries.map(e => `
      <div class="row">
        <span class="icon-box">${svg(e.kind === 'merchant' ? 'store' : 'receipt')}</span>
        <div class="grow">
          <b>${escapeHtml(e.title)}</b><br>
          <small class="sub">${escapeHtml(e.subtitle)} · ${cents(e.owedCents)} still owed</small>
        </div>
        <div style="text-align:right">
          <div class="money" style="font-weight:800">${cents(e.totalCents)}</div>
          <div style="margin-top:4px">${pill(e.status)}</div>
        </div>
        <button type="button" class="btn btn-secondary" onclick="go('${escapeHtml(e.route)}')">Details</button>
      </div>
    `).join('')}
  </div>

  <div class="card" style="margin-top:16px">
    <div class="row">
      <span class="icon-box">${svg('calendar')}</span>
      <div class="grow">
        <b>December 2026 Rent Draft ${badge('Preview', 'preview')}</b><br>
        <small class="sub">$2,400.00 USD due Dec 1 · Equal 3-way rule ($800.00 each)</small>
      </div>
      <button type="button" class="btn btn-secondary" onclick="go('rent')">Open Rent</button>
    </div>
  </div>`;
}

function setActivityFilter(f) {
  activityFilter = f;
  render();
}

async function refreshWorkspace() {
  if (!backendMode) return;
  try {
    await loadWorkspaceState();
    toast('Synced with local backend.');
    render();
  } catch (e) {
    toast(e.message);
  }
}

function requestDetailScreen(reqId) {
  const req = activeReimbursements().find(r => r.id === reqId);
  if (!req) {
    return screenHeader('Request not found', '', 'activity')
      + `<div class="card narrow"><p>That reimbursement request does not exist in this ledger.</p><div class="actions"><button type="button" class="btn btn-primary" onclick="go('activity')">Back to Activity</button></div></div>`;
  }
  const owed = req.recipients.filter(r => r.status !== 'Paid').reduce((s, r) => s + r.amountCents, 0);
  const activeQr = req.recipients.find(r => r.id === selectedReqQr.recipientId) || req.recipients[0];
  if (activeQr) selectedReqQr = { reqId: req.id, recipientId: activeQr.id };

  return screenHeader(escapeHtml(req.merchant || req.title), `${req.id} · Still owed: ${cents(owed)}`, 'activity', badge('Receipt reimbursement', 'preview'))
    + `<div class="split-grid">
      <section class="card">
        <div class="section-title">
          <h2>Bill evidence</h2>
          <span class="sub">${escapeHtml(req.billDate || 'Undated')} · ${escapeHtml(req.currency || 'USD')}</span>
        </div>
        ${req.evidenceImageDataUrl ? `<img src="${escapeHtml(req.evidenceImageDataUrl)}" alt="Captured bill receipt evidence" class="crop-canvas" style="margin-bottom:14px">` : `<div class="callout">${svg('receipt')}<span>Manual / voice request without attached photo thumbnail.</span></div>`}
        ${(req.items || []).map(i => `<div class="row"><span>${escapeHtml(i.name)}</span><b class="money">${cents(i.amountCents)}</b></div>`).join('')}
        ${req.taxCents ? `<div class="row"><span>Tax</span><span class="money">${cents(req.taxCents)}</span></div>` : ''}
        ${req.tipCents ? `<div class="row"><span>Tip</span><span class="money">${cents(req.tipCents)}</span></div>` : ''}
        <div class="row total"><span>Bill total</span><span class="money">${cents(req.totalCents)} ${escapeHtml(req.currency || 'USD')}</span></div>
        <div class="callout">${svg('alert')}<span>Photographed receipt evidence creates a peer reimbursement reference. PayPal commercial Orders v2 checkout applies only to Demo Merchant purchases (<code>SS-001</code>).</span></div>
      </section>

      <section class="card">
        <div class="section-title">
          <h2>Recipients</h2>
          <span class="money" style="font-weight:800">${cents(req.recipients.reduce((s, r) => s + r.amountCents, 0))} requested</span>
        </div>
        ${req.recipients.map(r => {
          const shareUrl = r.shareUrl || (location.href.split('#')[0] + '#req/' + r.shareToken);
          return `<div class="draft-row-card ${r.deliveryStatus === 'Failed' ? 'needs-fix' : ''}">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
              <div style="display:flex;align-items:center;gap:10px">
                <span class="person ${r.name.toLowerCase()}">${escapeHtml(r.name[0])}</span>
                <div>
                  <b>${escapeHtml(r.name)}</b> · <b class="money">${cents(r.amountCents)} USD</b><br>
                  <small class="sub">Reason: ${escapeHtml(r.reason)}</small>
                </div>
              </div>
              <div style="display:flex;gap:6px;align-items:center">
                ${pill(r.status)}
                ${r.deliveryStatus === 'Failed' ? pill('Failed') : ''}
              </div>
            </div>
            ${r.deliveryMessage ? `<p class="sub" style="margin-top:8px;color:${r.deliveryStatus === 'Failed' ? 'var(--error)' : 'var(--muted)'}">${escapeHtml(r.deliveryMessage)}</p>` : ''}
            <div class="chip-row">
              <button type="button" class="btn-ghost-sm" onclick="copyReqLink('${escapeHtml(req.id)}','${escapeHtml(r.id)}')">${svg('copy')}<span>Copy link</span></button>
              <button type="button" class="btn-ghost-sm" onclick="showReqQr('${escapeHtml(req.id)}','${escapeHtml(r.id)}')">${svg('qr')}<span>Show QR</span></button>
              <button type="button" class="btn-ghost-sm" onclick="shareReqNative('${escapeHtml(req.id)}','${escapeHtml(r.id)}')">${svg('share')}<span>Share</span></button>
              ${r.status === 'Created' ? `<button type="button" class="btn-ghost-sm" onclick="markReqSent('${escapeHtml(req.id)}','${escapeHtml(r.id)}')">Mark Sent</button>` : ''}
              ${r.status !== 'Paid' ? `<button type="button" class="btn-ghost-sm" onclick="markReqPaid('${escapeHtml(req.id)}','${escapeHtml(r.id)}')">Mark Paid</button>` : ''}
              <a class="btn-ghost-sm" href="${escapeHtml(shareUrl)}">Open link ${svg('external')}</a>
            </div>
          </div>`;
        }).join('')}

        ${activeQr ? `<div class="card card-tint" style="margin-top:14px">
          <div class="qr-spotlight">
            <div class="qr-box" id="req-qr"></div>
            <div class="qr-meta">
              <h3>${escapeHtml(activeQr.name)} · <span class="money">${cents(activeQr.amountCents)} USD</span></h3>
              <p>${escapeHtml(activeQr.reason)}</p>
            </div>
          </div>
        </div>` : ''}
      </section>
    </div>`;
}

async function copyReqLink(reqId, rid) {
  const req = activeReimbursements().find(r => r.id === reqId);
  const rec = req?.recipients?.find(x => x.id === rid);
  if (!rec) return;
  const url = rec.shareUrl || (location.href.split('#')[0] + '#req/' + rec.shareToken);
  try { await navigator.clipboard.writeText(url); toast(`${rec.name}’s request link copied.`); }
  catch { prompt(`Copy ${rec.name}’s request link`, url); }
}

function showReqQr(reqId, rid) {
  selectedReqQr = { reqId, recipientId: rid };
  render();
}

async function shareReqNative(reqId, rid) {
  const req = activeReimbursements().find(r => r.id === reqId);
  const rec = req?.recipients?.find(x => x.id === rid);
  if (!rec) return;
  const url = rec.shareUrl || (location.href.split('#')[0] + '#req/' + rec.shareToken);
  if (navigator.share) {
    try {
      await navigator.share({ title: `SplitSync request from Leah`, text: `${cents(rec.amountCents)} for ${rec.reason}`, url });
      await markReqSent(reqId, rid);
      return;
    } catch {}
  }
  await copyReqLink(reqId, rid);
}

async function markReqSent(reqId, rid) {
  if (backendMode) {
    const res = await api(`/api/organizer/requests/${reqId}/deliver`, { action: 'mark_shared', recipientId: rid });
    reimbursementsList = reimbursementsList.map(r => r.id === reqId ? res.request : r);
  } else {
    const req = reimbursementsList.find(r => r.id === reqId);
    const rec = req?.recipients?.find(x => x.id === rid);
    if (rec) { rec.status = 'Sent'; rec.deliveryStatus = 'Sent'; rec.deliveryMessage = 'Shared manually.'; saveLocalReimbursements(); }
  }
  toast('Updated status to Sent.');
  render();
}

async function markReqPaid(reqId, rid) {
  if (backendMode) {
    const res = await api(`/api/organizer/requests/${reqId}/recipients/${rid}/status`, { status: 'Paid' });
    reimbursementsList = reimbursementsList.map(r => r.id === reqId ? res.request : r);
  } else {
    const req = reimbursementsList.find(r => r.id === reqId);
    const rec = req?.recipients?.find(x => x.id === rid);
    if (rec) { rec.status = 'Paid'; rec.receiptRef = 'LOCAL-REIMB'; saveLocalReimbursements(); }
  }
  toast('Marked as Paid.');
  render();
}

// ---------- Signature Flow 1: Scan Bill -> Crop/Retake -> Extract -> Mic Dictation -> Review & Chatterbox -> Confirm ----------
function createSampleReceiptDataUrl() {
  const fallback = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  if (typeof document.createElement !== 'function') return fallback;
  const c = document.createElement('canvas');
  c.width = 440; c.height = 560;
  const ctx = typeof c?.getContext === 'function' ? c.getContext('2d') : null;
  if (!ctx) return fallback;
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#DCE1E8'; ctx.lineWidth = 4; ctx.strokeRect(14, 14, c.width - 28, c.height - 28);
  ctx.fillStyle = '#242E49'; ctx.font = 'bold 28px sans-serif';
  ctx.fillText('OLIVE KITCHEN', 42, 74);
  ctx.fillStyle = '#5D6A85'; ctx.font = '18px sans-serif';
  ctx.fillText('Date: 2026-11-10   Currency: USD', 42, 112);
  ctx.fillText('Table 14  ·  Order #842', 42, 142);
  ctx.strokeStyle = '#DCE1E8'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(42, 168); ctx.lineTo(398, 168); ctx.stroke();
  const lines = [
    ['Pasta Dinner Bowl', '$20.00'],
    ['Craft Drinks (2)', '$15.00'],
    ['Shared Herb Flatbread', '$7.00'],
  ];
  let y = 216;
  ctx.fillStyle = '#242E49'; ctx.font = 'bold 20px sans-serif';
  for (const [k, v] of lines) {
    ctx.fillText(k, 42, y);
    ctx.fillText(v, 315, y);
    y += 50;
  }
  ctx.beginPath(); ctx.moveTo(42, y - 10); ctx.lineTo(398, y - 10); ctx.stroke();
  ctx.fillStyle = '#5D6A85'; ctx.font = '18px sans-serif';
  ctx.fillText('Tax', 42, y + 32); ctx.fillText('$0.00', 325, y + 32);
  ctx.fillText('Tip', 42, y + 68); ctx.fillText('$0.00', 325, y + 68);
  ctx.fillStyle = '#0A4EC4'; ctx.font = 'bold 26px sans-serif';
  ctx.fillText('TOTAL USD', 42, y + 124); ctx.fillText('$42.00', 300, y + 124);
  return c.toDataURL('image/png');
}

function scanBillScreen() {
  let frameInner = '';
  if (billCameraState === 'denied') {
    frameInner = `<div class="center"><div class="result-icon cancelled">${svg('receipt-camera')}</div><h2 style="color:#fff">Camera permission denied</h2><p style="color:#DCE1E8;margin-top:6px">Allow camera permission in your browser, upload a receipt file, or use the bundled sample receipt below.</p></div>`;
  } else if (billCameraState === 'unavailable') {
    frameInner = `<div class="center"><div class="result-icon processing">${svg('alert')}</div><h2 style="color:#fff">Camera unavailable</h2><p style="color:#DCE1E8;margin-top:6px">Upload a receipt image or load the bundled Olive Kitchen sample receipt.</p></div>`;
  } else if (billCameraState === 'scanning') {
    frameInner = `<span class="camera-badge">Live camera preview</span><video id="bill-cam-video" autoplay playsinline muted></video><div class="actions" style="width:100%"><button type="button" class="btn btn-primary full" onclick="captureBillPhoto()">${svg('receipt-camera')}<span>Capture bill photo</span></button></div>`;
  } else {
    frameInner = `<span class="camera-badge">Receipt capture</span><div class="center"><div class="icon-box" style="width:56px;height:56px;margin:0 auto 12px">${svg('receipt-camera')}</div><h2 style="color:#fff">Photograph a paper bill</h2><p style="color:#DCE1E8;margin-top:6px">Keep merchant, items, and total inside the frame, then crop &amp; extract.</p></div>`;
  }

  return stepHeader(1, 4, 'Scan Bill · Step 1', 'home')
    + screenHeader('Scan Bill', 'Capture or upload a personal receipt for reimbursement. Separate from Merchant QR.', 'home')
    + `<div class="split-grid">
      <div class="camera-frame">${frameInner}</div>
      <div class="card">
        <h2>Choose a receipt source</h2>
        <p style="margin-top:6px">Use camera photo, upload an image file, or open the bundled sample receipt without camera hardware.</p>
        <div class="actions">
          <button type="button" class="btn btn-primary" onclick="useBundledSampleReceipt()">${svg('receipt')}<span>Use bundled sample receipt</span></button>
          <button type="button" class="btn btn-secondary" onclick="${billCameraState === 'scanning' ? 'stopBillCamera()' : 'startBillCamera()'}">${svg('receipt-camera')}<span>${billCameraState === 'scanning' ? 'Stop camera' : 'Open camera'}</span></button>
        </div>
        <div class="field-group">
          <label for="bill-upload">Or upload receipt photo (PNG / JPEG / WebP)</label>
          <input id="bill-upload" type="file" accept="image/png,image/jpeg,image/webp" onchange="handleBillUpload(this)">
        </div>
        ${billCameraMessage ? `<div class="callout warning" role="alert">${svg('alert')}<span>${escapeHtml(billCameraMessage)}</span></div>` : ''}
        <div class="chip-row" style="margin-top:12px">
          <button type="button" class="btn-ghost-sm" onclick="simulateBillCam('denied')">Test camera denied</button>
          <button type="button" class="btn-ghost-sm" onclick="simulateBillCam('unavailable')">Test camera unavailable</button>
        </div>
      </div>
    </div>`;
}

async function startBillCamera() {
  billCameraState = 'scanning'; billCameraMessage = ''; render();
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('No camera API'), { name: 'NotFoundError' });
    billStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const v = document.querySelector('#bill-cam-video');
    if (v) v.srcObject = billStream;
  } catch (e) {
    const denied = e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError';
    billCameraState = denied ? 'denied' : 'unavailable';
    billCameraMessage = denied
      ? 'Camera permission was denied. Upload a photo or use the bundled sample receipt.'
      : 'Camera hardware unavailable here. Upload a photo or use the bundled sample receipt.';
    render();
  }
}

function stopBillCamera() {
  stopStreams();
  billCameraState = 'ready';
  render();
}

function simulateBillCam(state) {
  stopStreams();
  billCameraState = state;
  billCameraMessage = state === 'denied'
    ? 'Camera permission denied. Use Upload or Use bundled sample receipt.'
    : 'Camera unavailable on this device. Use Upload or Use bundled sample receipt.';
  render();
}

function captureBillPhoto() {
  const v = document.querySelector('#bill-cam-video');
  if (!v || !v.videoWidth) { toast('Waiting for camera frame…'); return; }
  const c = document.createElement('canvas');
  c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  billRawImage = c.toDataURL('image/jpeg', 0.88);
  billCroppedImage = billRawImage;
  stopStreams();
  go('bill-crop');
}

function handleBillUpload(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    billRawImage = String(reader.result || '');
    billCropTopPct = 0; billCropBottomPct = 0;
    billCroppedImage = billRawImage;
    go('bill-crop');
  };
  reader.readAsDataURL(file);
}

function useBundledSampleReceipt() {
  stopStreams();
  billRawImage = createSampleReceiptDataUrl();
  billCropTopPct = 3; billCropBottomPct = 3;
  billCroppedImage = billRawImage;
  billDraft = {
    merchant: 'Olive Kitchen', date: '2026-11-10', currency: 'USD',
    items: [
      { name: 'Pasta Dinner Bowl', amountCents: 2000 },
      { name: 'Craft Drinks (2)', amountCents: 1500 },
      { name: 'Shared Herb Flatbread', amountCents: 700 },
    ],
    taxCents: 0, tipCents: 0, totalCents: 4200, unreadableFields: [], totalMismatch: false, modelUsed: '',
  };
  go('bill-crop');
}

function billCropScreen() {
  if (!billRawImage) billRawImage = createSampleReceiptDataUrl();
  if (!billCroppedImage) billCroppedImage = billRawImage;
  return stepHeader(2, 4, 'Crop & Extract · Step 2', 'scan-bill')
    + screenHeader('Crop or retake bill', 'Trim extra margins before extracting merchant and line items.', 'scan-bill')
    + `<div class="split-grid">
      <div class="card">
        <img id="bill-crop-preview" class="crop-canvas" src="${escapeHtml(billCroppedImage)}" alt="Cropped bill receipt preview">
      </div>
      <div class="card">
        <h2>Adjust crop frame</h2>
        <div class="field-group">
          <label for="crop-top">Top trim (${billCropTopPct}%)</label>
          <input id="crop-top" type="range" min="0" max="30" value="${billCropTopPct}" oninput="updateCropSliders(this.value, billCropBottomPct)">
        </div>
        <div class="field-group">
          <label for="crop-bottom">Bottom trim (${billCropBottomPct}%)</label>
          <input id="crop-bottom" type="range" min="0" max="30" value="${billCropBottomPct}" oninput="updateCropSliders(billCropTopPct, this.value)">
        </div>
        <div class="actions">
          <button type="button" class="btn btn-secondary" onclick="go('scan-bill')">${svg('undo')}<span>Retake / change photo</span></button>
          <button type="button" class="btn btn-primary" onclick="extractBillDetails()">${svg('sparkles')}<span>Extract bill details</span></button>
        </div>
      </div>
    </div>`;
}

function updateCropSliders(topVal, bottomVal) {
  billCropTopPct = Number(topVal); billCropBottomPct = Number(bottomVal);
  if (typeof Image === 'undefined') return;
  const img = new Image();
  img.onload = () => {
    const sy = Math.round(img.height * (billCropTopPct / 100));
    const eh = Math.round(img.height * (1 - (billCropTopPct + billCropBottomPct) / 100));
    const h = Math.max(40, eh);
    const c = document.createElement('canvas');
    c.width = img.width; c.height = h;
    c.getContext('2d').drawImage(img, 0, sy, img.width, h, 0, 0, img.width, h);
    billCroppedImage = c.toDataURL('image/png');
    const preview = document.querySelector('#bill-crop-preview');
    if (preview) preview.src = billCroppedImage;
  };
  img.src = billRawImage;
}

async function extractBillDetails() {
  billExtractState = 'loading'; billExtractError = '';
  go('bill-review');
  await render();
  if (!backendMode) {
    billExtractState = 'ready';
    recalcBillMath();
    render();
    return;
  }
  try {
    const res = await api('/api/organizer/extract-bill', { imageDataUrl: billCroppedImage || billRawImage });
    billDraft = {
      merchant: res.merchant || '',
      date: res.date || '',
      currency: res.currency || 'USD',
      items: Array.isArray(res.items) && res.items.length ? res.items : [{ name: 'Receipt item', amountCents: res.totalCents || 0 }],
      taxCents: res.taxCents || 0,
      tipCents: res.tipCents || 0,
      totalCents: res.totalCents || 0,
      unreadableFields: res.unreadableFields || [],
      totalMismatch: Boolean(res.totalMismatch),
      modelUsed: res.modelUsed || '',
    };
    billExtractState = 'ready';
    recalcBillMath();
    await render();
  } catch (e) {
    billExtractState = 'error';
    billExtractError = e.message;
    recalcBillMath();
    await render();
  }
}

function recalcBillMath() {
  const sum = (billDraft.items || []).reduce((s, i) => s + (i.amountCents || 0), 0) + (billDraft.taxCents || 0) + (billDraft.tipCents || 0);
  billDraft.computedTotalCents = sum;
  billDraft.totalMismatch = billDraft.totalCents > 0 && sum > 0 && Math.abs(billDraft.totalCents - sum) > 1;
}

function micBlockHtml() {
  return `<div class="mic-panel">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div>
        <b>Voice split instruction</b>
        <p class="sub">${micState === 'listening' ? 'Listening… tap Stop when done.' : micState === 'transcribing' ? 'Transcribing audio clip…' : 'Tap mic &amp; say who owes what (e.g. Maya $20 for dinner, Arun $15 for drinks).'}</p>
      </div>
      <button type="button" class="mic-btn ${micState === 'listening' ? 'recording' : ''}" onclick="${micState === 'listening' ? 'stopVoiceDictation()' : 'startVoiceDictation()'}" ${micState === 'transcribing' ? 'disabled' : ''}>
        ${svg('mic')}
        <span>${micState === 'listening' ? 'Stop listening' : micState === 'transcribing' ? 'Transcribing…' : 'Tap mic to speak'}</span>
      </button>
    </div>
    ${micError ? `<div class="callout warning" role="alert">${svg('alert')}<span>${escapeHtml(micError)}</span></div>` : ''}
    <div class="field-group" style="margin-top:10px">
      <label for="voice-transcript">Transcript / split instruction</label>
      <textarea id="voice-transcript" rows="2" oninput="transcriptDraft = this.value" placeholder="Ask Maya for twenty dollars for dinner and Arun for fifteen for drinks.">${escapeHtml(transcriptDraft)}</textarea>
    </div>
    <div class="chip-row">
      <button type="button" class="chip" onclick="useSampleTranscript('Ask Maya for twenty dollars for dinner and Arun for fifteen for drinks.')">Sample: Maya $20 dinner + Arun $15 drinks</button>
      <button type="button" class="chip" onclick="useSampleTranscript('Ask Alex for ten dollars for coffee')">Test clarify (unknown contact)</button>
    </div>
    <div class="actions">
      <button type="button" class="btn btn-primary full" onclick="parseVoiceRequest()">${svg('sparkles')}<span>Review spoken request</span>${svg('arrow-right')}</button>
    </div>
  </div>`;
}

function billReviewScreen() {
  const sum = (billDraft.items || []).reduce((s, i) => s + (i.amountCents || 0), 0) + (billDraft.taxCents || 0) + (billDraft.tipCents || 0);
  const mismatch = billDraft.totalCents > 0 && sum > 0 && Math.abs(billDraft.totalCents - sum) > 1;
  const unread = (billDraft.unreadableFields || []).filter(f => {
    if (f === 'merchant') return !billDraft.merchant || billDraft.merchant === 'Unreadable merchant';
    if (f === 'date') return !billDraft.date;
    if (f === 'total') return !billDraft.totalCents;
    return false;
  });

  return stepHeader(3, 4, 'Review Bill & Dictate · Step 3', 'bill-crop')
    + screenHeader('Extracted bill & voice split', billDraft.modelUsed ? `Extracted with ${billDraft.modelUsed}` : 'Editable receipt breakdown & voice mic', 'bill-crop')
    + `<div class="split-grid">
      <section class="card">
        <h2>Captured receipt</h2>
        ${billCroppedImage ? `<img src="${escapeHtml(billCroppedImage)}" alt="Cropped bill receipt" class="crop-canvas" style="margin-top:12px">` : ''}
        ${billExtractState === 'loading' ? `<div class="callout" style="margin-top:14px">${svg('sparkles')}<span>Extracting merchant, items, tax, and total from your photo…</span></div><div class="skeleton" style="margin-top:10px;width:85%"></div><div class="skeleton" style="width:65%"></div>` : ''}
        ${billExtractState === 'error' ? `<div class="callout warning" role="alert">${svg('alert')}<div><b>Extraction provider unavailable</b><br>${escapeHtml(billExtractError)} Edit fields manually on the right.</div></div>` : ''}
      </section>

      <section class="card">
        <div class="section-title">
          <h2>Editable bill details</h2>
          ${unread.length || mismatch ? pill('Check flagged fields') : pill('Ready')}
        </div>
        ${unread.length ? `<div class="callout warning">${svg('alert')}<span>Flagged unreadable fields: <b>${escapeHtml(unread.join(', '))}</b>. Review before sending.</span></div>` : ''}
        ${mismatch ? `<div class="callout error">${svg('alert')}<div class="grow"><b>Total mismatch</b>: Items + tax + tip = <b class="money">${cents(sum)}</b>, but bill total shows <b class="money">${cents(billDraft.totalCents)}</b>. <button type="button" class="btn-ghost-sm" style="margin-left:6px" onclick="fixBillTotal(${sum})">Match ${cents(sum)}</button></div></div>` : ''}

        <div class="split-grid" style="margin-top:8px;gap:10px">
          <div class="field-group" style="margin-top:0">
            <label for="bill-merchant">Merchant</label>
            <input id="bill-merchant" value="${escapeHtml(billDraft.merchant)}" oninput="billDraft.merchant = this.value">
          </div>
          <div class="field-group" style="margin-top:0">
            <label for="bill-date">Date</label>
            <input id="bill-date" value="${escapeHtml(billDraft.date)}" placeholder="YYYY-MM-DD" oninput="billDraft.date = this.value">
          </div>
        </div>

        <div style="margin-top:12px">
          <label for="bill-item-name-0" style="font-size:13px;font-weight:800;display:block;margin-bottom:6px">Line items</label>
          ${(billDraft.items || []).map((item, idx) => `<div style="display:flex;gap:8px;margin-bottom:8px">
            <input id="bill-item-name-${idx}" name="bill-item-name-${idx}" aria-label="Line item ${idx + 1} name" style="flex:2;min-height:42px;padding:8px 12px;border:1.5px solid var(--line);border-radius:10px" value="${escapeHtml(item.name)}" oninput="billDraft.items[${idx}].name = this.value">
            <input id="bill-item-amt-${idx}" name="bill-item-amt-${idx}" aria-label="Line item ${idx + 1} USD amount" style="flex:1;min-height:42px;padding:8px 12px;border:1.5px solid var(--line);border-radius:10px" type="number" step="0.01" value="${(item.amountCents / 100).toFixed(2)}" oninput="updateBillItemAmt(${idx}, this.value)">
            <button type="button" class="btn-ghost-sm" onclick="removeBillItem(${idx})" aria-label="Remove item ${idx + 1}">${svg('trash')}</button>
          </div>`).join('')}
          <button type="button" class="btn-ghost-sm" onclick="addBillItem()">${svg('plus')}<span>Add line item</span></button>
        </div>

        <div class="split-grid" style="margin-top:10px;gap:10px">
          <div class="field-group" style="margin-top:0">
            <label for="bill-tax">Tax (${escapeHtml(billDraft.currency)})</label>
            <input id="bill-tax" type="number" step="0.01" value="${((billDraft.taxCents || 0) / 100).toFixed(2)}" oninput="billDraft.taxCents = Math.round((Number(this.value)||0)*100); renderBillFooterOnly()">
          </div>
          <div class="field-group" style="margin-top:0">
            <label for="bill-tip">Tip (${escapeHtml(billDraft.currency)})</label>
            <input id="bill-tip" type="number" step="0.01" value="${((billDraft.tipCents || 0) / 100).toFixed(2)}" oninput="billDraft.tipCents = Math.round((Number(this.value)||0)*100); renderBillFooterOnly()">
          </div>
        </div>
        <div class="field-group">
          <label for="bill-total">Total (${escapeHtml(billDraft.currency)})</label>
          <input id="bill-total" type="number" step="0.01" value="${((billDraft.totalCents || 0) / 100).toFixed(2)}" oninput="billDraft.totalCents = Math.round((Number(this.value)||0)*100)">
        </div>

        ${micBlockHtml()}
      </section>
    </div>`;
}

function updateBillItemAmt(idx, val) {
  billDraft.items[idx].amountCents = Math.max(0, Math.round((Number(val) || 0) * 100));
}
function removeBillItem(idx) {
  billDraft.items.splice(idx, 1); recalcBillMath(); render();
}
function addBillItem() {
  billDraft.items.push({ name: 'New item', amountCents: 0 }); render();
}
function fixBillTotal(sum) {
  billDraft.totalCents = sum; billDraft.totalMismatch = false; render();
}
function renderBillFooterOnly() { recalcBillMath(); }

// ---------- Speech-to-Text + Request Composer ----------
function openVoiceRequestComposer() {
  billDraft = { merchant: 'Shared request', date: '2026-11-10', currency: 'USD', items: [], taxCents: 0, tipCents: 0, totalCents: 0, unreadableFields: [], totalMismatch: false, modelUsed: '' };
  billCroppedImage = '';
  go('talk');
}

function talkScreen() {
  return screenHeader('Talk to SplitSync', 'Speak or type a request like "Ask Maya for twenty dollars for dinner and Arun for fifteen for drinks."', 'home')
    + `<div class="narrow card">
      ${micBlockHtml()}
      <div class="callout">${svg('key')}<span>Contacts resolved automatically: ${contactsList.map(c => escapeHtml(c.name)).join(', ')}.</span></div>
    </div>`;
}

function useSampleTranscript(text) {
  transcriptDraft = text;
  const el = document.querySelector('#voice-transcript');
  if (el) el.value = text;
}

async function startVoiceDictation() {
  micError = '';
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    try {
      micState = 'listening'; render();
      speechRecognition = new SR();
      speechRecognition.lang = 'en-US';
      speechRecognition.interimResults = true;
      speechRecognition.onresult = e => {
        transcriptDraft = [...e.results].map(r => r[0].transcript).join(' ').trim();
        const el = document.querySelector('#voice-transcript');
        if (el) el.value = transcriptDraft;
      };
      speechRecognition.onerror = ev => {
        micState = ev.error === 'not-allowed' ? 'denied' : 'unavailable';
        micError = ev.error === 'not-allowed'
          ? 'Microphone permission denied. Allow mic access or type / select a sample instruction below.'
          : 'Live speech recognition unavailable here. Edit your transcript directly below.';
        render();
      };
      speechRecognition.onend = () => {
        if (micState === 'listening') { micState = 'idle'; render(); }
      };
      speechRecognition.start();
      return;
    } catch {}
  }

  // Fallback to MediaRecorder + backend Faster-Whisper STT
  try {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw Object.assign(new Error('Mic unavailable'), { name: 'NotFoundError' });
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micChunks = [];
    micRecorder = new MediaRecorder(stream);
    micRecorder.ondataavailable = e => { if (e.data.size) micChunks.push(e.data); };
    micRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      micState = 'transcribing'; render();
      try {
        const blob = new Blob(micChunks, { type: micRecorder.mimeType || 'audio/webm' });
        const b64 = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result || '').split(',')[1] || '');
          r.onerror = reject;
          r.readAsDataURL(blob);
        });
        const res = await api('/api/organizer/transcribe', { audioBase64: b64, mimeType: blob.type });
        transcriptDraft = res.transcript || '';
        micState = 'idle';
        render();
      } catch (e) {
        micState = 'unavailable';
        micError = e.message;
        render();
      }
    };
    micRecorder.start();
    micState = 'listening';
    render();
  } catch (e) {
    const denied = e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError';
    micState = denied ? 'denied' : 'unavailable';
    micError = denied
      ? 'Microphone permission denied. Type your split instruction or tap a sample below.'
      : 'Microphone hardware is unavailable in this browser. Type your instruction below.';
    render();
  }
}

function stopVoiceDictation() {
  try { speechRecognition?.stop(); } catch {}
  try { if (micRecorder && micRecorder.state === 'recording') micRecorder.stop(); else micState = 'idle'; } catch { micState = 'idle'; }
  render();
}

function parseStaticTranscript(text) {
  const raw = String(text || '').trim();
  const segments = raw.split(/\band\b|,|;/i);
  const wordNum = { ten: 10, fifteen: 15, twenty: 20, twentyfive: 25, thirty: 30, forty: 40, fifty: 50 };
  const rows = [];
  for (const seg of segments) {
    const mAmt = seg.match(/\$?(\d+(?:\.\d{1,2})?)|\b(ten|fifteen|twenty|thirty|forty|fifty)\b/i);
    if (!mAmt) continue;
    const val = mAmt[1] ? Math.round(Number(mAmt[1]) * 100) : (wordNum[mAmt[2].toLowerCase()] || 0) * 100;
    const matched = contactsList.find(c => new RegExp('\\b' + c.name.split(' ')[0] + '\\b', 'i').test(seg));
    const wordAfterAsk = seg.match(/\b(?:ask|for|from)\s+([A-Z][a-z]+)\b/);
    const rawName = matched ? matched.name : (wordAfterAsk?.[1] || '');
    const reasonM = seg.match(/\bfor\s+([a-z\s]{2,40})$/i);
    rows.push({
      id: `draft-${rows.length + 1}`,
      name: rawName || 'Unknown contact',
      contactId: matched?.id || null,
      known: Boolean(matched),
      unknownContact: Boolean(rawName && !matched),
      ambiguous: !matched,
      amountCents: val,
      currency: 'USD',
      reason: reasonM ? reasonM[1].trim() : 'Shared expense',
    });
  }
  const alloc = rows.reduce((s, r) => s + r.amountCents, 0);
  return {
    recipients: rows,
    allocatedCents: alloc,
    billTotalCents: billDraft.totalCents || 0,
    unallocatedCents: (billDraft.totalCents || 0) > 0 ? billDraft.totalCents - alloc : 0,
    needsClarification: rows.length === 0 || rows.some(r => r.ambiguous),
    clarificationPrompt: rows.some(r => !r.known) ? 'Confirm unknown or ambiguous recipient names against your contacts below.' : '',
  };
}

async function parseVoiceRequest() {
  const ta = document.querySelector('#voice-transcript');
  if (ta) transcriptDraft = ta.value.trim();
  if (!transcriptDraft) transcriptDraft = 'Ask Maya for twenty dollars for dinner and Arun for fifteen for drinks.';

  requestParseState = 'loading'; requestParseError = '';
  reqTtsState = 'idle'; reqTtsAudioSrc = '';
  go('request-review');
  await render();

  if (!backendMode) {
    const local = parseStaticTranscript(transcriptDraft);
    draftRecipients = local.recipients;
    clarificationMessage = local.clarificationPrompt;
    requestParseState = local.needsClarification ? 'clarify' : 'ready';
    requestModelUsed = 'Static parser';
    render();
    return;
  }

  try {
    const res = await api('/api/organizer/parse-request', { transcript: transcriptDraft, bill: billDraft });
    draftRecipients = res.recipients || [];
    clarificationMessage = res.clarificationPrompt || '';
    requestModelUsed = res.modelUsed || '';
    requestParseState = res.needsClarification ? 'clarify' : 'ready';
    await render();
  } catch (e) {
    requestParseState = 'error';
    requestParseError = e.message;
    if (!draftRecipients.length) {
      draftRecipients = [{ id: 'draft-1', name: 'Maya', contactId: 'maya', known: true, ambiguous: false, amountCents: 2000, currency: 'USD', reason: 'dinner' }];
    }
    await render();
  }
}

function confirmationPhrase() {
  if (!draftRecipients.length) return 'Add at least one recipient to review and send.';
  const parts = draftRecipients.map(r => `${money(r.amountCents / 100).replace('.00', '')} from ${r.name} for ${r.reason}`);
  const joined = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `I’ll request ${joined}. Review and send?`;
}

async function readConfirmationAloud() {
  reqTtsPhrase = confirmationPhrase();
  reqTtsState = 'loading'; reqTtsError = '';
  render();
  if (!backendMode) {
    reqTtsState = 'unavailable';
    reqTtsError = 'Chatterbox voice synthesis requires the connected backend with NVIDIA_API_KEY.';
    render();
    return;
  }
  try {
    const res = await api('/api/organizer/read-text', { text: reqTtsPhrase });
    reqTtsAudioSrc = 'data:audio/wav;base64,' + res.audio;
    reqTtsState = 'ready';
    await render();
    const audio = document.querySelector('#req-audio');
    if (audio) await audio.play().catch(() => {});
  } catch (e) {
    reqTtsState = 'unavailable';
    reqTtsError = e.message;
    render();
  }
}

function requestReviewScreen() {
  const allocated = draftRecipients.reduce((s, r) => s + (r.amountCents || 0), 0);
  const billTotal = billDraft.totalCents || 0;
  const unallocated = billTotal > 0 ? billTotal - allocated : 0;
  const phrase = confirmationPhrase();

  return stepHeader(4, 4, 'Review & Confirm · Step 4', billCroppedImage ? 'bill-review' : 'talk')
    + screenHeader('Review & confirm requests', requestModelUsed ? `Parsed with ${requestModelUsed}` : 'Verify recipients before creating requests', billCroppedImage ? 'bill-review' : 'talk')
    + `<div class="split-grid">
      <section class="card">
        <h2>Dictated transcript</h2>
        <div class="field-group" style="margin-top:8px">
          <label for="voice-transcript" class="sr-only">Split instruction transcript</label>
          <textarea id="voice-transcript" name="voice-transcript" rows="3" oninput="transcriptDraft = this.value">${escapeHtml(transcriptDraft)}</textarea>
        </div>
        <div class="actions">
          <button type="button" class="btn btn-secondary" onclick="parseVoiceRequest()">${svg('refresh')}<span>Re-parse instruction</span></button>
          <button type="button" class="btn btn-secondary" onclick="addDraftRecipient()">${svg('plus')}<span>Add recipient</span></button>
        </div>
        ${billTotal > 0 ? `<div class="rule"></div>
          <div class="row"><span>Attached bill (${escapeHtml(billDraft.merchant)})</span><b class="money">${cents(billTotal)}</b></div>
          <div class="row"><span>Allocated across requests</span><b class="money">${cents(allocated)}</b></div>
          <div class="row total"><span>Unallocated balance</span><span class="money" style="color:${unallocated === 0 ? 'var(--teal-ink)' : 'var(--amber)'}">${cents(unallocated)} USD</span></div>` : ''}
      </section>

      <section class="card">
        <div class="section-title">
          <h2>Request draft (${draftRecipients.length})</h2>
          ${badge(backendMode ? 'Server validated' : 'Static draft', backendMode ? '' : 'preview')}
        </div>
        ${requestParseState === 'loading' ? `<div class="callout">${svg('sparkles')}<span>Parsing recipient names, amounts, and reasons…</span></div><div class="skeleton" style="margin-top:10px;width:80%"></div>` : ''}
        ${requestParseState === 'error' ? `<div class="callout warning" role="alert">${svg('alert')}<span>${escapeHtml(requestParseError)} Edit rows manually below.</span></div>` : ''}
        ${clarificationMessage ? `<div class="callout warning" role="alert">${svg('alert')}<div><b>Clarification needed</b><br>${escapeHtml(clarificationMessage)}</div></div>` : ''}

        ${draftRecipients.map((r, idx) => `<div class="draft-row-card ${r.ambiguous || !r.known ? 'needs-fix' : ''}">
          <div class="draft-grid">
            <div class="field-group" style="margin-top:0">
              <label for="draft-rec-name-${idx}">Recipient</label>
              <input id="draft-rec-name-${idx}" name="draft-rec-name-${idx}" value="${escapeHtml(r.name)}" oninput="updateDraftRow(${idx}, 'name', this.value)">
            </div>
            <div class="field-group" style="margin-top:0">
              <label for="draft-rec-amt-${idx}">USD</label>
              <input id="draft-rec-amt-${idx}" name="draft-rec-amt-${idx}" type="number" step="0.01" value="${(r.amountCents / 100).toFixed(2)}" oninput="updateDraftRow(${idx}, 'amount', this.value)">
            </div>
            <div class="field-group" style="margin-top:0">
              <label for="draft-rec-reason-${idx}">Reason</label>
              <input id="draft-rec-reason-${idx}" name="draft-rec-reason-${idx}" value="${escapeHtml(r.reason)}" oninput="updateDraftRow(${idx}, 'reason', this.value)">
            </div>
            <button type="button" class="btn-ghost-sm" style="height:46px" onclick="removeDraftRecipient(${idx})" aria-label="Remove">${svg('trash')}</button>
          </div>
          ${!r.known ? `<div class="chip-row" style="margin-top:8px"><small class="sub">Pick known contact:</small>${contactsList.map(c => `<button type="button" class="chip" onclick="resolveRowContact(${idx}, '${escapeHtml(c.id)}', '${escapeHtml(c.name)}')">${escapeHtml(c.name)}</button>`).join('')}</div>` : ''}
        </div>`).join('')}

        <div class="tts-panel" aria-live="polite">
          <div class="tts-row">
            <div class="grow">
              <b>Chatterbox voice reply</b>
              <p class="sub" style="margin-top:2px">“${escapeHtml(phrase)}”</p>
            </div>
            <button type="button" class="btn btn-secondary" onclick="readConfirmationAloud()" ${reqTtsState === 'loading' ? 'disabled' : ''}>
              ${svg('volume')}<span>${reqTtsState === 'loading' ? 'Speaking…' : reqTtsState === 'unavailable' ? 'Retry Chatterbox' : 'Hear reply'}</span>
            </button>
          </div>
          ${reqTtsState === 'unavailable' ? `<div class="callout warning" style="margin-top:10px">${svg('alert')}<span>${escapeHtml(reqTtsError)}</span></div>` : ''}
          ${reqTtsState === 'ready' && reqTtsAudioSrc ? `<audio id="req-audio" controls src="${reqTtsAudioSrc}"></audio>` : ''}
        </div>

        <div class="field-group">
          <label for="delivery-channel">Delivery channel on confirm</label>
          <select id="delivery-channel" onchange="selectedDeliveryChannel = this.value">
            <option value="link" ${selectedDeliveryChannel === 'link' ? 'selected' : ''}>Private link &amp; QR (ready immediately)</option>
            <option value="email" ${selectedDeliveryChannel === 'email' ? 'selected' : ''}>Email gateway (${providers.emailConfigured ? 'configured' : 'not configured — stays Created'})</option>
            <option value="sms" ${selectedDeliveryChannel === 'sms' ? 'selected' : ''}>SMS gateway (${providers.smsConfigured ? 'configured' : 'not configured — stays Created'})</option>
          </select>
        </div>

        <div class="actions">
          <button type="button" class="btn btn-primary full" onclick="confirmCreateRequests()" ${requestCreateBusy ? 'disabled' : ''}>
            <span>${requestCreateBusy ? 'Creating requests…' : 'Confirm & create requests'}</span>${svg('arrow-right')}
          </button>
        </div>
      </section>
    </div>`;
}

function updateDraftRow(idx, field, val) {
  const r = draftRecipients[idx]; if (!r) return;
  if (field === 'amount') r.amountCents = Math.max(0, Math.round((Number(val) || 0) * 100));
  else if (field === 'name') {
    r.name = val;
    const match = contactsList.find(c => c.name.toLowerCase() === val.trim().toLowerCase());
    r.known = Boolean(match); r.contactId = match?.id || null; r.ambiguous = !match;
  } else r[field] = val;
}
function resolveRowContact(idx, id, name) {
  draftRecipients[idx] = { ...draftRecipients[idx], name, contactId: id, known: true, unknownContact: false, ambiguous: false };
  clarificationMessage = draftRecipients.some(r => !r.known) ? clarificationMessage : '';
  render();
}
function addDraftRecipient() {
  draftRecipients.push({ id: `draft-${draftRecipients.length + 1}`, name: 'Maya', contactId: 'maya', known: true, ambiguous: false, amountCents: 1000, currency: 'USD', reason: 'Shared expense' });
  render();
}
function removeDraftRecipient(idx) {
  draftRecipients.splice(idx, 1); render();
}

async function confirmCreateRequests() {
  if (!draftRecipients.length || draftRecipients.some(r => !r.name.trim() || r.amountCents <= 0)) {
    toast('Every recipient row needs a name and positive USD amount.');
    return;
  }
  requestCreateBusy = true; render();
  const payload = {
    title: billDraft.merchant || 'Shared expense request',
    merchant: billDraft.merchant || 'Shared request',
    billDate: billDraft.date || '2026-11-10',
    currency: billDraft.currency || 'USD',
    items: billDraft.items || [],
    taxCents: billDraft.taxCents || 0,
    tipCents: billDraft.tipCents || 0,
    totalCents: billDraft.totalCents || draftRecipients.reduce((s, r) => s + r.amountCents, 0),
    evidenceImageDataUrl: billCroppedImage || '',
    transcript: transcriptDraft,
    channel: selectedDeliveryChannel,
    recipients: draftRecipients.map(r => ({ name: r.name.trim(), contactId: r.contactId, amountCents: r.amountCents, currency: r.currency || 'USD', reason: r.reason || 'Shared expense' })),
  };

  if (!backendMode) {
    const id = 'REQ-DEMO' + (reimbursementsList.length + 1);
    const failed = selectedDeliveryChannel !== 'link';
    const record = {
      id,
      createdAt: new Date().toISOString(),
      ...payload,
      recipients: payload.recipients.map((r, i) => ({
        id: `REC-${i + 1}`, ...r, shareToken: 'demo-' + id.toLowerCase() + '-' + (i + 1),
        status: 'Created', deliveryStatus: failed ? 'Failed' : 'Created',
        deliveryMessage: failed ? `${selectedDeliveryChannel.toUpperCase()} gateway not configured. Use Copy link, Show QR, or Share.` : 'Ready to share via link or QR.',
      })),
    };
    reimbursementsList.unshift(record);
    saveLocalReimbursements();
    requestCreateBusy = false;
    go('request/' + record.id);
    return;
  }

  try {
    const res = await api('/api/organizer/requests', payload);
    reimbursementsList = [res.request, ...reimbursementsList.filter(r => r.id !== res.request.id)];
    requestCreateBusy = false;
    const anyFailed = res.deliveryOutcomes?.some(o => !o.ok);
    toast(anyFailed ? 'Requests created. External delivery not configured — use Copy link or Show QR.' : 'Requests created.');
    go('request/' + res.request.id);
    await render();
  } catch (e) {
    requestCreateBusy = false;
    toast(e.message);
    render();
  }
}

// ---------- Existing Merchant QR (Scan & Pay) & $150 Move-in Essentials Flow ----------
function purchaseHeader() {
  return `<div style="display:flex;align-items:center;gap:12px">
    <div class="icon-box">${svg('store')}</div>
    <div>
      <h3>Move-in essentials</h3>
      <small class="sub">Demo Merchant · Purchase SS-001</small>
    </div>
  </div>`;
}

function receiptCard() {
  return `<div class="card">
    <div class="section-title"><h2>Original bill</h2>${badge('USD')}</div>
    ${purchaseHeader()}
    <div class="rule"></div>
    <div class="row"><div class="grow"><b>Shared kitchen essentials</b><br><small class="sub">Split 3 ways ($40.00 each)</small></div><b class="money">$120.00</b></div>
    <div class="row"><div class="grow"><b>Desk lamp</b><br><small class="sub">Assigned to ${escapeHtml(activeLamp())}</small></div><b class="money">$30.00</b></div>
    <div class="row total"><span>Total</span><span class="money">$150.00 USD</span></div>
    <div class="callout">${svg('receipt')}<span>Fixed merchant demo purchase verified for PayPal Sandbox Orders v2 checkout.</span></div>
  </div>`;
}

function scanQrScreen(forceError = false) {
  const effective = forceError ? 'denied' : scannerState;
  let camera = '';
  if (effective === 'denied') {
    camera = `<div class="center"><div class="result-icon cancelled">${svg('qr')}</div><h2 style="color:#fff">Camera permission denied</h2><p style="color:#DCE1E8;margin-top:6px">Allow camera permission or open the demo purchase below.</p></div>`;
  } else if (effective === 'unavailable') {
    camera = `<div class="center"><div class="result-icon processing">${svg('alert')}</div><h2 style="color:#fff">Camera unavailable</h2><p style="color:#DCE1E8;margin-top:6px">Open the demo purchase or paste #purchase/SS-001.</p></div>`;
  } else if (effective === 'scanning') {
    camera = `<span class="camera-badge">Live camera preview (simulated QR decode)</span><video id="cam" autoplay playsinline muted></video>`;
  } else {
    camera = `<span class="camera-badge">Merchant QR scanner</span><div class="scan-target"><div class="scan-merchant-slip"><b>Demo Merchant</b><small class="sub" style="display:block;margin-bottom:8px">Move-in essentials · SS-001</small><div class="icon-box" style="margin:0 auto">${svg('qr')}</div></div></div>`;
  }

  return stepHeader(1, 4, 'Scan & Pay · Step 1', 'home')
    + screenHeader('Scan merchant QR', 'Merchant checkout QR scanner (separate from photographed bills).', 'home')
    + `<div class="split-grid">
      <div class="camera-frame">${camera}</div>
      <div class="card">
        <h2>Open merchant purchase</h2>
        <p style="margin-top:6px">Scan at checkout or open the $150.00 Demo Merchant purchase directly.</p>
        <div class="actions">
          <button type="button" class="btn btn-primary" onclick="go('review')"><span>Open demo purchase</span>${svg('arrow-right')}</button>
          <button type="button" class="btn btn-secondary" onclick="${effective === 'scanning' ? 'stopCamera()' : 'startCamera()'}">${svg('qr')}<span>${effective === 'scanning' ? 'Stop camera' : 'Enable camera'}</span></button>
        </div>
        <div class="rule"></div>
        <form onsubmit="event.preventDefault(); pasteLink()">
          <div class="field-group" style="margin-top:0">
            <label for="purchase-link">Or paste merchant code / link</label>
            <input id="purchase-link" value="${escapeHtml(pastedLinkDraft)}" oninput="pastedLinkDraft = this.value" placeholder="#purchase/SS-001" aria-invalid="${effective === 'invalid' ? 'true' : 'false'}">
          </div>
          <div class="actions" style="margin-top:10px"><button type="submit" class="btn btn-secondary full">Open pasted link</button></div>
        </form>
        ${['invalid', 'denied', 'unavailable'].includes(effective) ? `<div class="callout error" role="alert">${svg('alert')}<span>${escapeHtml(scannerMessage || 'Invalid merchant QR code. Use #purchase/SS-001.')}</span></div>` : ''}
        <div class="chip-row" style="margin-top:12px">
          <button type="button" class="btn-ghost-sm" onclick="previewScannerState('denied')">Test denied</button>
          <button type="button" class="btn-ghost-sm" onclick="previewScannerState('unavailable')">Test unavailable</button>
          <button type="button" class="btn-ghost-sm" onclick="previewScannerState('invalid')">Test invalid</button>
        </div>
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
    scannerMessage = denied ? 'Camera permission blocked. Use Open demo purchase.' : 'Camera unavailable here. Use Open demo purchase.';
    render();
  }
}
function stopCamera() { stopStreams(); scannerState = 'ready'; scannerMessage = ''; render(); }
function previewScannerState(next) { stopStreams(); scannerState = next; scannerMessage = next === 'invalid' ? 'Unrecognized QR or link. Only #purchase/SS-001 is supported.' : ''; render(); }
function pasteLink() {
  const raw = (document.querySelector('#purchase-link')?.value || '').trim();
  pastedLinkDraft = raw;
  if (!raw || raw.includes('SS-001') || raw.includes('#purchase/SS-001')) { scannerState = 'ready'; go('review'); return; }
  scannerState = 'invalid'; scannerMessage = 'Only #purchase/SS-001 is recognized in this merchant demo.'; render();
}

function reviewScreen() {
  return stepHeader(2, 4, 'Review Bill · Step 2', 'scan')
    + screenHeader('Review merchant purchase', 'Confirm items and how to assign the $30.00 lamp.', 'scan')
    + `<div class="split-grid">
      ${receiptCard()}
      <div class="card">
        <h2>Participants</h2>
        ${names.map(n => `<div class="row"><span class="person ${n.toLowerCase()}">${n[0]}</span><div class="grow"><b>${n}</b><br><small class="sub">${n === activeLamp() ? '$40.00 + $30.00 lamp' : '$40.00 shared'}</small></div><b class="money">${money(shares()[n])}</b></div>`).join('')}
        <div class="field-group">
          <label for="instruction">Split instruction</label>
          <textarea id="instruction" rows="3" oninput="instructionDraft = this.value">${escapeHtml(instructionDraft)}</textarea>
        </div>
        <div class="chip-row">
          <button type="button" class="chip" onclick="applyPresetInstruction('Split the $120 kitchen essentials evenly between Maya, Arun and Leah. The $30 lamp is for Leah.')">Lamp for Leah ($40/$40/$70)</button>
          <button type="button" class="chip" onclick="applyPresetInstruction('Split the $120 kitchen essentials evenly between Maya, Arun and Leah. The $30 lamp is for Maya.')">Lamp for Maya ($70/$40/$40)</button>
          <button type="button" class="chip" onclick="applyPresetInstruction('Split evenly, someone take the lamp')">Ambiguous (clarify)</button>
        </div>
        <div class="actions">
          <button type="button" class="btn btn-secondary" onclick="go('scan')">${svg('arrow-left')}<span>Back</span></button>
          <button type="button" class="btn btn-primary" onclick="prepare()"><span>Prepare AI split</span>${svg('arrow-right')}</button>
        </div>
      </div>
    </div>`;
}

function applyPresetInstruction(t) { instructionDraft = t; const el = document.querySelector('#instruction'); if (el) el.value = t; }
function parseStaticLampOwner(t) {
  const low = String(t || '').toLowerCase();
  const hits = names.filter(n => new RegExp('\\b' + n.toLowerCase() + '\\b').test(low));
  if (hits.length === 1) return hits[0];
  const ls = low.split(/[.;\n]/).find(p => p.includes('lamp'));
  if (ls) { const o = names.filter(n => new RegExp('\\b' + n.toLowerCase() + '\\b').test(ls)); if (o.length === 1) return o[0]; }
  return null;
}
async function prepare() {
  const ta = document.querySelector('#instruction'); if (ta) instructionDraft = ta.value;
  if (!backendMode) {
    const owner = parseStaticLampOwner(instructionDraft);
    if (owner) { lamp = owner; localStorage.setItem('splitsync-lamp', owner); aiState = 'ready'; go('split'); }
    else { aiState = 'clarify'; go('clarify'); }
    return;
  }
  aiState = 'loading'; aiError = ''; go('split'); await render();
  try {
    const r = await api('/api/organizer/suggest-split', { instruction: instructionDraft });
    if (names.includes(r.lamp)) { draftLamp = r.lamp; lamp = r.lamp; aiState = 'ready'; await render(); }
    else { aiState = 'clarify'; go('clarify'); await render(); }
  } catch (e) { aiState = e.status === 502 || e.status === 503 || e.network ? 'unavailable' : 'error'; aiError = e.message; await render(); }
}

async function readSplit() {
  ttsState = 'loading'; ttsError = ''; ttsAudioLamp = activeLamp(); render();
  if (!backendMode) { ttsState = 'unavailable'; ttsError = 'Chatterbox TTS requires the connected backend with NVIDIA_API_KEY.'; render(); return; }
  try {
    const res = await api('/api/organizer/read-split', { lamp: activeLamp() });
    ttsAudioSrc = 'data:audio/wav;base64,' + res.audio; ttsState = 'ready'; await render();
    document.querySelector('#split-audio')?.play().catch(() => {});
  } catch (e) { ttsState = 'unavailable'; ttsError = e.message; render(); }
}

function splitScreen(clarify = false, edit = false) {
  const l = activeLamp();
  const cur = shares();
  const locked = hasExistingOrders();
  const isLoading = aiState === 'loading' && !clarify && !edit;
  const isUnavailable = (aiState === 'unavailable' || aiState === 'error') && !clarify && !edit;

  return stepHeader(3, 4, 'AI Split Review · Step 3', 'review')
    + screenHeader(clarify ? 'Clarify lamp owner' : edit ? 'Edit allocations' : 'Review suggested split', '$150.00 USD total · $120.00 essentials ($40 each) + $30.00 lamp', 'review')
    + `<div class="split-grid">
      ${receiptCard()}
      <div class="card">
        <div class="section-title"><h2>Participant allocations</h2>${badge(backendMode ? 'Server validated' : 'Static preview', backendMode ? '' : 'preview')}</div>
        ${isLoading ? `<div class="callout">${svg('sparkles')}<span>Interpreting split instruction…</span></div><div class="skeleton" style="margin-top:10px;width:85%"></div>` : ''}
        ${isUnavailable ? `<div class="callout warning" role="alert">${svg('alert')}<div><b>AI split unavailable</b><br>${escapeHtml(aiError)} Edit manually below or retry.<div class="actions" style="margin-top:8px"><button type="button" class="btn btn-secondary" onclick="prepare()">Retry AI split</button><button type="button" class="btn btn-primary" onclick="go('edit')">Edit manually</button></div></div></div>` : ''}
        ${(clarify || edit || isUnavailable) ? `<div class="field-group" style="margin-top:0"><label for="lamp-sel">Who pays for the $30.00 lamp?</label><select id="lamp-sel" onchange="setLamp(this.value)" ${locked ? 'disabled' : ''}>${names.map(n => `<option value="${n}" ${n === l ? 'selected' : ''}>${n} ($70.00)</option>`).join('')}</select></div><div class="chip-row" style="margin-bottom:12px">${names.map(n => `<button type="button" class="chip ${n === l ? 'selected' : ''}" onclick="setLamp('${n}')" ${locked ? 'disabled' : ''}>Lamp → ${n}</button>`).join('')}</div>` : ''}
        ${isLoading ? '' : names.map(n => `<div class="row"><span class="person ${n.toLowerCase()}">${n[0]}</span><div class="grow"><b>${n}</b><br><small class="sub">${n === l ? '$40.00 (1/3 of $120) + $30.00 lamp' : '$40.00 (1/3 of $120 shared)'}</small></div><b class="money" style="color:var(--primary-ink)">${money(cur[n])}</b></div>`).join('')}
        <div class="tts-panel" aria-live="polite">
          <div class="tts-row">
            <div><b>Chatterbox voice summary</b><p class="sub">${ttsState === 'loading' ? 'Generating audio…' : ttsState === 'ready' ? 'Audio ready' : ttsState === 'unavailable' ? 'Audio unavailable' : 'Read allocations aloud'}</p></div>
            <button type="button" class="btn btn-secondary" onclick="readSplit()" ${ttsState === 'loading' ? 'disabled' : ''}>${svg('volume')}<span>Read split aloud</span></button>
          </div>
          ${ttsState === 'unavailable' ? `<div class="callout warning" style="margin-top:10px">${svg('alert')}<span>${escapeHtml(ttsError)}</span></div>` : ''}
          ${ttsState === 'ready' && ttsAudioSrc ? `<audio id="split-audio" controls src="${ttsAudioSrc}"></audio>` : ''}
        </div>
        <div class="actions">
          <button type="button" class="btn btn-secondary" onclick="go('${edit || clarify ? 'split' : 'edit'}')"><span>${edit || clarify ? 'Done editing' : 'Edit split'}</span></button>
          <button type="button" class="btn btn-primary" onclick="confirmSplit()" ${confirmBusy || isLoading ? 'disabled' : ''}><span>${confirmBusy ? 'Publishing…' : 'Confirm split'}</span>${svg('arrow-right')}</button>
        </div>
      </div>
    </div>`;
}

function setLamp(n) {
  if (!names.includes(n)) return;
  draftLamp = n; lamp = n; selectedQrName = n;
  if (ttsAudioLamp !== n) { ttsState = 'idle'; ttsAudioSrc = ''; }
  localStorage.setItem('splitsync-lamp', n);
  render();
}
async function confirmSplit() {
  if (backendMode) {
    confirmBusy = true; render();
    try {
      await api('/api/organizer/split', { lamp: activeLamp() });
      draftLamp = null; aiState = 'idle';
      await loadWorkspaceState();
      selectedQrName = lamp; confirmBusy = false; go('requests'); await render();
    } catch (e) { confirmBusy = false; toast(e.message); render(); }
    return;
  }
  published = true; localStorage.setItem('splitsync-published', 'true'); selectedQrName = lamp; go('requests');
}

function requestsScreen(qrName) {
  const activeQr = qrName || selectedQrName || lamp || 'Maya';
  selectedQrName = activeQr;
  const activeUrl = paymentLink(activeQr);
  return stepHeader(4, 4, 'Share Requests · Step 4', 'split')
    + screenHeader('Share payment requests', 'Private PayPal Sandbox payment links for SS-001.', 'split', `<button type="button" class="btn btn-secondary" onclick="go('dashboard')">Ledger</button>`)
    + `<div class="split-grid">
      <div class="card">
        ${purchaseHeader()}
        <div class="rule"></div>
        ${names.map(n => `<div class="row">
          <span class="person ${n.toLowerCase()}">${n[0]}</span>
          <div class="grow"><b>${n}</b><br><small class="sub"><span class="money">${money(shares()[n])} USD</span> · ${pill(status(n))}</small></div>
          <button type="button" class="btn-ghost-sm" onclick="copySsLink('${n}')">${svg('copy')}<span>Copy link</span></button>
          <button type="button" class="btn-ghost-sm" onclick="go('qr/${n.toLowerCase()}')">${svg('qr')}<span>Show QR</span></button>
        </div>`).join('')}
      </div>
      <div class="card card-tint">
        <h2>Participant QR code</h2>
        <div class="qr-spotlight" style="margin-top:14px">
          <div class="qr-box" id="qr"></div>
          <div class="qr-meta">
            <h3>${escapeHtml(activeQr)} · <span class="money">${money(shares()[activeQr])} USD</span></h3>
            <p style="margin-bottom:10px">${activeQr === lamp ? '$40.00 shared + $30.00 desk lamp' : '$40.00 shared essentials'}</p>
            ${activeUrl ? `<a class="btn btn-primary" href="${escapeHtml(activeUrl)}"><span>Open ${escapeHtml(activeQr)}’s link</span>${svg('external')}</a>` : `<p class="sub">Confirm split first.</p>`}
          </div>
        </div>
      </div>
    </div>`;
}

async function copySsLink(n) {
  const u = paymentLink(n);
  if (!u) { toast('Confirm the split first.'); return; }
  try { await navigator.clipboard.writeText(u); toast(`${n}’s link copied`); }
  catch { prompt(`Copy ${n}’s link`, u); }
}

function dashboardScreen() {
  const paid = paidTotal();
  const rem = Math.max(0, 150 - paid);
  return screenHeader('Group payment ledger', 'Move-in essentials · Demo Merchant · SS-001', 'activity', `<button type="button" class="btn btn-primary" onclick="go('requests')">Share links</button>`)
    + `<div class="split-grid">
      ${receiptCard()}
      <div class="card">
        <div class="section-title"><h2>Settlement status</h2>${badge(backendMode ? 'Verified captures' : 'Sample ledger', backendMode ? '' : 'preview')}</div>
        <div style="font-size:28px;font-weight:800;color:var(--navy)" class="money">${money(paid)} <span style="font-size:14px;color:var(--muted)">/ $150.00 USD</span></div>
        <div class="progress"><i style="transform:scaleX(${(paid / 150).toFixed(4)})"></i></div>
        <p class="sub">${paidCount()} of 3 paid · ${money(rem)} remaining</p>
        <div class="rule"></div>
        ${names.map(n => `<div class="row"><span class="person ${n.toLowerCase()}">${n[0]}</span><div class="grow"><b>${n}</b><br><small class="sub">${n === activeLamp() ? '$40 + $30 lamp' : '$40 essentials'}</small></div><b class="money">${money(shares()[n])}</b>${pill(status(n))}</div>`).join('')}
      </div>
    </div>`;
}

// ---------- Store (super.money splitStore style) & Cart & Rent ----------
function storeScreen() {
  const cats = ['All', 'Kitchen', 'Lighting', 'Furniture', 'Cleaning', 'Retailers'];
  const q = storeQuery.trim().toLowerCase();
  const showProducts = storeCategory !== 'Retailers';
  const filteredProducts = showProducts
    ? storeCatalog.filter(p => (storeCategory === 'All' || p.category === storeCategory) && (!q || p.name.toLowerCase().includes(q) || p.seller.toLowerCase().includes(q)))
    : [];
  const showRetailers = storeCategory === 'All' || storeCategory === 'Retailers';
  const filteredRetailers = showRetailers
    ? externalRetailers.filter(r => (storeCategory === 'All' || storeCategory === 'Retailers' || r.category === storeCategory) && (!q || r.name.toLowerCase().includes(q)))
    : [];
  const count = cartCount();
  const prefs = JSON.parse(localStorage.getItem('splitsync-interests') || '[]');

  return `<div class="hub-top">
    <div>
      <h1>splitStore ${badge('Sample inventory · Preview', 'preview')}</h1>
      <p class="screen-sub">${prefs.length ? `Preferences: ${escapeHtml(prefs.join(', '))}` : 'Browse move-in products, build a shared cart, then split with your household.'}</p>
    </div>
    <div class="hub-pills">
      <button type="button" class="btn-ghost-sm" onclick="go('preferences')">Preferences</button>
      <button type="button" class="btn btn-primary" onclick="go('cart')">${svg('cart')}<span>Cart (${count})</span></button>
    </div>
  </div>

  <div class="store-toolbar">
    <div class="store-search">
      ${svg('search')}
      <input type="search" aria-label="Search products" placeholder="Search lamps, cookware, bins, retailers..." value="${escapeHtml(storeQuery)}" oninput="storeQuery = this.value; render()">
    </div>
  </div>

  <div class="category-strip" role="tablist" aria-label="Store categories">
    ${cats.map(c => `<button type="button" class="chip ${storeCategory === c ? 'selected' : ''}" onclick="setStoreCategory('${c}')">${c}</button>`).join('')}
  </div>

  <div class="store-grid">
    ${filteredProducts.map(p => `<article class="product-card">
      <div>
        <div class="product-art">${svg(p.art)}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:6px">
          ${badge(p.seller, p.demoLinked ? '' : 'preview')}
          <small class="sub">${escapeHtml(p.category)}</small>
        </div>
        <h2 style="margin-top:8px">${escapeHtml(p.name)}</h2>
        <p style="margin-top:4px">${escapeHtml(p.desc)}</p>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:6px">
        <b class="money" style="font-size:17px">${cents(p.priceCents)}</b>
        <div style="display:flex;gap:6px">
          <button type="button" class="btn-ghost-sm" onclick="go('product/${escapeHtml(p.id)}')">View</button>
          <button type="button" class="btn btn-primary" onclick="addToCart('${escapeHtml(p.id)}')">Add</button>
        </div>
      </div>
    </article>`).join('')}

    ${filteredRetailers.map(r => `<article class="product-card">
      <div>
        <div class="product-art" style="background:#EEF2F7;color:var(--navy)">${svg('store')}</div>
        <div style="margin-top:10px">${badge(r.seller, 'preview')}</div>
        <h2 style="margin-top:8px">${escapeHtml(r.name)}</h2>
        <p style="margin-top:4px">${escapeHtml(r.desc)}</p>
      </div>
      <a class="btn btn-secondary full" href="${escapeHtml(r.url)}" target="_blank" rel="noopener"><span>Open retailer</span>${svg('external')}</a>
    </article>`).join('')}
  </div>`;
}

function setStoreCategory(c) { storeCategory = c; render(); }

function productDetailScreen(prodId) {
  const p = storeCatalog.find(x => x.id === prodId) || storeCatalog[0];
  return screenHeader(escapeHtml(p.name), `${escapeHtml(p.seller)} · ${escapeHtml(p.category)}`, 'store', `<button type="button" class="btn-ghost-sm" onclick="go('cart')">${svg('cart')}<span>Cart (${cartCount()})</span></button>`)
    + `<div class="split-grid">
      <div class="card"><div class="product-art" style="height:240px">${svg(p.art)}</div></div>
      <div class="card">
        ${badge(p.demoLinked ? 'Demo product · Supports SS-001 flow' : 'Sample catalog item · Preview', p.demoLinked ? '' : 'preview')}
        <h2 style="margin-top:10px;font-size:26px" class="money">${cents(p.priceCents)} USD</h2>
        <p style="margin-top:8px">${escapeHtml(p.desc)}</p>
        <div class="actions">
          <button type="button" class="btn btn-primary full" onclick="addToCart('${escapeHtml(p.id)}', true)">${svg('cart')}<span>Add to shared purchase</span></button>
        </div>
      </div>
    </div>`;
}

function addToCart(prodId, openCart = false) {
  const existing = sharedCart.find(i => i.id === prodId);
  if (existing) existing.qty += 1;
  else sharedCart.push({ id: prodId, qty: 1 });
  localStorage.setItem('splitsync-cart', JSON.stringify(sharedCart));
  updateCartBadges();
  toast('Added to shared cart.');
  if (openCart) go('cart'); else render();
}

function cartScreen() {
  const rows = sharedCart.map(c => ({ ...c, product: storeCatalog.find(p => p.id === c.id) })).filter(c => c.product);
  const totalCents = rows.reduce((s, r) => s + r.product.priceCents * r.qty, 0);
  return screenHeader('Shared cart', `${cartCount()} item${cartCount() === 1 ? '' : 's'} ready to split`, 'store')
    + `<div class="narrow card">
      ${rows.length === 0 ? `<p>Your shared cart is empty. Add sample items from the Store to split with roommates.</p><div class="actions"><button type="button" class="btn btn-primary" onclick="go('store')">Browse Store</button></div>`
        : `${rows.map(r => `<div class="row">
            <span class="icon-box">${svg(r.product.art)}</span>
            <div class="grow">
              <b>${escapeHtml(r.product.name)}</b><br>
              <small class="sub">${escapeHtml(r.product.seller)} · ${cents(r.product.priceCents)} each</small>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <button type="button" class="btn-ghost-sm" onclick="adjustCart('${escapeHtml(r.id)}', -1)">-</button>
              <b>${r.qty}</b>
              <button type="button" class="btn-ghost-sm" onclick="adjustCart('${escapeHtml(r.id)}', 1)">+</button>
            </div>
            <b class="money">${cents(r.product.priceCents * r.qty)}</b>
          </div>`).join('')}
          <div class="rule"></div>
          <div class="row total"><span>Cart subtotal</span><span class="money">${cents(totalCents)} USD</span></div>
          <div class="actions">
            <button type="button" class="btn btn-secondary" onclick="clearCart()">Clear cart</button>
            <button type="button" class="btn btn-primary" onclick="splitCartWithPeople()"><span>Split with people</span>${svg('arrow-right')}</button>
          </div>`}
    </div>`;
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
  const totalCents = rows.reduce((s, r) => s + r.product.priceCents * r.qty, 0);
  const perPerson = Math.round(totalCents / 3);
  billDraft = {
    merchant: 'splitStore Shared Cart', date: '2026-11-10', currency: 'USD',
    items: rows.map(r => ({ name: `${r.product.name} x${r.qty}`, amountCents: r.product.priceCents * r.qty })),
    taxCents: 0, tipCents: 0, totalCents, unreadableFields: [], totalMismatch: false, modelUsed: 'Store Cart',
  };
  billCroppedImage = '';
  transcriptDraft = `Split $${(totalCents / 100).toFixed(2)} store cart (${rows.map(r => r.product.name).join(', ')}) evenly between Maya, Arun, and Leah.`;
  draftRecipients = [
    { id: 'draft-1', name: 'Maya', contactId: 'maya', known: true, ambiguous: false, amountCents: perPerson, currency: 'USD', reason: rows[0]?.product?.name || 'Store cart' },
    { id: 'draft-2', name: 'Arun', contactId: 'arun', known: true, ambiguous: false, amountCents: perPerson, currency: 'USD', reason: rows[0]?.product?.name || 'Store cart' },
    { id: 'draft-3', name: 'Leah', contactId: 'leah', known: true, ambiguous: false, amountCents: Math.max(100, totalCents - perPerson * 2), currency: 'USD', reason: rows[0]?.product?.name || 'Store cart' },
  ];
  requestParseState = 'ready'; requestModelUsed = 'Store Cart';
  go('request-review');
}

function preferencesScreen() {
  const saved = JSON.parse(localStorage.getItem('splitsync-interests') || '[]');
  return screenHeader('Shopping preferences', 'Optional categories for splitStore.', 'store')
    + `<div class="narrow card">
      ${['Kitchen', 'Lighting', 'Furniture', 'Cleaning'].map(n => `<label class="row" style="cursor:pointer"><span style="display:flex;align-items:center;gap:10px;font-weight:700"><input type="checkbox" value="${n}" ${saved.includes(n) ? 'checked' : ''} style="width:18px;height:18px">${n}</span></label>`).join('')}
      <div class="actions"><button type="button" class="btn btn-secondary" onclick="go('store')">Skip</button><button type="button" class="btn btn-primary" onclick="savePreferences()">Save preferences</button></div>
    </div>`;
}
function savePreferences() {
  const vals = [...document.querySelectorAll('input[type="checkbox"]:checked')].map(x => x.value);
  localStorage.setItem('splitsync-interests', JSON.stringify(vals));
  toast('Preferences saved.'); go('store');
}

function rentScreen() {
  return screenHeader('Monthly rent draft', 'Preview household schedule. Separate from merchant PayPal checkout.', 'home', badge('Preview', 'preview'))
    + `<div class="split-grid">
      <div class="card">
        <div class="section-title"><h2>December 2026 draft</h2>${pill(rentReviewed ? 'Reviewed' : 'Draft')}</div>
        <div style="font-size:28px;font-weight:800;color:var(--navy)" class="money">$2,400.00 USD</div>
        <p class="sub" style="margin-top:4px">Due December 1, 2026 · Saved 3-way split</p>
        <div class="rule"></div>
        ${names.map(n => `<div class="row"><span class="person ${n.toLowerCase()}">${n[0]}</span><div class="grow"><b>${n}</b><br><small class="sub">1/3 share</small></div><b class="money">$800.00</b>${pill(rentReviewed ? 'Reviewed' : 'Draft')}</div>`).join('')}
        <div class="actions"><button type="button" class="btn btn-primary full" onclick="toggleRentReviewed()">${rentReviewed ? 'Reviewed (demo only)' : 'Review monthly draft'}</button></div>
      </div>
      <div class="card">
        <h2>Saved split rules</h2>
        <div class="rule"></div>
        <div class="row"><span>Household</span><b>The new place</b></div>
        <div class="row"><span>Rule</span><b>Equal 3-way ($800.00 each)</b></div>
        <div class="row"><span>Schedule</span><b>1st of every month</b></div>
      </div>
    </div>`;
}
function toggleRentReviewed() { rentReviewed = !rentReviewed; localStorage.setItem('splitsync-rent-reviewed', String(rentReviewed)); render(); }

// ---------- Profile Tab (Contacts, Organizer Key & Session, Provider Status) ----------
function profileScreen() {
  return `<div class="hub-top">
    <div>
      <h1>Profile &amp; Settings</h1>
      <p class="screen-sub">Household contacts, organizer Sandbox session, and live provider diagnostics.</p>
    </div>
    ${badge(backendMode ? 'Connected Sandbox' : 'Preview mode', backendMode ? '' : 'preview')}
  </div>

  <div class="split-grid">
    <section class="card">
      <h2>Organizer &amp; Sandbox session</h2>
      <p style="margin-top:6px">${backendMode && ledger ? 'Signed in as Organizer Leah on local PayPal Sandbox server.' : 'Currently browsing static preview without backend persistence.'}</p>
      <div class="actions">
        ${backendMode && ledger ? `<button type="button" class="btn btn-secondary" onclick="signOutOrganizer()">Sign out</button>` : `<button type="button" class="btn btn-primary" onclick="go('welcome')">Sign in with organizer key</button>`}
      </div>
      <div class="rule"></div>
      <h3>Provider status</h3>
      <div class="row"><span>AI Extract &amp; Split (NVIDIA / DeepSeek)</span>${pill(providers.aiConfigured ? 'Sent' : 'Created')}</div>
      <div class="row"><span>Chatterbox TTS Voice Output</span>${pill(providers.ttsConfigured ? 'Paid' : 'Created')}</div>
      <div class="row"><span>Speech-to-Text (Web Speech / Whisper)</span>${pill(providers.sttConfigured ? 'Paid' : 'Created')}</div>
      <div class="row"><span>PayPal Sandbox (SS-001 Checkout)</span>${pill(providers.paypalConfigured ? 'Paid' : 'Created')}</div>
      <div class="row"><span>Automated Email / SMS Delivery</span>${pill(providers.emailConfigured || providers.smsConfigured ? 'Sent' : 'Created')}</div>
    </section>

    <section class="card">
      <h2>Contacts (${contactsList.length})</h2>
      <p class="sub">Used to resolve spoken names in Voice Dictation &amp; Scan Bill.</p>
      <div class="rule"></div>
      ${contactsList.map(c => `<div class="row"><span class="person ${c.name.toLowerCase()}">${escapeHtml(c.name[0])}</span><div class="grow"><b>${escapeHtml(c.name)}</b><br><small class="sub">${escapeHtml(c.handle || c.note || 'Contact')}</small></div><span class="sub">${escapeHtml(c.phone || '')}</span></div>`).join('')}
      <form onsubmit="event.preventDefault(); addNewContact()" style="margin-top:12px">
        <div class="split-grid" style="gap:8px">
          <input id="new-contact-name" placeholder="Name (e.g. Priya)" style="min-height:42px;padding:8px 12px;border:1.5px solid var(--line);border-radius:10px" required>
          <input id="new-contact-handle" placeholder="Email or phone" style="min-height:42px;padding:8px 12px;border:1.5px solid var(--line);border-radius:10px">
        </div>
        <div class="actions" style="margin-top:10px"><button type="submit" class="btn btn-secondary full">${svg('plus')}<span>Add contact</span></button></div>
      </form>
    </section>
  </div>`;
}

async function addNewContact() {
  const name = (document.querySelector('#new-contact-name')?.value || '').trim();
  const handle = (document.querySelector('#new-contact-handle')?.value || '').trim();
  if (!name) return;
  if (backendMode) {
    const res = await api('/api/organizer/contacts', { name, handle });
    contactsList = res.contacts;
  } else {
    contactsList.push({ id: name.toLowerCase(), name, handle, note: 'Contact' });
    saveLocalContacts();
  }
  toast(`Added ${name} to contacts.`);
  render();
}

// ---------- Private Payer Routes (#pay/:token, #req/:token, #share/:name, #handoff, #result) ----------
function buyerPage(shareData, query) {
  const paid = shareData.status === 'Paid';
  const pending = shareData.status === 'Processing';
  const cancelled = query.get('cancelled') === '1' && !paid && !pending;
  const amount = money(shareData.amountCents / 100);
  const ownsLamp = shareData.name === shareData.lamp;
  let statePanel = '';
  if (paid) statePanel = `<div class="callout success" role="status">${svg('check')}<div><b>Payment complete &amp; verified</b><br>PayPal Sandbox capture confirmed.${shareData.receipt ? ` Receipt: <code>${escapeHtml(shareData.receipt)}</code>` : ''}</div></div>`;
  else if (pending) statePanel = `<div class="callout warning" role="status">${svg('clock')}<div><b>Payment processing</b><br>Refresh status shortly to verify completion.</div></div>`;
  else if (cancelled) statePanel = `<div class="callout error" role="status">${svg('undo')}<div><b>Checkout cancelled</b><br>No payment was completed on PayPal. Retry below.</div></div>`;

  return `<div class="hub-top">
    <div><h1>Your share · ${amount} USD</h1><p class="screen-sub">Hi ${escapeHtml(shareData.name)}, review ${escapeHtml(shareData.purchaseTitle)} from ${escapeHtml(shareData.merchant)}.</p></div>
    ${badge('Connected Sandbox')}
  </div>
  <div class="split-grid">
    <div class="card">
      <div class="section-title"><h2>Your items</h2>${badge('Private link')}</div>
      <div class="row"><div class="grow"><b>Shared kitchen essentials (1 of 3)</b></div><b class="money">$40.00</b></div>
      ${ownsLamp ? `<div class="row"><div class="grow"><b>Personal desk lamp</b></div><b class="money">$30.00</b></div>` : ''}
      <div class="row total"><span>Your total</span><span class="money">${amount} USD</span></div>
      <div class="callout">${svg('key')}<span>Only your own share and PayPal button are shown on this private link.</span></div>
    </div>
    <div class="card card-tint payment-summary${paid || pending || cancelled ? ' is-priority' : ''}">
      <div class="section-title"><h2>${cancelled ? 'Retry payment' : 'Payment summary'}</h2>${pill(cancelled ? 'Cancelled' : shareData.status)}</div>
      <div class="row"><span>Participant</span><b>${escapeHtml(shareData.name)}</b></div>
      <div class="row total"><span>Total to pay</span><span class="money">${amount} USD</span></div>
      ${statePanel}
      ${!paid && !pending ? `<div class="actions"><button type="button" class="btn btn-paypal full" id="pay-button" onclick="startCheckout()"><span>${cancelled ? 'Retry with PayPal' : 'Pay with PayPal'}</span></button></div>` : ''}
      <div class="actions"><button type="button" class="btn btn-secondary full" onclick="refreshBuyer()">${svg('refresh')}<span>Refresh payment status</span></button></div>
      <p id="payment-message" role="status" class="sub" style="margin-top:10px;color:var(--error)"></p>
    </div>
  </div>`;
}

function reimbursementBuyerPage(data) {
  return `<div class="hub-top">
    <div><h1>Reimbursement · ${cents(data.amountCents)} ${escapeHtml(data.currency)}</h1><p class="screen-sub">Hi ${escapeHtml(data.recipientName)}, request from Leah for ${escapeHtml(data.reason)}.</p></div>
    ${badge('Photographed bill evidence', 'preview')}
  </div>
  <div class="split-grid">
    <div class="card">
      <div class="section-title"><h2>Bill evidence · ${escapeHtml(data.merchant)}</h2><span class="sub">${escapeHtml(data.billDate || '')}</span></div>
      ${data.evidenceImageDataUrl ? `<img src="${escapeHtml(data.evidenceImageDataUrl)}" alt="Receipt evidence" class="crop-canvas" style="margin-bottom:12px">` : ''}
      ${(data.items || []).map(i => `<div class="row"><span>${escapeHtml(i.name)}</span><b class="money">${cents(i.amountCents)}</b></div>`).join('')}
      <div class="row total"><span>Bill total</span><span class="money">${cents(data.totalBillCents)}</span></div>
    </div>
    <div class="card card-tint">
      <div class="section-title"><h2>Your portion</h2>${pill(data.status)}</div>
      <div class="row"><span>Recipient</span><b>${escapeHtml(data.recipientName)}</b></div>
      <div class="row"><span>Reason</span><b>${escapeHtml(data.reason)}</b></div>
      <div class="row total"><span>Requested amount</span><span class="money">${cents(data.amountCents)} ${escapeHtml(data.currency)}</span></div>
      ${data.receiptRef ? `<div class="row"><span>Reference</span><code>${escapeHtml(data.receiptRef)}</code></div>` : ''}
      <div class="callout">${svg('alert')}<span>${escapeHtml(data.note)} Settle directly with Leah and ask them to mark your request Paid on their Activity screen.</span></div>
      ${backendMode && !buyerToken.startsWith('demo-') ? `<div class="actions"><button type="button" class="btn btn-secondary full" onclick="renderReimbursementBuyer()">${svg('refresh')}<span>Refresh status</span></button></div>` : ''}
    </div>
  </div>`;
}

function staticSharePage(n) {
  const amt = shares()[n];
  return `<div class="hub-top"><div><h1>Your share · ${money(amt)} USD</h1><p class="screen-sub">Static demo view for ${n}.</p></div>${badge('Static preview', 'preview')}</div>
  <div class="split-grid">
    <div class="card"><h2>Your items</h2><div class="row"><span>Shared essentials</span><b>$40.00</b></div>${n === activeLamp() ? `<div class="row"><span>Desk lamp</span><b>$30.00</b></div>` : ''}<div class="row total"><span>Total</span><span>${money(amt)} USD</span></div></div>
    <div class="card card-tint"><h2>Payment summary</h2><div class="actions"><button type="button" class="btn btn-paypal full" onclick="go('handoff/${n.toLowerCase()}')">Pay with PayPal</button></div></div>
  </div>`;
}

function handoffPage(n) {
  return `<div class="narrow card center"><h1>Continue in PayPal Sandbox</h1><p style="margin-top:6px">${n} · ${money(shares()[n])} USD</p><div class="chip-row" style="justify-content:center;margin-top:16px">${['Processing', 'Paid', 'Cancelled'].map(s => `<button type="button" class="btn ${s === 'Paid' ? 'btn-primary' : 'btn-secondary'}" onclick="go('result/${n.toLowerCase()}/${s.toLowerCase()}')">Preview ${s}</button>`).join('')}</div></div>`;
}

function resultPage(n, s) {
  const paid = s === 'paid'; const cancel = s === 'cancelled';
  return `<div class="narrow card center"><div class="result-icon ${paid ? '' : cancel ? 'cancelled' : 'processing'}">${svg(paid ? 'check' : cancel ? 'undo' : 'clock')}</div><h1>${paid ? 'Payment complete' : cancel ? 'Payment cancelled' : 'Payment processing'}</h1><h2 class="money" style="margin-top:8px">${money(shares()[n])} USD</h2>${paid ? '<p class="sub">Receipt: DEMO-SS-8F3D21</p>' : ''}<div class="actions"><button type="button" class="btn btn-primary full" onclick="go('share/${n.toLowerCase()}')">${cancel ? 'Retry payment' : 'View share'}</button></div></div>`;
}

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

  const activeTab = primaryTabs.includes(route) ? route
    : ['dashboard', 'requests', 'qr', 'request', 'rent'].includes(route) ? 'activity'
    : ['product', 'cart', 'preferences'].includes(route) ? 'store' : 'home';

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
  if (!/^[a-f0-9]{48}$/.test(buyerToken)) {
    if (appEl) appEl.innerHTML = `<div class="narrow card center"><h1>Invalid payment link</h1><p style="margin-top:8px">Ask your organizer for your private share URL.</p></div>`;
    return;
  }
  try {
    buyer = await api('/api/shares/' + buyerToken);
    const query = new URLSearchParams(location.search || '');
    for (const [k, v] of new URLSearchParams(search)) query.set(k, v);
    let captureError = '';
    if (query.get('returned') === '1' && query.get('order') && buyer.status !== 'Paid') {
      try { buyer = await api('/api/shares/' + buyerToken + '/capture', { orderId: query.get('order') }); }
      catch (e) { captureError = e.message; }
    }
    if (appEl) appEl.innerHTML = buyerPage(buyer, query);
    if (captureError || buyerActionMessage) {
      const msg = document.querySelector('#payment-message');
      if (msg) msg.textContent = captureError || buyerActionMessage;
    }
  } catch (e) {
    if (appEl) appEl.innerHTML = `<div class="narrow card center"><h1>Link unavailable</h1><p style="margin-top:8px">${escapeHtml(e.message)}</p></div>`;
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
    if (req && rec && appEl) {
      appEl.innerHTML = reimbursementBuyerPage({
        ...req, totalBillCents: req.totalCents, recipientName: rec.name, amountCents: rec.amountCents,
        reason: rec.reason, status: rec.status, receiptRef: rec.receiptRef,
        note: 'Personal receipt reimbursement request in static preview mode.',
      });
      return;
    }
  }
  try {
    const data = await api('/api/reimbursements/' + encodeURIComponent(token));
    if (appEl) appEl.innerHTML = reimbursementBuyerPage(data);
  } catch (e) {
    if (appEl) appEl.innerHTML = `<div class="narrow card center"><h1>Request link not found</h1><p style="margin-top:8px">${escapeHtml(e.message)}</p></div>`;
  }
}

async function startCheckout() {
  const button = document.querySelector('#pay-button');
  const msg = document.querySelector('#payment-message');
  if (button) button.disabled = true;
  try {
    const res = await api('/api/shares/' + buyerToken + '/orders', {});
    if (res.alreadyPaid || res.pending) { buyer = res.share; await renderBuyer(); return; }
    location.href = res.approvalUrl;
  } catch (e) {
    buyerActionMessage = e.message;
    if (msg) msg.textContent = e.message;
    if (button) { button.disabled = false; button.textContent = 'Retry with PayPal'; }
  }
}

async function refreshBuyer() {
  try { buyer = await api('/api/shares/' + buyerToken + '/refresh', {}); buyerActionMessage = ''; await renderBuyer(); }
  catch (e) { const msg = document.querySelector('#payment-message'); if (msg) msg.textContent = e.message; }
}

async function render() {
  if (location.hash.startsWith('#pay/')) return renderBuyer();
  if (location.hash.startsWith('#req/')) return renderReimbursementBuyer();

  const rawHash = (location.hash || '#home').slice(1);
  const [rawRoute, a, b] = rawHash.split('/');
  const route = rawRoute || 'home';

  if (backendMode && !ledger && !staticPreviewMode && !['welcome', 'share', 'handoff', 'result'].includes(route)) {
    try {
      await loadWorkspaceState();
    } catch {
      setChromeMode('welcome');
      const appEl = document.querySelector('#app');
      if (appEl) appEl.innerHTML = authView();
      return;
    }
  }
  if (!backendMode && !staticPreviewMode && !['welcome', 'share', 'handoff', 'result'].includes(route)) {
    // Allow first-time browser open without backend to show Welcome sign-in screen cleanly
    if (!['home'].includes(route)) { /* direct route still requires entering workspace */ }
  }
  if (route === 'welcome' || (!ledger && !staticPreviewMode && !['share', 'handoff', 'result'].includes(route))) {
    setChromeMode('welcome');
    const appEl = document.querySelector('#app');
    if (appEl) appEl.innerHTML = authView();
    return;
  }

  if (route !== 'scan') if (activeStream) stopStreams();
  if (route !== 'scan-bill') if (billStream) stopStreams();

  const n = names.find(x => x.toLowerCase() === a) || 'Maya';
  setChromeMode(route);

  const views = {
    home: homeScreen,
    activity: activityScreen,
    store: storeScreen,
    shop: storeScreen,
    profile: profileScreen,
    welcome: authView,
    scan: () => scanQrScreen(false),
    'scan-error': () => scanQrScreen(true),
    review: reviewScreen,
    split: () => splitScreen(false, false),
    clarify: () => splitScreen(true, false),
    edit: () => splitScreen(false, true),
    requests: () => requestsScreen(),
    qr: () => requestsScreen(n),
    request: () => requestDetailScreen(a),
    dashboard: dashboardScreen,
    'scan-bill': scanBillScreen,
    'bill-crop': billCropScreen,
    'bill-review': billReviewScreen,
    talk: talkScreen,
    'request-review': requestReviewScreen,
    rent: rentScreen,
    product: () => productDetailScreen(a),
    cart: cartScreen,
    preferences: preferencesScreen,
    share: () => staticSharePage(n),
    handoff: () => handoffPage(n),
    result: () => resultPage(n, ['paid', 'cancelled', 'processing'].includes(b) ? b : 'processing'),
  };

  const appEl = document.querySelector('#app');
  if (appEl) appEl.innerHTML = (views[route] || homeScreen)();
  window.scrollTo(0, 0);

  if (route === 'requests' || route === 'qr') {
    const activeName = route === 'qr' ? n : (selectedQrName || lamp || 'Maya');
    const url = paymentLink(activeName);
    const box = document.querySelector('#qr');
    if (box && url) {
      const { default: QR } = await import('./qrcode.js');
      const liveBox = document.querySelector('#qr');
      if (liveBox) liveBox.innerHTML = QR(url);
    }
  }
  if (route === 'request') {
    const req = activeReimbursements().find(r => r.id === a);
    const rec = req?.recipients?.find(x => x.id === selectedReqQr.recipientId) || req?.recipients?.[0];
    const url = rec ? (rec.shareUrl || (location.href.split('#')[0] + '#req/' + rec.shareToken)) : '';
    const box = document.querySelector('#req-qr');
    if (box && url) {
      const { default: QR } = await import('./qrcode.js');
      const liveBox = document.querySelector('#req-qr');
      if (liveBox) liveBox.innerHTML = QR(url);
    }
  }
}

window.addEventListener('hashchange', render);
detectBackend().then(render);
