'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
async function settled(check){for(let i=0;i<100;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,5));}throw Error('A atualização não concluiu a operação.');}
test('Tela interna mostra download, reabre pronta e impede reiniciar com formulário pendente',async()=>{
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only'}),w=dom.window;let draft=true,timerCalls=0;const calls=[];w.setTimeout=()=>{timerCalls++;return timerCalls;};w.clearTimeout=()=>{};let state={phase:'idle',version:'1.2.0',nextVersion:'',percent:0,message:'Consultar'};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.hasLocalDraft=()=>draft;
 w.desktop={checkUpdate:async action=>{calls.push(action);if(action==='check')state={...state,phase:'available',nextVersion:'1.3.0',message:'Nova versão'};if(action==='download')state={...state,phase:'ready',percent:100,message:'Pronta'};if(action==='install')state={...state,phase:'installing',message:'Reiniciando'};return {...state};}};
 w.eval(fs.readFileSync(path.join(__dirname,'../ui/update-view.js'),'utf8'));
 try{
 await w.UpdateView.open();const d=w.document,button=d.querySelector('[data-update="action"]');assert.equal(button.textContent,'Baixar atualização');assert(!calls.includes('download'));const stableCalls=timerCalls;await w.UpdateView.open();assert.equal(timerCalls,stableCalls);
 button.click();await settled(()=>button.dataset.action==='install'&&!button.disabled);assert.equal(button.textContent,'Reiniciar e atualizar');assert(!calls.includes('install'));
 d.querySelector('[data-update="close"]').click();await w.UpdateView.open();assert.equal(button.dataset.action,'install');assert.equal(calls.filter(x=>x==='check').length,1);
 button.click();assert(!calls.includes('install'));assert.match(d.querySelector('.update-message').textContent,/formulários/);
 draft=false;button.click();await settled(()=>calls.includes('install'));assert.equal(state.phase,'installing');
 }finally{dom.window.close();}
});
