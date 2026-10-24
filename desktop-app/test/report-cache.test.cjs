'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../../dist/report-cache.js');
test('Relatórios compartilham cálculo em andamento e invalidam com dados ou dia diferentes',async()=>{
 let calls=0,received;const calculate=async input=>{calls++;received=input;return{income:calls};},cached=create(calculate);
 const state={entries:[],goals:[],accounts:[{name:'Conta'}],preferences:{userName:'Pessoa'}};
 const a=cached(state,'2026-10-01','2026-10-31','2026-10-23'),b=cached(state,'2026-10-01','2026-10-31','2026-10-23');assert.equal(a,b);await a;assert.equal(calls,1);assert(!('preferences' in received.state));assert(!('accounts' in received.state));
 await cached(state,'2026-10-01','2026-10-31','2026-10-24');assert.equal(calls,2);await cached({...state},'2026-10-01','2026-10-31','2026-10-24');assert.equal(calls,3);
});
test('Relatório com falha pode ser repetido e cache tem tamanho limitado',async()=>{
 let calls=0;const cached=create(async()=>{if(++calls===1)throw Error('falha');return calls;},2),state={entries:[],goals:[]};
 await assert.rejects(cached(state,'a','b','today'));assert.equal(await cached(state,'a','b','today'),2);await cached(state,'c','d','today');await cached(state,'e','f','today');await cached(state,'a','b','today');assert.equal(calls,5);
});
