'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {JSDOM}=require('jsdom');
const {GoogleAuth,readResponse}=require('../src/oauth.cjs');
const {reconnectGoogle}=require('../src/reconnect.cjs');
const {LocalFinance}=require('../src/local-cache.cjs');
const json=(value,status=200)=>new Response(JSON.stringify(value),{status});
const client={client_id:'test.apps.googleusercontent.com',client_secret:'not-a-real-secret'};
const profile={sub:'same-user',email:'person@example.test',email_verified:true,name:'Pessoa'};
const state={entries:[{id:'local-entry',description:'Lançamento ainda não enviado',kind:'expense',cents:1234,date:'2026-11-02',frequency:'once',end_date:null,category:'Outros',source:'Conta'}],goals:[],accounts:[],incomeSources:[]};
test('HTTP 400 OAuth distingue autorização expirada, configuração e erros Drive sem vazar respostas',async()=>{
 await assert.rejects(()=>readResponse(json({error:'invalid_grant',error_description:'private-token'},400),'oauth'),e=>e.code==='GOOGLE_REAUTH_REQUIRED'&&/Reconectar Google/.test(e.message)&&!e.message.includes('private-token'));
 await assert.rejects(()=>readResponse(json({error:'invalid_client'},400),'oauth'),e=>e.code==='GOOGLE_CLIENT_INVALID');
 await assert.rejects(()=>readResponse(json({error:{errors:[{reason:'badRequest'}],message:'private-file-name'}},400)),e=>e.code==='GOOGLE_REQUEST_FAILED'&&/badRequest/.test(e.message)&&!e.message.includes('private-file-name'));
 await assert.rejects(()=>readResponse(json({error:{errors:[{reason:'storageQuotaExceeded'}]}},403)),e=>e.code==='GOOGLE_STORAGE_FULL');
 let cancelled=false;const huge=new Response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(20000));},cancel(){cancelled=true;}}),{status:400});await assert.rejects(()=>readResponse(huge),/HTTP 400/);assert(cancelled);
});
test('Token invalid_grant deixa de ser repetido em segundo plano e não apaga credenciais',async()=>{
 let requests=0;const auth=new GoogleAuth({client,vault:{read:async()=>({refresh_token:'old-refresh',sub:profile.sub}),clear:()=>{throw Error('Não apagar');}},fetchImpl:async()=>{requests++;return json({error:'invalid_grant'},400);}});
 for(let i=0;i<2;i++)await assert.rejects(()=>auth.accessToken(),e=>e.code==='GOOGLE_REAUTH_REQUIRED');assert.equal(requests,1);
});
function authorizationAuth(sub,stored){return new GoogleAuth({client,vault:{write:async value=>{stored.value=value;}},openExternal:async url=>{const u=new URL(url),callback=new URL(u.searchParams.get('redirect_uri'));callback.search=new URLSearchParams({state:u.searchParams.get('state'),code:'test-code'}).toString();await fetch(callback);},fetchImpl:async url=>url.endsWith('/token')?json({access_token:'new-access',refresh_token:'new-refresh',expires_in:3600,scope:'openid email profile https://www.googleapis.com/auth/drive.file'}):json({...profile,sub})});}
test('Reconectar com outra conta recusa antes de substituir o vault e restaura a sessão',async()=>{
 const stored={value:{refresh_token:'old-refresh',sub:profile.sub}},auth=authorizationAuth('another-user',stored),previous={access_token:'old-access',expires_at:Date.now()+3600000};auth.session=previous;auth.reauthRequired=true;
 await assert.rejects(()=>auth.login({expectedAccount:profile.sub}),/outra conta/);assert.equal(stored.value.refresh_token,'old-refresh');assert.equal(auth.session,previous);assert.equal(auth.reauthRequired,true);
 const good=authorizationAuth(profile.sub,stored);good.reauthRequired=true;await good.login({expectedAccount:profile.sub});assert.equal(stored.value.refresh_token,'new-refresh');assert.equal(good.reauthRequired,false);
});
async function localFixture(){
 const remote={auth:{old:true},record:{profile,revision:'remote-1',state:structuredClone(state)},writes:0,async loadFinance(){return structuredClone(this.record);},async saveFinance(next,revision,operationId){assert.equal(revision,this.record.revision);this.record={...this.record,state:structuredClone(next),revision:'remote-2',operationId};this.writes++;return structuredClone(this.record);}};
 const disk={value:null,async read(){return null;},async write(value){this.value=structuredClone(value);}},local=new LocalFinance({cloud:remote,storage:disk,account:profile.sub});await local.open();const before=await local.loadFinance();await local.saveFinance(before.state,before.revision,randomUUID(),profile.sub);await local.prepare();return{remote,disk,local};
}
test('Reconexão preserva dados pendentes e diário de envio; sincronização retoma após autorização',async()=>{
 const {remote,disk,local}=await localFixture(),before=structuredClone(disk.value),nextAuth={login:async({expectedAccount})=>{assert.equal(expectedAccount,profile.sub);assert(local.stopped);return profile;}};
 try{assert.equal(await reconnectGoogle({local,drive:remote,createAuth:()=>nextAuth}),nextAuth);assert.equal(remote.auth,nextAuth);assert.deepEqual(disk.value,before);assert(local.status().dirty);assert(!local.stopped);assert.equal(remote.writes,0);await local.synchronize();assert.equal(remote.writes,1);assert.equal(local.status().dirty,false);assert.equal((await local.loadFinance()).state.entries[0].cents,1234);}finally{local.stop();}
});
test('Reconexão cancelada mantém cliente anterior e timer; sincronização em andamento bloqueia reconexão',async()=>{
 const {remote,local,disk}=await localFixture(),old=remote.auth,before=structuredClone(disk.value);try{await assert.rejects(()=>reconnectGoogle({local,drive:remote,createAuth:()=>({login:async()=>{throw Error('Autorização cancelada');}})}),/cancelada/);assert.equal(remote.auth,old);assert.deepEqual(disk.value,before);assert(!local.stopped);local.syncTask=Promise.resolve();await assert.rejects(()=>reconnectGoogle({local,drive:remote,createAuth:()=>{throw Error('Não deveria abrir');}}),/Aguarde/);local.syncTask=null;}finally{local.stop();}
});
async function until(check){for(let i=0;i<150;i++){if(check())return;await new Promise(r=>setTimeout(r,5));}throw Error('Interface não concluiu');}
test('Interface Google permite reconectar sem sair, substituir lançamentos ou limpar cache',async()=>{
 const root=path.join(__dirname,'../generated/'),dom=new JSDOM(fs.readFileSync(root+'index.html','utf8'),{runScripts:'outside-only',url:'https://test.invalid'}),w=dom.window;let connects=0;const record={state:structuredClone(state),profile,revision:'local-1',localSync:{dirty:true,message:'Autorização expirada. Use Reconectar Google.'}};
 try{w.WebAssembly=WebAssembly;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.structuredClone=structuredClone;w.HTMLElement.prototype.scrollIntoView=function(){};w.desktop={reconnect:async()=>{connects++;record.localSync={dirty:false,message:'Computador e Google Drive sincronizados.'};return record.localSync;},logout:()=>{throw Error('Não sair');},rpc:async method=>{if(method==='loadFinance')return structuredClone(record);if(method==='syncStatus')return record.localSync;throw Error('RPC não esperado: '+method);}};w.eval(fs.readFileSync(root+'app.js','utf8'));const d=w.document;await until(()=>d.querySelector('.stats'));d.querySelector('[data-view="profiles"]').click();assert(d.querySelector('#desktop-sync-status').textContent.includes('expirada'));d.querySelector('[data-desktop="reconnect"]').click();await until(()=>connects===1&&d.querySelector('#desktop-sync-status').textContent.includes('sincronizados'));assert(!d.querySelector('[data-desktop="reconnect"]').disabled);assert.equal(record.state.entries[0].cents,1234);
 }finally{w.close();}
});
