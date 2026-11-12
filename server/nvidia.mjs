import {execFile} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import http2 from 'node:http2';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {gunzipSync} from 'node:zlib';
import {convertAmountCents, formatMoney, fxQuote, normalizeCurrency} from './store.mjs';

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const transcribeScript = fileURLToPath(new URL('./transcribe.py', import.meta.url));
const unavailable = (status, message) => Object.assign(new Error(message), {status});
const RIVA_TTS_URL = 'https://grpc.nvcf.nvidia.com:443';
const RIVA_TTS_METHOD = '/nvidia.riva.tts.RivaSpeechSynthesis/Synthesize';
const CHATTERBOX_FUNCTION_ID = 'ddacc747-1269-4fab-bfd9-8f593dead106';
const CHATTERBOX_VOICE = 'Chatterbox-Multilingual.en-US.Male';
const CHATTERBOX_LANGUAGE = 'en-US';
const CHATTERBOX_SAMPLE_RATE = 22050;
const LINEAR_PCM_ENCODING = 1;

function encodeVarint(value) {
  const bytes = [];
  let v = value >>> 0;
  while (v >= 0x80) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  bytes.push(v);
  return Buffer.from(bytes);
}

function encodeStringField(fieldNumber, text) {
  if (!text) return Buffer.alloc(0);
  const data = Buffer.from(String(text), 'utf8');
  return Buffer.concat([encodeVarint((fieldNumber << 3) | 2), encodeVarint(data.length), data]);
}

function encodeVarintField(fieldNumber, value) {
  if (!value) return Buffer.alloc(0);
  return Buffer.concat([encodeVarint((fieldNumber << 3) | 0), encodeVarint(value)]);
}

export function encodeSynthesizeRequest({
  text,
  languageCode = CHATTERBOX_LANGUAGE,
  encoding = LINEAR_PCM_ENCODING,
  sampleRateHz = CHATTERBOX_SAMPLE_RATE,
  voiceName = CHATTERBOX_VOICE,
}) {
  return Buffer.concat([
    encodeStringField(1, text),
    encodeStringField(2, languageCode),
    encodeVarintField(3, encoding),
    encodeVarintField(4, sampleRateHz),
    encodeStringField(5, voiceName),
  ]);
}

function readVarint(buf, offset) {
  let result = 0n;
  let shift = 0n;
  let pos = offset;
  while (pos < buf.length) {
    const byte = buf[pos++];
    result |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return {value: result, nextOffset: pos};
    shift += 7n;
    if (shift > 63n) throw new Error('Malformed protobuf varint');
  }
  throw new Error('Truncated protobuf varint');
}

export function decodeSynthesizeResponse(buf) {
  const audioChunks = [];
  let offset = 0;
  while (offset < buf.length) {
    const tag = readVarint(buf, offset);
    offset = tag.nextOffset;
    const fieldNumber = Number(tag.value >> 3n);
    const wireType = Number(tag.value & 7n);
    if (wireType === 0) {
      offset = readVarint(buf, offset).nextOffset;
    } else if (wireType === 1) {
      offset += 8;
    } else if (wireType === 2) {
      const len = readVarint(buf, offset);
      const size = Number(len.value);
      const end = len.nextOffset + size;
      if (end > buf.length) throw new Error('Truncated protobuf field');
      if (fieldNumber === 1) audioChunks.push(buf.subarray(len.nextOffset, end));
      offset = end;
    } else if (wireType === 5) {
      offset += 4;
    } else {
      throw new Error(`Unsupported protobuf wire type ${wireType}`);
    }
    if (offset > buf.length) throw new Error('Truncated protobuf message');
  }
  return Buffer.concat(audioChunks);
}

export function pcmToWav(pcm, sampleRate = CHATTERBOX_SAMPLE_RATE, channels = 1, bitsPerSample = 16) {
  const header = Buffer.allocUnsafe(44);
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  header.write('RIFF', 0, 4, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 4, 'ascii');
  header.write('fmt ', 12, 4, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 4, 'ascii');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function callRivaTts({
  text,
  key,
  url = process.env.NVIDIA_TTS_URL || RIVA_TTS_URL,
  functionId = CHATTERBOX_FUNCTION_ID,
  voiceName = CHATTERBOX_VOICE,
  languageCode = CHATTERBOX_LANGUAGE,
  sampleRateHz = CHATTERBOX_SAMPLE_RATE,
  timeoutMs = Number(process.env.CHATTERBOX_TIMEOUT_MS || 22000),
  connectOptions,
}) {
  const payload = encodeSynthesizeRequest({text, languageCode, encoding: LINEAR_PCM_ENCODING, sampleRateHz, voiceName});
  const frame = Buffer.allocUnsafe(5 + payload.length);
  frame[0] = 0;
  frame.writeUInt32BE(payload.length, 1);
  payload.copy(frame, 5);

  return new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    let client;
    let req;
    const chunks = [];
    let httpStatus = 0;
    let grpcEncoding = '';
    let headerGrpcStatus;
    let headerGrpcMessage = '';
    let trailerGrpcStatus;
    let trailerGrpcMessage = '';

    const cleanup = () => {
      clearTimeout(timer);
      try { req?.close(); } catch {}
      try { client?.close(); } catch {}
    };
    const succeed = value => {
      if (settled) return;
      settled = true;
      cleanup();
      resolvePromise(value);
    };
    const fail = err => {
      if (settled) return;
      settled = true;
      cleanup();
      rejectPromise(err instanceof Error ? err : new Error(String(err)));
    };

    const timer = setTimeout(() => fail(new Error(`gRPC request timed out after ${timeoutMs}ms`)), timeoutMs);

    try {
      client = http2.connect(url, connectOptions);
    } catch (err) {
      fail(err);
      return;
    }

    client.on('error', fail);

    req = client.request({
      ':method': 'POST',
      ':path': RIVA_TTS_METHOD,
      'content-type': 'application/grpc',
      te: 'trailers',
      'grpc-accept-encoding': 'identity,gzip',
      'function-id': functionId,
      authorization: `Bearer ${key}`,
    });

    req.on('response', headers => {
      httpStatus = Number(headers[':status'] || 0);
      grpcEncoding = String(headers['grpc-encoding'] || '');
      if (headers['grpc-status'] !== undefined) headerGrpcStatus = String(headers['grpc-status']);
      if (headers['grpc-message'] !== undefined) headerGrpcMessage = String(headers['grpc-message']);
    });

    req.on('data', chunk => {
      chunks.push(chunk);
    });

    req.on('trailers', trailers => {
      if (trailers['grpc-status'] !== undefined) trailerGrpcStatus = String(trailers['grpc-status']);
      if (trailers['grpc-message'] !== undefined) trailerGrpcMessage = String(trailers['grpc-message']);
    });

    req.on('error', fail);

    req.on('end', () => {
      try {
        const grpcStatus = trailerGrpcStatus ?? headerGrpcStatus;
        const rawGrpcMessage = trailerGrpcMessage || headerGrpcMessage;
        let grpcMessage = rawGrpcMessage;
        try {
          grpcMessage = decodeURIComponent(rawGrpcMessage);
        } catch {}

        if (httpStatus && httpStatus !== 200) {
          throw new Error(`HTTP ${httpStatus}${grpcMessage ? `: ${grpcMessage}` : ''}`);
        }
        if (grpcStatus !== undefined && grpcStatus !== '0') {
          throw new Error(`gRPC status ${grpcStatus}${grpcMessage ? `: ${grpcMessage}` : ''}`);
        }

        const body = Buffer.concat(chunks);
        const pcmParts = [];
        let offset = 0;
        while (offset + 5 <= body.length) {
          const compressed = body[offset];
          const frameLength = body.readUInt32BE(offset + 1);
          const end = offset + 5 + frameLength;
          if (end > body.length) throw new Error('Truncated gRPC response frame');
          let message = body.subarray(offset + 5, end);
          if (compressed === 1) {
            if (!/gzip/i.test(grpcEncoding)) {
              throw new Error(`Unsupported gRPC compression: ${grpcEncoding || 'unknown'}`);
            }
            message = gunzipSync(message);
          } else if (compressed !== 0) {
            throw new Error(`Unexpected gRPC compression flag: ${compressed}`);
          }
          const pcm = decodeSynthesizeResponse(message);
          if (pcm.length) pcmParts.push(pcm);
          offset = end;
        }
        if (offset !== body.length) throw new Error('Incomplete gRPC response frame');
        const fullPcm = Buffer.concat(pcmParts);
        if (!fullPcm.length) throw new Error('Empty audio');
        succeed(pcmToWav(fullPcm, sampleRateHz));
      } catch (err) {
        fail(err);
      }
    });

    req.end(frame);
  });
}

export const DEEPSEEK_MODEL = 'deepseek-ai/deepseek-v4.1-flash';
export const FALLBACK_TEXT_MODEL = 'nvidia/nemotron-3.5-lightning-30b-a3b';
export const FALLBACK_VISION_MODEL = 'nvidia/nemotron-3.5-super-vl-120b-a12b';

export function resolvePython(configuredPython) {
  if (configuredPython && configuredPython.trim()) return configuredPython.trim();
  const winVenv = resolve(here, '.venv/Scripts/python.exe');
  if (existsSync(winVenv)) return winVenv;
  const posixVenv = resolve(here, '.venv/bin/python');
  if (existsSync(posixVenv)) return posixVenv;
  return 'python';
}

function stripJsonFences(raw) {
  const text = String(raw || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(candidate.slice(start, end + 1));
  }
  return JSON.parse(candidate);
}

function toCents(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    if (!cleaned) return 0;
    const num = Number(cleaned);
    if (Number.isFinite(num)) return Math.round(num * 100);
  }
  return 0;
}

export function normalizeExtractedBill(raw) {
  const merchant = typeof raw?.merchant === 'string' ? raw.merchant.trim() : '';
  const date = typeof raw?.date === 'string' ? raw.date.trim() : '';
  const currency = typeof raw?.currency === 'string' && /^[A-Z]{3}$/.test(raw.currency.trim().toUpperCase())
    ? raw.currency.trim().toUpperCase()
    : 'USD';

  const rawItems = Array.isArray(raw?.items) ? raw.items : [];
  const items = rawItems
    .map(item => {
      const name = typeof item?.name === 'string' ? item.name.trim() : '';
      const cents = Number.isInteger(item?.amountCents)
        ? item.amountCents
        : toCents(item?.amount ?? item?.price ?? item?.amountCents ?? 0);
      return name ? {name: name.slice(0, 120), amountCents: Math.max(0, cents)} : null;
    })
    .filter(Boolean)
    .slice(0, 40);

  const taxCents = Math.max(0, Number.isInteger(raw?.taxCents) ? raw.taxCents : toCents(raw?.tax ?? 0));
  const tipCents = Math.max(0, Number.isInteger(raw?.tipCents) ? raw.tipCents : toCents(raw?.tip ?? 0));
  const itemsSumCents = items.reduce((sum, i) => sum + i.amountCents, 0);
  const computedTotalCents = itemsSumCents + taxCents + tipCents;
  const totalCents = Math.max(
    0,
    Number.isInteger(raw?.totalCents) && raw.totalCents > 0
      ? raw.totalCents
      : toCents(raw?.total ?? computedTotalCents),
  );

  const unreadableSet = new Set(
    Array.isArray(raw?.unreadableFields) ? raw.unreadableFields.map(f => String(f).trim()).filter(Boolean) : [],
  );
  if (!merchant) unreadableSet.add('merchant');
  if (!date) unreadableSet.add('date');
  if (!items.length) unreadableSet.add('items');
  if (totalCents <= 0) unreadableSet.add('total');

  const totalMismatch = totalCents > 0 && computedTotalCents > 0 && Math.abs(totalCents - computedTotalCents) > 1;
  return {
    merchant: merchant || 'Unreadable merchant',
    date: date || '',
    currency,
    items,
    taxCents,
    tipCents,
    computedTotalCents,
    totalCents: totalCents || computedTotalCents,
    unreadableFields: [...unreadableSet],
    totalMismatch,
  };
}

export function matchContact(name, contacts = []) {
  const q = String(name || '').trim().toLowerCase();
  if (!q) return {contact: null, ambiguous: true, candidates: []};
  const exact = contacts.filter(c => c.name.toLowerCase() === q);
  if (exact.length === 1) return {contact: exact[0], ambiguous: false, candidates: exact};
  const firstWordMatches = contacts.filter(c => {
    const parts = c.name.toLowerCase().split(/\s+/);
    return parts[0] === q || c.name.toLowerCase().includes(q);
  });
  if (firstWordMatches.length === 1) return {contact: firstWordMatches[0], ambiguous: false, candidates: firstWordMatches};
  if (firstWordMatches.length > 1) return {contact: null, ambiguous: true, candidates: firstWordMatches};
  return {contact: null, ambiguous: false, candidates: []};
}

export function buildAssistantReply({intent = 'request', recipients = [], needsClarification = false, clarificationPrompt = '', rates}) {
  if (needsClarification) {
    return clarificationPrompt || 'Which contact and amount did you want to use?';
  }
  if (!recipients.length) {
    return 'Tell me who to pay or request money from, and how much.';
  }
  if (intent === 'send' && recipients.length === 1) {
    const r = recipients[0];
    const targetCurr = normalizeCurrency(r.targetCurrency || r.currency, r.currency);
    const q = fxQuote(r.amountCents, r.currency, targetCurr, rates);
    const conv = q.sourceCurrency !== q.targetCurrency
      ? ` (about ${formatMoney(q.targetAmountCents, q.targetCurrency, true)})`
      : '';
    const note = r.reason && r.reason !== 'Shared expense' && r.reason !== 'Payment'
      ? ` for ${r.reason}`
      : '';
    const loc = r.country ? ` in ${r.country}` : '';
    return `Prepared ${formatMoney(q.sourceAmountCents, q.sourceCurrency, true)}${conv} for ${r.name}${loc}${note}. Verify the recipient and amount before you pay.`;
  }
  if (intent === 'send') {
    return 'Prepared ' + recipients.length + ' payments. Add more recipients or review the draft when you’re ready.';
  }
  const parts = recipients.filter(r => r.contactId !== 'leah').map(r => `${r.name} owes ${formatMoney(r.amountCents, r.currency)} for ${r.reason}`);
  if (!parts.length) return 'Choose someone to request money from.';
  if (parts.length === 1) return `${parts[0]}. Ready to create this request?`;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}. Ready to create both requests?`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}. Ready to create these ${parts.length} requests?`;
}

export function normalizeParsedRequest(raw, contacts = [], bill = null, rates) {
  const intent = raw?.intent === 'send' ? 'send' : 'request';
  const rows = Array.isArray(raw?.recipients) ? raw.recipients : [];
  const recipients = rows.slice(0, 20).map((r, index) => {
    const rawName = String(r?.name || '').trim().slice(0, 80);
    const amountCents = Number.isInteger(r?.amountCents) ? r.amountCents : toCents(r?.amount ?? 0);
    const explicitCurr = typeof r?.currency === 'string' && r.currency.trim()
      ? normalizeCurrency(r.currency, '')
      : '';
    const reason = String(r?.reason || '').trim().slice(0, 140) || (intent === 'send' ? 'Payment' : 'Shared expense');
    const match = matchContact(rawName, contacts);
    const currency = explicitCurr || (intent === 'send' ? (match.contact?.currency || 'USD') : (bill?.currency || 'USD'));
    const targetCurrency = normalizeCurrency(match.contact?.currency || currency, currency);
    const ambiguousName = Boolean(r?.ambiguousName || match.ambiguous || !rawName);
    const unknownContact = Boolean(rawName && !match.contact && !match.ambiguous);
    const ambiguousAmount = Boolean(r?.ambiguousAmount || amountCents <= 0);
    const normalizedCents = currency === 'JPY'
      ? Math.max(0, Math.round(amountCents / 100) * 100)
      : Math.max(0, amountCents);
    const quote = fxQuote(normalizedCents, currency, targetCurrency, rates);
    return {
      id: `draft-${index + 1}`,
      name: match.contact ? match.contact.name : (rawName || `Recipient ${index + 1}`),
      contactId: match.contact?.id || null,
      country: match.contact?.country || '',
      flag: match.contact?.flag || '',
      known: Boolean(match.contact),
      ambiguous: ambiguousName || ambiguousAmount || unknownContact,
      unknownContact,
      candidates: match.candidates.map(c => c.name),
      amountCents: normalizedCents,
      currency,
      targetCurrency,
      targetAmountCents: quote.targetAmountCents,
      fxRate: quote.rate,
      reason,
    };
  });

  const billCurrency = normalizeCurrency(bill?.currency || recipients[0]?.currency);
  const allocatedCents = recipients.reduce(
    (sum, row) => sum + convertAmountCents(row.amountCents, row.currency, billCurrency, rates), 0,
  );
  const billTotalCents = Number.isInteger(bill?.totalCents) ? bill.totalCents : 0;
  const unallocatedCents = billTotalCents > 0 ? billTotalCents - allocatedCents : 0;
  const needsClarification = Boolean(raw?.needsClarification)
    || recipients.length === 0
    || recipients.some(r => r.ambiguous);

  const clarificationPrompt = String(raw?.clarificationPrompt || '').trim()
    || (recipients.length === 0
      ? 'Could not detect a contact and amount. Who is this for, and how much?'
      : recipients.find(r => r.unknownContact)
        ? `Verify "${recipients.find(r => r.unknownContact).name}" against your contacts (${contacts.map(c => c.name).slice(0, 6).join(', ')}).`
        : recipients.find(r => r.ambiguous)
          ? 'Please confirm the contact or amount before continuing.'
          : '');

  const replyText = buildAssistantReply({
    intent,
    recipients,
    needsClarification,
    clarificationPrompt,
    rates,
  });

  return {
    intent,
    recipients,
    allocatedCents,
    billTotalCents,
    unallocatedCents,
    needsClarification,
    clarificationPrompt,
    replyText,
  };
}

export function createNvidia({key, python, fetchImpl = fetch, ttsUrl, ttsConnectOptions} = {}) {
  const py = resolvePython(python);
  const deepseekTimeoutMs = Number(process.env.DEEPSEEK_TIMEOUT_MS || 5500);

  function requireKey() {
    if (!key?.trim()) throw unavailable(503, 'Set NVIDIA_API_KEY in server/.env and restart.');
  }

  async function callChat(model, body, timeoutMs = 15000) {
    const response = await fetchImpl('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'},
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({model, max_tokens: 800, temperature: 0, ...body}),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`NVIDIA ${model} HTTP ${response.status}${detail ? `: ${detail.slice(0, 140)}` : ''}`);
    }
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error(`Empty response from ${model}`);
    return content;
  }

  async function callWithFallback(attempts) {
    let lastError = null;
    for (let i = 0; i < attempts.length; i++) {
      const {model, body, timeoutMs} = attempts[i];
      try {
        const content = await callChat(model, body, timeoutMs);
        return {
          content,
          modelUsed: model,
          fallbackUsed: i > 0,
          primaryAttempted: attempts[0].model,
          primaryError: i > 0 ? lastError?.message : null,
        };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('All NVIDIA models failed');
  }

  return {
    configured: Boolean(key?.trim()),
    pythonPath: py,

    async suggest(instruction) {
      requireKey();
      const messages = [
        {
          role: 'system',
          content: 'Interpret the user’s split instruction for a fixed demo bill. Kitchen essentials cost $120 and must be divided equally among Maya, Arun, and Leah. The $30 lamp must be assigned to exactly one of those three people. Reply with only the lamp owner’s first name. If the owner is unclear or the request requires a different split, reply only CLARIFY.',
        },
        {role: 'user', content: instruction},
      ];
      try {
        const {content} = await callWithFallback([
          {model: FALLBACK_TEXT_MODEL, body: {messages, max_tokens: 128, chat_template_kwargs: {enable_thinking: false}}, timeoutMs: 12000},
          {model: DEEPSEEK_MODEL, body: {messages, max_tokens: 128}, timeoutMs: deepseekTimeoutMs},
        ]);
        return content;
      } catch {
        throw unavailable(502, 'AI split is unavailable. Check NVIDIA API access or edit the split manually.');
      }
    },

    async extractBill({imageDataUrl}) {
      requireKey();
      if (typeof imageDataUrl !== 'string' || !/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(imageDataUrl)) {
        throw unavailable(400, 'Upload or capture a PNG, JPEG, or WebP receipt image.');
      }
      const prompt = 'Extract receipt fields from this bill photo. Return ONLY raw JSON with shape: {"merchant":string,"date":string,"currency":string,"items":[{"name":string,"amountCents":integer}],"taxCents":integer,"tipCents":integer,"totalCents":integer,"unreadableFields":[string]}. Identify the printed currency and return its ISO code. Use integer hundredths of the currency unit ($20.50 -> 2050, ¥1200 -> 120000). Put field names in unreadableFields if missing or blurry.';
      const messages = [{
        role: 'user',
        content: [
          {type: 'text', text: prompt},
          {type: 'image_url', image_url: {url: imageDataUrl}},
        ],
      }];
      try {
        const {content, modelUsed, fallbackUsed, primaryError} = await callWithFallback([
          {model: FALLBACK_VISION_MODEL, body: {messages, chat_template_kwargs: {enable_thinking: false}}, timeoutMs: 20000},
          {model: DEEPSEEK_MODEL, body: {messages}, timeoutMs: deepseekTimeoutMs},
        ]);
        const parsed = stripJsonFences(content);
        return {
          ...normalizeExtractedBill(parsed),
          modelUsed,
          fallbackUsed,
          primaryError,
        };
      } catch (e) {
        throw unavailable(502, `Bill extraction AI unavailable (${e.message}). Edit receipt fields manually.`);
      }
    },

    async parseRequest({transcript, contacts = [], bill = null, currentDraft = null, lastIntent = '', rates}) {
      requireKey();
      const contactList = contacts.length
        ? contacts.map(c => `${c.name} (${c.country || 'US'}, ${c.currency || 'USD'})`).join(', ')
        : 'Allen (UK, GBP), Maya (US, USD), Arun (Canada, CAD), Sofia (Germany, EUR), Yuki (Japan, JPY), Leah (US, USD)';
      const billHint = bill?.totalCents > 0
        ? `Extracted bill context: merchant="${bill.merchant}", totalCents=${bill.totalCents}, currency=${bill.currency || 'USD'}.`
        : 'No bill total constraint.';
      const draftHint = Array.isArray(currentDraft) && currentDraft.length
        ? `Active conversation draft from previous turn (intent=${lastIntent || 'request'}): ${JSON.stringify(currentDraft.map(r => ({name: r.name, amountCents: r.amountCents, currency: r.currency, reason: r.reason, unknownContact: r.unknownContact, ambiguous: r.ambiguous})))}. Keep the active intent on follow-up turns. Add newly mentioned recipients and update edited rows. Return all draft rows, including untouched recipients, unless the user explicitly asks to start over or switch intent.`
        : 'No prior draft.';
      const messages = [
        {
          role: 'system',
          content: `Parse a spoken or typed payment instruction into JSON. Known contacts: [${contactList}]. ${billHint} ${draftHint}
Determine intent: "send" if the user is sending/paying someone (e.g. "Allen, send him 20 dollars saying thanks for coffee", "pay Maya $15", "give Maya $15 and Arun $20"), OR "request" if requesting/splitting/asking money ("Ask Maya for $20 for dinner and Arun for $15 for drinks").
Extract EVERY person paired with an amount (if phonetic STT says "a run" near drinks/amount, match Arun or mark ambiguousName=true). Preserve explicit spoken/typed currency ("dollars"/"USD" -> "USD", "pounds"/"GBP" -> "GBP", "euros"/"EUR" -> "EUR", "CAD" -> "CAD", "yen"/"JPY" -> "JPY"); otherwise leave currency empty so the contact preference applies. Convert spoken numbers cleanly ("twenty dollars" -> 2000, "fifteen" -> 1500; for JPY use major*100 e.g. "3000 yen" -> 300000).
Return ONLY raw JSON: {"intent":"send"|"request","recipients":[{"name":string,"amountCents":integer,"currency":string,"reason":string,"ambiguousName":boolean,"ambiguousAmount":boolean}],"needsClarification":boolean,"clarificationPrompt":string}.`,
        },
        {role: 'user', content: transcript},
      ];
      try {
        const {content, modelUsed, fallbackUsed, primaryError} = await callWithFallback([
          {model: FALLBACK_TEXT_MODEL, body: {messages, chat_template_kwargs: {enable_thinking: false}}, timeoutMs: 12000},
          {model: DEEPSEEK_MODEL, body: {messages}, timeoutMs: deepseekTimeoutMs},
        ]);
        const parsed = stripJsonFences(content);
        return {
          ...normalizeParsedRequest(parsed, contacts, bill, rates),
          modelUsed,
          fallbackUsed,
          primaryError,
        };
      } catch (e) {
        throw unavailable(502, `AI request parser unavailable (${e.message}). Add recipient rows manually.`);
      }
    },

    async speak(text) {
      requireKey();
      const cleanText = String(text || '').trim();
      if (!cleanText) throw unavailable(400, 'Text is required for Chatterbox speech output.');
      try {
        const wav = await callRivaTts({
          text: cleanText,
          key: key.trim(),
          url: ttsUrl,
          connectOptions: ttsConnectOptions,
        });
        if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.length <= 44) throw new Error('Empty audio');
        return wav;
      } catch (err) {
        if (err?.status) throw err;
        const safeKey = key.trim();
        const rawDetail = String(err?.message || '').trim();
        const detail = safeKey ? rawDetail.replaceAll(safeKey, '[redacted]') : rawDetail;
        throw unavailable(502, detail ? `Chatterbox is unavailable (${detail}). Check NVIDIA API access.` : 'Chatterbox is unavailable. Check NVIDIA API access.');
      }
    },

    async transcribe({audioBase64, mimeType = 'audio/webm', contacts = []}) {
      if (typeof audioBase64 !== 'string' || !audioBase64.trim()) {
        throw unavailable(400, 'Audio payload is required for transcription.');
      }
      const cleanB64 = audioBase64.replace(/^data:[^;]+;base64,/, '');
      const buf = Buffer.from(cleanB64, 'base64');
      if (!buf.length || buf.length > 3 * 1024 * 1024) {
        throw unavailable(400, 'Audio clip must be between 1 byte and 3 MB.');
      }
      const ext = /wav/i.test(mimeType) ? 'wav' : /mp4|m4a/i.test(mimeType) ? 'm4a' : 'webm';
      const dir = await mkdtemp(join(tmpdir(), 'splitsync-stt-'));
      const file = join(dir, `clip.${ext}`);
      const hint = contacts.length
        ? `Ask ${contacts.map(c => c.name).join(', ')} for dollars for dinner, drinks, groceries, or split expenses.`
        : 'Ask Maya, Arun, and Leah for dollars for dinner and drinks.';
      try {
        await writeFile(file, buf);
        const {stdout} = await run(py, [transcribeScript, file, hint], {
          timeout: 28000,
          maxBuffer: 1024 * 1024,
          windowsHide: true,
        });
        const lastLine = stdout.toString('utf8').trim().split(/\r?\n/).filter(Boolean).pop() || '{}';
        const parsed = JSON.parse(lastLine);
        return {transcript: parsed.transcript || '', engine: parsed.engine || 'faster-whisper'};
      } catch {
        throw unavailable(502, 'Speech-to-text transcription unavailable on the backend. Type your instruction instead.');
      } finally {
        await rm(dir, {recursive: true, force: true}).catch(() => {});
      }
    },
  };
}
