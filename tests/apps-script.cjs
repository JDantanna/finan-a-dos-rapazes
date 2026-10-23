'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
let active='a@example.test',effective=active,id=0,clock=0,failUpdate=false;const files=new Map(),properties=new Map();
const blob=(text,type,name)=>({text:String(text),type,name,getBytes(){return Buffer.from(this.text)}});
const context={console,Date,JSON,Set,Number,Error,encodeURIComponent,isNaN,
 Session:{getActiveUser:()=>({getEmail:()=>active}),getEffectiveUser:()=>({getEmail:()=>effective})},
 ScriptApp:{getScriptId:()=> 'script-test',getOAuthToken:()=> 'SERVER_ONLY_FAKE_TOKEN'},
 Utilities:{getUuid:()=> 'revision-'+(++clock),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,text)=>[...crypto.createHash('sha256').update(text).digest()],newBlob:blob},
 LockService:{getUserLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
 PropertiesService:{getUserProperties:()=>({getProperty:k=>properties.get(active+':'+k)||null,setProperty:(k,v)=>properties.set(active+':'+k,v)})},
 UrlFetchApp:{fetch:url=>{const file=files.get(url.split('/').at(-1).split('?')[0]);const ok=file&&file.owner===active;return{getResponseCode:()=>ok?200:403,getContent:()=>Buffer.from(file?.data||''),getContentText:()=>file?.data||''}}},
 Drive:{About:{get:()=>({user:{displayName:active==='a@example.test'?'Ana Silva':'Bruno Santos',photoLink:'https://lh3.googleusercontent.com/photo'}})},Files:{
  create(meta,content){const file={...meta,id:'file-'+(++id),owner:active,data:content?.text||'',createdTime:new Date(1700000000000+id*1000).toISOString(),trashed:false};files.set(file.id,file);return{id:file.id}},
  get(fileId){const f=files.get(fileId);if(!f)throw Error('404');return{...f,ownedByMe:f.owner===active}},
  update(meta,fileId,content){if(failUpdate)throw Error('network');const f=files.get(fileId);assert.equal(f.owner,active);f.data=content.text;return{id:fileId}},
  list({q,pageSize=100,orderBy}){let items=[...files.values()].filter(f=>f.owner===active&&!f.trashed);const parent=q.match(/'([^']+)' in parents/);if(parent)items=items.filter(f=>f.parents?.includes(parent[1]));const marker=q.match(/key='app' and value='([^']+)'/);if(marker)items=items.filter(f=>f.appProperties?.app===marker[1]);if(q.includes("mimeType = 'application/vnd.google-apps.folder'"))items=items.filter(f=>f.mimeType==='application/vnd.google-apps.folder');if(q.includes("name = 'financas.json'"))items=items.filter(f=>f.name==='financas.json');if(q.includes("key='kind' and value='backup'"))items=items.filter(f=>f.appProperties?.kind==='backup');if(orderBy)items.sort((a,b)=>b.createdTime.localeCompare(a.createdTime));return{files:items.slice(0,pageSize)}},
 }}
};vm.createContext(context);vm.runInContext(fs.readFileSync('apps-script/Code.gs','utf8'),context);
const state=n=>({entries:[{id:'entry',description:'Teste',kind:'income',cents:n,category:'Salário',source:'Empresa',account:'Conta',date:'2026-10-23',frequency:'once',end_date:null}],goals:[],accounts:[],incomeSources:[]});
const a=context.loadFinance();assert.equal(a.state.entries.length,0);active=effective='b@example.test';const b=context.loadFinance();assert.notEqual(a.folderId,b.folderId);assert.notEqual(a.profile.sub,b.profile.sub);active=effective='a@example.test';const saved=context.saveFinance(state(10001),a.revision,'operation-1',a.profile.sub);assert.equal(saved.state.entries[0].cents,10001);assert.equal(context.loadFinance().revision,saved.revision);console.log('1. Cada usuário recebe pasta, perfil e arquivo próprios.');
const count=files.size;const retry=context.saveFinance(state(10001),a.revision,'operation-1',a.profile.sub);assert.equal(retry.revision,saved.revision);assert.equal(files.size,count);assert.throws(()=>context.saveFinance(state(20000),a.revision,'operation-2',a.profile.sub),/CONFLICT/);console.log('2. Idempotência e conflito entre abas preservam a versão confirmada.');
const history=context.listFinanceBackups(a.profile.sub);assert.equal(history.length,1);const restored=context.restoreFinanceBackup(history[0].id,saved.revision,'restore-1',a.profile.sub);assert.equal(restored.state.entries.length,0);assert.equal(context.listFinanceBackups(a.profile.sub).length,2);console.log('3. Restauração preserva a versão anterior como backup.');
active=effective='b@example.test';assert.throws(()=>context.restoreFinanceBackup(history[0].id,b.revision,'restore-2',b.profile.sub),/não pertence/);assert.throws(()=>context.saveFinance(state(10),b.revision,'operation-3',a.profile.sub),/conta Google mudou/);effective='a@example.test';assert.throws(()=>context.loadFinance(),/usuário que acessa/);active=effective='a@example.test';console.log('4. Restauração cruzada e execução como proprietário são bloqueadas.');
for(const change of [s=>s.entries[0].cents=-1,s=>s.entries[0].date='2026-02-30',s=>s.entries.push({...s.entries[0]}),s=>s.accounts=[{id:'x',name:'A',type:'invalid'}],s=>s.goals=[{id:'g',name:'G',target:1,saved:2,deadline:'2027-01-01'}]]){const bad=state(1);change(bad);assert.throws(()=>context.validState_(bad));}console.log('5. Valores, datas, metas e registros inválidos são rejeitados.');
failUpdate=true;assert.throws(()=>context.saveFinance(state(20000),restored.revision,'operation-4',a.profile.sub),/network/);failUpdate=false;assert.equal(context.loadFinance().revision,restored.revision);assert.ok(!JSON.stringify(context.loadFinance()).includes('SERVER_ONLY_FAKE_TOKEN'));console.log('6. Falha no envio não troca a versão atual; tokens nunca chegam ao navegador.');
const html=fs.readFileSync('apps-script/Index.html','utf8');assert.ok(!html.includes('accounts.google.com/gsi/client'));assert.ok(!html.includes('FINANCE_GOOGLE_CLIENT_ID'));assert.ok(html.includes('FINANCE_WASM_BASE64'));assert.ok(html.includes('google.script.run'));const code=html.match(/<script>([\s\S]*)<\/script>/)[1];new vm.Script(code);console.log('7. HTML independente contém o núcleo Rust, não pede Client ID e tem JavaScript válido.');

assert.equal(context.loadFinance().profile.name,'Ana Silva');
assert.equal(context.loadFinance().profile.picture,'https://lh3.googleusercontent.com/photo');
const payload={start:'2026-10-01',end:'2026-10-31',rows:[{date:'2026-10-23',kind:'expense',description:'Compra <teste> · parcela 1/4',category:'Casa',source:'__proto__',account:'',cents:10001,frequency:'Uma vez'}]};
const pdfHtml=context.reportPdfHtml_(payload,'Ana & Silva');assert.ok(pdfHtml.includes('Ana &amp; Silva'));assert.ok(pdfHtml.includes('Compra &lt;teste&gt;'));assert.ok(pdfHtml.includes('100,01'));assert.ok(!pdfHtml.includes('Finança dos Rapazes'));assert.ok(pdfHtml.includes('__proto__'));assert.throws(()=>context.reportPdfHtml_({...payload,start:'2026-02-30'},'Ana'));assert.throws(()=>context.exportFinancePdf(payload,b.profile.sub),/conta Google mudou/);assert.ok(context.reportPdfHtml_({...payload,rows:[]},'Ana').includes('Nenhum lançamento'));console.log('8. Nome/foto reais, PDF sem marca, centavos, texto seguro, período vazio e conta correta.');
const filteredPayload={...payload,expenseSource:'__proto__',expensesOnly:true};
assert.ok(context.reportPdfHtml_(filteredPayload,'Ana').includes('Despesas · __proto__'));
assert.throws(()=>context.reportPdfHtml_({...filteredPayload,expenseSource:'Outro cartão'},'Ana'),/fora do filtro/);
assert.throws(()=>context.reportPdfHtml_({...filteredPayload,rows:[{...payload.rows[0],kind:'income'}]},'Ana'),/fora do filtro/);
assert.ok(context.reportPdfHtml_({...filteredPayload,rows:[]},'Ana').includes('Nenhum lançamento'));
console.log('9. PDF identifica a fonte selecionada e rejeita receitas ou despesas de outra fonte.');
const preferenceState={...context.loadFinance().state,preferences:{color:'#8234ab',userName:'Rafael Campo',appTitle:'Minhas finanças'}};
const preferenceSaved=context.saveFinance(preferenceState,context.loadFinance().revision,'preferences-1',a.profile.sub);
assert.equal(context.loadFinance().state.preferences.appTitle,'Minhas finanças');
assert.equal(context.loadFinance().state.preferences.color,'#8234ab');
active=effective='b@example.test';assert.equal(context.loadFinance().state.preferences.userName,'');active=effective='a@example.test';
assert.throws(()=>context.validPreferences_({color:'red;display:none'}),/Cor inválida/);
assert.throws(()=>context.validPreferences_({userName:'a'.repeat(81)}),/80 caracteres/);
assert.equal(context.validPreferences_({userName:'  Rafael  '}).userName,'Rafael');
assert.equal(context.validPreferences_(null).color,'#287560');
const profileBackup=context.listFinanceBackups(a.profile.sub).find(file=>JSON.parse(files.get(file.id).data).state.preferences?.appTitle==='Minhas finanças');
const resetState={...context.loadFinance().state,preferences:{color:'#287560',userName:'',appTitle:''}};
context.saveFinance(resetState,preferenceSaved.revision,'preferences-2',a.profile.sub);
const preserved=context.listFinanceBackups(a.profile.sub).find(file=>JSON.parse(files.get(file.id).data).state.preferences?.appTitle==='Minhas finanças');
context.restoreFinanceBackup(preserved.id,context.loadFinance().revision,'preferences-restore',a.profile.sub);
assert.equal(context.loadFinance().state.preferences.userName,'Rafael Campo');
console.log('10. Preferências persistem por conta, aceitam padrões e restauração; cores inválidas e textos longos são rejeitados.');
const reminderState={...context.loadFinance().state,reminders:{dismissed:[JSON.stringify(['monthly','2026-10-23'])]},preferences:{...context.loadFinance().state.preferences,reminderEnabled:true,reminderDays:7}};
context.saveFinance(reminderState,context.loadFinance().revision,'reminders-save',a.profile.sub);
assert.equal(context.loadFinance().state.reminders.dismissed.length,1);assert.equal(context.loadFinance().state.preferences.reminderDays,7);
active=effective='b@example.test';assert.equal(context.loadFinance().state.reminders.dismissed.length,0);active=effective='a@example.test';
assert.throws(()=>context.validPreferences_({reminderDays:999}),/avisos/);assert.throws(()=>context.validReminders_({dismissed:['invalid']}));
console.log('11. Avisos dispensados persistem isolados por conta; antecedência e formato são validados.');
