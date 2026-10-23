'use strict';
const GoogleProfiles = (() => {
 const configKey='financa-dos-rapazes:google-client-id';
 const scopes=['openid','https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/userinfo.profile','https://www.googleapis.com/auth/drive.appdata'],scope=scopes.join(' ');
 const store=new FinanceProfiles.Store(localStorage,()=>newId());
 let credentials=null,client=null,busy=false,status='',timer=null,expiryTimer=null,queued=false,conflict=false,history=[];
 const notify=()=>document.dispatchEvent(new CustomEvent('finance:cloud-status'));
 const changed=()=>document.dispatchEvent(new CustomEvent('finance:profile-change'));
 const token=()=>credentials&&Date.now()<credentials.expiresAt?credentials.accessToken:null;
 function clientId(){return window.FINANCE_GOOGLE_CLIENT_ID||localStorage.getItem(configKey)||'';}
 function configure(id){if(busy)throw Error('Aguarde a operação Google terminar.');id=id.trim();if(!/^[\w-]+\.apps\.googleusercontent\.com$/.test(id))throw Error('Informe somente o Client ID OAuth do tipo Aplicativo da Web.');localStorage.setItem(configKey,id);leaveSession();status='Configuração salva. Agora conecte sua conta Google.';notify();}
 function stateInfo(){const p=store.current(),r=p?store.record():null;return{profile:p,profiles:store.list(),configured:!!clientId(),connected:!!token(),busy,status,conflict,history,dirty:!!r?.dirty,lastBackup:r?.lastBackup,head:r?.head,metadataError:store.metadataError};}
 function leaveSession(){clearTimeout(timer);clearTimeout(expiryTimer);queued=false;timer=null;credentials=null;client=null;conflict=false;history=[];}
 function select(sub){if(busy)throw Error('Aguarde a operação no Drive terminar.');leaveSession();store.select(sub);status=sub?'Perfil local aberto. Reconecte a conta Google para salvar no Drive.':'Perfil local aberto.';changed();notify();}
 function logout(){select('');}
 async function synchronize(options={}){
  if(busy){queued=true;return;}const profile=store.current();if(!profile)return;
  if(!client||!token()){status='Salvo neste navegador. Reconecte o Google para enviar ao Drive.';notify();return;}
  busy=true;status='Salvando no Google Drive…';notify();
  try{const result=await client.sync(store,options);conflict=false;status='Cópia confirmada no Google Drive.';if(result==='downloaded')changed();}
  catch(error){if(error.name==='GoogleSessionExpired')leaveSession();conflict=error.name==='DriveConflict';status=error.message;}
  finally{busy=false;notify();if(queued){queued=false;if(token()&&!conflict)schedule();}else if(store.current()&&store.record().dirty&&!conflict&&status==='Cópia confirmada no Google Drive.')schedule();}
 }
 function schedule(){if(!store.current())return;clearTimeout(timer);status='Salvo neste navegador · envio ao Drive pendente.';notify();timer=setTimeout(()=>synchronize(),1500);}
 async function validate(state){if(!state||!Array.isArray(state.entries)||!Array.isArray(state.goals))throw Error('Dados financeiros inválidos.');IncomeSources.validate(state.incomeSources??[]);if(typeof validateAccounts==='function')validateAccounts(state.accounts??[]);await rustReport(state,today(),today());return{entries:state.entries,goals:state.goals,accounts:state.accounts||[],incomeSources:state.incomeSources||[],demo:!!state.demo};}
 function connect(hintSub){
  if(busy)return;if(!clientId())throw Error('Configure o Client ID OAuth do Google antes de conectar.');
  if(!window.google?.accounts?.oauth2)throw Error('O serviço de login Google ainda não carregou. Verifique sua conexão e tente novamente.');
  busy=true;status='Aguardando a autorização do Google…';notify();
  const oauth=google.accounts.oauth2.initTokenClient({client_id:clientId(),scope,include_granted_scopes:false,
   error_callback:()=>{status='Login não concluído. Seus dados locais foram preservados.';finish();},
   callback:async response=>{
    try{
     if(response.error||!response.access_token||!Number.isFinite(Number(response.expires_in))||Number(response.expires_in)<=30)throw Error('O Google não autorizou a conexão.');
     if(!google.accounts.oauth2.hasGrantedAllScopes(response,...scopes))throw Error('Autorize o perfil Google e a pasta do aplicativo no Drive para continuar.');
     const request=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+response.access_token},signal:AbortSignal.timeout(20000)});
     if(!request.ok)throw Error('Não foi possível confirmar o perfil Google.');const user=await request.json();
     const profile=store.add(user);leaveSession();store.select(profile.sub);
     credentials={accessToken:response.access_token,expiresAt:Date.now()+Math.max(0,Number(response.expires_in)*1000-30000)};
     expiryTimer=setTimeout(()=>{credentials=null;client=null;clearTimeout(timer);status='A sessão Google expirou. Reconecte para continuar salvando no Drive.';notify();},Math.max(0,credentials.expiresAt-Date.now()));
     client=new FinanceDrive.Client({fetch:(...args)=>fetch(...args),token,sub:profile.sub,validate,uuid:()=>newId()});
     busy=false;changed();await synchronize();
    }catch(error){status=error.message;finish();}
   }});
  try{oauth.requestAccessToken({prompt:'select_account',...(hintSub?{hint:store.list().find(p=>p.sub===hintSub)?.email}: {})});}catch{status='Não foi possível abrir o login Google. Permita a janela de login e tente novamente.';finish();}
 }
 function finish(){busy=false;notify();if(queued){queued=false;if(token()&&!conflict)schedule();}}
 async function loadHistory(){if(busy)throw Error('Aguarde a operação atual.');if(!client||!token())throw Error('Reconecte a conta Google.');const epoch=store.epoch;busy=true;notify();try{const files=await client.list();if(epoch!==store.epoch)throw Error('O perfil mudou. Tente novamente.');history=files;status='Últimas 20 cópias disponíveis.';}finally{finish();}}
 async function restore(id){if(busy)throw Error('Aguarde a operação atual.');if(!client||!token())throw Error('Reconecte a conta Google.');const point=store.checkpoint();busy=true;notify();try{const snapshot=await client.read(id);if(!store.matches(point))throw Error('O perfil ou os dados mudaram. A restauração foi cancelada.');store.write(snapshot.state);conflict=false;status='Cópia restaurada neste navegador. Envie ao Drive para confirmar esta versão.';changed();}finally{finish();}}
 async function importLocal(){if(busy||!store.current())throw Error('Conecte um perfil Google primeiro.');const raw=localStorage.getItem(FinanceProfiles.legacyKey);if(!raw)throw Error('Não há dados no perfil local.');const point=store.checkpoint();busy=true;notify();try{const data=await validate(JSON.parse(raw));if(!store.matches(point))throw Error('O perfil ou os dados mudaram. A cópia foi cancelada.');store.write(data);changed();queued=true;}finally{finish();}}
 window.addEventListener('online',()=>{if(store.current())synchronize();});
 window.addEventListener('storage',e=>{if(e.key===store.key()){store.epoch++;clearTimeout(timer);status='Dados atualizados em outra aba. Confira a versão antes de enviar ao Drive.';changed();notify();}else if(e.key==='financa-dos-rapazes:profiles:v2:index')notify();});
 return{store,stateInfo,clientId,configure,logout,connect,synchronize,schedule,loadHistory,restore,importLocal};
})();
