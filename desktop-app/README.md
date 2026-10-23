# Aplicativo Windows com Google Drive

Esta edição instala o programa no computador e abre a interface em uma janela própria. O usuário autoriza sua conta Google no navegador; os dados ficam em uma pasta privada `Finança dos Rapazes — Desktop` no Drive da conta autorizada. Não é necessário instalar o Google Drive para computador. O Drive não executa arquivos `.exe`.

## Estado da entrega

Código do instalador NSIS, interface atual, autorização Google com PKCE, acesso ao Drive, cópias anteriores, relatórios PDF/CSV e atualização via GitHub Releases implementados. A validação com uma conta Google real e o teste de instalação/atualização no Windows precisam ser concluídos antes de distribuir como versão pronta. Builds sem cliente OAuth abrem uma tela de configuração e não conseguem conectar ao Google. O workflow bloqueia sua publicação como release.

## Configuração única do responsável

1. No Google Cloud, use um projeto com Google Drive API habilitada e configure o público e a tela de consentimento OAuth. Para compartilhar com outras pessoas, não deixe o acesso restrito somente à sua organização. Em modo de teste é necessário cadastrar os usuários de teste; autorizações podem expirar conforme as regras do Google.
2. Crie um **ID de cliente OAuth → App para computador**. A edição web/Apps Script não substitui esse cliente.
3. Baixe o JSON desse cliente. Para desenvolvimento, salve em `desktop-app/oauth-client.json` (ignorado pelo Git). Alternativamente importe pela tela inicial. Esse JSON identifica o aplicativo; não deve conter tokens de usuários, contas de serviço ou chaves privadas.
4. Para o instalador distribuído, configure esse JSON no secret do repositório `GOOGLE_DESKTOP_CLIENT_JSON`. Todos os usuários recebem o mesmo identificador de aplicativo e cada um autoriza sua própria conta; eles não precisam criar projetos Google.
5. Execute o workflow **Instalador Windows**. Um push gera um artefato de teste. `Run workflow → publish=true` publica uma versão utilizável e exige o secret configurado. O GitHub deve permitir Actions e escrita de Releases pelo workflow.

O instalador usa instalação por usuário, atalho na área de trabalho e desinstalação convencional. Nenhuma pasta financeira é compartilhada e nenhum dado financeiro passa pelo GitHub. O instalador não inclui certificado Authenticode: Windows pode mostrar o editor como desconhecido. Assinatura de distribuição deve ser configurada antes de uma distribuição ampla.

## Desenvolvimento e validação

```sh
cd desktop-app
npm ci
python3 ../scripts/build-desktop.py
npm test
npm start
# No Windows:
npm run dist:win
```

`build-desktop.py` reutiliza a interface mais recente da edição Apps Script, o mesmo WASM financeiro e os validadores/template PDF do servidor. Não existe outra implementação das regras de parcelas ou recorrências. Execute o gerador após mudar a interface e antes de empacotar.

As credenciais de renovação ficam criptografadas por `safeStorage` do Electron, protegido pelo usuário Windows; nunca são enviadas à interface, ao relatório, ao backup JSON ou ao GitHub. A interface tem sandbox, isolamento de contexto e Node desabilitado. A autorização usa navegador externo, PKCE, estado aleatório e retorno somente em `127.0.0.1`. Sair remove as credenciais deste computador; para revogar a permissão por completo use as conexões de terceiros da Conta Google.

Salvamentos validam os dados, verificam revisão e ETag e mantêm uma cópia anterior. Um conflito conserva os dados e exige recarregar. Falha de rede não é apresentada como salvamento. Esta primeira edição requer internet para acessar os registros; não implementa fila offline nem avisos com o programa fechado.

## Dados da edição web

A edição desktop usa uma pasta própria porque permissões `drive.file` de aplicativos diferentes não concedem acesso automático aos arquivos da edição Apps Script. Para migrar, baixe uma cópia JSON na edição web e use **Configurações → Restaurar cópia JSON** na edição desktop, conferindo a conta e os dados antes de salvar. O site existente continua disponível. As duas edições não sincronizam automaticamente entre si.

## Atualizações

O botão **Checar atualização** está na tela inicial e nas configurações. A edição instalada consulta somente as Releases de `JDantanna/finan-a-dos-rapazes`. O usuário confirma o download e a reinicialização. O instalador é verificado pelo SHA-512 do manifesto fornecido pelo `electron-updater`; esse hash não equivale a uma assinatura de editor Windows. Não é executado código diretamente da branch `main`.

Para atualizar: altere o código, aumente `version` em `desktop-app/package.json` e o lockfile, valide no Windows e publique pelo workflow. A release contém `.exe`, `.blockmap` e `latest.yml`. Apenas modificar arquivos no GitHub não publica uma versão instalável. Não apague as releases anteriores para que reinstalação e diagnóstico permaneçam possíveis.

Antes da primeira release, testar: login e cancelamento; reiniciar e renovar autorização; contas distintas; migração de JSON; salvamento/recarga e conflito em dois computadores; relatórios por fonte; parcelas; popup de vencimentos; instalação/desinstalação; atualização de uma versão anterior para outra publicada.
