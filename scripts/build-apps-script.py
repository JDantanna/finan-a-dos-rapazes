#!/usr/bin/env python3
"""Build the current Rust/Wasm UI into one Google Apps Script HTML file."""
from pathlib import Path
import base64,re
root=Path(__file__).resolve().parents[1];dist=root/'dist';dest=root/'apps-script'
html=(dist/'index.html').read_text()
html=re.sub(r'<script\b[^>]*\bsrc=["\'][^"\']+["\'][^>]*></script>','',html)
html=re.sub(r'<link\b[^>]*rel="stylesheet"[^>]*>','',html)
html=html.replace('<head>','<head><base target="_top">').replace('href="./"','href="#"')
css=(dist/'style.css').read_text();html=html.replace('</head>','<style>'+css+'</style></head>')
app=(dist/'app.js').read_text();app=app[:app.index('function profiles(')]
app=re.sub(r'function settings\(\).*?(?=function openEntry)', '', app, flags=re.S)
app=re.sub(r'function reports\(\).*?(?=function openEntry)', '', app, flags=re.S)
app=re.sub(r'function csv\(\).*?(?=async function loadDemo)', '', app, flags=re.S)
app=app.replace("toast(GoogleProfiles.store.current()?'Salvo neste navegador. Consulte o status do envio ao Drive.':'Alterações salvas no perfil local.')","toast('Salvo no seu Google Drive.')")
app=app.replace('Entre com Google para separar seus dados e salvar cópias no Drive.','Sua conta Google e seus registros no Drive.')
bootstrap='const FINANCE_WASM_BASE64='+repr(base64.b64encode((dist/'finance.wasm').read_bytes()).decode())+';\n'
parts=[bootstrap,(dist/'income-sources.js').read_text(),(dest/'client.js').read_text(),(dist/'currency-input.js').read_text(),(dist/'expense-summary.js').read_text(),app,(dest/'report-filter.js').read_text(),(dest/'view.js').read_text()]
script='\n'.join(parts).replace('</script','<\\/script')
html=html.replace('</body>','<script>'+script+'</script></body>')
(dest/'Index.html').write_text(html)
print(f'Apps Script HTML: {len(html.encode()):,} bytes')
