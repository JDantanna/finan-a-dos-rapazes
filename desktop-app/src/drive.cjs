'use strict';
const {randomUUID}=require('node:crypto');
const {readResponse}=require('./oauth.cjs');
const {validate}=require('../generated/shared.cjs');
const API='https://www.googleapis.com/drive/v3/files';
// v3 media downloads do not guarantee an ETag header. v2 exposes the file
// ETag in metadata and accepts it on its conditional content update endpoint.
const VERSION_API='https://www.googleapis.com/drive/v2/files';
const MARKER='financa-dos-rapazes-desktop-v1';
const EMPTY={entries:[],goals:[],accounts:[],incomeSources:[],demo:false};
class FinanceDrive{
 constructor(auth){this.auth=auth;this.user=null;this.folder=null;this.file=null;this.busy=false;}
 guard(account){if(!this.user||this.user.sub!==account)throw Error('A conta mudou. Reinicie o aplicativo.');}
 async list(query,extra={}){return (await readResponse(await this.auth.request(API+'?'+new URLSearchParams({q:query,fields:'files(id,name,createdTime,parents,ownedByMe,appProperties)',pageSize:'100',...extra})))).files||[];}
 async create(meta,value){
  let body,headers;
  if(value===undefined){body=JSON.stringify(meta);headers={'Content-Type':'application/json'};}
  else {const boundary='finance-'+randomUUID();body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(meta)+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+JSON.stringify(value)+'\r\n--'+boundary+'--';headers={'Content-Type':'multipart/related; boundary='+boundary};}
  return readResponse(await this.auth.request(value===undefined?API:API.replace('/drive/','/upload/drive/')+'?uploadType=multipart',{method:'POST',headers,body}));
 }
 async locate(){
  const folders=await this.list("trashed=false and 'me' in owners and mimeType='application/vnd.google-apps.folder' and appProperties has {key='app' and value='"+MARKER+"'}");
  if(folders.length>1)throw Error('Existem duas pastas do aplicativo. Nenhum dado foi substituído.');
  this.folder=folders[0]||await this.create({name:'Finança dos Rapazes — Desktop',mimeType:'application/vnd.google-apps.folder',appProperties:{app:MARKER}});
  const files=await this.list("trashed=false and 'me' in owners and '"+this.folder.id+"' in parents and name='financas.json'");
  if(files.length>1)throw Error('Existem dois arquivos financeiros. Nenhum dado foi substituído.');
  this.file=files[0]||await this.create({name:'financas.json',parents:[this.folder.id],appProperties:{kind:'current'}},this.record(EMPTY));
 }
 record(state,operationId){return {schema:3,owner:this.user.email,revision:randomUUID(),operationId,savedAt:new Date().toISOString(),state:validate(state)};}
 async read(){
  const version=async()=>{const meta=await readResponse(await this.auth.request(VERSION_API+'/'+this.file.id+'?fields=etag&updateViewedDate=false'));if(typeof meta.etag!=='string'||!meta.etag)throw Error('O Drive não retornou a versão do arquivo. Salvamento interrompido para preservar os dados.');return meta.etag;};
  const etag=await version();
  const response=await this.auth.request(API+'/'+this.file.id+'?alt=media');
  const record=await readResponse(response);
  if(await version()!==etag)throw Error('CONFLICT: o arquivo mudou durante a leitura. Recarregue do Drive e tente novamente.');
  if(record.schema!==3||record.owner!==this.user.email||typeof record.revision!=='string')throw Error('Este arquivo não pertence à conta atual ou é incompatível.');
  record.state=validate(record.state);return {record,etag};
 }
 response(record){return {profile:this.user,folderId:this.folder.id,fileId:this.file.id,revision:record.revision,lastBackup:record.savedAt,operationId:record.operationId,state:record.state};}
 async loadFinance(){if(!this.user)this.user=await this.auth.profile();if(!this.file)await this.locate();return this.response((await this.read()).record);}
 async saveFinance(state,revision,operationId,account){
  this.guard(account);if(this.busy)throw Error('Aguarde o salvamento atual.');if(typeof operationId!=='string'||!/^[-\w]{8,200}$/.test(operationId))throw Error('Operação inválida.');
  this.busy=true;try{
   state=validate(state);const {record,etag}=await this.read();
   if(record.operationId===operationId)return this.response(record);
   if(record.revision!==revision)throw Error('CONFLICT: dados alterados em outro dispositivo. Exporte uma cópia e recarregue do Drive.');
   await this.create({name:'backup-'+record.revision+'.json',parents:[this.folder.id],appProperties:{kind:'backup'}},record);
   const next=this.record(state,operationId);
   await readResponse(await this.auth.request(VERSION_API.replace('/drive/','/upload/drive/')+'/'+this.file.id+'?uploadType=media',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':etag},body:JSON.stringify(next)}));
   return this.response(next);
  }finally{this.busy=false;}
 }
 async listFinanceBackups(account){this.guard(account);return this.list("trashed=false and 'me' in owners and '"+this.folder.id+"' in parents and appProperties has {key='kind' and value='backup'}",{pageSize:'20',orderBy:'createdTime desc'});}
 async readBackup(id,account){
  this.guard(account);if(typeof id!=='string'||!/^[-\w]+$/.test(id))throw Error('Cópia inválida.');
  const meta=await readResponse(await this.auth.request(API+'/'+id+'?fields=parents,ownedByMe,trashed,appProperties'));
  if(meta.trashed||!meta.ownedByMe||!meta.parents?.includes(this.folder.id)||meta.appProperties?.kind!=='backup')throw Error('Esta cópia não pertence à sua pasta.');
  const copy=await readResponse(await this.auth.request(API+'/'+id+'?alt=media'));
  if(copy.schema!==3||copy.owner!==this.user.email)throw Error('Cópia de outra conta ou incompatível.');
  return validate(copy.state);
 }
 async restoreFinanceBackup(id,revision,operationId,account){return this.saveFinance(await this.readBackup(id,account),revision,operationId,account);}
}
module.exports={FinanceDrive};
