'use strict';
// Profile metadata is local convenience, not authentication. Tokens never enter this store.
const FinanceProfiles = (() => {
 const legacyKey='financa-dos-rapazes:test:v1', prefix='financa-dos-rapazes:profiles:v2';
 const empty=()=>({entries:[],goals:[],accounts:[],incomeSources:[],demo:false});
 class Store {
  constructor(storage,uuid){this.storage=storage;this.uuid=uuid;this.active='';this.epoch=0;this.metadataError=false;}
  list(){const raw=this.storage.getItem(prefix+':index');if(!raw){this.metadataError=false;return[];}try{const list=JSON.parse(raw);if(!Array.isArray(list)||list.some(p=>!p||typeof p.sub!=='string'||!/^[-\w]{1,128}$/.test(p.sub)||typeof p.name!=='string'||typeof p.email!=='string'))throw Error();this.metadataError=false;return list;}catch{this.metadataError=true;return[];}}
  current(){return this.list().find(p=>p.sub===this.active)||null;}
  add(user){if(!user||typeof user.sub!=='string'||!/^[-\w]{1,128}$/.test(user.sub)||typeof user.email!=='string'||!user.email||user.email_verified!==true)throw Error('A conta Google não pôde ser confirmada.');const profile={sub:user.sub,name:String(user.name||user.email).slice(0,200),email:user.email.slice(0,254)};const list=this.list().filter(p=>p.sub!==user.sub);if(this.metadataError)throw Error('O cadastro local de perfis está inválido. Os arquivos existentes foram preservados.');list.push(profile);this.storage.setItem(prefix+':index',JSON.stringify(list));return profile;}
  select(sub){if(sub&&!this.list().some(p=>p.sub===sub))throw Error('Perfil não encontrado.');this.active=sub;this.epoch++;if(sub&&!this.storage.getItem(this.key()))this.put({state:empty(),revision:this.uuid(),dirty:false,head:null,lastBackup:null});}
  key(){return this.active?prefix+':data:'+this.active:legacyKey;}
  checkpoint(){return{key:this.key(),active:this.active,epoch:this.epoch,raw:this.storage.getItem(this.key())};}
  matches(point){return this.active===point.active&&this.epoch===point.epoch&&this.key()===point.key&&this.storage.getItem(point.key)===point.raw;}
  record(){const raw=this.storage.getItem(this.key());if(raw!==null&&this.cachedKey===this.key()&&this.cachedRaw===raw)return this.cachedRecord;if(!raw)return{state:empty(),revision:this.uuid(),dirty:false,head:null,lastBackup:null};const parsed=JSON.parse(raw);if(!this.active)return{state:parsed,revision:this.uuid(),dirty:false,head:null,lastBackup:null};if(parsed.schema!==2||!parsed.state||typeof parsed.revision!=='string')throw Error('Dados do perfil inválidos. Exporte uma cópia antes de alterar este perfil.');this.cachedKey=this.key();this.cachedRaw=raw;this.cachedRecord=parsed;return parsed;}
  write(state){if(!this.active){this.storage.setItem(legacyKey,JSON.stringify(state));return}const old=this.record();this.put({...old,schema:2,state,revision:this.uuid(),dirty:true});}
  put(record){if(!this.active)throw Error('Selecione um perfil Google.');this.storage.setItem(this.key(),JSON.stringify({...record,schema:2}));}
  accept(snapshot,head,time){this.put({schema:2,state:snapshot.state,revision:snapshot.revision,dirty:false,head,lastBackup:time});}
  acknowledge(revision,head,time){const current=this.record();this.put({...current,head,lastBackup:time,dirty:current.revision!==revision});}
 }
 return{Store,empty,legacyKey};
})();
if(typeof module!=='undefined')module.exports=FinanceProfiles;
