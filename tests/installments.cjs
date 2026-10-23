const fs=require('node:fs');const assert=require('node:assert/strict');
const {summarizeExpenses}=require('../dist/expense-summary.js');
(async()=>{
const {instance:{exports:w}}=await WebAssembly.instantiate(fs.readFileSync('dist/finance.wasm'));
function call(data){const b=new TextEncoder().encode(JSON.stringify(data)),p=w.allocate(b.length);new Uint8Array(w.memory.buffer,p,b.length).set(b);const r=w.calculate(p,b.length),ptr=Number(r>>32n),len=Number(r&0xffffffffn);let out;try{out=JSON.parse(new TextDecoder().decode(new Uint8Array(w.memory.buffer,ptr,len)))}finally{w.release(ptr,len)}return out}
const entry={id:'purchase',description:'Compra',kind:'expense',cents:100001,category:'Outros',source:'Nubank',account:'',date:'2026-10-31',frequency:'once',end_date:null};
const parts=call({installments:{entry,count:4}}).ok;
assert.deepEqual(parts.map(p=>p.cents),[25001,25000,25000,25000]);assert.deepEqual(parts.map(p=>p.date),['2026-10-31','2026-11-30','2026-12-31','2027-01-31']);
console.log('1. Compra parcelada: total, centavos, datas e identificação passaram.');
const state=JSON.parse(JSON.stringify({entries:parts,goals:[],accounts:[{id:'a',name:'Nubank',type:'credit'}]}));
function report(start,end){return call({state,start,end,today:'2026-10-22'}).ok}
assert.equal(report('2026-10-01','2026-10-31').expense,25001);assert.equal(report('2026-11-01','2026-11-30').expense,25000);assert.equal(report('2027-02-01','2027-02-28').expense,0);
console.log('2. Relatórios mensais: somente parcelas do período, sem repetição após a última.');
assert.equal(report('2026-01-01','2026-12-31').expense,75001);assert.equal(report('2027-01-01','2027-12-31').expense,25000);assert.equal(report('2026-10-26','2026-11-01').expense,25001);
console.log('3. Semana, ano e restauração JSON preservam os valores.');
for(const count of [0,1,1.5,121])assert.ok(call({installments:{entry,count}}).error);
assert.ok(call({installments:{entry:{...entry,cents:2},count:4}}).error);
assert.ok(call({installments:{entry:{...entry,kind:'income'},count:4}}).error);
console.log('4. Entradas inválidas rejeitadas pelo Rust.');
const r=report('2026-01-01','2027-12-31');const summary=summarizeExpenses(r.occurrences,state.accounts);assert.equal(summary.totals.credit,100001);assert.equal(summary.items.reduce((s,x)=>s+x.cents,0),r.expense);
console.log('5. Resumo por cartão coincide com o total das parcelas no Rust.');
})().catch(e=>{console.error(e);process.exitCode=1});
