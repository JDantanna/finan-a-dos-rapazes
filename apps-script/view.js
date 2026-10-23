function profiles(info=GoogleProfiles.stateInfo()){
 const profile=info.profile,date=v=>v?new Date(v).toLocaleString('pt-BR'):'Nenhum envio confirmado';
 return `<section class="card settings-block"><div class="card-head"><h2>${esc(profile?.name||'Conta Google')}</h2><span class="tag">${info.connected?'CONECTADO':'CONECTANDO'}</span></div>${profile?`<p>${esc(profile.email)}</p>`:''}<div class="notice">${esc(info.status)}</div><p>Último salvamento confirmado: <strong>${esc(date(info.lastBackup))}</strong></p><p>Seus registros ficam na pasta <strong>Finança dos Rapazes</strong> do seu próprio Google Drive. O link do aplicativo pode ser compartilhado; a pasta com suas finanças deve permanecer privada.</p>${scriptRecord?`<a class="secondary" href="https://drive.google.com/drive/folders/${encodeURIComponent(scriptRecord.folderId)}" target="_blank" rel="noopener">Abrir minha pasta no Drive</a>`:''}<button class="secondary" data-script-action="reload" ${info.busy?'disabled':''}>Recarregar do Drive</button><button class="secondary" data-script-action="history" ${info.busy?'disabled':''}>Cópias anteriores</button><p class="muted">Para trocar de conta, abra o link usando o perfil correspondente no navegador. Esta edição precisa de internet para carregar e salvar os registros.</p></section>${info.history.length?`<section class="card settings-block full-card"><h2>Cópias anteriores</h2>${info.history.map(file=>`<div class="profile-item"><span>${esc(date(file.createdTime))}</span><button class="secondary" data-script-restore="${esc(file.id)}">Restaurar esta cópia</button></div>`).join('')}</section>`:''}`;
}
function renderProfileStatus(info=GoogleProfiles.stateInfo()){
 applyPersonalization();
 checkDueDates();
 const p=info.profile,avatar=$('#profile-initial');avatar.replaceChildren();
 avatar.textContent=displayUserName().charAt(0).toUpperCase();
 if(p?.picture&&/^https:\/\//.test(p.picture)){
  const img=document.createElement('img');img.src=p.picture;img.alt='';img.referrerPolicy='no-referrer';img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:50%';
  img.onerror=()=>{avatar.textContent=displayUserName().charAt(0).toUpperCase()};avatar.replaceChildren(img);
 }
 $('#profile-display').textContent=displayUserName();
 const small=document.createElement('small');small.textContent=p?.email||'Conta Google';$('#profile-display').append(small);
 $('#profile-cloud-status').textContent=info.status;$('#cloud-toolbar-status').textContent=info.busy?'● Salvando no Drive…':info.status;$('#storage-notice').textContent='Google Drive · Cada pessoa usa a própria conta e a própria pasta de dados.';
}
let reportKind='all',reportSource='';
function selectedReport(){return ReportFilter.select(report.occurrences,reportKind,reportSource)}
function reportScope(){return reportSource?'Despesas · '+reportSource:reportKind==='expense'?'Todas as despesas':'Receitas e despesas'}
function reports(){
 const selected=selectedReport(),sources=ReportFilter.sources(state);
 return `<section class="card"><div class="card-head"><div><h2>Relatório do período</h2><p>Selecione a semana, o mês ou o ano acima.</p></div><div class="report-actions"><button class="secondary" data-action="csv">↓ Exportar CSV</button><button class="primary" data-script-action="pdf">↓ Exportar PDF</button></div></div>
 <div style="display:flex;flex-wrap:wrap;gap:16px;margin:20px 0"><label style="flex:1;min-width:200px">Lançamentos<select id="report-kind"><option value="all" ${reportKind==='all'?'selected':''}>Receitas e despesas</option><option value="expense" ${reportKind==='expense'?'selected':''}>Somente despesas</option></select></label><label style="flex:1;min-width:200px">Fonte de despesa (conta ou cartão)<select id="report-source"><option value="">Todas as fontes de despesa</option>${sources.map(name=>`<option value="${esc(name)}" ${reportSource===name?'selected':''}>${esc(name)}</option>`).join('')}</select></label></div>
 <div class="notice">${esc(reportScope())} · ${selected.occurrences.length} lançamento(s). A tabela, os totais e as exportações usam os mesmos filtros. Inclui recorrências e parcelas do período.</div><div class="report-summary">${reportKind==='all'&&!reportSource?`<div>Receitas<b>${money(selected.income)}</b></div>`:''}<div>Despesas<b>${money(selected.expense)}</b></div>${reportKind==='all'&&!reportSource?`<div>Saldo previsto<b>${money(selected.balance)}</b></div>`:''}</div><div style="margin-top:28px">${rows(selected.occurrences)}</div></section>`;
}
function csv(){
 const cell=v=>'"'+String(v).replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
 const selected=selectedReport();
 const lines=[['Data','Tipo','Descrição','Categoria','Origem da receita','Conta de recebimento','Conta ou cartão','Valor BRL','Repetição','Natureza'],...selected.occurrences.map(o=>[o.date,o.entry.kind==='income'?'Receita':'Despesa',o.entry.description,o.entry.category,o.entry.kind==='income'?o.entry.source:'',o.entry.kind==='income'?(o.entry.account||''):'',o.entry.kind==='expense'?o.entry.source:'',(o.entry.cents/100).toFixed(2).replace('.',','),frequencies[o.entry.frequency],'Previsto (não conciliado)'])];
 const suffix=reportSource?'-'+reportSource.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').slice(0,60):reportKind==='expense'?'-despesas':'';
 download(`relatorio-${range()[0]}-${range()[1]}${suffix}.csv`,'\ufeff'+lines.map(r=>r.map(cell).join(';')).join('\r\n'),'text/csv;charset=utf-8');toast('Relatório CSV exportado.');
}
document.addEventListener('change',e=>{
 if(e.target.id==='report-kind'){reportKind=e.target.value;if(reportKind==='all')reportSource='';render();}
 if(e.target.id==='report-source'){reportSource=e.target.value;if(reportSource)reportKind='expense';render();}
});
let pdfExporting=false;
async function exportPdf(button){
 if(pdfExporting)return;pdfExporting=true;button.disabled=true;button.textContent='Gerando PDF…';
 try{
  const [start,end]=range(),account=scriptRecord.profile.sub;
  const payload={start,end,expenseSource:reportSource,expensesOnly:reportKind==='expense',rows:selectedReport().occurrences.map(o=>({date:o.date,kind:o.entry.kind,description:o.entry.description,category:o.entry.category,source:o.entry.source,account:o.entry.account||'',cents:o.entry.cents,frequency:frequencies[o.entry.frequency]}))};
  const result=await scriptRpc('exportFinancePdf',payload,account);
  if(scriptRecord.profile.sub!==account)throw Error('A conta mudou. Exporte novamente.');
  const bytes=Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0));
  download(result.name,bytes,'application/pdf');toast('Relatório PDF exportado.');
 }finally{pdfExporting=false;button.disabled=false;button.textContent='↓ Exportar PDF';}
}
function settings(){return `${personalizationSettings()}${reminderSettings()}<section class="card settings-block"><h2>Dados no Google Drive</h2><p>Cada salvamento confirmado grava os dados no seu Google Drive. Uma cópia da versão anterior é mantida na mesma pasta.</p><button class="secondary" data-view="profiles">Conta Google e pasta de dados</button><hr><h2>Transferir registros</h2><p>Para trazer seus dados da versão anterior, baixe o backup JSON naquela versão e restaure aqui. Confira a conta Google antes de restaurar.</p><button class="secondary" data-action="backup">Baixar cópia JSON</button><button class="secondary" data-action="restore">Restaurar cópia JSON</button><hr><h2>Dados de exemplo</h2><p>Os dados fictícios, se carregados, também serão salvos no Drive da conta atual.</p><button class="secondary" data-action="demo">Carregar demonstração</button><button class="secondary remove-demo" data-action="clear-demo" ${demo?'':'disabled'}>Remover demonstração</button></section>`;}
document.addEventListener('finance:cloud-status',()=>{if(view==='profiles')render();else renderProfileStatus()});
document.addEventListener('finance:profile-change',safe(async()=>{++refreshVersion;for(const d of document.querySelectorAll('dialog[open]'))d.close();state=await api('/api/state');dueCheckKey='';state.accounts||=[];state.incomeSources||=[];demo=!!state.demo;filter='';reportSource='';reportKind='all';view='profiles';await refresh()}));
document.addEventListener('click',safe(async event=>{const b=event.target.closest('button');if(!b)return;if(b.dataset.scriptAction==='reload'&&confirm('Recarregar os dados confirmados no Drive? Exporte uma cópia JSON antes se desejar preservar a versão exibida.'))await GoogleProfiles.synchronize();if(b.dataset.scriptAction==='history')await GoogleProfiles.loadHistory();if(b.dataset.scriptRestore&&confirm('Restaurar esta cópia no seu Drive? A versão atual será preservada como backup.'))await GoogleProfiles.restore(b.dataset.scriptRestore);}));

document.addEventListener('click',safe(async e=>{const b=e.target.closest('button[data-script-action="pdf"]');if(b)await exportPdf(b);}));

function preferences(){return {color:'#287560',userName:'',appTitle:'',...(state.preferences||{})}}
function displayUserName(){return preferences().userName||GoogleProfiles.stateInfo().profile?.name||'Conta Google'}
function applyPersonalization(){
 const p=preferences(),color=/^#[0-9a-f]{6}$/i.test(p.color)?p.color:'#287560';
 const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
 const linear=rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});
 const lum=linear[0]*.2126+linear[1]*.7152+linear[2]*.0722;
 const root=document.documentElement.style;root.setProperty('--green',color);root.setProperty('--mint','rgb('+rgb.map(v=>Math.round(v*.1+255*.9)).join(',')+')');root.setProperty('--accent-contrast',lum>.179?'#000000':'#ffffff');
 const brand=document.querySelector('.brand');if(p.appTitle)brand.textContent=p.appTitle;else brand.innerHTML='Finança<span>dos Rapazes</span>';
 brand.style.overflowWrap='anywhere';brand.style.fontSize=p.appTitle?'26px':'';
 document.title=p.appTitle||'Finança dos Rapazes';const footer=document.querySelector('footer>span:first-child');if(footer)footer.textContent=p.appTitle||'Finança dos Rapazes';
}
function personalizationSettings(){const p=preferences();return `<section class="card settings-block" style="margin-bottom:20px"><h2>Personalização</h2><p>Preferências desta conta, salvas no seu Google Drive.</p><form id="personalization-form"><label>Nome exibido do usuário<input name="userName" maxlength="80" value="${esc(p.userName)}" placeholder="${esc(GoogleProfiles.stateInfo().profile?.name||'Nome da conta Google')}"></label><label>Título do aplicativo<input name="appTitle" maxlength="80" value="${esc(p.appTitle)}" placeholder="Finança dos Rapazes"></label><label>Cor principal<input name="color" type="color" value="${esc(p.color)}" style="height:48px;max-width:140px"></label><p class="muted">Deixe o nome ou o título em branco para usar o padrão. O nome também identifica os relatórios PDF. Sua conta Google e sua foto permanecem vinculadas ao login.</p><button class="primary" type="submit">Salvar personalização</button><button class="secondary" type="button" data-script-action="reset-personalization">Restaurar aparência padrão</button></form></section>`}
document.addEventListener('submit',safe(async event=>{if(event.target.id!=='personalization-form')return;event.preventDefault();const form=event.target;const next=structuredClone(state);next.preferences={...preferences(),color:form.elements.color.value,userName:form.elements.userName.value.trim(),appTitle:form.elements.appTitle.value.trim()};await save(next);}));
document.addEventListener('click',safe(async e=>{if(!e.target.closest('[data-script-action="reset-personalization"]'))return;const next=structuredClone(state);next.preferences={...preferences(),color:'#287560',userName:'',appTitle:''};await save(next);}));
