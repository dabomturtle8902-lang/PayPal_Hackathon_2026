import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomBytes} from 'node:crypto';

export const names = ['Maya', 'Arun', 'Leah'];
export const secret = () => randomBytes(24).toString('hex');

export const FX_RATES_USD = Object.freeze({
  USD: 1,
  GBP: 0.74501,
  CAD: 1.4136,
  EUR: 0.89174,
  JPY: 158.18,
  INR: 93.93,
});

export const FX_REFERENCE_DATE = '2026-11-10';

export function createExchangeRateLoader(fetchRates = fetch) {
  let snapshot = {rates: FX_RATES_USD, date: FX_REFERENCE_DATE};
  let expires = 0;
  let pending;
  return function loadRates() {
    if (Date.now() < expires) return Promise.resolve(snapshot);
    if (pending) return pending;
    pending = (async () => {
      try {
        const quotes = Object.keys(FX_RATES_USD).filter(code => code !== 'USD');
        const response = await fetchRates(
          'https://api.frankfurter.dev/v2/rates?base=USD&providers=ECB&quotes=' + quotes.join(','),
          {signal: AbortSignal.timeout(4500)},
        );
        if (!response.ok) throw new Error('Exchange rates are unavailable');
        const rows = await response.json();
        const date = rows[0]?.date;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < snapshot.date) {
          throw new Error('Exchange rates are out of date');
        }
        const rates = {USD: 1};
        for (const code of quotes) {
          const row = rows.find(item => item.quote === code && item.base === 'USD' && item.date === date);
          if (!Number.isFinite(row?.rate) || row.rate <= 0) throw new Error('Missing exchange rate');
          rates[code] = row.rate;
        }
        snapshot = {rates, date};
        expires = Date.now() + 15 * 60 * 1000;
      } catch {
        expires = Date.now() + 60 * 1000;
      }
      return snapshot;
    })().finally(() => { pending = undefined; });
    return pending;
  };
}

export const CURRENCY_SYMBOLS = Object.freeze({
  USD: '$',
  GBP: '£',
  CAD: 'CA$',
  EUR: '€',
  JPY: '¥',
  INR: '₹',
});

export function normalizeCurrency(code, fallback = 'USD') {
  const c = typeof code === 'string' ? code.trim().toUpperCase() : '';
  return FX_RATES_USD[c] ? c : fallback;
}

export function convertAmountCents(amountCents, fromCurrency = 'USD', toCurrency = 'USD', rates = FX_RATES_USD) {
  const from = normalizeCurrency(fromCurrency, 'USD');
  const to = normalizeCurrency(toCurrency, 'USD');
  const raw = Math.max(0, Number(amountCents) || 0);
  if (from === to) {
    return to === 'JPY' ? Math.round(raw / 100) * 100 : Math.round(raw);
  }
  const usdMajor = (raw / 100) / rates[from];
  const targetMajor = usdMajor * rates[to];
  return to === 'JPY' ? Math.round(targetMajor) * 100 : Math.round(targetMajor * 100);
}

export function fxQuote(amountCents, fromCurrency = 'USD', toCurrency = 'USD', rates = FX_RATES_USD) {
  const sourceCurrency = normalizeCurrency(fromCurrency, 'USD');
  const targetCurrency = normalizeCurrency(toCurrency, sourceCurrency);
  const sourceAmountCents = sourceCurrency === 'JPY'
    ? Math.round((Number(amountCents) || 0) / 100) * 100
    : Math.max(0, Math.round(Number(amountCents) || 0));
  const targetAmountCents = convertAmountCents(sourceAmountCents, sourceCurrency, targetCurrency, rates);
  const inrEquivalentCents = convertAmountCents(sourceAmountCents, sourceCurrency, 'INR', rates);
  const rate = rates[targetCurrency] / rates[sourceCurrency];
  return {
    sourceAmountCents,
    sourceCurrency,
    targetAmountCents,
    targetCurrency,
    inrEquivalentCents,
    rate,
  };
}

export function formatMoney(amountCents, currency = 'USD', withCode = false) {
  const curr = normalizeCurrency(currency, 'USD');
  const sym = CURRENCY_SYMBOLS[curr] || '$';
  const major = (Number(amountCents) || 0) / 100;
  const formatted = curr === 'JPY'
    ? Math.round(major).toLocaleString('en-US')
    : major.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  return `${sym}${formatted}${withCode ? ` ${curr}` : ''}`;
}

export function defaultContacts() {
  return [
    {id: 'allen', name: 'Allen', country: 'United Kingdom', flag: '🇬🇧', currency: 'GBP', handle: 'allen@demo.local', phone: '+44-20-7946-0112', note: 'London · Friend'},
    {id: 'maya', name: 'Maya', country: 'United States', flag: '🇺🇸', currency: 'USD', handle: 'maya@demo.local', phone: '+1-555-0141', note: 'Roommate'},
    {id: 'arun', name: 'Arun', country: 'Canada', flag: '🇨🇦', currency: 'CAD', handle: 'arun@demo.local', phone: '+1-416-555-0142', note: 'Toronto · Roommate'},
    {id: 'sofia', name: 'Sofia', country: 'Germany', flag: '🇩🇪', currency: 'EUR', handle: 'sofia@demo.local', phone: '+49-30-5550-0143', note: 'Berlin · Designer'},
    {id: 'yuki', name: 'Yuki', country: 'Japan', flag: '🇯🇵', currency: 'JPY', handle: 'yuki@demo.local', phone: '+81-3-5550-0144', note: 'Tokyo · Friend'},
    {id: 'leah', name: 'Leah', country: 'United States', flag: '🇺🇸', currency: 'USD', handle: 'leah@demo.local', phone: '+1-555-0145', note: 'Organizer'},
  ];
}

export function newState() {
  return {
    version: 2,
    purchaseId: 'SS-001',
    lamp: 'Maya',
    published: false,
    participants: Object.fromEntries(names.map(n => [n, {
      name: n,
      amountCents: n === 'Maya' ? 7000 : 4000,
      shareToken: secret(),
      status: 'Awaiting payment',
      orders: [],
      receipt: null,
    }])),
    contacts: defaultContacts(),
    reimbursements: [],
    demoTransactions: [],
    savedRentRule: null,
    events: [],
  };
}

export function normalizeState(state) {
  if (!state || ![1, 2].includes(state.version)) {
    throw new Error('Unsupported ledger format.');
  }
  state.version = 2;
  const seedById = new Map(defaultContacts().map(c => [c.id, c]));
  const existing = Array.isArray(state.contacts) ? state.contacts : [];
  if (!existing.length) {
    state.contacts = defaultContacts();
  } else {
    const merged = existing
      .filter(c => c && c.id !== 'samir')
      .map(c => {
        const seed = seedById.get(c.id);
        return seed ? {...seed, ...c, country: c.country || seed.country, flag: c.flag || seed.flag, currency: normalizeCurrency(c.currency || seed.currency, seed.currency)} : {
          ...c,
          country: c.country || 'United States',
          flag: c.flag || '🇺🇸',
          currency: normalizeCurrency(c.currency, 'USD'),
        };
      });
    for (const seed of defaultContacts()) {
      if (!merged.some(c => c.id === seed.id)) merged.push(seed);
    }
    state.contacts = merged;
  }
  if (!Array.isArray(state.reimbursements)) state.reimbursements = [];
  if (!Array.isArray(state.demoTransactions)) state.demoTransactions = [];
  if (!state.savedRentRule || typeof state.savedRentRule !== 'object') state.savedRentRule = null;
  if (!Array.isArray(state.events)) state.events = [];
  return state;
}

export class Store {
  constructor(file) {
    this.file = file;
    this.queue = Promise.resolve();
  }

  async init() {
    try {
      this.state = normalizeState(JSON.parse(await readFile(this.file, 'utf8')));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.state = newState();
      await this.save();
    }
    return this;
  }

  async save() {
    if (!this.file) return;
    await mkdir(dirname(this.file), {recursive: true});
    await writeFile(this.file + '.tmp', JSON.stringify(this.state, null, 2), {mode: 0o600});
    await rename(this.file + '.tmp', this.file);
  }

  // One process, one queue: persist request IDs before any external payment call.
  exclusive(fn) {
    const next = this.queue.then(fn);
    this.queue = next.catch(() => {});
    return next;
  }
}
