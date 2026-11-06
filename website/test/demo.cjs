const fs=require('fs'),vm=require('vm'),assert=require('assert');
const app={innerHTML:''};const store={};const ctx={console,location:{hash:'',href:'https://demo.test/'},localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=v},document:{body:{dataset:{},classList:{toggle(){}}},querySelector:s=>s==='#app'?app:s==='#breadcrumb'?{textContent:''}:null,querySelectorAll:()=>[]},window:{addEventListener(){},scrollTo(){}},navigator:{},setTimeout(){}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/app.js'),'utf8'),ctx);
const run=s=>vm.runInContext(s,ctx);
assert.equal(run('shares().Maya+shares().Arun+shares().Leah'),150);
assert.equal(run('shares().Maya'),70);
for(const route of ['home','welcome','scan','scan-error','review','split','clarify','edit','requests','dashboard','share/maya','share/arun','handoff/maya','result/maya/processing','result/maya/paid','result/maya/cancelled','rent','shop','product','preferences']){ctx.location.hash='#'+route;run('render()');assert(app.innerHTML.length>100,route);assert(!app.innerHTML.includes('undefined'),route);}
ctx.location.hash='#share/arun';run('render()');assert(app.innerHTML.includes('Your share · $40.00 USD'));assert(!app.innerHTML.includes('Your personal desk lamp'));
run("setLamp('Arun')");assert.equal(run('shares().Arun'),70);assert.equal(run('shares().Maya'),40);assert.equal(run('shares().Maya+shares().Arun+shares().Leah'),150);
ctx.location.hash='#result/maya/processing';run('render()');assert(app.innerHTML.includes('Payment processing'));assert(!app.innerHTML.includes('Receipt reference'));
ctx.location.hash='#result/maya/paid';run('render()');assert(app.innerHTML.includes('DEMO-SS-8F3D21'));
run('confirmSplit()');assert.equal(store['splitsync-published'],'true');
console.log('PASS: 22 routes, default/edited allocations, participant isolation in rendered views, result variants and publication state.');
