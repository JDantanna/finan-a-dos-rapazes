'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {LocalFinance,CacheFile,INTERVAL}=require('../src/local-cache.cjs');
const {validate}=require('../generated/shared.cjs');
const state=()=>({entries:[],goals:[],categories:[{id:'test-category',name:'Campo',symbol:'🚁',color:'#123456'}],accounts:[],incomeSources:[],preferences:{color:'#2468ac',userName:'Pessoa',appTitle:'Casa'},reminders:{dismissed:[]}});
function storage(){return{value:null,writes:0,archives:[],fail:false,async read(check){return this.value?{value:check(structuredClone(this.value)),recovered:false}:null;},async write(value){if(this.fail)throw Error('Disk full');this.value=structuredClone(value);this.writes++;},async archive(value){this.archives.push(structuredClone(value));}};}
function cloud(){let n=0;return{reads:0,writes:0,offline:false,block:null,record:{profile:{sub:'A',email:'a@example.test',name:'Pessoa'},revision:'cloud-0',folderId:'folder',fileId:'file',lastBackup:'2026-10-23T12:00:00Z',state:state()},async loadFinance(){this.reads++;if(this.offline)throw Error('Offline');return structuredClone(this.record);},async saveFinance(next,revision,id){if(this.block)await this.block;if(this.offline)throw Error('Offline');if(this.record.revision!==revision)throw Error('CONFLICT: remote changed');this.writes++;this.record={...this.record,state:validate(next),revision:'cloud-'+ ++n,operationId:id};return structuredClone(this.record);}};}
async function fixture(){const disk=storage(),remote=cloud(),cache=new LocalFinance({storage:disk,cloud:remote,account:'A'});await cache.open();return{disk,remote,cache};}
async function edit(cache,name){const before=await cache.loadFinance(),next=structuredClone(before.state);next.preferences.userName=name;return cache.saveFinance(next,before.revision,crypto.randomUUID(),'A');}
test('Salvamento local imediato não chama o Drive; vários registros viram um envio',async()=>{
 const {cache,remote,disk}=await fixture();const reads=remote.reads;await edit(cache,'Um');await edit(cache,'Dois');await edit(cache,'Três');assert.equal(remote.reads,reads);assert.equal(remote.writes,0);assert.equal(disk.value.record.state.preferences.userName,'Três');assert(cache.status().dirty);
 await cache.synchronize();assert.equal(remote.writes,1);assert.equal(remote.record.state.preferences.userName,'Três');assert.equal(cache.status().dirty,false);assert.equal((await cache.loadFinance()).state.categories[0].symbol,'🚁');
});
test('Agendamento usa cinco minutos e não cria intervalos duplicados',async()=>{
 const {cache,remote}=await fixture();await edit(cache,'Agendado');let callback,delay,clears=0;
 cache.setIntervalImpl=(cb,ms)=>{callback=cb;delay=ms;return 123;};cache.clearIntervalImpl=id=>{assert.equal(id,123);clears++;};cache.start();cache.start();assert.equal(delay,300000);assert.equal(INTERVAL,300000);assert.equal(remote.writes,0);callback();await cache.syncTask;assert.equal(remote.writes,1);cache.stop();assert.equal(clears,1);
});
test('Offline, reiniciar e retomar mantém alterações e isolamento por conta',async()=>{
 const {cache,disk,remote}=await fixture();await edit(cache,'Sem internet');remote.offline=true;await assert.rejects(()=>cache.synchronize(),/Offline/);await cache.flushLocal();cache.stop();const reopened=new LocalFinance({cloud:remote,storage:disk,account:'A'});await reopened.open();assert.equal((await reopened.loadFinance()).state.preferences.userName,'Sem internet');await edit(reopened,'Ainda offline');assert(reopened.status().dirty);
 const other=new LocalFinance({cloud:remote,storage:disk,account:'B'});await assert.rejects(()=>other.open(),/incompatível/);remote.offline=false;await reopened.synchronize();assert.equal(remote.record.state.preferences.userName,'Ainda offline');assert(!reopened.status().dirty);
});
test('Novas edições durante upload permanecem locais e são enviadas depois',async()=>{
 const {cache,remote}=await fixture();await edit(cache,'Primeiro');let release;remote.block=new Promise(r=>release=r);const sync=cache.synchronize();while(!cache.envelope.inflight)await new Promise(r=>setImmediate(r));await edit(cache,'Durante o upload');assert.equal((await cache.loadFinance()).state.preferences.userName,'Durante o upload');remote.block=null;release();await sync;assert.equal(remote.record.state.preferences.userName,'Durante o upload');assert(!cache.status().dirty);
});
test('Upload confirmado com falha de confirmação local é retomado sem sobrescrever nem duplicar',async()=>{
 const {cache,remote,disk}=await fixture();await edit(cache,'Persistente');const save=remote.saveFinance.bind(remote);remote.saveFinance=async(...args)=>{const r=await save(...args);disk.fail=true;return r;};await assert.rejects(()=>cache.synchronize(),/Disk full/);assert.equal(remote.writes,1);assert(disk.value.inflight);disk.fail=false;const reopened=new LocalFinance({cloud:remote,storage:disk,account:'A'});await reopened.open();await reopened.synchronize();assert.equal(remote.writes,1);assert(!reopened.status().dirty);
});
test('Falha de disco não confirma salvamento e preserva estado anterior',async()=>{
 const {cache,disk}=await fixture();const before=await cache.loadFinance();disk.fail=true;await assert.rejects(()=>edit(cache,'Não gravado'),/Disk full/);assert.equal((await cache.loadFinance()).revision,before.revision);assert.equal((await cache.loadFinance()).state.preferences.userName,'Pessoa');
});
test('Conflito mantém as duas versões e exige escolha explícita, com cópias de recuperação',async()=>{
 const {cache,remote,disk}=await fixture();await edit(cache,'Local');remote.record.revision='remote-changed';remote.record.state.preferences.userName='Outro computador';await assert.rejects(()=>cache.synchronize(),/CONFLICT/);assert.equal(remote.writes,0);assert(cache.status().conflict);assert.equal((await cache.loadFinance()).state.preferences.userName,'Local');
 await cache.resolveConflict('cloud');assert.equal((await cache.loadFinance()).state.preferences.userName,'Outro computador');assert.equal(disk.archives[0].record.state.preferences.userName,'Local');
 await edit(cache,'Escolha local');remote.record.revision='remote-again';await assert.rejects(()=>cache.synchronize(),/CONFLICT/);await cache.resolveConflict('local');assert.equal(remote.record.state.preferences.userName,'Escolha local');assert.equal(disk.archives.length,2);
});
test('Atualização limpa vinda do Drive não apaga edição que começou enquanto a rede aguardava',async()=>{
 const {cache,remote}=await fixture();let release;const load=remote.loadFinance.bind(remote);remote.loadFinance=async()=>{await new Promise(r=>release=r);return load();};const sync=cache.synchronize();while(!release)await new Promise(r=>setImmediate(r));await edit(cache,'Edição rápida');release();await sync;assert.equal((await cache.loadFinance()).state.preferences.userName,'Edição rápida');assert(cache.status().dirty);
});
test('Arquivo local é criptografado, recupera cópia anterior e nunca mistura contas',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'finance-cache-')),key=crypto.randomBytes(32),iv=crypto.randomBytes(16);
 const safe={isAsyncEncryptionAvailable:async()=>true,encryptStringAsync:async s=>{const c=crypto.createCipheriv('aes-256-ctr',key,iv);return Buffer.concat([c.update(s),c.final()]);},decryptStringAsync:async b=>{const c=crypto.createDecipheriv('aes-256-ctr',key,iv);return{result:Buffer.concat([c.update(b),c.final()]).toString()};}};
 try{const file=new CacheFile(dir,'A',safe);await file.write({name:'Privado 1'});await file.write({name:'Privado 2'});assert(!(await fs.readFile(file.file)).includes(Buffer.from('Privado')));await fs.writeFile(file.file,'corrompido');const recovered=await file.read(v=>v);assert(recovered.recovered);assert.equal(recovered.value.name,'Privado 1');await file.write({name:'Recuperado'});assert.equal((await file.read(v=>v)).value.name,'Recuperado');assert.equal(await new CacheFile(dir,'B',safe).read(v=>v),null);}finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('Interface completa salva personalização offline sem chamada de rede e sincroniza pelo botão',async()=>{
 const {JSDOM}=require('jsdom'),read=require('node:fs');const {cache,remote}=await fixture();remote.offline=true;const before=remote.reads;
 const root=path.join(__dirname,'../generated'),dom=new JSDOM(read.readFileSync(path.join(root,'index.html'),'utf8'),{runScripts:'outside-only',url:'https://test.invalid/'}),w=dom.window;
 const until=async check=>{for(let i=0;i<150;i++){if(check())return;await new Promise(r=>setTimeout(r,5));}throw Error('A interface não concluiu a operação.');};
 try{w.WebAssembly=WebAssembly;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.structuredClone=structuredClone;w.confirm=()=>true;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.HTMLElement.prototype.scrollIntoView=function(){};
 w.desktop={rpc:async(method,...args)=>{switch(method){case'loadFinance':return cache.loadFinance();case'saveFinance':return cache.saveFinance(...args);case'syncStatus':return cache.status();case'syncNow':return cache.synchronize();default:throw Error('Unexpected RPC '+method);}}};
 w.eval(read.readFileSync(path.join(root,'app.js'),'utf8'));await until(()=>w.document.querySelector('#content .stats'));w.document.querySelector('[data-view="settings"]').click();const form=w.document.querySelector('#personalization-form');form.elements.userName.value='Salvo offline';form.elements.userName.dispatchEvent(new w.Event('input',{bubbles:true}));form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>w.document.querySelector('#profile-display').textContent.includes('Salvo offline'));assert.equal(remote.reads,before);assert(cache.status().dirty);assert(w.document.querySelector('#cloud-toolbar-status').textContent.includes('computador'));
 remote.offline=false;w.document.querySelector('[data-desktop="sync"]').click();await until(()=>remote.writes===1&&!cache.status().dirty);assert.equal(remote.record.state.preferences.userName,'Salvo offline');
 }finally{dom.window.close();}
});
