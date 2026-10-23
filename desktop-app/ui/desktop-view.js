const originalSettings=settings;
settings=function(){return `<section class="card settings-block"><h2>Aplicativo para computador</h2><p id="desktop-version">Atualizações distribuídas pelo GitHub da aplicação.</p><button class="secondary" data-desktop="update">Checar atualização</button><button class="secondary" data-desktop="logout">Sair da conta Google</button><p id="desktop-update-status" role="status"></p></section>`+originalSettings()};
document.addEventListener('click',safe(async e=>{
 const button=e.target.closest('[data-desktop]');if(!button)return;
 if(button.dataset.desktop==='update'){
  button.disabled=true;try{const result=await window.desktop.checkUpdate();const status=document.querySelector('#desktop-update-status');if(status)status.textContent=result.message;}finally{button.disabled=false;}
 }
 if(button.dataset.desktop==='logout'&&confirm('Sair desta conta? Seus dados continuarão no seu Drive.')){if(saving||scriptBusy)throw Error('Aguarde o salvamento terminar.');await window.desktop.logout();}
}));
