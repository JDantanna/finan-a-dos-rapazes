/** Finança dos Rapazes. Deploy as USER_ACCESSING, never as the owner for other users. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('Finança dos Rapazes').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
function loadFinance() {
  return withUserLock_(function() { return load_(identity_()); });
}
function saveFinance(state, expectedRevision, operationId, expectedAccount) {
  return withUserLock_(function() {
    const user = identity_();
    if (user.sub !== expectedAccount) throw new Error('A conta Google mudou. Reabra o aplicativo antes de salvar.');
    return save_(state, expectedRevision, operationId, user);
  });
}
function listFinanceBackups(expectedAccount) {
  const user = identity_();
  if (user.sub !== expectedAccount) throw new Error('A conta Google mudou. Reabra o aplicativo.');
  const folder = folder_();
  return Drive.Files.list({q: "'" + folder.id + "' in parents and trashed = false and 'me' in owners and appProperties has { key='kind' and value='backup' }", pageSize:20, orderBy:'createdTime desc', fields:'files(id,name,createdTime)'}).files || [];
}
function restoreFinanceBackup(fileId, expectedRevision, operationId, expectedAccount) {
  return withUserLock_(function() {
    const user = identity_();
    if (user.sub !== expectedAccount) throw new Error('A conta Google mudou. Reabra o aplicativo.');
    const folder = folder_();
    const file = Drive.Files.get(validId_(fileId), {fields:'id,parents,ownedByMe,trashed,appProperties'});
    if (file.trashed || !file.ownedByMe || !file.parents || file.parents.indexOf(folder.id) < 0 || !file.appProperties || file.appProperties.kind !== 'backup') throw new Error('Esta cópia não pertence à sua pasta do aplicativo.');
    const snapshot = readJson_(file.id);
    if (snapshot.schema !== 3 || snapshot.owner !== user.email) throw new Error('Cópia incompatível com esta conta Google.');
    return save_(snapshot.state, expectedRevision, operationId, user);
  });
}
function identity_() {
  const active = Session.getActiveUser().getEmail(), effective = Session.getEffectiveUser().getEmail();
  if (!active || !effective || active.toLowerCase() !== effective.toLowerCase()) throw new Error('Publique este aplicativo para executar como o usuário que acessa. O acesso à conta de outra pessoa foi bloqueado.');
  const email = active.toLowerCase();
  const sub = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, email + ':' + ScriptApp.getScriptId()).map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
  let account = {};
  try { account = Drive.About.get({fields:'user(displayName,photoLink,emailAddress)'}).user || {}; }
  catch (error) { /* Finance access remains available when profile metadata is temporarily unavailable. */ }
  return {email:email, name:account.displayName || email, picture:account.photoLink || '', sub:sub};
}
function withUserLock_(fn) {
  const lock = LockService.getUserLock();
  if (!lock.tryLock(20000)) throw new Error('Há outro salvamento em andamento. Tente novamente.');
  try { return fn(); } finally { lock.releaseLock(); }
}
function marker_() { return 'financa-rapazes-' + ScriptApp.getScriptId(); }
function folder_() {
  const props = PropertiesService.getUserProperties(), cached = props.getProperty('financeFolder');
  if (cached) {
    try { const folder = Drive.Files.get(cached, {fields:'id,ownedByMe,trashed,mimeType,appProperties'});
      if (folder.ownedByMe && !folder.trashed && folder.mimeType === 'application/vnd.google-apps.folder' && folder.appProperties && folder.appProperties.app === marker_()) return folder;
    } catch (error) { /* Discover an owned application folder if a previous folder is no longer accessible. */ }
  }
  const found = Drive.Files.list({q:"trashed = false and 'me' in owners and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='app' and value='" + marker_() + "' }",fields:'files(id)',pageSize:2}).files || [];
  if (found.length > 1) throw new Error('Há duas pastas deste aplicativo. Nenhum dado foi alterado.');
  const folder = found[0] || Drive.Files.create({name:'Finança dos Rapazes',mimeType:'application/vnd.google-apps.folder',appProperties:{app:marker_()}},null,{fields:'id'});
  props.setProperty('financeFolder',folder.id);
  return folder;
}
function current_(folder, user) {
  const files = Drive.Files.list({q:"'" + folder.id + "' in parents and trashed = false and 'me' in owners and name = 'financas.json'",fields:'files(id)',pageSize:2}).files || [];
  if (files.length > 1) throw new Error('Há dois arquivos financas.json nesta pasta. Nenhum deles foi substituído.');
  if (!files.length) {
    const record = {schema:3,owner:user.email,revision:Utilities.getUuid(),savedAt:new Date().toISOString(),state:{entries:[],goals:[],accounts:[],incomeSources:[],demo:false}};
    const file = Drive.Files.create({name:'financas.json',parents:[folder.id],appProperties:{kind:'current'}},jsonBlob_(record,'financas.json'),{fields:'id'});
    return {file:file,record:record};
  }
  const record = readJson_(files[0].id);
  if (record.schema !== 3 || record.owner !== user.email || typeof record.revision !== 'string') throw new Error('Arquivo financeiro incompatível. Os dados foram preservados.');
  record.state = validState_(record.state);
  return {file:files[0],record:record};
}
function load_(user) {
  const folder = folder_(), current = current_(folder,user);
  return response_(user,folder,current.file,current.record);
}
function save_(state, expectedRevision, operationId, user) {
  state = validState_(state);
  if (typeof operationId !== 'string' || !/^[\w-]{8,200}$/.test(operationId)) throw new Error('Identificador de salvamento inválido.');
  const folder = folder_(), current = current_(folder,user);
  if (current.record.operationId === operationId) return response_(user,folder,current.file,current.record);
  if (current.record.revision !== expectedRevision) throw new Error('CONFLICT: os dados foram alterados em outra aba ou dispositivo. Exporte os dados exibidos e use Recarregar do Drive antes de tentar novamente.');
  const backupName = 'backup-' + current.record.savedAt.replace(/[:.]/g,'-') + '-' + current.record.revision + '.json';
  Drive.Files.create({name:backupName,parents:[folder.id],appProperties:{kind:'backup'}},jsonBlob_(current.record,backupName),{fields:'id'});
  const record = {schema:3,owner:user.email,revision:Utilities.getUuid(),operationId:operationId,savedAt:new Date().toISOString(),state:state};
  Drive.Files.update({},current.file.id,jsonBlob_(record,'financas.json'),{fields:'id'});
  return response_(user,folder,current.file,record);
}
function response_(user,folder,file,record) {
  return {profile:user,folderId:folder.id,fileId:file.id,revision:record.revision,lastBackup:record.savedAt,state:record.state};
}
function validId_(id) { if (typeof id !== 'string' || !/^[\w-]+$/.test(id)) throw new Error('Arquivo inválido.'); return id; }
function jsonBlob_(value,name) { const text = JSON.stringify(value); if (Utilities.newBlob(text).getBytes().length > 4000000) throw new Error('Limite de 4 MB por arquivo excedido.'); return Utilities.newBlob(text,'application/json',name); }
function readJson_(id) {
  const response = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(validId_(id)) + '?alt=media',{headers:{Authorization:'Bearer ' + ScriptApp.getOAuthToken()},muteHttpExceptions:true});
  if (response.getResponseCode() !== 200) throw new Error('Não foi possível ler os dados no Drive. Tente novamente.');
  if (response.getContent().length > 4000000) throw new Error('O arquivo financeiro excede o limite de tamanho.');
  return JSON.parse(response.getContentText());
}
function validState_(state) {
  if (!state || !Array.isArray(state.entries) || !Array.isArray(state.goals) || state.entries.length > 100000 || state.goals.length > 1000) throw new Error('Dados financeiros inválidos.');
  function text(s,max) { return typeof s === 'string' && !!s.trim() && Utilities.newBlob(s).getBytes().length <= max; }
  function cents(n) { return Number.isSafeInteger(n) && n > 0 && n <= 100000000000; }
  function date(s) { if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d = new Date(s+'T12:00:00Z'); return !isNaN(d.getTime()) && d.toISOString().slice(0,10) === s && +s.slice(0,4) >= 1900 && +s.slice(0,4) <= 2200; }
  const ids = new Set();
  state.entries.forEach(function(e) {
    if (!e || !text(e.id,200) || ids.has(e.id) || !text(e.description,200) || !text(e.source,120) || !text(e.category,80) || !cents(e.cents) || ['income','expense'].indexOf(e.kind)<0 || ['once','weekly','fortnightly','monthly','yearly'].indexOf(e.frequency)<0 || !date(e.date) || (e.end_date && (!date(e.end_date) || e.end_date < e.date)) || (e.account != null && (typeof e.account !== 'string' || Utilities.newBlob(e.account).getBytes().length > 120))) throw new Error('Confira os campos dos lançamentos.'); ids.add(e.id);
  });
  ids.clear();
  state.goals.forEach(function(g) { if (!g || !text(g.id,200) || ids.has(g.id) || !text(g.name,200) || !cents(g.target) || !Number.isSafeInteger(g.saved) || g.saved < 0 || g.saved > g.target || !date(g.deadline)) throw new Error('Confira os campos das metas.'); ids.add(g.id); });
  function registry(items,accounts) { if (!Array.isArray(items) || items.length > 1000) throw new Error('Cadastro inválido.'); const names = new Set(), keys = new Set(); items.forEach(function(item) { const name = item && typeof item.name === 'string' ? item.name.trim().normalize('NFC').toLowerCase() : ''; if (!item || !text(item.id,200) || keys.has(item.id) || !text(item.name,120) || names.has(name) || (accounts && ['checking','credit','benefit','cash','other'].indexOf(item.type)<0)) throw new Error('Cadastro inválido ou duplicado.'); names.add(name); keys.add(item.id); }); return items; }
  const clean = {entries:state.entries,goals:state.goals,accounts:registry(state.accounts||[],true),incomeSources:registry(state.incomeSources||[],false),demo:!!state.demo,preferences:validPreferences_(state.preferences),reminders:validReminders_(state.reminders)};
  jsonBlob_(clean,'validation.json');return clean;
}

function exportFinancePdf(payload, expectedAccount) {
  const user = identity_();
  if (user.sub !== expectedAccount) throw new Error('A conta Google mudou. Exporte novamente.');
  const html = reportPdfHtml_(payload,load_(user).state.preferences?.userName || user.name);
  const pdf = Utilities.newBlob(html,'text/html','relatorio.html').getAs('application/pdf');
  const suffix = payload.expenseSource ? '-' + payload.expenseSource.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').slice(0,60) : payload.expensesOnly ? '-despesas' : '';
  const name = 'relatorio-' + payload.start + '-' + payload.end + suffix + '.pdf';
  return {name:name,base64:Utilities.base64Encode(pdf.getBytes())};
}
function reportPdfHtml_(p, name) {
  function validDate(v) { return typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v+'T12:00:00Z').getTime()) && new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v; }
  if (!p || !validDate(p.start) || !validDate(p.end) || p.start>p.end || !Array.isArray(p.rows) || p.rows.length>10000) throw new Error('Período inválido ou relatório muito grande. Exporte um período menor.');
  if (p.expenseSource != null && (typeof p.expenseSource!=='string' || p.expenseSource.length>120)) throw new Error('Fonte de despesa inválida.');
  function esc(v) { return String(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function date(v) { return v.slice(8,10)+'/'+v.slice(5,7)+'/'+v.slice(0,4); }
  function cash(v) { return 'R$ '+(v/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  const scope=p.expenseSource?'Despesas · '+p.expenseSource:p.expensesOnly?'Todas as despesas':'Receitas e despesas';
  let income=0,expense=0;const groups=Object.create(null);
  p.rows.forEach(function(row){
    if (!row || !validDate(row.date) || row.date<p.start || row.date>p.end || ['income','expense'].indexOf(row.kind)<0 || !Number.isSafeInteger(row.cents) || row.cents<=0 || row.cents>100000000000) throw new Error('Lançamento inválido para exportação.');
    if ((p.expensesOnly || p.expenseSource) && row.kind!=='expense' || p.expenseSource && row.source!==p.expenseSource) throw new Error('Lançamento fora do filtro selecionado.');
    ['description','category','source','account','frequency'].forEach(function(k){if(typeof row[k]!=='string'||row[k].length>1000)throw new Error('Descrição inválida para exportação.');});
    if(row.kind==='income')income+=row.cents;else {expense+=row.cents;groups[row.source]=(groups[row.source]||0)+row.cents;}
  });
  if(!Number.isSafeInteger(income)||!Number.isSafeInteger(expense))throw new Error('Total excede o limite do relatório.');
  const details=p.rows.slice().sort(function(a,b){return a.date.localeCompare(b.date)}).map(function(row){
    const isIncome=row.kind==='income';
    return '<tr><td class="date">'+date(row.date)+'</td><td><strong>'+esc(row.description)+'</strong><div class="muted">'+esc(row.category)+' · '+esc(row.frequency)+'</div></td><td><span class="type">'+(isIncome?'Receita':'Despesa')+'</span><div>'+esc(row.source)+'</div>'+(isIncome&&row.account?'<div class="muted">Recebimento: '+esc(row.account)+'</div>':'')+'</td><td class="amount '+(isIncome?'income':'')+'">'+(isIncome?'+ ':'− ')+cash(row.cents)+'</td></tr>';
  }).join('');
  const summary=Object.keys(groups).sort(function(a,b){return groups[b]-groups[a]}).map(function(key){return '<tr><td>'+esc(key)+'</td><td class="amount">'+cash(groups[key])+'</td></tr>'}).join('');
  return '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><style>'+ 
    '@page{size:A4;margin:18mm 15mm}body{font-family:Arial,sans-serif;color:#243344;font-size:10px;line-height:1.5}h1{font-size:26px;margin:0 0 5px;color:#142a3a}h2{font-size:14px;margin:26px 0 10px}p{margin:4px 0}.eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#627783}.header{border-bottom:3px solid #197d78;padding-bottom:18px}.muted{color:#6d7983;font-size:9px}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}tr{page-break-inside:avoid}th{text-align:left;color:#5b6d78;text-transform:uppercase;font-size:8px;letter-spacing:1px;padding:10px 7px;border-bottom:2px solid #cad8de}td{padding:10px 7px;border-bottom:1px solid #e4ebee;vertical-align:top;word-wrap:break-word}tbody tr:nth-child(even){background:#f6f9fa}.amount{text-align:right;white-space:nowrap;font-weight:bold}.income{color:#12716a}.date{white-space:nowrap}.type{font-size:8px;text-transform:uppercase;letter-spacing:1px}.totals{margin-top:20px;background:#edf5f5}.totals td{width:33%;padding:14px 12px;border:0}.totals b{display:block;font-size:19px;margin-top:5px}.foot{margin-top:22px;border-top:1px solid #dce5e9;padding-top:10px;font-size:8px;color:#6d7983}' +
    '</style></head><body><div class="header"><div class="eyebrow">Relatório financeiro</div><h1>'+esc(name)+'</h1><p>'+date(p.start)+' a '+date(p.end)+'</p><p>'+esc(scope)+'</p></div><table class="totals"><tr>'+(!(p.expensesOnly||p.expenseSource)?'<td>Receitas<b class="income">'+cash(income)+'</b></td>':'')+'<td>Despesas<b>'+cash(expense)+'</b></td>'+(!(p.expensesOnly||p.expenseSource)?'<td>Saldo previsto<b>'+cash(income-expense)+'</b></td>':'')+'</tr></table>'+
    '<h2>Lançamentos do período</h2><table><thead><tr><th style="width:15%">Data</th><th style="width:35%">Descrição / categoria</th><th style="width:28%">Origem / conta ou cartão</th><th style="width:22%;text-align:right">Valor</th></tr></thead><tbody>'+(details||'<tr><td colspan="4">Nenhum lançamento neste período.</td></tr>')+'</tbody></table>'+
    (summary?'<h2>Despesas por conta ou cartão</h2><table><tbody>'+summary+'</tbody></table>':'')+
    '<div class="foot">'+p.rows.length+' lançamento(s). Valores previstos, incluindo recorrências e parcelas; não conciliados. Relatório de controle pessoal.</div></body></html>';
}

function validPreferences_(value) {
  if(value==null)return {color:'#287560',userName:'',appTitle:''};
  if(typeof value!=='object'||Array.isArray(value))throw new Error('Personalização inválida.');
  const result={color:value.color??'#287560',userName:value.userName??'',appTitle:value.appTitle??'',reminderEnabled:value.reminderEnabled??true,reminderDays:value.reminderDays??3};
  if(typeof result.color!=='string'||!/^#[0-9a-f]{6}$/i.test(result.color))throw new Error('Cor inválida.');
  ['userName','appTitle'].forEach(function(key){if(typeof result[key]!=='string'||result[key].trim().length>80)throw new Error('Use até 80 caracteres no nome e título.');result[key]=result[key].trim();});
  if(typeof result.reminderEnabled!=='boolean'||![0,1,3,7].includes(result.reminderDays))throw new Error('Configuração de avisos inválida.');
  return result;
}

function validReminders_(value){
 if(value==null)return {dismissed:[]};
 if(typeof value!=='object'||!Array.isArray(value.dismissed)||value.dismissed.length>1000)throw new Error('Avisos inválidos.');
 value.dismissed.forEach(function(key){if(typeof key!=='string'||key.length>500)throw new Error('Aviso inválido.');const parts=JSON.parse(key);if(!Array.isArray(parts)||parts.length!==2||typeof parts[0]!=='string'||!parts[0]||typeof parts[1]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(parts[1]))throw new Error('Aviso inválido.');});
 return {dismissed:Array.from(new Set(value.dismissed))};
}
