const fs=require('node:fs'),assert=require('node:assert/strict'),Reminders=require('../apps-script/reminders.js');
(async()=>{
const {instance:{exports:w}}=await WebAssembly.instantiate(fs.readFileSync('dist/finance.wasm'));
function call(data){const b=new TextEncoder().encode(JSON.stringify(data)),p=w.allocate(b.length);new Uint8Array(w.memory.buffer,p,b.length).set(b);const r=w.calculate(p,b.length),ptr=Number(r>>32n),len=Number(r&0xffffffffn);try{return JSON.parse(new TextDecoder().decode(new Uint8Array(w.memory.buffer,ptr,len)))}finally{w.release(ptr,len)}}
const entry={id:'monthly',description:'Aluguel',kind:'expense',cents:10000,category:'Moradia',source:'Conta',date:'2026-01-31',frequency:'monthly',end_date:null};
const state={entries:[entry],goals:[]};const report=(start,end)=>call({state,start,end,today:start}).ok;
const feb=report('2026-02-28','2026-03-03');assert.equal(feb.occurrences[0].date,'2026-02-28');assert.equal(report('2026-03-31','2026-03-31').occurrences[0].date,'2026-03-31');
const due=Reminders.select(feb.occurrences,'2026-02-28','2026-03-03');assert.equal(due.length,1);assert.equal(Reminders.select(feb.occurrences,'2026-02-28','2026-03-03',[Reminders.key(due[0])]).length,0);
assert.equal(Reminders.select(report('2026-03-31','2026-03-31').occurrences,'2026-03-31','2026-03-31',[Reminders.key(due[0])]).length,1);
state.entries=[{...entry,frequency:'weekly',date:'2026-10-23',end_date:'2026-10-30'},{...entry,id:'once',frequency:'once',date:'2026-10-23'}];assert.equal(Reminders.select(report('2026-10-23','2026-11-06').occurrences,'2026-10-23','2026-11-06').length,2);
state.entries=[{...entry,frequency:'fortnightly',date:'2026-10-23'}];assert.deepEqual(report('2026-10-23','2026-11-07').occurrences.map(o=>o.date),['2026-10-23','2026-11-07']);
state.entries=[{...entry,frequency:'yearly',date:'2024-02-29'}];assert.equal(report('2025-02-28','2025-02-28').occurrences[0].date,'2025-02-28');
console.log('Vencimentos: hoje, antecedência, dispensar só uma ocorrência, limite da série, semana, 15 dias, mês curto, ano bissexto e exclusão de únicos passaram.');
})().catch(e=>{console.error(e);process.exitCode=1});
