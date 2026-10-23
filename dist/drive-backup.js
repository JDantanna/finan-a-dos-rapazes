'use strict';
const FinanceDrive = (() => {
 const name='financa-dos-rapazes-v2.json', api='https://www.googleapis.com/drive/v3/files';
 class Conflict extends Error{constructor(){super('Existe uma cópia diferente no Drive. Escolha qual versão deseja usar em Perfis.');this.name='DriveConflict';}}
 class Client {
  constructor({fetch,token,sub,validate,uuid,now=()=>new Date().toISOString()}){Object.assign(this,{fetch,token,sub,validate,uuid,now});}
  async request(url,init={}){const token=this.token();if(!token)throw Error('Reconecte a conta Google para salvar no Drive.');const response=await this.fetch(url,{...init,headers:{...init.headers,Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});if(!response.ok){if(response.status===401){const error=Error('A sessão Google expirou. Reconecte para salvar no Drive.');error.name='GoogleSessionExpired';throw error;}if(response.status===403)throw Error('O Google Drive recusou o acesso. Confira as permissões e a configuração OAuth.');throw Error('Google Drive indisponível. Os dados continuam salvos neste navegador.')}return response;}
  async list(){const params=new URLSearchParams({spaces:'appDataFolder',q:`name = '${name}' and trashed = false`,orderBy:'createdTime desc',pageSize:'20',fields:'files(id,createdTime,appProperties)'});return(await(await this.request(api+'?'+params)).json()).files||[];}
  async read(id){if(!/^[\w-]+$/.test(id))throw Error('Cópia inválida.');const response=await this.request(api+'/'+encodeURIComponent(id)+'?alt=media');const text=await response.text();if(new TextEncoder().encode(text).length>4_000_000)throw Error('A cópia excede o limite de 4 MB.');const snapshot=JSON.parse(text);if(snapshot.schema!==2||snapshot.owner!==this.sub||typeof snapshot.revision!=='string')throw Error('A cópia não pertence a este perfil ou é incompatível.');snapshot.state=await this.validate(snapshot.state);return snapshot;}
  async upload(record){const snapshot={schema:2,owner:this.sub,revision:record.revision,savedAt:this.now(),state:record.state};const data=JSON.stringify(snapshot);if(new TextEncoder().encode(data).length>4_000_000)throw Error('A cópia excede o limite de 4 MB. Faça um backup manual.');const boundary='finance_'+this.uuid();const metadata={name,mimeType:'application/json',parents:['appDataFolder'],appProperties:{revision:record.revision,parent:record.head||''}};const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,JSON.stringify(metadata),`\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`,data,`\r\n--${boundary}--\r\n`]);const file=await(await this.request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,createdTime',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body})).json();if(!file.id)throw Error('O Google não confirmou o envio. Tente novamente.');return file;}
  async sync(store,{preferLocal=false}={}){
   const sub=store.active,epoch=store.epoch,record=store.record(),files=await this.list(),latest=files[0];const guard=()=>{if(store.active!==sub||store.epoch!==epoch)throw Error('O perfil mudou durante o salvamento.');};guard();
   if(latest?.appProperties?.revision===record.revision){store.acknowledge(record.revision,latest.id,latest.createdTime);return'uploaded';}
   if(latest&&latest.id!==record.head){
    const byId=new Map(files.map(file=>[file.id,file]));let ancestor=latest;const visited=new Set();while(ancestor&&!visited.has(ancestor.id)&&ancestor.id!==record.head){visited.add(ancestor.id);ancestor=byId.get(ancestor.appProperties?.parent)}const descendant=!!ancestor&&ancestor.id===record.head;
    if(!preferLocal&&(record.dirty||(record.head&&!descendant)))throw new Conflict();
    if(!preferLocal){const snapshot=await this.read(latest.id);guard();if(store.record().revision!==record.revision)throw new Conflict();store.accept(snapshot,latest.id,latest.createdTime);return'downloaded';}
   }
   if(latest&&!record.dirty&&!preferLocal)return'unchanged';
   if(store.record().revision!==record.revision)throw Error('Há alterações novas. Salve novamente no Drive.');
   const file=await this.upload({...record,head:latest?.id||null});guard();store.acknowledge(record.revision,file.id,file.createdTime||this.now());return'uploaded';
  }
 }
 return{Client,Conflict};
})();
if(typeof module!=='undefined')module.exports=FinanceDrive;
