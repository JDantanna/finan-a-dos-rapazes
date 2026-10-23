'use strict';
const http=require('node:http');
const crypto=require('node:crypto');
const fs=require('node:fs/promises');
const path=require('node:path');
const SCOPES=['openid','email','profile','https://www.googleapis.com/auth/drive.file'];
const TIMEOUT=25_000;
function validateClient(raw){
 const value=raw?.installed;
 if(!value||typeof value.client_id!=='string'||!value.client_id.endsWith('.apps.googleusercontent.com')||value.client_id.length>250||typeof value.client_secret!=='string'||value.client_secret.length>250)throw Error('Use o JSON de um cliente OAuth do tipo App para computador.');
 return {client_id:value.client_id,client_secret:value.client_secret};
}
class Vault{
 constructor(directory,safeStorage){this.file=path.join(directory,'google-session.enc');this.safe=safeStorage;}
 async read(){try{const decrypted=await this.safe.decryptStringAsync(await fs.readFile(this.file));const value=JSON.parse(decrypted.result);if(decrypted.shouldReEncrypt)await this.write(value);return value;}catch(e){if(e.code==='ENOENT')return {};throw Error('Não foi possível abrir as credenciais locais. Use Sair e conecte novamente.');}}
 async write(value){if(!await this.safe.isAsyncEncryptionAvailable())throw Error('A proteção de credenciais do sistema não está disponível.');await fs.mkdir(path.dirname(this.file),{recursive:true});const temp=this.file+'.tmp';await fs.writeFile(temp,await this.safe.encryptStringAsync(JSON.stringify(value)),{mode:0o600});await fs.rename(temp,this.file);}
 async clear(){await fs.rm(this.file,{force:true});}
}
async function readResponse(response){
 if(!response.ok){if(response.status===412)throw Error('CONFLICT: outro dispositivo alterou os dados. Recarregue do Drive antes de salvar.');if(response.status===401)throw Error('Sua autorização Google expirou. Saia e conecte novamente.');throw Error('Não foi possível acessar o Google (HTTP '+response.status+'). Nenhum salvamento foi confirmado.');}
 const reader=response.body?.getReader();if(!reader)return {};const chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4_100_000){await reader.cancel();throw Error('Resposta excede o limite de tamanho.');}chunks.push(value);}}finally{reader.releaseLock();}
 const text=Buffer.concat(chunks).toString('utf8');return text?JSON.parse(text):{};
}
class GoogleAuth{
 constructor({vault,client,openExternal,fetchImpl=fetch}){Object.assign(this,{vault,client,openExternal,fetchImpl});this.session=null;this.pending=null;}
 async tokenRequest(fields){return readResponse(await this.fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...this.client,...fields}),signal:AbortSignal.timeout(TIMEOUT)}));}
 async accessToken(){
  if(this.session?.access_token&&this.session.expires_at>Date.now()+60_000)return this.session.access_token;
  if(this.pending)return this.pending;
  this.pending=(async()=>{const saved=await this.vault.read();if(!saved.refresh_token)throw Error('Conecte sua conta Google para continuar.');const result=await this.tokenRequest({grant_type:'refresh_token',refresh_token:saved.refresh_token});this.session={access_token:result.access_token,expires_at:Date.now()+result.expires_in*1000};return this.session.access_token;})();
  try{return await this.pending}finally{this.pending=null;}
 }
 async request(url,options={}){
  const parsed=new URL(url);if(parsed.protocol!=='https:'||!['www.googleapis.com','openidconnect.googleapis.com'].includes(parsed.hostname))throw Error('Destino Google inválido.');
  const token=await this.accessToken();return this.fetchImpl(url,{...options,headers:{...options.headers,Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(TIMEOUT)});
 }
 async profile(){const p=await readResponse(await this.request('https://openidconnect.googleapis.com/v1/userinfo'));if(!p.sub||!p.email||!p.email_verified)throw Error('A conta Google precisa ter um e-mail confirmado.');return{sub:p.sub,email:p.email.toLowerCase(),name:p.name||p.email,picture:p.picture||''};}
 async login(){
  const verifier=crypto.randomBytes(48).toString('base64url'),state=crypto.randomBytes(32).toString('base64url');
  const challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
  const server=http.createServer({requestTimeout:10_000,headersTimeout:10_000,maxHeaderSize:8192});let timer;
  try{
   await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
   const redirect='http://127.0.0.1:'+server.address().port+'/oauth/callback';
   const codePromise=new Promise((resolve,reject)=>{
    timer=setTimeout(()=>reject(Error('A autorização expirou. Clique em conectar para tentar novamente.')),180_000);
    server.on('request',(req,res)=>{
     let url;try{url=new URL(req.url,redirect)}catch{res.writeHead(400);res.end('Solicitacao invalida.');return;}
     if(req.method!=='GET'||url.pathname!=='/oauth/callback'||url.searchParams.get('state')!==state){res.writeHead(400);res.end('Solicitacao invalida.');return;}
     res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'"});res.end('Você pode fechar esta aba e voltar ao aplicativo.');
     if(url.searchParams.has('error'))reject(Error('A autorização não foi concedida. Seus dados não foram alterados.'));
     else if(!url.searchParams.get('code'))reject(Error('Resposta de autorização inválida.'));
     else resolve(url.searchParams.get('code'));
    });
   });
   // Attach rejection handling before opening the browser, including open failures.
   const authorize=new URL('https://accounts.google.com/o/oauth2/v2/auth');
   authorize.search=new URLSearchParams({client_id:this.client.client_id,redirect_uri:redirect,response_type:'code',scope:SCOPES.join(' '),state,code_challenge:challenge,code_challenge_method:'S256',access_type:'offline',prompt:'consent select_account'}).toString();
   const [code]=await Promise.all([codePromise,this.openExternal(authorize.toString())]);
   const tokens=await this.tokenRequest({grant_type:'authorization_code',code,redirect_uri:redirect,code_verifier:verifier});
   if(!tokens.refresh_token||!tokens.access_token)throw Error('O Google não retornou autorização persistente. Tente conectar novamente.');
   if(!tokens.scope?.split(' ').includes(SCOPES[3]))throw Error('Autorize o acesso aos arquivos do aplicativo no Google Drive.');
   this.session={access_token:tokens.access_token,expires_at:Date.now()+tokens.expires_in*1000};
   const profile=await this.profile();
   await this.vault.write({refresh_token:tokens.refresh_token,sub:profile.sub});
   return profile;
  }finally{clearTimeout(timer);server.closeAllConnections();server.close();}
 }
 async logout(){this.session=null;await this.vault.clear();}
}
module.exports={GoogleAuth,Vault,validateClient,readResponse};
