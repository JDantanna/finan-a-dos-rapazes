let scriptRecord=null,scriptLoading=null,scriptBusy=false,scriptHistory=[],scriptSync={},scriptStatus='Carregando a cópia local…';
function scriptRpc(method,...args){return window.desktop.rpc(method,...args);}
function updateSync(info){scriptSync=info||{};scriptStatus=scriptSync.message||'Dados salvos neste computador.';}
async function scriptLoad(){if(!scriptLoading)scriptLoading=scriptRpc('loadFinance').then(result=>{scriptRecord=result;updateSync(result.localSync);return result;}).catch(error=>{scriptLoading=null;scriptStatus=error.message;throw error;});return scriptLoading;}
function scriptNotify(){document.dispatchEvent(new CustomEvent('finance:cloud-status'));}
const GoogleProfiles={
 store:{get active(){return scriptRecord?.profile.sub||''},epoch:0,current:()=>scriptRecord?.profile||null},
 stateInfo:()=>({profile:scriptRecord?.profile||null,profiles:[],connected:!!scriptRecord,configured:true,busy:scriptBusy,status:scriptStatus,dirty:!!scriptSync.dirty,lastBackup:scriptSync.lastSync||scriptRecord?.lastBackup,head:scriptRecord?.fileId,history:scriptHistory}),
 async synchronize(){await scriptRpc('syncNow');await refreshLocalCopy();},
 async loadHistory(){if(scriptBusy)throw Error('Aguarde o salvamento local.');await scriptLoad();scriptHistory=await scriptRpc('listFinanceBackups',scriptRecord.profile.sub);scriptNotify();},
 async restore(id){if(scriptBusy)throw Error('Aguarde o salvamento local.');scriptBusy=true;try{const result=await scriptRpc('restoreFinanceBackup',id,scriptRecord.revision,newId(),scriptRecord.profile.sub);scriptRecord=result;scriptLoading=Promise.resolve(result);updateSync(result.localSync);document.dispatchEvent(new CustomEvent('finance:profile-change'));}finally{scriptBusy=false;scriptNotify();}}
};
function hasLocalDraft(){return !!document.querySelector('dialog[open]:not(.update-dialog), main form[data-local-draft="true"]');}
for(const event of ['input','change'])document.addEventListener(event,e=>{const form=e.target.closest('form');if(form)form.dataset.localDraft='true';});
document.addEventListener('reset',e=>{if(e.target.matches('form'))delete e.target.dataset.localDraft;});
async function refreshLocalCopy(){if(scriptBusy||saving||hasLocalDraft())return;const account=scriptRecord?.profile.sub,result=await scriptRpc('loadFinance');if(account&&account!==result.profile.sub)return;scriptRecord=result;scriptLoading=Promise.resolve(result);updateSync(result.localSync);state=result.state;state.accounts||=[];state.incomeSources||=[];dueCheckKey='';await refresh();}
async function webApi(route,body){
 await scriptLoad();if(route==='/api/state'){
  if(body===undefined)return scriptRecord.state;if(scriptBusy)throw Error('Aguarde o salvamento local.');
  const revision=scriptRecord.revision,account=scriptRecord.profile.sub;
  IncomeSources.validate(body.incomeSources??[]);validateAccounts(body.accounts??[]);await rustReport(body,today(),today());
  if(scriptRecord.revision!==revision||scriptRecord.profile.sub!==account)throw Error('Os dados mudaram. Confira antes de salvar.');
  scriptBusy=true;try{const result=await scriptRpc('saveFinance',body,revision,newId(),account);scriptRecord=result;scriptLoading=Promise.resolve(result);updateSync(result.localSync);return{ok:true};}catch(error){scriptStatus='Não foi possível salvar no computador: '+error.message;throw error;}finally{scriptBusy=false;scriptNotify();}
 }
 if(route.startsWith('/api/report?')){const params=new URLSearchParams(route.split('?')[1]);return rustReport(scriptRecord.state,params.get('start'),params.get('end'));}throw Error('Recurso indisponível.');
}
