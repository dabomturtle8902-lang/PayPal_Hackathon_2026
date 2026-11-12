import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {timingSafeEqual, randomUUID, createHmac} from 'node:crypto';
import {FX_RATES_USD, FX_REFERENCE_DATE, convertAmountCents, defaultContacts, fxQuote, names, normalizeCurrency, secret} from './store.mjs';

const fail = (status, message) => { throw Object.assign(new Error(message), {status}); };
function equal(a, b) {
  const x = Buffer.from(a || ''), y = Buffer.from(b || '');
  return x.length === y.length && timingSafeEqual(x, y);
}
const safeOrder = id => typeof id === 'string' && /^[A-Z0-9-]{1,80}$/.test(id);

function defaultDelivery() {
  const emailConfigured = Boolean(process.env.SMTP_URL || process.env.RESEND_API_KEY);
  const smsConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  return {
    emailConfigured,
    smsConfigured,
    async send({channel, recipient}) {
      if (channel === 'email' && !emailConfigured) {
        return {ok: false, message: `Email delivery not configured for ${recipient.name}. Copy link or Show QR instead.`};
      }
      if (channel === 'sms' && !smsConfigured) {
        return {ok: false, message: `SMS delivery not configured for ${recipient.name}. Copy link or Show QR instead.`};
      }
      return {ok: false, message: `Live ${channel} transport handler not connected.`};
    },
  };
}

export function createApp({store, paypal, nvidia, delivery, organizerToken, baseUrl, flutterOrigin = '', localOrganizerAutoLogin = false, envOrganizerAutoLogin = false, allowedHosts = null, allowedOrigins = null, loadRates = async () => ({rates: FX_RATES_USD, date: FX_REFERENCE_DATE}), staticDir}) {
  const base = new URL(baseUrl);
  const hostAllowlist = new Set((allowedHosts && allowedHosts.length ? allowedHosts : [base.host]).filter(Boolean));
  const originAllowlist = new Set((allowedOrigins && allowedOrigins.length ? allowedOrigins : [base.origin, flutterOrigin]).filter(Boolean));
  const deliv = delivery || defaultDelivery();
  const participants = () => Object.values(store.state.participants);
  const sessionKey = createHmac('sha256', organizerToken).update('splitsync-session-v1').digest('hex');

  const publicShare = p => ({
    name: p.name, amountCents: p.amountCents, currency: 'USD', status: p.status, receipt: p.receipt,
    lamp: store.state.lamp, published: store.state.published, merchant: 'Sandbox Merchant', purchaseTitle: 'Move-in essentials',
  });
  const admin = p => ({...publicShare(p), shareUrl: `${base.origin}/#pay/${p.shareToken}`});
  const providerSummary = () => ({
    paypalConfigured: Boolean(paypal?.configured),
    paypalFlow: 'commercial-orders-v2-ss001-only',
    aiConfigured: Boolean(nvidia?.configured),
    ttsConfigured: Boolean(nvidia?.configured),
    sttConfigured: Boolean(nvidia?.transcribe),
    emailConfigured: Boolean(deliv.emailConfigured),
    smsConfigured: Boolean(deliv.smsConfigured),
  });
  const adminReimbursement = req => ({
    ...req,
    recipients: req.recipients.map(r => ({...r, shareUrl: `${base.origin}/#req/${r.shareToken}`})),
  });
  const publicReimbursement = (req, r) => ({
    mode: 'reimbursement',
    demo: req.demo === true,
    requestId: req.id,
    title: req.title,
    merchant: req.merchant,
    billDate: req.billDate,
    currency: r.currency || req.currency || 'USD',
    totalBillCents: req.totalCents,
    items: req.items,
    taxCents: req.taxCents,
    tipCents: req.tipCents,
    evidenceImageDataUrl: req.evidenceImageDataUrl || '',
    recipientName: r.name,
    amountCents: r.amountCents,
    reason: r.reason,
    status: r.status,
    deliveryStatus: r.deliveryStatus,
    receiptRef: r.receiptRef || null,
    paypalCheckoutSupported: false,
    note: req.demo ? 'Practice request with simulated settlement. No money moves.' : 'Personal receipt reimbursement request. PayPal Sandbox merchant checkout applies only to Sandbox Merchant purchases (SS-001).',
  });

  function sameOriginRequest(req) {
    return (!req.headers.origin || originAllowlist.has(req.headers.origin))
      && req.headers['sec-fetch-site'] !== 'cross-site';
  }

  function localOrganizer(req) {
    return localOrganizerAutoLogin
      && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
      && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)
      && sameOriginRequest(req);
  }

  function envAutoOrganizer(req) {
    return envOrganizerAutoLogin && sameOriginRequest(req);
  }

  function organizer(req) {
    return localOrganizer(req) || envAutoOrganizer(req) || equal(req.headers.authorization, `Bearer ${organizerToken}`)
      || equal((req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('splitsync_session='))?.slice(18), sessionKey);
  }

  function checkOrder(data, p, order) {
    if (data.id !== order.id || data.intent !== 'CAPTURE' || data.purchase_units?.length !== 1) fail(502, 'PayPal order did not match this share.');
    const unit = data.purchase_units[0];
    if (unit.custom_id !== order.customId || unit.reference_id !== order.referenceId || unit.amount?.currency_code !== 'USD' || unit.amount.value !== (p.amountCents / 100).toFixed(2)) {
      fail(502, 'PayPal amount or purchase reference did not match.');
    }
    return unit;
  }

  function apply(data, p, order) {
    const unit = checkOrder(data, p, order);
    const captures = unit.payments?.captures || [];
    if (captures.length > 1) fail(502, 'Unexpected capture count.');
    const capture = captures[0];
    if (!capture) return;
    if (capture.amount?.currency_code !== 'USD' || capture.amount?.value !== (p.amountCents / 100).toFixed(2)) fail(502, 'PayPal capture amount did not match.');
    order.captureId = capture.id;
    if (capture.status === 'COMPLETED') { p.status = 'Paid'; p.receipt = capture.id; order.state = 'paid'; }
    else if (capture.status === 'PENDING') { if (p.status !== 'Paid') p.status = 'Processing'; order.state = 'pending'; }
    else if (['DECLINED', 'FAILED', 'DENIED'].includes(capture.status) && p.status !== 'Paid') { p.status = 'Awaiting payment'; order.state = 'failed'; }
  }

  async function body(req, maxBytes = 65536) {
    if (req.readableEnded && req.body !== undefined) {
      if (typeof req.body === 'string') {
        if (Buffer.byteLength(req.body) > maxBytes) fail(413, 'Request too large.');
        try { return req.body.trim() ? JSON.parse(req.body) : {}; } catch { fail(400, 'Invalid JSON.'); }
      }
      if (Buffer.isBuffer(req.body)) {
        if (req.body.length > maxBytes) fail(413, 'Request too large.');
        try { return req.body.length ? JSON.parse(req.body.toString('utf8')) : {}; } catch { fail(400, 'Invalid JSON.'); }
      }
      if (typeof req.body === 'object' && req.body !== null) {
        if (Buffer.byteLength(JSON.stringify(req.body)) > maxBytes) fail(413, 'Request too large.');
        return req.body;
      }
    }
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > maxBytes) fail(413, 'Request too large.');
      chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
    catch { fail(400, 'Invalid JSON.'); }
  }

  function reconcileDueDemoSettlements() {
    let changed = false;
    const now = Date.now();
    for (const reqItem of store.state.reimbursements || []) {
      if (!reqItem.demo) continue;
      for (const r of reqItem.recipients || []) {
        if (r.status === 'Waiting for payment' && Number.isFinite(r.settleAt) && now >= r.settleAt) {
          r.status = 'Paid';
          r.demoSettled = true;
          r.settledAt ||= new Date(r.settleAt).toISOString();
          r.receiptRef ||= `DEMO-${secret().slice(0, 4).toUpperCase()}`;
          changed = true;
        }
      }
    }
    return changed;
  }

  function validateRecipients(rawRecipients, opts = {}) {
    if (!Array.isArray(rawRecipients) || !rawRecipients.length || rawRecipients.length > 20) {
      fail(400, 'Add between 1 and 20 recipients before confirming.');
    }
    const demoAutoSettle = Boolean(opts.demoAutoSettle);
    const now = Date.now();
    return rawRecipients.map((r, index) => {
      const name = typeof r?.name === 'string' ? r.name.trim().slice(0, 80) : '';
      const amountCents = Number(r?.amountCents);
      const currency = normalizeCurrency(r?.currency, 'USD');
      const targetCurrency = normalizeCurrency(r?.targetCurrency || currency, currency);
      const reason = typeof r?.reason === 'string' && r.reason.trim() ? r.reason.trim().slice(0, 140) : 'Shared expense';
      if (!name) fail(400, 'Every request row requires a recipient name.');
      if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > 100000000 || (currency === 'JPY' && amountCents % 100 !== 0)) {
        fail(400, `Enter a valid positive amount for ${name}.`);
      }
      const quote = fxQuote(amountCents, currency, targetCurrency, opts.rates);
      const jitterMs = (index * 2400) + 2200 + ((index * 537) % 700);
      return {
        id: `REC-${secret().slice(0, 6).toUpperCase()}`,
        name,
        contactId: typeof r?.contactId === 'string' ? r.contactId : null,
        amountCents,
        currency,
        targetCurrency,
        targetAmountCents: quote.targetAmountCents,
        fxRate: quote.rate,
        reason,
        shareToken: secret(),
        status: demoAutoSettle ? 'Waiting for payment' : 'Created',
        deliveryStatus: 'Created',
        deliveryMessage: demoAutoSettle ? 'Practice request active — awaiting simulated payer confirmation.' : '',
        settleAt: demoAutoSettle ? now + jitterMs : null,
        demoSettled: false,
        settledAt: null,
        receiptRef: null,
      };
    });
  }

  async function attemptChannelDelivery(record, channel) {
    const outcomes = [];
    for (const r of record.recipients) {
      if (channel === 'link' || channel === 'manual') {
        r.deliveryStatus = 'Created';
        r.deliveryMessage = 'Share manually via Copy link or Show QR.';
        outcomes.push({recipient: r.name, ok: true, status: r.status, deliveryStatus: r.deliveryStatus, message: r.deliveryMessage});
        continue;
      }
      try {
        const res = await deliv.send({channel, request: record, recipient: r, shareUrl: `${base.origin}/#req/${r.shareToken}`});
        if (res?.ok) {
          r.deliveryStatus = 'Sent';
          r.status = 'Sent';
          r.deliveryMessage = res.message || `Sent via ${channel}`;
          outcomes.push({recipient: r.name, ok: true, status: r.status, deliveryStatus: r.deliveryStatus, message: r.deliveryMessage});
        } else {
          r.deliveryStatus = 'Failed';
          if (r.status === 'Sent') r.status = 'Created';
          r.deliveryMessage = res?.message || `Delivery via ${channel} failed.`;
          outcomes.push({recipient: r.name, ok: false, status: r.status, deliveryStatus: 'Failed', message: r.deliveryMessage});
        }
      } catch (e) {
        r.deliveryStatus = 'Failed';
        if (r.status === 'Sent') r.status = 'Created';
        r.deliveryMessage = e?.message || `Delivery via ${channel} failed.`;
        outcomes.push({recipient: r.name, ok: false, status: r.status, deliveryStatus: 'Failed', message: r.deliveryMessage});
      }
    }
    return outcomes;
  }

  async function handler(req, res) {
    const send = (code, data, headers = {}) => {
      res.writeHead(code, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers});
      res.end(JSON.stringify(data));
    };
    try {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('X-Frame-Options', 'DENY');
      const url = new URL(req.url, base), path = url.pathname;
      if (req.headers.host && !hostAllowlist.has(req.headers.host)) fail(400, 'Use the configured PUBLIC_BASE_URL host.');
      if (flutterOrigin && req.headers.origin === flutterOrigin) {
        res.setHeader('Access-Control-Allow-Origin', flutterOrigin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      }
      if (req.method === 'OPTIONS') {
        if (req.headers.origin !== flutterOrigin) fail(403, 'Origin not allowed.');
        res.writeHead(204); res.end(); return;
      }
      if (req.method === 'POST' && path !== '/api/paypal/webhook') {
        if (req.headers.origin && !originAllowlist.has(req.headers.origin)) fail(403, 'Origin not allowed.');
        if (!req.headers['content-type']?.startsWith('application/json')) fail(415, 'Use application/json.');
      }

      if (path === '/api/fx-rates' && req.method === 'GET') {
        return send(200, await loadRates());
      }
      if (path === '/api/health' && req.method === 'GET') {
        const p = providerSummary();
        return send(200, {mode: 'sandbox', localOrganizerAutoLogin: Boolean(localOrganizer(req) || envAutoOrganizer(req)), configured: p.paypalConfigured, aiConfigured: p.aiConfigured, ...p});
      }
      if (path === '/api/organizer/session' && req.method === 'POST') {
        const input = await body(req);
        if (!equal(input.token, organizerToken)) fail(401, 'Invalid organizer key.');
        return send(200, {ok: true}, {'Set-Cookie': `splitsync_session=${sessionKey}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${base.protocol === 'https:' ? '; Secure' : ''}`});
      }
      if (path === '/api/organizer/logout' && req.method === 'POST') {
        return send(200, {ok: true}, {'Set-Cookie': `splitsync_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${base.protocol === 'https:' ? '; Secure' : ''}`});
      }

      if (path.startsWith('/api/organizer/')) {
        if (!organizer(req)) fail(401, 'Enter the organizer key printed in the server terminal.');
        if (path === '/api/organizer/purchase' && req.method === 'GET') {
          return send(200, {
            purchaseId: 'SS-001', lamp: store.state.lamp, published: store.state.published,
            participants: participants().map(admin), configured: paypal.configured, aiConfigured: Boolean(nvidia?.configured),
          });
        }
        if (path === '/api/organizer/state' && req.method === 'GET') {
          const {rates, date} = await loadRates();
          return await store.exclusive(async () => {
            if (reconcileDueDemoSettlements()) await store.save();
            return send(200, {
              purchase: {
                purchaseId: 'SS-001', lamp: store.state.lamp, published: store.state.published,
                participants: participants().map(admin),
              },
              contacts: store.state.contacts || [],
              reimbursements: (store.state.reimbursements || []).map(adminReimbursement),
              demoTransactions: store.state.demoTransactions || [],
              savedRentRule: store.state.savedRentRule || null,
              fxRates: rates,
              fxRateDate: date,
              providers: providerSummary(),
            });
          });
        }
        if (path === '/api/organizer/demo-pay' && req.method === 'POST') {
          const payload = await body(req);
          const batch = Object.hasOwn(payload ?? {}, 'payments');
          const inputs = batch ? payload.payments : [payload];
          if (!Array.isArray(inputs) || !inputs.length || inputs.length > 20) {
            fail(400, 'Choose between 1 and 20 payments.');
          }
          const contacts = store.state.contacts || [];
          const {rates, date} = await loadRates();
          const payments = inputs.map(input => {
            const clientTxId = typeof input?.clientTxId === 'string' ? input.clientTxId.trim().slice(0, 80) : '';
            const contact = contacts.find(c => c.id === input?.contactId)
              || contacts.find(c => c.name.toLowerCase() === String(input?.recipientName || '').trim().toLowerCase());
            const recipientName = contact?.name || (typeof input?.recipientName === 'string' ? input.recipientName.trim().slice(0, 80) : '');
            if (!recipientName || (batch && !contact)) fail(400, 'Choose a recipient before paying.');
            const sourceCurrency = normalizeCurrency(input?.sourceCurrency, 'USD');
            const targetCurrency = normalizeCurrency(input?.targetCurrency || contact?.currency || sourceCurrency, sourceCurrency);
            const enteredSide = input?.enteredSide === 'receive' ? 'receive' : 'send';
            const enteredCents = Number(enteredSide === 'receive' ? input?.targetAmountCents : input?.sourceAmountCents);
            const checkedCurr = enteredSide === 'receive' ? targetCurrency : sourceCurrency;
            if (!Number.isInteger(enteredCents) || enteredCents <= 0 || enteredCents > 100000000 || (checkedCurr === 'JPY' && enteredCents % 100 !== 0)) {
              fail(400, 'Enter a valid positive amount.');
            }
            const computed = fxQuote(enteredCents, sourceCurrency, targetCurrency, rates, enteredSide);
            const counterVal = Number(enteredSide === 'receive' ? input?.sourceAmountCents : input?.targetAmountCents);
            const expectedCounter = enteredSide === 'receive' ? computed.sourceAmountCents : computed.targetAmountCents;
            const tolerance = Math.max(200, Math.round(expectedCounter * 0.05));
            const lockedCounter = Number.isInteger(counterVal) && counterVal > 0 && Math.abs(counterVal - expectedCounter) <= tolerance
              ? ((enteredSide === 'receive' ? sourceCurrency : targetCurrency) === 'JPY' && counterVal % 100 !== 0 ? expectedCounter : counterVal)
              : expectedCounter;
            const quote = {
              ...computed,
              sourceAmountCents: enteredSide === 'receive' ? lockedCounter : computed.sourceAmountCents,
              targetAmountCents: enteredSide === 'receive' ? computed.targetAmountCents : lockedCounter,
              rate: typeof input?.reviewedRate === 'number' && Number.isFinite(input.reviewedRate) && input.reviewedRate > 0 ? input.reviewedRate : computed.rate,
            };
            const note = typeof input?.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 140) : 'Payment';
            const type = input?.type === 'store-demo' ? 'store-demo' : 'demo-send';
            return {clientTxId, contact, recipientName, note, type, rateDate: typeof input?.reviewedRateDate === 'string' ? input.reviewedRateDate.slice(0, 20) : date, quote};
          });
          const ids = payments.map(p => p.clientTxId);
          if (batch && (ids.includes('') || new Set(ids).size !== ids.length)) {
            fail(400, 'Each payment needs a unique transaction reference.');
          }
          return await store.exclusive(async () => {
            const previous = store.state.demoTransactions || [];
            const created = [];
            const transactions = payments.map(({clientTxId, contact, recipientName, note, type, rateDate: lockedDate, quote}) => {
              const existing = clientTxId && previous.find(tx => tx.clientTxId === clientTxId);
              if (existing) return existing;
              const tx = {
                id: 'DTX-' + secret().slice(0, 6).toUpperCase(),
                clientTxId: clientTxId || randomUUID(),
                type,
                direction: 'outgoing',
                enteredSide: quote.enteredSide,
                recipientName,
                contactId: contact?.id || null,
                country: contact?.country || '',
                flag: contact?.flag || '',
                sourceAmountCents: quote.sourceAmountCents,
                sourceCurrency: quote.sourceCurrency,
                targetAmountCents: quote.targetAmountCents,
                targetCurrency: quote.targetCurrency,
                inrEquivalentCents: quote.inrEquivalentCents,
                rate: quote.rate,
                rateDate: lockedDate || date,
                rateLabel: 'Demo rate',
                note,
                status: 'Completed',
                demo: true,
                createdAt: new Date().toISOString(),
              };
              created.push(tx);
              return tx;
            });
            if (created.length) {
              store.state.demoTransactions = [...created, ...previous];
              try {
                await store.save();
              } catch (error) {
                store.state.demoTransactions = previous;
                throw error;
              }
            }
            return send(200, batch ? {transactions} : {transaction: transactions[0], deduplicated: !created.length});
          });
        }
        if (path === '/api/organizer/rent-rule' && req.method === 'POST') {
          const input = await body(req);
          return await store.exclusive(async () => {
            if (input?.clear) {
              store.state.savedRentRule = null;
            } else {
              const contactIds = Array.isArray(input?.contactIds) ? input.contactIds.map(String).slice(0, 20) : [];
              const totalCents = Math.max(0, Number.isInteger(input?.totalCents) ? input.totalCents : 0);
              if (!contactIds.length || totalCents <= 0) fail(400, 'Select household contacts and a positive rent amount before saving.');
              store.state.savedRentRule = {
                contactIds,
                totalCents,
                currency: normalizeCurrency(input?.currency, 'USD'),
                mode: input?.mode === 'custom' ? 'custom' : 'equal',
                customShares: input?.customShares && typeof input.customShares === 'object' ? input.customShares : {},
                dayOfMonth: Math.min(28, Math.max(1, Number(input?.dayOfMonth) || 1)),
                savedAt: new Date().toISOString(),
              };
            }
            await store.save();
            return send(200, {savedRentRule: store.state.savedRentRule});
          });
        }
        if (path === '/api/organizer/reset-demo' && req.method === 'POST') {
          return await store.exclusive(async () => {
            store.state.reimbursements = (store.state.reimbursements || []).filter(record => !record.demo);
            store.state.demoTransactions = [];
            store.state.savedRentRule = null;
            await store.save();
            return send(200, {ok: true});
          });
        }
        if (path === '/api/organizer/contacts' && req.method === 'POST') {
          const input = await body(req);
          const name = typeof input?.name === 'string' ? input.name.trim().slice(0, 60) : '';
          if (!name) fail(400, 'Enter a contact name.');
          return await store.exclusive(async () => {
            store.state.contacts ||= [];
            const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + secret().slice(0, 4);
            const contact = {
              id,
              name,
              handle: typeof input?.handle === 'string' ? input.handle.trim().slice(0, 100) : '',
              phone: typeof input?.phone === 'string' ? input.phone.trim().slice(0, 30) : '',
              note: typeof input?.note === 'string' ? input.note.trim().slice(0, 60) : 'Contact',
            };
            store.state.contacts.push(contact);
            await store.save();
            return send(200, {contact, contacts: store.state.contacts});
          });
        }
        if (path === '/api/organizer/suggest-split' && req.method === 'POST') {
          const input = await body(req);
          if (typeof input?.instruction !== 'string' || !input.instruction.trim() || input.instruction.length > 1000) {
            fail(400, 'Enter a split instruction of up to 1,000 characters.');
          }
          if (!nvidia) fail(503, 'NVIDIA is not configured.');
          const owner = await nvidia.suggest(input.instruction);
          return send(200, {lamp: names.includes(owner) ? owner : null});
        }
        if (path === '/api/organizer/read-split' && req.method === 'POST') {
          const input = await body(req);
          if (!names.includes(input?.lamp)) fail(400, 'Choose a valid lamp owner.');
          if (!nvidia) fail(503, 'NVIDIA is not configured.');
          const amounts = names.map(name => name + ' owes ' + (name === input.lamp ? '70' : '40') + ' dollars.');
          const audio = await nvidia.speak('Move-in essentials. ' + amounts.join(' ') + ' The total is 150 US dollars.');
          return send(200, {audio: audio.toString('base64')});
        }
        if (path === '/api/organizer/extract-bill' && req.method === 'POST') {
          const input = await body(req, 4 * 1024 * 1024);
          if (!nvidia?.extractBill) fail(503, 'AI bill extraction is not configured.');
          const extracted = await nvidia.extractBill({imageDataUrl: input?.imageDataUrl});
          return send(200, extracted);
        }
        if (path === '/api/organizer/transcribe' && req.method === 'POST') {
          const input = await body(req, 4 * 1024 * 1024);
          if (!nvidia?.transcribe) fail(503, 'Speech-to-text is not configured on the backend.');
          const result = await nvidia.transcribe({audioBase64: input?.audioBase64, mimeType: input?.mimeType, contacts: store.state.contacts || []});
          return send(200, result);
        }
        if (path === '/api/organizer/parse-request' && req.method === 'POST') {
          const input = await body(req);
          if (typeof input?.transcript !== 'string' || !input.transcript.trim() || input.transcript.length > 1000) {
            fail(400, 'Dictate or enter a split instruction of up to 1,000 characters.');
          }
          if (!nvidia?.parseRequest) fail(503, 'AI request parser is not configured.');
          const draft = await nvidia.parseRequest({
            transcript: input.transcript,
            contacts: store.state.contacts || [],
            bill: input.bill || null,
            currentDraft: Array.isArray(input?.currentDraft) ? input.currentDraft : null,
            rates: (await loadRates()).rates,
            lastIntent: typeof input?.lastIntent === 'string' ? input.lastIntent : '',
          });
          return send(200, draft);
        }
        if (path === '/api/organizer/read-text' && req.method === 'POST') {
          const input = await body(req);
          const text = typeof input?.text === 'string' ? input.text.trim() : '';
          if (!text || text.length > 400) fail(400, 'Provide a confirmation phrase up to 400 characters.');
          if (!nvidia?.speak) fail(503, 'Chatterbox speech output is not configured.');
          const audio = await nvidia.speak(text);
          return send(200, {audio: audio.toString('base64')});
        }
        if (path === '/api/organizer/split' && req.method === 'POST') {
          const input = await body(req);
          return await store.exclusive(async () => {
            if (!names.includes(input.lamp)) fail(400, 'Choose a valid lamp owner.');
            if (input.lamp !== store.state.lamp && participants().some(p => p.orders.length)) fail(409, 'Payment orders already exist. Allocations are locked for this purchase.');
            store.state.lamp = input.lamp; store.state.published = true;
            participants().forEach(p => p.amountCents = p.name === input.lamp ? 7000 : 4000);
            await store.save();
            return send(200, {participants: participants().map(admin), lamp: store.state.lamp, published: true});
          });
        }
        if (path === '/api/organizer/requests' && req.method === 'POST') {
          const input = await body(req, 2 * 1024 * 1024);
          const channel = ['demo', 'link', 'manual', 'email', 'sms'].includes(input?.channel) ? input.channel : 'demo';
          const demoAutoSettle = Boolean(input?.demoAutoSettle || channel === 'demo');
          const clientRequestId = typeof input?.clientRequestId === 'string' ? input.clientRequestId.trim().slice(0, 80) : '';
          const {rates} = await loadRates();
          const requested = Array.isArray(input?.recipients)
            ? input.recipients.filter(row => row?.contactId !== 'leah')
            : input?.recipients;
          const recipients = validateRecipients(requested, {demoAutoSettle, rates});
          const items = Array.isArray(input?.items)
            ? input.items.slice(0, 30).map(i => ({
                name: String(i?.name || 'Item').trim().slice(0, 100),
                amountCents: Math.max(0, Number.isInteger(i?.amountCents) ? i.amountCents : 0),
              }))
            : [];
          const evidence = typeof input?.evidenceImageDataUrl === 'string' && input.evidenceImageDataUrl.length <= 1500000
            ? input.evidenceImageDataUrl
            : '';

          return await store.exclusive(async () => {
            store.state.reimbursements ||= [];
            if (clientRequestId) {
              const dup = store.state.reimbursements.find(r => r.clientRequestId === clientRequestId);
              if (dup) return send(200, {request: adminReimbursement(dup), deliveryOutcomes: [], deduplicated: true});
            }
            const currency = normalizeCurrency(input?.currency, recipients[0].currency);
            const allocated = recipients.reduce((sum, row) => sum + convertAmountCents(row.amountCents, row.currency, currency, rates), 0);
            const totalCents = Number.isInteger(input?.totalCents) && input.totalCents > 0 ? input.totalCents : allocated;
            const record = {
              id: `REQ-${secret().slice(0, 6).toUpperCase()}`,
              clientRequestId: clientRequestId || randomUUID(),
              createdAt: new Date().toISOString(),
              mode: demoAutoSettle ? 'demo-request' : 'reimbursement',
              kind: ['receipt', 'request', 'rent', 'electricity', 'store'].includes(input?.kind) ? input.kind : 'request',
              demo: demoAutoSettle,
              dueDate: typeof input?.dueDate === 'string' ? input.dueDate.trim().slice(0, 40) : '',
              title: typeof input?.title === 'string' && input.title.trim() ? input.title.trim().slice(0, 100) : (String(input?.merchant || '').trim() || 'Money request'),
              merchant: typeof input?.merchant === 'string' && input.merchant.trim() ? input.merchant.trim().slice(0, 100) : 'Personal request',
              billDate: typeof input?.billDate === 'string' ? input.billDate.trim().slice(0, 40) : '',
              currency,
              items,
              taxCents: Math.max(0, Number.isInteger(input?.taxCents) ? input.taxCents : 0),
              tipCents: Math.max(0, Number.isInteger(input?.tipCents) ? input.tipCents : 0),
              totalCents,
              ownShareCents: Math.max(0, totalCents - allocated),
              evidenceImageDataUrl: evidence,
              transcript: typeof input?.transcript === 'string' ? input.transcript.trim().slice(0, 1000) : '',
              channel,
              recipients,
            };
            const deliveryOutcomes = demoAutoSettle
              ? recipients.map(r => ({recipient: r.name, ok: true, status: r.status, deliveryStatus: r.deliveryStatus, message: r.deliveryMessage}))
              : await attemptChannelDelivery(record, channel);
            store.state.reimbursements.unshift(record);
            await store.save();
            return send(200, {request: adminReimbursement(record), deliveryOutcomes});
          });
        }
        const deliverMatch = path.match(/^\/api\/organizer\/requests\/([A-Za-z0-9-]+)\/deliver$/);
        if (deliverMatch && req.method === 'POST') {
          const input = await body(req);
          const reqId = deliverMatch[1];
          return await store.exclusive(async () => {
            const record = (store.state.reimbursements || []).find(r => r.id === reqId);
            if (!record) fail(404, 'Request not found.');
            if (input?.action === 'mark_shared') {
              const targetRid = input?.recipientId;
              for (const r of record.recipients) {
                if (!targetRid || r.id === targetRid) {
                  if (r.status === 'Created') r.status = 'Sent';
                  r.deliveryStatus = 'Sent';
                  r.deliveryMessage = 'Shared manually via private link/QR.';
                }
              }
              await store.save();
              return send(200, {request: adminReimbursement(record), deliveryOutcomes: [{ok: true, status: 'Sent', message: 'Marked as shared manually.'}]});
            }
            const channel = ['email', 'sms', 'link'].includes(input?.channel) ? input.channel : record.channel;
            const deliveryOutcomes = await attemptChannelDelivery(record, channel);
            await store.save();
            return send(200, {request: adminReimbursement(record), deliveryOutcomes});
          });
        }
        const recStatusMatch = path.match(/^\/api\/organizer\/requests\/([A-Za-z0-9-]+)\/recipients\/([A-Za-z0-9-]+)\/status$/);
        if (recStatusMatch && req.method === 'POST') {
          const input = await body(req);
          const [, reqId, recId] = recStatusMatch;
          const nextStatus = input?.status;
          if (!['Created', 'Sent', 'Processing', 'Paid'].includes(nextStatus)) fail(400, 'Invalid status.');
          return await store.exclusive(async () => {
            const record = (store.state.reimbursements || []).find(r => r.id === reqId);
            const rec = record?.recipients?.find(r => r.id === recId);
            if (!rec) fail(404, 'Recipient request not found.');
            rec.status = nextStatus;
            if (nextStatus === 'Paid' && !rec.receiptRef) rec.receiptRef = `REIMB-${secret().slice(0, 4).toUpperCase()}`;
            await store.save();
            return send(200, {request: adminReimbursement(record)});
          });
        }
      }

      if (path.startsWith('/api/reimbursements/') && req.method === 'GET') {
        const token = path.slice('/api/reimbursements/'.length);
        for (const reqItem of store.state.reimbursements || []) {
          const rec = (reqItem.recipients || []).find(r => equal(r.shareToken, token));
          if (rec) return send(200, publicReimbursement(reqItem, rec));
        }
        fail(404, 'Reimbursement link not found.');
      }

      if (path.startsWith('/api/shares/')) {
        const [, , , token, action] = path.split('/');
        const p = participants().find(p => equal(p.shareToken, token));
        if (!p || !store.state.published) fail(404, 'Payment link not found or split not published.');
        if (req.method === 'GET' && !action) return send(200, publicShare(p));
        if (req.method === 'POST' && ['orders', 'capture', 'refresh'].includes(action)) {
          const input = await body(req);
          return await store.exclusive(async () => {
            if (action === 'orders') {
              if (p.status === 'Paid') return send(200, {share: publicShare(p), alreadyPaid: true});
              if (!paypal.configured) fail(503, 'Add your Sandbox Client ID and Secret to server/.env, then restart.');
              let order = p.orders.at(-1);
              if (!order || order.state === 'failed') {
                const attempt = secret();
                order = {requestId: randomUUID(), captureRequestId: randomUUID(), customId: `SS-001:${p.name}:${attempt}`, referenceId: `SS-001-${p.name}`, state: 'creating'};
                p.orders.push(order); await store.save();
              }
              if (order.state === 'pending') return send(200, {share: publicShare(p), pending: true});
              if (order.id) {
                const current = await paypal.get(order.id); apply(current, p, order); await store.save();
                if (p.status === 'Paid') return send(200, {share: publicShare(p), alreadyPaid: true});
                if (p.status === 'Processing') return send(200, {share: publicShare(p), pending: true});
                if (current.status === 'VOIDED') { order.state = 'failed'; await store.save(); fail(409, 'This approval expired. Retry to create a new order.'); }
              }
              if (!order.id) {
                order.startedAt ||= Date.now(); await store.save();
                if (Date.now() - order.startedAt > 5 * 60 * 60 * 1000) fail(409, 'Unresolved order expired locally. Reconcile it in PayPal before retrying.');
                const data = await paypal.create({
                  participant: p.name, amountCents: p.amountCents, customId: order.customId, referenceId: order.referenceId, requestId: order.requestId,
                  returnUrl: `${base.origin}/paypal/return?share=${token}`, cancelUrl: `${base.origin}/paypal/cancel?share=${token}`,
                });
                if (!safeOrder(data.id)) fail(502, 'PayPal returned an invalid order ID.');
                const approval = data.links?.find(l => ['payer-action', 'approve'].includes(l.rel))?.href;
                const link = approval ? new URL(approval) : null;
                if (!link || link.protocol !== 'https:' || link.hostname !== 'www.sandbox.paypal.com') fail(502, 'PayPal did not return a Sandbox approval link.');
                order.id = data.id; order.approvalUrl = approval; order.state = 'created'; await store.save();
              }
              return send(200, {orderId: order.id, approvalUrl: order.approvalUrl});
            }
            const requestedId = input.orderId || (action === 'refresh' ? p.orders.at(-1)?.id : undefined);
            if (action === 'refresh' && !requestedId) return send(200, publicShare(p));
            if (!safeOrder(requestedId)) fail(400, 'Invalid order ID.');
            const order = p.orders.find(o => o.id === requestedId);
            if (!order) fail(404, 'Order not found for this participant.');
            if (p.status === 'Paid') return send(200, publicShare(p));
            let data = await paypal.get(order.id); checkOrder(data, p, order);
            if (action === 'capture' && data.status === 'APPROVED') {
              order.captureStartedAt ||= Date.now(); await store.save();
              if (Date.now() - order.captureStartedAt > 5 * 60 * 60 * 1000) fail(409, 'Reconcile this unresolved capture in PayPal before retrying.');
              try { await paypal.capture(order.id, order.captureRequestId); }
              catch (error) { if (error.issue !== 'ORDER_ALREADY_CAPTURED') throw error; }
              data = await paypal.get(order.id);
            }
            apply(data, p, order); await store.save(); return send(200, publicShare(p));
          });
        }
      }
      if (path === '/api/paypal/webhook' && req.method === 'POST') {
        const event = await body(req);
        if (!await paypal.verify(event, req.headers)) fail(401, 'Invalid PayPal signature.');
        return await store.exclusive(async () => {
          if (!event.id || store.state.events.includes(event.id)) return send(200, {ok: true});
          const id = event.resource?.supplementary_data?.related_ids?.order_id;
          const p = participants().find(p => p.orders.some(o => o.id === id));
          if (p) { const order = p.orders.find(o => o.id === id); apply(await paypal.get(id), p, order); }
          store.state.events.push(event.id); store.state.events = store.state.events.slice(-2000); await store.save();
          return send(200, {ok: true});
        });
      }
      if (['/paypal/return', '/paypal/cancel'].includes(path) && req.method === 'GET') {
        const token = url.searchParams.get('share');
        if (!participants().some(p => equal(p.shareToken, token))) fail(404, 'Unknown payment link.');
        const orderId = url.searchParams.get('token') || '';
        const query = new URLSearchParams(path.endsWith('cancel') ? {cancelled: '1'} : {order: orderId, returned: '1'});
        res.writeHead(303, {Location: `${base.origin}/#pay/${token}?${query}`, 'Cache-Control': 'no-store'}); res.end(); return;
      }
      if (path.startsWith('/api/')) fail(404, 'API endpoint not found.');
      if (req.method !== 'GET' && req.method !== 'HEAD') fail(405, 'Method not allowed.');
      const file = resolve(staticDir, '.' + decodeURIComponent(path === '/' ? '/index.html' : path));
      if (!file.startsWith(resolve(staticDir) + sep)) fail(403, 'Forbidden.');
      const data = await readFile(file);
      const type = {
        '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
        '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
      }[extname(file)] || 'application/octet-stream';
      res.writeHead(200, {'Content-Type': type, 'Cache-Control': 'no-cache'}); res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      const code = error.code === 'ENOENT' ? 404 : (error.status || 500);
      send(code, {error: code === 500 ? 'Server error. Check the local server setup; retry safely.' : error.message});
    }
  }
  return {handler, server: createServer(handler)};
}
