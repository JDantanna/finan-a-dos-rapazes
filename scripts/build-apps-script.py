#!/usr/bin/env python3
"""Build the current Rust/Wasm UI into one Google Apps Script HTML file."""
from pathlib import Path
import base64,re
def replace_once(text,old,new):
    if text.count(old)!=1: raise RuntimeError('Âncora de build ausente ou duplicada: '+old[:80])
    return text.replace(old,new,1)

root=Path(__file__).resolve().parents[1];dist=root/'dist';dest=root/'apps-script'
html=(dist/'index.html').read_text(encoding='utf-8')
html=re.sub(r'<script\b[^>]*\bsrc=["\'][^"\']+["\'][^>]*></script>','',html)
html=re.sub(r'<link\b[^>]*rel="stylesheet"[^>]*>','',html)
html=html.replace('<head>','<head><base target="_top">').replace('href="./"','href="#"')
css=(dist/'style.css').read_text(encoding='utf-8')+'\n.primary{color:var(--accent-contrast,#fff)}';html=html.replace('</head>','<style>'+css+'</style></head>')
app=(dist/'app.js').read_text(encoding='utf-8');app=app[:app.index('function profiles(')]
app=re.sub(r'function settings\(\).*?(?=function openEntry)', '', app, flags=re.S)
app=re.sub(r'function reports\(\).*?(?=function openEntry)', '', app, flags=re.S)
app=re.sub(r'function csv\(\).*?(?=async function loadDemo)', '', app, flags=re.S)
app=replace_once(app,"toast(GoogleProfiles.store.current()?'Salvo neste navegador. Consulte o status do envio ao Drive.':'Alterações salvas no perfil local.')","toast('Salvo no seu Google Drive.')")
app=app.replace('Entre com Google para separar seus dados e salvar cópias no Drive.','Sua conta Google e seus registros no Drive.')
app=app.replace("accounts:state.accounts||[],incomeSources:state.incomeSources||[],categories:state.categories","accounts:state.accounts||[],incomeSources:state.incomeSources||[],categories:state.categories,preferences:state.preferences")
app=app.replace("incomeSources:state.incomeSources||[],accounts:state.accounts||[],categories:state.categories,demo:true","incomeSources:state.incomeSources||[],accounts:state.accounts||[],categories:state.categories,preferences:state.preferences,demo:true")
app=app.replace("demo:!!data.demo,categories:Categories.validate(data.categories)});","demo:!!data.demo,categories:Categories.validate(data.categories),preferences:data.preferences||state.preferences});")
app=app.replace("updateEntryFields();$('#entry-title')","updateEntryFields();updateDueDateLabel();$('#entry-title')")
app=app.replace("preferences:data.preferences||state.preferences","preferences:data.preferences||state.preferences,reminders:data.reminders||state.reminders")
app=app.replace("preferences:state.preferences","preferences:state.preferences,reminders:state.reminders")
app=app.replace("}finally{saving=false}}","}finally{saving=false;dueCheckKey='';checkDueDates()}}")
bootstrap='const FINANCE_WASM_BASE64='+repr(base64.b64encode((dist/'finance.wasm').read_bytes()).decode())+';\n'
parts=[bootstrap,(dist/'app-theme.js').read_text(encoding='utf-8'),(dist/'report-cache.js').read_text(encoding='utf-8'),(dist/'categories.js').read_text(encoding='utf-8'),(dist/'income-sources.js').read_text(encoding='utf-8'),(dest/'client.js').read_text(encoding='utf-8'),(dist/'currency-input.js').read_text(encoding='utf-8'),(dist/'expense-summary.js').read_text(encoding='utf-8'),app,(dest/'report-filter.js').read_text(encoding='utf-8'),(dest/'view.js').read_text(encoding='utf-8'),(dest/'reminders.js').read_text(encoding='utf-8'),(dest/'reminder-view.js').read_text(encoding='utf-8'),(dist/'categories-view.js').read_text(encoding='utf-8')]
script='\n'.join(parts).replace('</script','<\\/script')
html=html.replace('</body>','<script>'+script+'</script></body>')
(dest/'Index.html').write_text(html,encoding='utf-8')
print(f'Apps Script HTML: {len(html.encode()):,} bytes')

# The same category validator runs in the UI, Apps Script and desktop process.
server=(dest/'Code.gs').read_text(encoding='utf-8').split('\n// GENERATED CATEGORY REGISTRY')[0]
(dest/'Code.gs').write_text(server+'\n// GENERATED CATEGORY REGISTRY\n'+(dist/'categories.js').read_text(encoding='utf-8'),encoding='utf-8')
