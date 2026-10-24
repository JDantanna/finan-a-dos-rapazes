'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
async function until(check){for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,5));}throw Error('A interface não concluiu.');}
test('Entrada permite começar sem cliente OAuth e sem chamar login Google',async()=>{
 const root=path.join(__dirname,'../ui/'),dom=new JSDOM(fs.readFileSync(root+'login.html','utf8'),{runScripts:'outside-only'}),w=dom.window;let name;
 try{w.desktop={status:async()=>({configured:false,localProfile:false,version:'1.6.0'}),localLogin:async value=>{name=value;},login:()=>{throw Error('Google não deve ser chamado');}};w.eval(fs.readFileSync(root+'login.js','utf8'));await until(()=>w.document.querySelector('#status').textContent.includes('sem login Google'));assert(w.document.querySelector('#login').disabled);w.document.querySelector('#local-name').value='Pessoa';w.document.querySelector('#local-profile').dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));await until(()=>name==='Pessoa'&&!w.document.querySelector('#local-start').disabled);assert(!w.document.querySelector('#local-start').disabled);}finally{w.close();}
});
test('Interface local apresenta pasta opcional e salva sem exigir conta Google',async()=>{
 const root=path.join(__dirname,'../generated/'),dom=new JSDOM(fs.readFileSync(root+'index.html','utf8'),{runScripts:'outside-only',url:'https://test.invalid'}),w=dom.window;let saves=0;
 let state={entries:[],goals:[],accounts:[],incomeSources:[]},revision=0;
 const record=()=>({state:structuredClone(state),profile:{sub:'local-ui-user',name:'Pessoa',email:''},revision:String(revision),localSync:{localMode:true,folder:null,folderConnected:false,dirty:true,revision:String(revision),message:'Dados salvos neste computador.'}});
 try{w.WebAssembly=WebAssembly;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.structuredClone=structuredClone;w.HTMLElement.prototype.scrollIntoView=function(){};
 w.desktop={rpc:async(method,...args)=>{if(method==='loadFinance')return record();if(method==='saveFinance'){state=args[0];revision++;saves++;return record();}if(method==='syncStatus')return record().localSync;throw Error('RPC inesperado '+method);}};
 w.eval(fs.readFileSync(root+'app.js','utf8'));await until(()=>w.document.querySelector('.stats'));const d=w.document;assert(d.querySelector('#profile-display').textContent.includes('Perfil local'));d.querySelector('[data-view="settings"]').click();assert(d.querySelector('[data-desktop="folder"]'));assert(!d.querySelector('[data-desktop="sync"]'));const form=d.querySelector('#personalization-form');form.elements.userName.value='Meu perfil';form.dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));await until(()=>saves===1);assert.equal(state.preferences.userName,'Meu perfil');d.querySelector('[data-view="profiles"]').click();assert(d.querySelector('#content').textContent.includes('sem login Google obrigatório'));assert(d.querySelector('#content').textContent.includes('não há mesclagem automática'));
 }finally{w.close();}
});
