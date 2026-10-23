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

Salvamentos locais validam os dados e verificam a revisão local; o envio ao Drive verifica a revisão remota e ETag e mantém uma cópia anterior. Um conflito conserva os dados e exige recarregar. Falha de rede não é apresentada como salvamento. A partir da versão 1.2.0, a primeira conexão carrega os dados do Drive e cria uma cópia local; os próximos acessos e salvamentos usam essa cópia, inclusive offline. O programa não emite avisos nem sincroniza quando está fechado.

## Dados da edição web

A edição desktop usa uma pasta própria porque permissões `drive.file` de aplicativos diferentes não concedem acesso automático aos arquivos da edição Apps Script. Para migrar, baixe uma cópia JSON na edição web e use **Configurações → Restaurar cópia JSON** na edição desktop, conferindo a conta e os dados antes de salvar. O site existente continua disponível. As duas edições não sincronizam automaticamente entre si.

## Atualizações

O botão **Checar atualização** está na tela inicial e nas configurações. A edição instalada consulta somente as Releases de `JDantanna/finan-a-dos-rapazes`. O usuário confirma o download e a reinicialização. O instalador é verificado pelo SHA-512 do manifesto fornecido pelo `electron-updater`; esse hash não equivale a uma assinatura de editor Windows. Não é executado código diretamente da branch `main`.

Para atualizar: altere o código, aumente `version` em `desktop-app/package.json` e o lockfile, valide no Windows e publique pelo workflow. A release contém `.exe`, `.blockmap` e `latest.yml`. Apenas modificar arquivos no GitHub não publica uma versão instalável. Não apague as releases anteriores para que reinstalação e diagnóstico permaneçam possíveis.

Antes da primeira release, testar: login e cancelamento; reiniciar e renovar autorização; contas distintas; migração de JSON; salvamento/recarga e conflito em dois computadores; relatórios por fonte; parcelas; popup de vencimentos; instalação/desinstalação; atualização de uma versão anterior para outra publicada.

## Correção 1.0.1

O download de conteúdo da API Drive v3 não garante o cabeçalho HTTP ETag. O desktop agora obtém o ETag explicitamente dos metadados da API v2, verifica a estabilidade antes e depois de ler o conteúdo e grava pelo endpoint v2 com `If-Match`. A pasta, o arquivo, a conta e o formato dos dados continuam os mesmos. Os testes reproduzem o download sem ETag e as alterações concorrentes durante leitura e gravação. A validação final com o Drive real deve ser feita após atualizar o aplicativo.

## Categorias — 1.1.0

O menu Categorias permite cadastrar e editar nome, símbolo/emoji e cor. Oito categorias padrão são oferecidas a contas antigas e novas, preservando os nomes dos lançamentos existentes. Renomear atualiza receitas e despesas da categoria, incluindo séries e parcelas; excluir remove somente o cadastro. Símbolos e cores aparecem nas tabelas e na distribuição de despesas. O cadastro acompanha os dados no Drive e o backup JSON.

O campo Categoria agora usa sugestões próprias, com navegação por teclado e botão Limpar, mantendo a digitação livre após selecionar uma opção. A implementação evita a lista nativa que apresentava travamento de edição. Testes de interface com DOM isolado verificam cadastro, seleção, digitação posterior, troca, limpeza e edição/salvamento de um lançamento antigo; testes de domínio e processo principal verificam validação, renomeação e persistência JSON. O teste com a conta Google real continua sendo feito no aplicativo instalado.

## Cópia local — 1.2.0

O caminho de gravação passa a ser primeiro local: alterações em lançamentos, parcelas, categorias, fontes, metas, preferências e avisos são confirmadas depois da gravação criptografada em disco, sem esperar Google ou internet. A interface calcula os relatórios no computador e o PDF usa a cópia local atual.

O processo principal sincroniza com o Drive a cada 300.000 ms enquanto o programa está aberto e tenta sincronizar ao reabrir. Várias alterações são agrupadas num único envio. Configurações e Conta Google oferecem Sincronizar agora, status de pendência e horário da última sincronização. Configurações também permite abrir a pasta dos arquivos locais. Ao fechar, o programa espera somente as gravações locais; não obriga a aguardar a rede. Pendências são retomadas na próxima abertura.

A cópia e a versão local anterior ficam em `finance-cache` dentro de `app.getPath('userData')`, separadas pelo hash do identificador Google e criptografadas com safeStorage/Windows. Cada gravação usa arquivo temporário, flush e rename. Ela é persistente, não um cache descartável; permanece após Sair e não contém tokens. Para uma cópia legível/transportável, use o backup JSON já disponível na interface. A primeira carga de cada conta ainda exige internet e autorização Google.

Falhas de rede mantêm as alterações pendentes. O envio em andamento é registrado antes da chamada remota, permitindo reconhecer um upload já confirmado após reinício, sem duplicá-lo. Edições feitas durante o envio continuam locais e são enviadas depois. Mudanças concorrentes no Drive geram um conflito explícito: o usuário pode exportar JSON, escolher a versão do Drive ou enviar a versão local. A decisão preserva uma cópia local de recuperação; sobrescrever o Drive também mantém o backup remoto anterior.

Testes verificam ausência de rede no salvamento local, agrupamento, intervalo de cinco minutos, operação offline/reabertura, alterações durante upload, falha de disco, confirmação perdida após upload, conflitos e escolhas, criptografia, recuperação da cópia anterior, isolamento de contas e o fluxo completo da interface para salvar personalização offline e sincronizar pelo botão. A velocidade observada no Windows e a sincronização com uma conta Google real precisam ser conferidas após instalar.
