'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const Categories=require('../../dist/categories.js');
const {validate}=require('../generated/shared.cjs');
const empty={entries:[],goals:[],accounts:[],incomeSources:[]};
const category={id:'travel',name:'Viagens',symbol:'✈️',color:'#2468ac'};
test('Categorias: padrões compatíveis, nomes Unicode, validação e aparência por nome',()=>{
 assert.equal(Categories.validate().length,8);assert.deepEqual(Categories.validate([]),[]);
 const items=Categories.validate([category]);assert.equal(Categories.appearance({categories:items},' viagens ').color,category.color);
 for(const changed of [{name:''},{color:'red'},{color:'#123456;display:none'},{symbol:''},{symbol:'x'.repeat(49)},{name:'á'.repeat(41)}])assert.throws(()=>Categories.validate([{...category,...changed}]));
 assert.throws(()=>Categories.validate([category,{...category,id:'second',name:' VIAGENS '}]));
 assert.throws(()=>Categories.validate([category,{...category,name:'Outra'}]));
 assert.equal(Categories.validate([{...category,name:'Café'}])[0].name,'Café');
});
test('Categorias: renomear inclui receitas, séries e parcelas, sem alterar valores ou datas',()=>{
 const entries=['income','expense','expense'].map((kind,i)=>({id:'e'+i,kind,category:i===2?'Moradia':'Viagens',cents:1000+i,date:'2026-10-23',frequency:i===1?'monthly':'once'}));
 const state={...empty,categories:[category],entries};const next=Categories.upsert(state,{...category,name:'Campo',symbol:'🚁',color:'#aa2244'});
 assert.deepEqual(next.entries.map(e=>e.category),['Campo','Campo','Moradia']);
 assert.deepEqual(next.entries.map(({category,...e})=>e),entries.map(({category,...e})=>e));assert.equal(state.entries[0].category,'Viagens');
 const removed=Categories.remove(next,'travel');assert.equal(removed.entries[0].category,'Campo');assert(Categories.options(removed).some(c=>c.name==='Campo'));
});
test('Categorias: validação do processo principal e restauração JSON preservam símbolo e cor',()=>{
 const stored=validate({...empty,categories:[category],preferences:{color:'#123456',userName:'Pessoa',appTitle:'Casa'},reminders:{dismissed:[]}});
 assert.deepEqual(validate(JSON.parse(JSON.stringify(stored))).categories,[category]);
 assert.throws(()=>validate({...empty,categories:[{...category,color:'invalid'}]}));
});
async function settled(check){for(let i=0;i<100;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,5));}throw Error('A interface não concluiu a operação.');}
async function app(entries=null){
 const root=path.join(__dirname,'../generated');const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{runScripts:'outside-only',url:'https://test.invalid/'}),w=dom.window;
 let state={...structuredClone(empty),entries:entries||[{id:'legacy-entry',description:'Registro antigo',kind:'expense',cents:1200,category:'Moradia',source:'Conta',account:'',date:new Date().toISOString().slice(0,10),frequency:'once',end_date:null}]},revision=0,saves=0;
 w.WebAssembly=WebAssembly;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.structuredClone=structuredClone;w.confirm=()=>true;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.HTMLElement.prototype.scrollIntoView=function(){};
 const record=()=>({state:structuredClone(state),profile:{sub:'test-user',email:'test@example.test',name:'Pessoa'},revision:String(revision),lastBackup:new Date().toISOString(),folderId:'test-folder',fileId:'test-file'});
 w.desktop={rpc:async(method,...args)=>{if(method==='loadFinance')return record();if(method==='saveFinance'){state=validate(args[0]);revision++;saves++;return record();}throw Error('Unexpected '+method);}};
 w.eval(fs.readFileSync(path.join(root,'app.js'),'utf8'));
 await settled(()=>w.document.querySelector('#content .stats'));
 return{dom,w,getState:()=>state,getSaves:()=>saves};
}
test('Interface real: cadastrar categoria persiste no backend e aparece com cor/símbolo',async()=>{
 const a=await app();try{
 const d=a.w.document;d.querySelector('[data-view="categories"]').click();d.querySelector('[data-new-category]').click();const f=d.querySelector('#category-form');f.elements.name.value='Campo';f.elements.symbol.value='🚁';f.elements.color.value='#a73377';
 f.dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));await settled(()=>a.getSaves()===1&&!d.querySelector('#category-dialog').open);
 const saved=a.getState().categories.find(c=>c.name==='Campo');assert.equal(saved.symbol,'🚁');assert.equal(saved.color,'#a73377');assert(d.querySelector('.category-cards').textContent.includes('Campo'));assert(d.querySelector('.category-cards').textContent.includes('🚁'));
 }finally{a.dom.window.close();}
});
test('Interface real: selecionar, digitar outro nome, limpar, escolher outra categoria e editar lançamento',async()=>{
 const a=await app();try{
 const w=a.w,d=w.document;d.querySelector('#new-entry').click();const f=d.querySelector('#entry-form'),input=f.elements.category;
 assert.equal(input.hasAttribute('list'),false);input.focus();let option=[...d.querySelectorAll('[data-category-choice]')].find(b=>b.textContent.includes('Moradia'));assert(option);option.click();assert.equal(input.value,'Moradia');
 input.value='Viagens a campo';input.dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(input.value,'Viagens a campo');assert.equal(input.readOnly,false);assert.equal(input.disabled,false);assert.equal(new w.FormData(f).get('category'),'Viagens a campo');
 d.querySelector('.category-clear').click();assert.equal(input.value,'');option=[...d.querySelectorAll('[data-category-choice]')].find(b=>b.textContent.includes('Saúde'));option.click();assert.equal(input.value,'Saúde');
 input.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));input.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));assert.equal(d.querySelector('#category-choices').hidden,true);
 d.querySelector('[data-close="entry-dialog"]').click();d.querySelector('[data-view="entries"]').click();d.querySelector('[data-edit-entry="legacy-entry"]').click();assert.equal(input.value,'Moradia');
 input.value='Categoria alterada';input.dispatchEvent(new w.Event('input',{bubbles:true}));f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settled(()=>a.getSaves()===1&&!d.querySelector('#entry-dialog').open);assert.equal(a.getState().entries[0].category,'Categoria alterada');
 }finally{a.dom.window.close();}
});

test('Galeria de emojis: centenas de opções, busca por tema e persistência do símbolo escolhido',async()=>{
 const a=await app();try{
 const w=a.w,d=w.document;d.querySelector('[data-view="categories"]').click();d.querySelector('[data-new-category]').click();
 const symbols=[...d.querySelectorAll('[data-emoji]')].map(b=>b.dataset.emoji);assert(symbols.length>400);assert.equal(new Set(symbols).size,symbols.length);
 for(const symbol of symbols)Categories.validate([{...category,symbol}]);
 const search=d.querySelector('#emoji-search');search.value='educação';search.dispatchEvent(new w.Event('input',{bubbles:true}));assert([...d.querySelectorAll('[data-emoji]')].some(b=>b.dataset.emoji==='🎓'));assert(![...d.querySelectorAll('[data-emoji]')].some(b=>b.dataset.emoji==='🍕'));
 search.value='viagem';search.dispatchEvent(new w.Event('input',{bubbles:true}));[...d.querySelectorAll('[data-emoji]')].find(b=>b.dataset.emoji==='🚁').click();const f=d.querySelector('#category-form');assert.equal(f.elements.symbol.value,'🚁');assert.equal(d.querySelector('#category-emojis').open,false);
 f.elements.name.value='Campo';f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settled(()=>a.getSaves()===1);assert.equal(a.getState().categories.find(c=>c.name==='Campo').symbol,'🚁');
 }finally{a.dom.window.close();}
});

test('Planilha: filtra dia, semana, mês, fonte e período; inclui recorrências e exclui receitas',async()=>{
 const make=(id,date,cents,source='Cartão',frequency='once',kind='expense')=>({id,date,cents,source,frequency,kind,description:id,category:'Viagens',account:'',end_date:null});
 const a=await app([make('Compra', '2026-10-15',1000),make('Recorrente','2026-09-15',2000,'Conta','monthly'),make('Parcela 2/4','2026-10-16',3000),make('Fora da semana','2026-10-19',4000),make('Salário','2026-10-15',99999,'Conta','once','income')]);
 try{
 const w=a.w,d=w.document;assert(d.querySelector('.brand-mascot'));assert.equal(d.querySelector('.brand-mascot').getAttribute('src'),'../assets/icon.png');
 d.querySelector('[data-view="sheet"]').click();const date=d.querySelector('#period-date');date.value='2026-10-15';date.dispatchEvent(new w.Event('change',{bubbles:true}));
 await w.eval('refresh()');d.querySelector('[data-period="day"]').click();await settled(()=>d.querySelector('#period-label').textContent==='15/10/2026');
 assert.equal(d.querySelectorAll('.expense-sheet tbody tr').length,2);assert.equal(d.querySelector('[data-sheet-total]').textContent,'R$ 30,00');assert(d.querySelector('.expense-sheet').textContent.includes('Recorrente'));assert(!d.querySelector('.expense-sheet').textContent.includes('Salário'));
 d.querySelector('#next').click();await settled(()=>d.querySelector('#period-label').textContent==='16/10/2026');assert.equal(d.querySelectorAll('.expense-sheet tbody tr').length,1);assert(d.querySelector('.expense-sheet').textContent.includes('Parcela 2/4'));
 d.querySelector('[data-period="week"]').click();await settled(()=>d.querySelectorAll('.expense-sheet tbody tr').length===3);assert.equal(d.querySelector('[data-sheet-total]').textContent,'R$ 60,00');
 const source=d.querySelector('#sheet-source');source.value='Cartão';source.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(d.querySelectorAll('.expense-sheet tbody tr').length,2);assert.equal(d.querySelector('[data-sheet-total]').textContent,'R$ 40,00');
 d.querySelector('[data-sheet-clear]').click();d.querySelector('[data-period="month"]').click();await settled(()=>d.querySelectorAll('.expense-sheet tbody tr').length===4);assert.equal(d.querySelector('[data-sheet-total]').textContent,'R$ 100,00');
 d.querySelector('[data-period="custom"]').click();await settled(()=>!d.querySelector('#custom-period').hidden);const f=d.querySelector('#custom-period');f.elements.start.value='2026-10-16';f.elements.end.value='2026-10-19';f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settled(()=>d.querySelectorAll('.expense-sheet tbody tr').length===2);assert.equal(d.querySelector('[data-sheet-total]').textContent,'R$ 70,00');assert(d.querySelector('#prev').disabled);
 assert.equal(a.getSaves(),0);
 }finally{a.dom.window.close();}
});
