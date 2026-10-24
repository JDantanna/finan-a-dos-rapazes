'use strict';
// Shared by the login screen and the signed-in application. No external windows.
window.UpdateView=(()=>{
 let dialog,poll,pending=false,reading=false,feedback='';
 function create(){
  if(dialog)return;
  dialog=document.createElement('dialog');dialog.className='update-dialog';dialog.setAttribute('aria-labelledby','update-title');
  dialog.innerHTML='<div class="update-head"><h2 id="update-title">Atualizar aplicativo</h2><button type="button" data-update="close" aria-label="Fechar atualização">×</button></div><p class="update-version"></p><p class="update-message" role="status" aria-live="polite"></p><progress max="100" aria-label="Progresso do download" hidden></progress><p class="update-percent" hidden></p><p class="update-help">O download acontece nesta janela. Ao reiniciar, a atualização será instalada em segundo plano, sem abrir o assistente do instalador.</p><div class="update-actions"><button type="button" class="secondary" data-update="close">Depois</button><button type="button" class="primary" data-update="action" hidden></button></div>';
  document.body.append(dialog);
  dialog.addEventListener('close',()=>{clearTimeout(poll);poll=null;});
  dialog.addEventListener('click',async e=>{
   const b=e.target.closest('[data-update]');if(!b)return;
   if(b.dataset.update==='close'){dialog.close();return;}
   if(pending)return;
   if(b.dataset.action==='install'&&typeof hasLocalDraft==='function'&&hasLocalDraft()){feedback='Salve ou feche os formulários abertos antes de reiniciar.';dialog.querySelector('.update-message').textContent=feedback;return;}
   await run(b.dataset.action);
  });
 }
 function paint(s){
  dialog.querySelector('.update-version').textContent='Sua versão: '+s.version+(s.nextVersion?' · Nova versão: '+s.nextVersion:'');
  dialog.querySelector('.update-message').textContent=feedback||s.message;
  const downloading=s.phase==='downloading',progress=dialog.querySelector('progress'),percent=dialog.querySelector('.update-percent');progress.hidden=percent.hidden=!downloading;progress.value=s.percent||0;percent.textContent=Math.round(s.percent||0)+'% baixado';
  const b=dialog.querySelector('[data-update="action"]');const action=s.phase==='available'?'download':s.phase==='ready'?'install':['idle','current','error'].includes(s.phase)?'check':'';
  b.hidden=!action;b.dataset.action=action;b.disabled=pending;b.textContent=action==='download'?'Baixar atualização':action==='install'?'Reiniciar e atualizar':'Checar novamente';
  clearTimeout(poll);poll=null;if(dialog.open&&(pending||['checking','downloading'].includes(s.phase)))poll=setTimeout(refresh,750);
 }
 async function run(action){
  pending=true;feedback='';try{const task=window.desktop.checkUpdate(action);await refresh();paint(await task);}catch{feedback='Não foi possível concluir. Tente novamente.';dialog.querySelector('.update-message').textContent=feedback;}finally{pending=false;if(dialog.open)await refresh();}
 }
 async function refresh(){if(reading)return;reading=true;try{paint(await window.desktop.checkUpdate('status'));}catch{/* Window may be closing during installation. */}finally{reading=false;}}
 async function open(){create();feedback='';if(!dialog.open)dialog.showModal();await refresh();const s=await window.desktop.checkUpdate('status');if(['idle','error','current'].includes(s.phase)&&!pending)await run('check');}
 return Object.freeze({open});
})();
