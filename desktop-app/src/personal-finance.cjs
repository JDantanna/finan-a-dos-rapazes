'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {LocalFinance,CacheFile}=require('./local-cache.cjs');
const {validate}=require('../generated/shared.cjs');
const EMPTY={entries:[],goals:[],accounts:[],incomeSources:[]};
const FILE=/^financas-\d{8}T\d{9}Z-[-\w]{8,200}\.json$/;
async function readJson(file){const stat=await fs.stat(file);if(!stat.isFile()||stat.size>4_100_000)throw Error('Cópia inválida ou maior que 4 MB.');const bytes=await fs.readFile(file);if(bytes.length>4_100_000)throw Error('Cópia maior que 4 MB.');return JSON.parse(bytes.toString('utf8'));}
function settingsStore(directory,safe){return new CacheFile(directory,'personal-profile-settings-v1',safe);}
function checkSettings(value){if(value?.schema!==1||typeof value.id!=='string'||!/^local-[-\w]{8,100}$/.test(value.id)||typeof value.name!=='string'||!value.name.trim()||value.name.length>80||(value.folder!==null&&(typeof value.folder!=='string'||!path.isAbsolute(value.folder))))throw Error('Perfil local inválido. Os arquivos foram preservados.');return value;}
class FolderBackups{
 constructor(settings){this.settings=settings;this.record={profile:{sub:settings.id,name:settings.name,email:'',picture:''},revision:'local-start',state:validate(EMPTY)};}
 async loadFinance(){return structuredClone(this.record);}
 async saveFinance(state,revision,operationId,account){
  if(account!==this.settings.id)throw Error('O perfil mudou.');if(!this.settings.folder)throw Error('Escolha uma pasta para guardar cópias.');
  state=validate(state);const dir=path.join(this.settings.folder,'Financa-dos-Rapazes');await fs.mkdir(dir,{recursive:true});
  // Unique immutable files avoid overwriting changes synchronized by another computer.
  const stamp=new Date().toISOString().replace(/[-:.]/g,''),name='financas-'+stamp+'-'+operationId+'.json';
  const matches=(await fs.readdir(dir)).filter(n=>FILE.test(n)&&n.endsWith('-'+operationId+'.json'));
  let copy;
  if(matches.length){copy=await readJson(path.join(dir,matches[0]));if(copy.schema!==1||copy.profileId!==account||copy.operationId!==operationId||copy.revision!==operationId||!Number.isFinite(Date.parse(copy.savedAt)))throw Error('Cópia incompatível.');validate(copy.state);}
  else{copy={schema:1,profileId:account,operationId,revision:operationId,savedAt:new Date().toISOString(),state};const temp=path.join(dir,'.pending-'+randomUUID());try{await fs.writeFile(temp,JSON.stringify(copy),{mode:0o600,flush:true,flag:'wx'});await fs.rename(temp,path.join(dir,name));}finally{await fs.rm(temp,{force:true});}}
  this.record={profile:this.record.profile,revision:copy.revision,lastBackup:copy.savedAt,state:copy.state};return structuredClone(this.record);
 }
 async listFinanceBackups(account){if(account!==this.settings.id)throw Error('O perfil mudou.');if(!this.settings.folder)return[];try{return (await fs.readdir(path.join(this.settings.folder,'Financa-dos-Rapazes'))).filter(n=>FILE.test(n)).sort().reverse().slice(0,100).map(name=>({id:name,name,createdTime:name.slice(9,13)+'-'+name.slice(13,15)+'-'+name.slice(15,17)+'T'+name.slice(18,20)+':'+name.slice(20,22)+':'+name.slice(22,24)+'.'+name.slice(24,27)+'Z'}));}catch(e){if(e.code==='ENOENT')return[];throw e;}}
 async readBackup(id,account){if(account!==this.settings.id||!this.settings.folder||typeof id!=='string'||!FILE.test(id))throw Error('Cópia inválida.');const value=await readJson(path.join(this.settings.folder,'Financa-dos-Rapazes',id));if(value.schema!==1||typeof value.savedAt!=='string')throw Error('Formato de cópia inválido.');return validate(value.state);}
}
class PersonalFinance extends LocalFinance{
 status(){const status=super.status(),settings=this.cloud.settings;return {...status,localMode:true,folder:settings.folder,folderConnected:!!settings.folder,message:status.conflict?'Uma cópia local anterior foi recuperada. Confira os dados e confirme a recuperação.':!settings.folder?'Dados salvos neste computador. Cópia em pasta opcional.':status.busy?'Gravando cópia na pasta selecionada…':status.dirty?'Salvo no computador · cópia na pasta pendente.':'Cópia gravada na pasta. O envio à nuvem é feito pelo Drive para computador.'};}
 synchronize(){if(!this.cloud.settings.folder)return Promise.resolve(this.status());return super.synchronize();}
 async chooseFolder(folder){if(this.syncTask||this.localWrites)throw Error('Aguarde a gravação terminar.');const settings={...this.cloud.settings,folder};await this.serialize(async()=>{const next=structuredClone(this.envelope);next.dirty=true;next.inflight=null;await this.commit(next);});await this.settingsFile.write(settings);this.cloud.settings=settings;return this.status();}
}
async function openPersonal(directory,safe,{name,initialState}={}){
 const settingsFile=settingsStore(directory,safe),saved=await settingsFile.read(checkSettings);let settings=saved?.value;
 if(!settings){if(typeof name!=='string'||!name.trim()||name.trim().length>80)throw Error('Informe seu nome, com até 80 caracteres.');settings={schema:1,id:'local-'+randomUUID(),name:name.trim(),folder:null};await settingsFile.write(settings);}
 const cloud=new FolderBackups(settings),local=new PersonalFinance({cloud,storage:new CacheFile(directory,settings.id,safe),account:settings.id});local.settingsFile=settingsFile;await local.open();cloud.record={...structuredClone(local.envelope.record),revision:local.envelope.cloudRevision};
 if(initialState){const record=await local.loadFinance();if(local.envelope.lastLocalOperation||record.state.entries.length||record.state.goals.length)throw Error('O perfil local já contém dados. Use a restauração JSON para escolher os dados a importar.');await local.saveFinance(initialState,record.revision,randomUUID(),settings.id);}
 return local;
}
async function hasPersonal(directory,safe){return !!await settingsStore(directory,safe).read(checkSettings);}
module.exports={openPersonal,hasPersonal,FolderBackups,PersonalFinance,FILE};
