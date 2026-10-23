'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {GoogleAuth,Vault,validateClient,readResponse}=require('../desktop-app/src/oauth.cjs');
const {FinanceDrive}=require('../desktop-app/src/drive.cjs');
const {Updates}=require('../desktop-app/src/updates.cjs');
const {validate,pdfHtml}=require('../desktop-app/generated/shared.cjs');
const EMPTY={entries:[],goals:[],accounts:[],incomeSources:[]};
const PROFILE={sub:'user-a',email:'a@example.test',name:'Pessoa A',email_verified:true};
const client={client_id:'test.apps.googleusercontent.com',client_secret:'desktop-public-identifier'};
function json(value,status=200,headers={}){return new Response(JSON.stringify(value),{status,headers});}
test('OAuth aceita somente configuração desktop e valida campos',()=>{
 assert.deepEqual(validateClient({installed:client}),client);
 assert.throws(()=>validateClient({web:client}));assert.throws(()=>validateClient({installed:{...client,client_id:'https://attacker.test'}}));
});
test('OAuth usa PKCE, loopback, estado e mantém refresh token fora da interface',async()=>{
 let stored,authorization,verifier;
 const auth=new GoogleAuth({client,vault:{read:async()=>stored||{},write:async v=>{stored=v}},
  openExternal:async url=>{
   authorization=new URL(url);assert.equal(authorization.origin,'https://accounts.google.com');
   const callback=new URL(authorization.searchParams.get('redirect_uri'));assert.equal(callback.hostname,'127.0.0.1');
   callback.search=new URLSearchParams({state:'incorrect',code:'malicious'}).toString();assert.equal((await fetch(callback)).status,400);
   callback.search=new URLSearchParams({state:authorization.searchParams.get('state'),code:'good-code'}).toString();assert.equal((await fetch(callback)).status,200);
  },fetchImpl:async(url,options)=>{
   if(url.endsWith('/token')){const params=new URLSearchParams(options.body);verifier=params.get('code_verifier');assert.equal(params.get('code'),'good-code');return json({access_token:'secret-access',refresh_token:'secret-refresh',expires_in:3600,scope:'openid email profile https://www.googleapis.com/auth/drive.file'});}
   assert.equal(options.headers.Authorization,'Bearer secret-access');return json(PROFILE);
  }});
 const result=await auth.login();assert.equal(result.sub,PROFILE.sub);assert(!JSON.stringify(result).includes('secret-'));
 assert.equal(stored.refresh_token,'secret-refresh');assert.equal(stored.sub,PROFILE.sub);
 assert.equal(crypto.createHash('sha256').update(verifier).digest('base64url'),authorization.searchParams.get('code_challenge'));
 assert.equal(authorization.searchParams.get('code_challenge_method'),'S256');
 await assert.rejects(()=>auth.request('https://attacker.test'),/inválido/);
});
test('OAuth cancelado não substitui credenciais anteriores',async()=>{
 let writes=0;
 const auth=new GoogleAuth({client,vault:{write:async()=>{writes++}},fetchImpl:async()=>{throw Error('Não deveria trocar código');},openExternal:async url=>{const u=new URL(url),callback=new URL(u.searchParams.get('redirect_uri'));callback.search=new URLSearchParams({state:u.searchParams.get('state'),error:'access_denied'}).toString();await fetch(callback)}});
 await assert.rejects(()=>auth.login(),/não foi concedida/);assert.equal(writes,0);
});
test('Renovação é única quando pedidos simultâneos precisam de token',async()=>{
 let refreshes=0;
 const auth=new GoogleAuth({client,vault:{read:async()=>({refresh_token:'private'})},fetchImpl:async()=>{refreshes++;return json({access_token:'fresh',expires_in:3600})}});
 assert.deepEqual(await Promise.all([auth.accessToken(),auth.accessToken()]),['fresh','fresh']);assert.equal(refreshes,1);
});
test('Vault criptografa em disco e recusa gravar sem proteção do sistema',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'finance-vault-'));
 const key=crypto.randomBytes(32),iv=crypto.randomBytes(16);
 const cipher={isAsyncEncryptionAvailable:async()=>true,encryptStringAsync:async s=>{const c=crypto.createCipheriv('aes-256-ctr',key,iv);return Buffer.concat([c.update(s),c.final()])},decryptStringAsync:async b=>{const d=crypto.createDecipheriv('aes-256-ctr',key,iv);return {result:Buffer.concat([d.update(b),d.final()]).toString(),shouldReEncrypt:false}}};
 try{const vault=new Vault(dir,cipher);await vault.write({refresh_token:'very-private'});assert(!(await fs.readFile(vault.file)).includes(Buffer.from('very-private')));assert.equal((await vault.read()).refresh_token,'very-private');await vault.clear();assert.deepEqual(await vault.read(),{});await assert.rejects(()=>new Vault(dir,{isAsyncEncryptionAvailable:async()=>false}).write({}),/não está disponível/);}finally{await fs.rm(dir,{recursive:true,force:true})}
});
test('Leitura interrompe respostas grandes antes de carregar todo o arquivo',async()=>{
 let cancelled=false;const response=new Response(new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(1_000_000))},cancel(){cancelled=true}}));
 await assert.rejects(()=>readResponse(response),/limite de tamanho/);assert.equal(cancelled,true);
});
function driveFixture({etag='"etag-1"',patchStatus=200,owner=PROFILE.email,changeDuringRead=false}={}){
 let current={schema:3,owner,revision:'revision-1',savedAt:'2026-10-23T12:00:00Z',state:EMPTY},writes=0,backups=0,metadataReads=0;
 const auth={profile:async()=>PROFILE,request:async(url,options={})=>{
  if(options.method==='POST'){backups++;return json({id:'backup-1'});}
  if(options.method==='PUT'){writes++;assert.equal(new URL(url).pathname,'/upload/drive/v2/files/file-a');assert.equal(options.headers['If-Match'],'"etag-1"');if(patchStatus!==200)return json({},patchStatus);current=JSON.parse(options.body);return json({id:'file-a'});}
  if(new URL(url).pathname==='/drive/v2/files/file-a'){metadataReads++;assert.equal(new URL(url).searchParams.get('fields'),'etag');return json({etag:changeDuringRead&&metadataReads>1?'"etag-2"':etag});}
  // Reproduce the real Drive response: no ETag HTTP header on media downloads.
  return json(current);
 }};
 const drive=new FinanceDrive(auth);drive.user=PROFILE;drive.folder={id:'folder-a'};drive.file={id:'file-a'};
 return {drive,counts:()=>({writes,backups})};
}
test('Drive salva personalização sem ETag no download, com cópia e atualização condicional idempotente',async()=>{
 const f=driveFixture(),next={...EMPTY,categories:[{id:'campo',name:'Campo',symbol:'🚁',color:'#13579b'}],preferences:{color:'#123456',userName:'Pessoa',appTitle:'Finanças'}};
 const saved=await f.drive.saveFinance(next,'revision-1','operation-123',PROFILE.sub);
 assert.equal(saved.state.preferences.color,'#123456');assert.equal((await f.drive.loadFinance()).state.categories[0].symbol,'🚁');assert.notEqual(saved.revision,'revision-1');assert.deepEqual(f.counts(),{writes:1,backups:1});
 assert.equal((await f.drive.loadFinance()).state.preferences.userName,'Pessoa');
 const repeated=await f.drive.saveFinance(next,'revision-1','operation-123',PROFILE.sub);assert.equal(saved.revision,repeated.revision);assert.deepEqual(f.counts(),{writes:1,backups:1});
});
test('Drive interrompe leitura que mudou entre metadados e conteúdo, sem escrever',async()=>{
 const f=driveFixture({changeDuringRead:true});await assert.rejects(()=>f.drive.saveFinance(EMPTY,'revision-1','operation-123',PROFILE.sub),/CONFLICT/);assert.deepEqual(f.counts(),{writes:0,backups:0});
});
test('Drive preserva dados em conflito, ETag ausente ou conta incorreta',async()=>{
 const f=driveFixture();await assert.rejects(()=>f.drive.saveFinance(EMPTY,'old','operation-123',PROFILE.sub),/CONFLICT/);assert.deepEqual(f.counts(),{writes:0,backups:0});
 await assert.rejects(()=>f.drive.saveFinance(EMPTY,'revision-1','operation-123','other-user'),/conta mudou/);
 const absent=driveFixture({etag:null});await assert.rejects(()=>absent.drive.saveFinance(EMPTY,'revision-1','operation-123',PROFILE.sub),/versão do arquivo/);assert.deepEqual(absent.counts(),{writes:0,backups:0});
 await assert.rejects(()=>driveFixture({owner:'other@example.test'}).drive.loadFinance(),/não pertence/);
 const race=driveFixture({patchStatus:412});await assert.rejects(()=>race.drive.saveFinance(EMPTY,'revision-1','operation-123',PROFILE.sub),/CONFLICT/);assert.equal(race.drive.busy,false);
});
test('Drive não escreve estado inválido e não restaura cópia de outra pasta',async()=>{
 const f=driveFixture();await assert.rejects(()=>f.drive.saveFinance({entries:[{cents:-1}],goals:[]},'revision-1','operation-123',PROFILE.sub));assert.equal(f.counts().writes,0);
 f.drive.auth.request=async()=>json({ownedByMe:true,parents:['another-folder'],appProperties:{kind:'backup'}});
 await assert.rejects(()=>f.drive.restoreFinanceBackup('backup-1','revision-1','operation-123',PROFILE.sub),/não pertence/);
});
test('UI reutiliza preferências, vencimentos e filtro PDF com HTML escapado',()=>{
 const state=validate({...EMPTY,preferences:{color:'#ffffff',userName:'Pessoa',appTitle:'Casa',reminderEnabled:true,reminderDays:7},reminders:{dismissed:['["item","2026-10-23"]']}});
 assert.equal(state.preferences.reminderDays,7);assert.equal(state.reminders.dismissed.length,1);
 const row={date:'2026-10-23',kind:'expense',description:'<script>bad()</script>',category:'Trabalho',source:'Cartão da empresa',account:'',cents:12345,frequency:'Mensal'};
 const payload={start:'2026-10-01',end:'2026-10-31',expensesOnly:true,expenseSource:row.source,rows:[row]};
 const html=pdfHtml(payload,'Pessoa <A>');assert(html.includes('Pessoa &lt;A&gt;'));assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));assert(html.includes('123,45'));
 assert.throws(()=>pdfHtml({...payload,expenseSource:'Outra conta'},'Pessoa'),/fora do filtro/);
});
function updatesFixture({available=true,answers=[0,0],busy=false,fail=false}={}){
 let downloaded=0,installed=0,dialogs=0;
 const updater={on(){},checkForUpdates:async()=>{if(fail)throw Error('offline');return {isUpdateAvailable:available,updateInfo:{version:'1.1.0'}}},downloadUpdate:async()=>{downloaded++},quitAndInstall(){installed++}};
 const updates=new Updates({updater,dialog:{showMessageBox:async()=>({response:answers[dialogs++]??1})},app:{isPackaged:true,getVersion:()=> '1.0.0'},window:()=>null,isBusy:()=>busy});
 return{updates,updater,counts:()=>({downloaded,installed,dialogs})};
}
test('Atualização requer aceite para baixar e instalar, sem instalar automaticamente',async()=>{
 const yes=updatesFixture();await yes.updates.check();assert.deepEqual(yes.counts(),{downloaded:1,installed:1,dialogs:2});assert.equal(yes.updater.autoInstallOnAppQuit,false);assert.equal(yes.updater.autoDownload,false);
 const no=updatesFixture({answers:[1]});await no.updates.check();assert.deepEqual(no.counts(),{downloaded:0,installed:0,dialogs:1});
 const later=updatesFixture({answers:[0,1]});await later.updates.check();assert.equal(later.counts().installed,0);
});
test('Atualização não instala durante salvamento, sem versão nova ou após falha',async()=>{
 const busy=updatesFixture({busy:true});await busy.updates.check();assert.equal(busy.counts().installed,0);
 const current=updatesFixture({available:false});assert.match((await current.updates.check()).message,/mais recente/);assert.equal(current.counts().downloaded,0);
 const failure=updatesFixture({fail:true});await assert.rejects(()=>failure.updates.check(),/Não foi possível/);assert.equal(failure.updates.busy,false);
});
