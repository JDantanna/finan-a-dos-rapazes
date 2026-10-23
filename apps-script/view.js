function profiles(info=GoogleProfiles.stateInfo()){
 const profile=info.profile,date=v=>v?new Date(v).toLocaleString('pt-BR'):'Nenhum envio confirmado';
 return `<section class="card settings-block"><div class="card-head"><h2>${esc(profile?.name||'Conta Google')}</h2><span class="tag">${info.connected?'CONECTADO':'CONECTANDO'}</span></div>${profile?`<p>${esc(profile.email)}</p>`:''}<div class="notice">${esc(info.status)}</div><p>Último salvamento confirmado: <strong>${esc(date(info.lastBackup))}</strong></p><p>Seus registros ficam na pasta <strong>Finança dos Rapazes</strong> do seu próprio Google Drive. O link do aplicativo pode ser compartilhado; a pasta com suas finanças deve permanecer privada.</p>${scriptRecord?`<a class="secondary" href="https://drive.google.com/drive/folders/${encodeURIComponent(scriptRecord.folderId)}" target="_blank" rel="noopener">Abrir minha pasta no Drive</a>`:''}<button class="secondary" data-script-action="reload" ${info.busy?'disabled':''}>Recarregar do Drive</button><button class="secondary" data-script-action="history" ${info.busy?'disabled':''}>Cópias anteriores</button><p class="muted">Para trocar de conta, abra o link usando o perfil correspondente no navegador. Esta edição precisa de internet para carregar e salvar os registros.</p></section>${info.history.length?`<section class="card settings-block full-card"><h2>Cópias anteriores</h2>${info.history.map(file=>`<div class="profile-item"><span>${esc(date(file.createdTime))}</span><button class="secondary" data-script-restore="${esc(file.id)}">Restaurar esta cópia</button></div>`).join('')}</section>`:''}`;
}
function renderProfileStatus(info=GoogleProfiles.stateInfo()){
 const p=info.profile,avatar=$('#profile-initial');avatar.replaceChildren();
 avatar.textContent=p?.name?.charAt(0).toUpperCase()||'G';
 if(p?.picture&&/^https:\/\//.test(p.picture)){
  const img=document.createElement('img');img.src=p.picture;img.alt='';img.referrerPolicy='no-referrer';img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:50%';
  img.onerror=()=>{avatar.textContent=p.name.charAt(0).toUpperCase()};avatar.replaceChildren(img);
 }
 $('#profile-display').textContent=p?.name||'Conectando…';
 const small=document.createElement('small');small.textContent=p?.email||'Conta Google';$('#profile-display').append(small);
 $('#profile-cloud-status').textContent=info.status;$('#cloud-toolbar-status').textContent=info.busy?'● Salvando no Drive…':info.status;$('#storage-notice').textContent='Google Drive · Cada pessoa usa a própria conta e a própria pasta de dados.';
}
function reports(){return `<section class="card"><div class="card-head"><div><h2>Relatório do período</h2><p>Selecione a semana, o mês ou o ano acima.</p></div><div class="report-actions"><button class="secondary" data-action="csv">↓ Exportar CSV</button><button class="primary" data-script-action="pdf">↓ Exportar PDF</button></div></div><div class="notice">Receitas, despesas e projeções do período selecionado, incluindo recorrências e parcelas.</div><div class="report-summary"><div>Receitas<b>${money(report.income)}</b></div><div>Despesas<b>${money(report.expense)}</b></div><div>Saldo previsto<b>${money(report.balance)}</b></div></div><div style="margin-top:28px">${rows(report.occurrences)}</div></section>`;}
let pdfExporting=false;
async function exportPdf(button){
 if(pdfExporting)return;pdfExporting=true;button.disabled=true;button.textContent='Gerando PDF…';
 try{
  const [start,end]=range(),account=scriptRecord.profile.sub;
  const payload={start,end,rows:report.occurrences.map(o=>({date:o.date,kind:o.entry.kind,description:o.entry.description,category:o.entry.category,source:o.entry.source,account:o.entry.account||'',cents:o.entry.cents,frequency:frequencies[o.entry.frequency]}))};
  const result=await scriptRpc('exportFinancePdf',payload,account);
  if(scriptRecord.profile.sub!==account)throw Error('A conta mudou. Exporte novamente.');
  const bytes=Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0));
  download(result.name,bytes,'application/pdf');toast('Relatório PDF exportado.');
 }finally{pdfExporting=false;button.disabled=false;button.textContent='↓ Exportar PDF';}
}
function settings(){return `<section class="card settings-block"><h2>Dados no Google Drive</h2><p>Cada salvamento confirmado grava os dados no seu Google Drive. Uma cópia da versão anterior é mantida na mesma pasta.</p><button class="secondary" data-view="profiles">Conta Google e pasta de dados</button><hr><h2>Transferir registros</h2><p>Para trazer seus dados da versão anterior, baixe o backup JSON naquela versão e restaure aqui. Confira a conta Google antes de restaurar.</p><button class="secondary" data-action="backup">Baixar cópia JSON</button><button class="secondary" data-action="restore">Restaurar cópia JSON</button><hr><h2>Dados de exemplo</h2><p>Os dados fictícios, se carregados, também serão salvos no Drive da conta atual.</p><button class="secondary" data-action="demo">Carregar demonstração</button><button class="secondary remove-demo" data-action="clear-demo" ${demo?'':'disabled'}>Remover demonstração</button></section>`;}
document.addEventListener('finance:cloud-status',()=>{if(view==='profiles')render();else renderProfileStatus()});
document.addEventListener('finance:profile-change',safe(async()=>{++refreshVersion;for(const d of document.querySelectorAll('dialog[open]'))d.close();state=await api('/api/state');state.accounts||=[];state.incomeSources||=[];demo=!!state.demo;filter='';view='profiles';await refresh()}));
document.addEventListener('click',safe(async event=>{const b=event.target.closest('button');if(!b)return;if(b.dataset.scriptAction==='reload'&&confirm('Recarregar os dados confirmados no Drive? Exporte uma cópia JSON antes se desejar preservar a versão exibida.'))await GoogleProfiles.synchronize();if(b.dataset.scriptAction==='history')await GoogleProfiles.loadHistory();if(b.dataset.scriptRestore&&confirm('Restaurar esta cópia no seu Drive? A versão atual será preservada como backup.'))await GoogleProfiles.restore(b.dataset.scriptRestore);}));

document.addEventListener('click',safe(async e=>{const b=e.target.closest('button[data-script-action="pdf"]');if(b)await exportPdf(b);}));
