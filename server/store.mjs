import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomBytes} from 'node:crypto';
export const names = ['Maya','Arun','Leah'];
export const secret = () => randomBytes(24).toString('hex');
export function newState() {
  return {version:1, purchaseId:'SS-001', lamp:'Maya', published:false, participants:Object.fromEntries(names.map(n => [n, {
    name:n, amountCents:n === 'Maya' ? 7000 : 4000, shareToken:secret(), status:'Awaiting payment', orders:[], receipt:null
  }])), events:[]};
}
export class Store {
  constructor(file) { this.file=file; this.queue=Promise.resolve(); }
  async init() {
    try { this.state=JSON.parse(await readFile(this.file,'utf8')); }
    catch(error) { if(error.code !== 'ENOENT') throw error; this.state=newState(); await this.save(); }
    if(this.state.version !== 1) throw new Error('Unsupported ledger format.');
    return this;
  }
  async save() {
    if(!this.file) return;
    await mkdir(dirname(this.file),{recursive:true});
    await writeFile(this.file+'.tmp',JSON.stringify(this.state,null,2),{mode:0o600});
    await rename(this.file+'.tmp',this.file);
  }
  // One process, one queue: persist request IDs before any external payment call.
  exclusive(fn) {
    const next=this.queue.then(fn);
    this.queue=next.catch(()=>{});
    return next;
  }
}
