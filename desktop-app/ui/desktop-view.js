const originalSettings=settings;
settings=function(){return `<section class="card settings-block"><h2>Aplicativo para computador</h2><p id="desktop-version">Atualizações distribuídas pelo GitHub da aplicação.</p><button class="secondary" data-desktop="update">Checar atualização</button><button class="secondary" data-desktop="logout">Sair da conta Google</button><p id="desktop-update-status" role="status"></p></section>`+originalSettings()};
document.addEventListener('click',safe(async e=>{
 const button=e.target.closest('[data-desktop]');if(!button)return;
 if(button.dataset.desktop==='update'){
  button.disabled=true;try{const result=await window.desktop.checkUpdate();const status=document.querySelector('#desktop-update-status');if(status)status.textContent=result.message;}finally{button.disabled=false;}
 }
 if(button.dataset.desktop==='logout'&&confirm('Sair desta conta? Seus dados continuarão no seu Drive.')){if(saving||scriptBusy)throw Error('Aguarde o salvamento terminar.');await window.desktop.logout();}
}));

profiles=function(info=GoogleProfiles.stateInfo()){
 const p=info.profile;
 return `<section class="card settings-block"><h2>${esc(p?.name||'Conta Google')}</h2><p>${esc(p?.email||'')}</p><div class="notice" role="status">${esc(scriptStatus)}</div><p>As alterações são gravadas primeiro neste computador. O Drive é sincronizado a cada cinco minutos enquanto o programa estiver aberto. Se fechar antes do envio, a cópia local permanece salva e será enviada ao reabrir.</p><button class="primary" data-desktop="sync">Sincronizar agora</button><button class="secondary" data-script-action="history">Cópias do Drive</button>${scriptRecord?.folderId?`<a class="secondary" href="https://drive.google.com/drive/folders/${encodeURIComponent(scriptRecord.folderId)}" target="_blank" rel="noopener">Abrir minha pasta no Drive</a>`:''}<p>Última sincronização: ${scriptSync.lastSync?esc(new Date(scriptSync.lastSync).toLocaleString('pt-BR')):'Ainda não confirmada'}</p></section>${conflictControls()}${scriptHistory.length?`<section class="card settings-block"><h2>Cópias anteriores no Drive</h2>${scriptHistory.map(f=>`<p>${esc(new Date(f.createdTime).toLocaleString('pt-BR'))} <button class="secondary" data-script-restore="${esc(f.id)}">Restaurar na cópia local</button></p>`).join('')}</section>`:''}`;
};
function conflictControls(){return scriptSync.conflict?'<section class="card settings-block"><h2>Há duas versões dos dados</h2><p>O Drive foi alterado em outro dispositivo. Sua cópia local foi preservada. Você pode baixar uma cópia JSON antes de escolher. Nenhuma versão será substituída automaticamente.</p><button class="secondary" data-action="backup">Baixar minha cópia JSON</button><button class="secondary" data-desktop="use-cloud">Usar os dados do Drive</button><button class="secondary" data-desktop="use-local">Enviar meus dados locais</button></section>':'';}
const cachedSettings=settings;
settings=function(){return `<section class="card settings-block"><h2>Cópia local e sincronização</h2><p role="status" id="desktop-sync-status">${esc(scriptStatus)}</p><p>Salvamento imediato neste computador e envio ao Drive a cada cinco minutos. Os arquivos locais ficam protegidos pela sua conta do Windows.</p><button class="primary" data-desktop="sync">Sincronizar agora</button><button class="secondary" data-desktop="open-local">Abrir pasta dos dados locais</button></section>${conflictControls()}`+cachedSettings();};
let manualSync=false;
document.addEventListener('click',safe(async e=>{
 const button=e.target.closest('[data-desktop]');if(!button)return;const action=button.dataset.desktop;
 if(action==='open-local'){await scriptRpc('openLocalFolder');return;}
 if(!['sync','use-cloud','use-local'].includes(action)||manualSync)return;
 if(saving||scriptBusy)throw Error('Aguarde o salvamento local.');
 if(action==='use-cloud'&&!confirm('Usar os dados do Drive no lugar da versão exibida? A cópia local anterior será guardada no computador.'))return;
 if(action==='use-local'&&!confirm('Enviar seus dados locais no lugar da versão do Drive? Uma cópia da versão anterior do Drive será mantida.'))return;
 manualSync=true;button.disabled=true;
 try{if(action==='sync')await GoogleProfiles.synchronize();else{await scriptRpc('resolveConflict',action==='use-local'?'local':'cloud');await refreshLocalCopy();}toast(scriptStatus);}finally{manualSync=false;button.disabled=false;updateSync(await scriptRpc('syncStatus'));scriptNotify();}
}));
// Poll local IPC metadata only: this does not contact Google Drive.
let statusPolling=false,lastSyncStatusKey='';
setInterval(async()=>{if(!scriptRecord||scriptBusy||saving||statusPolling||document.visibilityState==='hidden')return;statusPolling=true;try{const info=await scriptRpc('syncStatus');const key=JSON.stringify(info);if(key===lastSyncStatusKey&&(info.revision===scriptRecord.revision||hasLocalDraft()))return;lastSyncStatusKey=key;updateSync(info);if(info.revision!==scriptRecord.revision&&!hasLocalDraft())await refreshLocalCopy();else{renderProfileStatus();const status=document.querySelector('#desktop-sync-status');if(status)status.textContent=scriptStatus;if((view==='profiles'||view==='settings')&&!hasLocalDraft()&&!!document.querySelector('[data-desktop="use-cloud"]')!==!!info.conflict)render();}}catch{/* A window being closed or replaced must not trigger stale UI writes. */}finally{statusPolling=false;}},3000);
