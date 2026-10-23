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
  return {email:email, name:'Minha conta Google', sub:sub};
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
  const clean = {entries:state.entries,goals:state.goals,accounts:registry(state.accounts||[],true),incomeSources:registry(state.incomeSources||[],false),demo:!!state.demo};
  jsonBlob_(clean,'validation.json');return clean;
}
