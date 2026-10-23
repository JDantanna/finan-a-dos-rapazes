'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID,createHash}=require('node:crypto');
const {validate}=require('../generated/shared.cjs');
const INTERVAL=5*60*1000;
class CacheFile{
 constructor(directory,account,safe){this.safe=safe;this.file=path.join(directory,'finance-cache',createHash('sha256').update(account).digest('hex')+'.enc');}
 async atomic(file,bytes){await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.tmp';await fs.writeFile(temp,bytes,{mode:0o600,flush:true});await fs.rename(temp,file);}
 async read(check){let damaged=false;for(const file of [this.file,this.file+'.previous']){try{const {result}=await this.safe.decryptStringAsync(await fs.readFile(file));const recovered=damaged||file!==this.file;this.recovered=recovered;return{value:check(JSON.parse(result)),recovered};}catch(e){if(e.code!=='ENOENT')damaged=true;}}if(damaged)throw Error('Não foi possível recuperar a cópia local. Os arquivos foram preservados.');return null;}
 async write(value){
  if(!await this.safe.isAsyncEncryptionAvailable())throw Error('A proteção de dados locais do Windows não está disponível.');
  const encrypted=await this.safe.encryptStringAsync(JSON.stringify(value));
  try{if(!this.recovered)await this.atomic(this.file+'.previous',await fs.readFile(this.file));}catch(e){if(e.code!=='ENOENT')throw e;}
  await this.atomic(this.file,encrypted);this.recovered=false;
 }
 async archive(value){const encrypted=await this.safe.encryptStringAsync(JSON.stringify(value));await this.atomic(this.file+'.recovery-'+Date.now()+'-'+randomUUID(),encrypted);}
}
class LocalFinance{
 constructor({cloud,storage,account,setIntervalImpl=setInterval,clearIntervalImpl=clearInterval}){Object.assign(this,{cloud,storage,account,setIntervalImpl,clearIntervalImpl});this.queue=Promise.resolve();this.envelope=null;this.localWrites=0;this.syncTask=null;this.message='Dados salvos neste computador.';this.stopped=false;}
 check(e){if(!e||e.schema!==1||e.account!==this.account||e.record?.profile?.sub!==this.account||typeof e.cloudRevision!=='string'||typeof e.record.revision!=='string'||typeof e.dirty!=='boolean')throw Error('Cópia local incompatível com esta conta.');e.record.state=validate(e.record.state);if(e.inflight){if(typeof e.inflight.base!=='string'||typeof e.inflight.id!=='string'||typeof e.inflight.revision!=='string')throw Error('Sincronização local inválida.');e.inflight.state=validate(e.inflight.state);}return e;}
 async commit(next){await this.storage.write(next);this.envelope=next;}
 serialize(fn){const work=this.queue.then(fn);this.queue=work.catch(()=>{});return work;}
 async open(){
  const cached=await this.storage.read(e=>this.check(e));
  if(cached){this.envelope=cached.value;if(cached.recovered){this.envelope.conflict=true;this.message='Cópia local anterior recuperada. Confira os dados e escolha como sincronizar.';}else this.message=this.envelope.dirty?'Salvo no computador · envio ao Drive pendente.':'Cópia local carregada.';}
  else {const record=await this.cloud.loadFinance();if(record.profile.sub!==this.account)throw Error('A conta Google mudou.');await this.commit({schema:1,account:this.account,record:{...record,revision:randomUUID()},cloudRevision:record.revision,dirty:false,inflight:null,conflict:false,lastSync:new Date().toISOString()});}
  return this.loadFinance();
 }
 guard(account){if(!this.envelope||account!==this.account)throw Error('A conta mudou. Reabra o aplicativo.');}
 status(){const e=this.envelope;return{dirty:!!e?.dirty,busy:!!this.syncTask,conflict:!!e?.conflict,revision:e?.record.revision,lastSync:e?.lastSync,message:this.message,interval:INTERVAL};}
 async loadFinance(){await this.queue;this.guard(this.account);return structuredClone({...this.envelope.record,localSync:this.status()});}
 async saveFinance(state,revision,operationId,account){
  this.guard(account);if(typeof operationId!=='string'||!/^[-\w]{8,200}$/.test(operationId))throw Error('Operação inválida.');state=validate(state);this.localWrites++;
  try{return await this.serialize(async()=>{const e=this.envelope;if(e.lastLocalOperation===operationId)return structuredClone({...e.record,localSync:this.status()});if(e.record.revision!==revision)throw Error('Os dados locais mudaram. Recarregue antes de salvar.');const next=structuredClone(e);next.record.state=state;next.record.revision=randomUUID();next.dirty=true;next.lastLocalOperation=operationId;next.localSavedAt=new Date().toISOString();await this.commit(next);this.message=next.conflict?'Salvo no computador · conflito no Drive exige sua escolha.':'Salvo no computador · envio ao Drive pendente.';return structuredClone({...next.record,localSync:this.status()});});}finally{this.localWrites--;}
 }
 async prepare(){return this.serialize(async()=>{const e=this.envelope;if(e.conflict)throw Error('CONFLICT: há alterações diferentes no Drive e neste computador. Escolha qual versão usar.');if(!e.dirty)return{clean:true,revision:e.record.revision};if(!e.inflight){const next=structuredClone(e);next.inflight={id:randomUUID(),base:e.cloudRevision,revision:e.record.revision,state:structuredClone(e.record.state)};await this.commit(next);}return structuredClone(this.envelope.inflight);});}
 synchronize(){
  if(this.syncTask)return this.syncTask;if(this.stopped)return Promise.reject(Error('A sincronização está encerrada.'));
  this.syncTask=this.performSync().finally(()=>{this.syncTask=null;});return this.syncTask;
 }
 async performSync(){
  this.message='Sincronizando com o Google Drive…';
  try{for(let pass=0;pass<2;pass++){
   const pending=await this.prepare();const remote=await this.cloud.loadFinance();this.guard(remote.profile.sub);
   if(pending.clean){await this.serialize(async()=>{const e=this.envelope;if(e.dirty||e.record.revision!==pending.revision)return;const next=structuredClone(e);if(remote.revision!==e.cloudRevision||JSON.stringify(remote.profile)!==JSON.stringify(e.record.profile)){next.record={...remote,revision:randomUUID()};next.cloudRevision=remote.revision;}next.lastSync=new Date().toISOString();await this.commit(next);});break;}
   let saved=remote;
   if(remote.operationId!==pending.id){
    if(remote.revision!==pending.base)throw Error('CONFLICT: os dados também foram alterados em outro dispositivo.');
    saved=await this.cloud.saveFinance(pending.state,pending.base,pending.id,this.account);
   }
   await this.serialize(async()=>{const next=structuredClone(this.envelope);if(next.inflight?.id!==pending.id)throw Error('Sincronização local mudou.');next.cloudRevision=saved.revision;next.record.folderId=saved.folderId;next.record.fileId=saved.fileId;next.record.lastBackup=saved.lastBackup;next.lastSync=new Date().toISOString();next.dirty=next.record.revision!==pending.revision;next.inflight=null;next.conflict=false;await this.commit(next);});
   if(!this.envelope.dirty)break;
  }this.message=this.envelope.dirty?'Salvo no computador · novas alterações aguardam o próximo envio.':'Computador e Google Drive sincronizados.';return this.status();
  }catch(error){await this.serialize(async()=>{if(error.message.includes('CONFLICT')&&!this.envelope.conflict){const next=structuredClone(this.envelope);next.conflict=true;await this.commit(next);}this.message=this.envelope.conflict?'Conflito no Drive · seus dados locais foram preservados.':'Dados locais preservados · não foi possível sincronizar. '+error.message;});throw error;}
 }
 start(){if(this.timer)return;this.stopped=false;this.timer=this.setIntervalImpl(()=>{this.synchronize().catch(()=>{});},INTERVAL);this.timer?.unref?.();}
 stop(){this.stopped=true;if(this.timer)this.clearIntervalImpl(this.timer);this.timer=null;}
 async flushLocal(){await this.queue;}
 async resolveConflict(choice){
  if(this.syncTask)throw Error('Aguarde a sincronização atual.');if(!['local','cloud'].includes(choice))throw Error('Escolha inválida.');
  // Block concurrent sync while reading the explicit resolution snapshot.
  this.syncTask=(async()=>{const remote=await this.cloud.loadFinance();this.guard(remote.profile.sub);await this.serialize(async()=>{const old=this.envelope;await this.storage.archive(old);const next=structuredClone(old);if(choice==='cloud'){next.record={...remote,revision:randomUUID()};next.dirty=false;}next.cloudRevision=remote.revision;next.inflight=null;next.conflict=false;await this.commit(next);this.message=choice==='cloud'?'Dados do Drive carregados. A cópia local anterior foi preservada.':'Cópia local preservada; preparando envio confirmado.';});})().finally(()=>{this.syncTask=null;});await this.syncTask;if(choice==='local')await this.synchronize();return this.loadFinance();
 }
 async listFinanceBackups(account){this.guard(account);await this.cloud.loadFinance();return this.cloud.listFinanceBackups(account);}
 async restoreFinanceBackup(id,revision,operationId,account){this.guard(account);await this.cloud.loadFinance();const state=await this.cloud.readBackup(id,account);return this.saveFinance(state,revision,operationId,account);}
}
module.exports={LocalFinance,CacheFile,INTERVAL};
