'use strict';
const status=document.querySelector('#status'),login=document.querySelector('#login');
async function refresh(){const info=await window.desktop.status();document.querySelector('#setup').hidden=info.configured;login.disabled=!info.configured;status.textContent=info.error|| (info.configured?'Versão '+info.version+' · Pronto para conectar.':'A conexão Google ainda precisa ser configurada pelo desenvolvedor.');}
login.onclick=async()=>{login.disabled=true;status.textContent='Autorize o acesso na janela do navegador…';try{await window.desktop.login()}catch(e){status.textContent=e.message;login.disabled=false;}};
document.querySelector('#client').onclick=async()=>{try{await window.desktop.importClient();await refresh()}catch(e){status.textContent=e.message;}};
document.querySelector('#update').onclick=()=>window.UpdateView.open();
refresh().catch(e=>{status.textContent=e.message});
