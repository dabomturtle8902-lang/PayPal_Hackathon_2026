import {execFile} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const speechScript = fileURLToPath(new URL('./chatterbox.py', import.meta.url));
const transcribeScript = fileURLToPath(new URL('./transcribe.py', import.meta.url));
const unavailable = (status, message) => Object.assign(new Error(message), {status});

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

export function normalizeParsedRequest(raw, contacts = [], bill = null) {
  const rows = Array.isArray(raw?.recipients) ? raw.recipients : [];
  const recipients = rows.slice(0, 20).map((r, index) => {
    const rawName = String(r?.name || '').trim().slice(0, 80);
    const amountCents = Number.isInteger(r?.amountCents) ? r.amountCents : toCents(r?.amount ?? 0);
    const currency = typeof r?.currency === 'string' && /^[A-Z]{3}$/.test(r.currency.trim().toUpperCase())
      ? r.currency.trim().toUpperCase()
      : (bill?.currency || 'USD');
    const reason = String(r?.reason || '').trim().slice(0, 140) || 'Shared expense';
    const match = matchContact(rawName, contacts);
    const ambiguousName = Boolean(r?.ambiguousName || match.ambiguous || !rawName);
    const unknownContact = Boolean(rawName && !match.contact && !match.ambiguous);
    const ambiguousAmount = Boolean(r?.ambiguousAmount || amountCents <= 0);
    return {
      id: `draft-${index + 1}`,
      name: match.contact ? match.contact.name : (rawName || `Recipient ${index + 1}`),
      contactId: match.contact?.id || null,
      known: Boolean(match.contact),
      ambiguous: ambiguousName || ambiguousAmount || unknownContact,
      unknownContact,
      candidates: match.candidates.map(c => c.name),
      amountCents: Math.max(0, amountCents),
      currency,
      reason,
    };
  });

  const allocatedCents = recipients.reduce((s, r) => s + r.amountCents, 0);
  const billTotalCents = Number.isInteger(bill?.totalCents) ? bill.totalCents : 0;
  const unallocatedCents = billTotalCents > 0 ? billTotalCents - allocatedCents : 0;
  const needsClarification = Boolean(raw?.needsClarification)
    || recipients.length === 0
    || recipients.some(r => r.ambiguous);

  const clarificationPrompt = String(raw?.clarificationPrompt || '').trim()
    || (recipients.length === 0
      ? 'Could not detect any recipient names and dollar amounts. Add recipients manually below.'
      : recipients.find(r => r.unknownContact)
        ? `Verify unknown recipient "${recipients.find(r => r.unknownContact).name}" against your contacts.`
        : recipients.find(r => r.ambiguous)
          ? 'Please confirm the ambiguous recipient name or amount below.'
          : '');

  return {
    recipients,
    allocatedCents,
    billTotalCents,
    unallocatedCents,
    needsClarification,
    clarificationPrompt,
  };
}

export function createNvidia({key, python, fetchImpl = fetch} = {}) {
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
      const prompt = 'Extract receipt fields from this bill photo. Return ONLY raw JSON with shape: {"merchant":string,"date":string,"currency":"USD","items":[{"name":string,"amountCents":integer}],"taxCents":integer,"tipCents":integer,"totalCents":integer,"unreadableFields":[string]}. Use integer cents (e.g. $20.50 -> 2050). Put field names in unreadableFields if missing or blurry.';
      const messages = [{
        role: 'user',
        content: [
          {type: 'text', text: prompt},
          {type: 'image_url', image_url: {url: imageDataUrl}},
        ],
      }];
      try {
        const {content, modelUsed, fallbackUsed, primaryError} = await callWithFallback([
          {model: DEEPSEEK_MODEL, body: {messages}, timeoutMs: deepseekTimeoutMs},
          {model: FALLBACK_VISION_MODEL, body: {messages, chat_template_kwargs: {enable_thinking: false}}, timeoutMs: 20000},
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

    async parseRequest({transcript, contacts = [], bill = null}) {
      requireKey();
      const contactNames = contacts.map(c => c.name).join(', ') || 'Maya, Arun, Leah';
      const billHint = bill ? `Extracted bill context: merchant="${bill.merchant}", totalCents=${bill.totalCents}, currency=${bill.currency || 'USD'}.` : 'No bill total constraint.';
      const messages = [
        {
          role: 'system',
          content: `Parse a spoken or typed expense-split / payment request into JSON. Known contacts: [${contactNames}]. ${billHint} Extract EVERY named or phonetic person paired with an amount (for example if speech-to-text transcribed "Arun" as "a run" next to "$15 for drinks", match Arun or keep the raw phrase with ambiguousName=true — never drop a dollar amount). Return ONLY raw JSON with shape: {"recipients":[{"name":string,"amountCents":integer,"currency":"USD","reason":string,"ambiguousName":boolean,"ambiguousAmount":boolean}],"needsClarification":boolean,"clarificationPrompt":string}. Convert spoken numbers cleanly ("twenty dollars" -> 2000, "fifteen" -> 1500).`,
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
          ...normalizeParsedRequest(parsed, contacts, bill),
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
      try {
        const {stdout} = await run(py, [speechScript, text], {
          env: {...process.env, NVIDIA_API_KEY: key},
          encoding: 'buffer',
          timeout: 22000,
          maxBuffer: 4 * 1024 * 1024,
          windowsHide: true,
        });
        if (stdout.toString('ascii', 0, 4) !== 'RIFF' || stdout.length <= 44) throw new Error('Empty audio');
        return stdout;
      } catch {
        throw unavailable(502, 'Chatterbox is unavailable. Check NVIDIA API access and the Python Riva client setup.');
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
