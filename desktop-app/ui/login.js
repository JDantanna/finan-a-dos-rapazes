'use strict';
const status=document.querySelector('#status'),login=document.querySelector('#login');
async function refresh(){const info=await window.desktop.status();document.querySelector('#setup').hidden=info.configured;login.disabled=!info.configured;document.querySelector('#local-start').textContent=info.localProfile?'Abrir meu perfil local':'Começar a usar';document.querySelector('#local-name').required=!info.localProfile;status.textContent=info.error||'Versão '+info.version+' · Pronto para usar sem login Google.';}
document.querySelector('#local-profile').onsubmit=async e=>{e.preventDefault();const b=document.querySelector('#local-start');b.disabled=true;try{await window.desktop.localLogin(document.querySelector('#local-name').value);}catch(error){status.textContent=error.message;}finally{b.disabled=false;}};
login.onclick=async()=>{login.disabled=true;status.textContent='Autorize o acesso na janela do navegador…';try{await window.desktop.login()}catch(e){status.textContent=e.message;login.disabled=false;}};
document.querySelector('#client').onclick=async()=>{try{await window.desktop.importClient();await refresh()}catch(e){status.textContent=e.message;}};
document.querySelector('#update').onclick=()=>window.UpdateView.open();
refresh().catch(e=>{status.textContent=e.message});
