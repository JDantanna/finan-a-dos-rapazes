#!/usr/bin/env python3
"""Reuse the deployed interface and pure validators; never fork financial logic."""
from pathlib import Path
import re, subprocess, sys
root = Path(__file__).resolve().parents[1]
subprocess.run([sys.executable, str(root/'scripts/build-apps-script.py')], check=True)
out = root/'desktop-app/generated'
out.mkdir(exist_ok=True)
html = (root/'apps-script/Index.html').read_text(encoding='utf-8')
script = re.search(r'<script>(.*?)</script>', html, re.S).group(1)
script = script.replace('<\\/script', '</script')
start = script.index('function scriptRpc(')
end = script.index('async function scriptLoad', start)
script = script[:start] + 'function scriptRpc(method,...args){return window.desktop.rpc(method,...args);}\n' + script[end:]
script = script.replace('Para trocar de conta, abra o link usando o perfil correspondente no navegador.', 'Para trocar de conta, use Sair da conta nas configurações e entre novamente.')
script = script.replace('Finança dos Rapazes</strong> do seu próprio Google Drive', 'Finança dos Rapazes — Desktop</strong> do seu próprio Google Drive')
script += '\n' + (root/'desktop-app/ui/desktop-view.js').read_text(encoding='utf-8')
css = re.search(r'<style>(.*?)</style>', html, re.S).group(1)
html = re.sub(r'<style>.*?</style>', '<link rel="stylesheet" href="app.css">', html, flags=re.S)
html = re.sub(r'<script>.*?</script>', '<script src="app.js"></script>', html, flags=re.S)
html = html.replace('<base target="_top">', '')
html = html.replace('Teste online · Rust/WebAssembly', 'Aplicativo para computador · Google Drive')
html = html.replace('Finança dos Rapazes · Teste online', 'Finança dos Rapazes')
html = html.replace('◉ Perfil local · dados neste navegador', 'Conectando ao Google Drive…').replace('● Salvo neste navegador', 'Carregando do Google Drive…')
html = html.replace('Perfil local · Dados salvos neste navegador. Entre com Google em Perfis para ativar o Drive.', 'Seus dados ficam na sua conta Google Drive.')
csp = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.googleusercontent.com; connect-src 'none'; base-uri 'none'; form-action 'none'"
html = html.replace('<head>', '<head><meta http-equiv="Content-Security-Policy" content="'+csp+'">')
(out/'index.html').write_text(html,encoding='utf-8')
(out/'app.js').write_text(script,encoding='utf-8')
(out/'app.css').write_text(css,encoding='utf-8')
server = (root/'apps-script/Code.gs').read_text(encoding='utf-8').split('\n// GENERATED CATEGORY REGISTRY')[0]
names = ['validState_', 'validPreferences_', 'validReminders_', 'reportPdfHtml_']
parts = []
for name in names:
    start = server.index('function '+name+'(')
    following = server.find('\nfunction ', start+1)
    parts.append(server[start:following if following != -1 else len(server)])
shim = (root/'dist/categories.js').read_text(encoding='utf-8')+"\nconst Utilities={newBlob(value){return {getBytes:()=>Buffer.from(String(value))}}};\nfunction jsonBlob_(value){if(Buffer.byteLength(JSON.stringify(value))>4000000)throw Error('Limite de 4 MB excedido.');}\n"
(out/'shared.cjs').write_text(shim+'\n'.join(parts)+'\nmodule.exports={validate:validState_,pdfHtml:reportPdfHtml_};\n',encoding='utf-8')
print('Desktop UI + shared validation generated.')
