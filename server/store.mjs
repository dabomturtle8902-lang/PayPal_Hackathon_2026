import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomBytes} from 'node:crypto';

export const names = ['Maya', 'Arun', 'Leah'];
export const secret = () => randomBytes(24).toString('hex');

export function defaultContacts() {
  return [
    {id: 'maya', name: 'Maya', handle: 'maya@house.local', phone: '+1-555-0141', note: 'Roommate'},
    {id: 'arun', name: 'Arun', handle: 'arun@house.local', phone: '+1-555-0142', note: 'Roommate'},
    {id: 'leah', name: 'Leah', handle: 'leah@house.local', phone: '+1-555-0143', note: 'Organizer'},
    {id: 'samir', name: 'Samir Patel', handle: 'samir@house.local', phone: '+1-555-0144', note: 'Friend'},
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
    events: [],
  };
}

export function normalizeState(state) {
  if (!state || ![1, 2].includes(state.version)) {
    throw new Error('Unsupported ledger format.');
  }
  state.version = 2;
  if (!Array.isArray(state.contacts) || !state.contacts.length) {
    state.contacts = defaultContacts();
  }
  if (!Array.isArray(state.reimbursements)) {
    state.reimbursements = [];
  }
  if (!Array.isArray(state.events)) {
    state.events = [];
  }
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
