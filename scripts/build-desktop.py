#!/usr/bin/env python3
"""Reuse the deployed interface and pure validators; never fork financial logic."""
from pathlib import Path
import re, subprocess, sys, base64, struct
def replace_once(text,old,new):
    if text.count(old)!=1: raise RuntimeError('Âncora de build ausente ou duplicada: '+old[:80])
    return text.replace(old,new,1)

root = Path(__file__).resolve().parents[1]
subprocess.run([sys.executable, str(root/'scripts/build-apps-script.py')], check=True)
out = root/'desktop-app/generated'
out.mkdir(exist_ok=True)
assets=root/'desktop-app/assets'
assets.mkdir(exist_ok=True)
png=base64.b64decode((root/'desktop-app/artwork/icon.png.b64').read_text(encoding='ascii'),validate=False)
(assets/'icon.png').write_bytes(png)
# ICO supports embedded PNG images. Zero width/height denotes 256 pixels.
(assets/'icon.ico').write_bytes(struct.pack('<HHH',0,1,1)+struct.pack('<BBBBHHII',0,0,0,0,1,32,len(png),22)+png)

html = (root/'apps-script/Index.html').read_text(encoding='utf-8')
script = re.search(r'<script>(.*?)</script>', html, re.S).group(1)
script = script.replace('<\\/script', '</script')
# Reuse the WASM bridge; replace only storage/RPC behavior for the desktop.
start = script.index('let scriptRecord=')
wasm = script.index('const wasmReady=',start)
api = script.index('async function webApi(',wasm)
new_id = script.index('function newId(',api)
script = script[:start] + (root/'desktop-app/ui/client.js').read_text(encoding='utf-8') + script[wasm:api] + script[new_id:]
script = script.replace('Para trocar de conta, abra o link usando o perfil correspondente no navegador.', 'Para trocar de conta, use Sair da conta nas configurações e entre novamente.')
script = script.replace('Finança dos Rapazes</strong> do seu próprio Google Drive', 'Finança dos Rapazes — Desktop</strong> do seu próprio Google Drive')
script = script.replace("toast('Salvo no seu Google Drive.')", "toast('Salvo neste computador. O Drive será sincronizado em segundo plano.')")
script = script.replace("info.busy?'● Salvando no Drive…'", "info.busy?'● Salvando no computador…'")
script = script.replace('Google Drive · Cada pessoa usa a própria conta e a própria pasta de dados.', 'Cópia local · Sincronização com seu Drive a cada cinco minutos.')
script = script.replace('Cada salvamento confirmado grava os dados no seu Google Drive. Uma cópia da versão anterior é mantida na mesma pasta.', 'Cada salvamento grava a cópia local. O Drive recebe as alterações em segundo plano, a cada cinco minutos, mantendo uma cópia anterior.')
script = script.replace('Preferências desta conta, salvas no seu Google Drive.', 'Preferências desta conta, salvas no computador e sincronizadas com seu Drive.')
script = script.replace('Restaurar esta cópia no seu Drive? A versão atual será preservada como backup.', 'Restaurar esta cópia no computador? Ela será enviada ao Drive na próxima sincronização.')
script = script.replace('Sua conta Google e sua foto permanecem vinculadas ao login.', 'No modo local, o nome é definido por você e não depende de uma conta Google.')
script = script.replace('Preferências desta conta, salvas no computador e sincronizadas com seu Drive.', 'Preferências salvas no computador e incluídas nas cópias configuradas.')
script += '\n' + (root/'desktop-app/ui/update-view.js').read_text(encoding='utf-8')
script += '\n' + (root/'desktop-app/ui/desktop-view.js').read_text(encoding='utf-8')
script += '\n' + (root/'desktop-app/ui/nubank-import.js').read_text(encoding='utf-8')
script += '\n' + (root/'desktop-app/ui/nubank-view.js').read_text(encoding='utf-8')
if 'google.script.run' in script or 'window.desktop.rpc' not in script or script.count('async function webApi(')!=1:
    raise RuntimeError('O adaptador de armazenamento desktop não foi gerado corretamente.')
css = re.search(r'<style>(.*?)</style>', html, re.S).group(1) + '\n' + (root/'desktop-app/ui/update-view.css').read_text(encoding='utf-8')
html = re.sub(r'<style>.*?</style>', '<link rel="stylesheet" href="app.css">', html, flags=re.S)
html = re.sub(r'<script>.*?</script>', '<script src="app.js"></script>', html, flags=re.S)
html = html.replace('<base target="_top">', '')
html = replace_once(html,'<strong class="brand-title">', '<img class="brand-mascot" src="../assets/icon.png" alt="Pato segurando notas de reais" width="80" height="90"><strong class="brand-title">')
html = html.replace('Perfis e Google Drive', 'Perfil e cópias')
html = html.replace('Teste online · Rust/WebAssembly', 'Aplicativo para computador · Google Drive')
html = html.replace('Finança dos Rapazes · Teste online', 'Finança dos Rapazes')
html = html.replace('◉ Perfil local · dados neste navegador', 'Conectando ao Google Drive…').replace('● Salvo neste navegador', 'Carregando do Google Drive…')
html = html.replace('Perfil local · Dados salvos neste navegador. Entre com Google em Perfis para ativar o Drive.', 'Seus dados ficam na sua conta Google Drive.')
csp = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.googleusercontent.com; connect-src 'none'; base-uri 'none'; form-action 'none'"
html = replace_once(html,'<head>', '<head><meta http-equiv="Content-Security-Policy" content="'+csp+'">')
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
