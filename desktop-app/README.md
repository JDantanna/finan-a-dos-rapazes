# Aplicativo Windows — perfil local e cópias opcionais

A partir da versão 1.6.0, o primeiro uso não exige conta Google, cliente OAuth ou lista de testadores. Instale o executável, informe seu nome e comece a usar. A interface continua nativa em uma janela Electron e as atualizações são distribuídas pelo GitHub Releases.

## Dados e cópias

O perfil e os dados de trabalho são gravados localmente com a proteção da conta Windows. Esse perfil local não tem senha própria; proteja o acesso à sua sessão do Windows.

Em **Perfil e cópias** ou nas configurações, escolha opcionalmente uma pasta. Para ter cópia no Google Drive, instale e conecte o **Drive para computador**, depois escolha uma pasta que ele sincronize. Também é possível escolher outra pasta local ou sincronizada por outro serviço. O aplicativo não instala/configura o cliente de nuvem automaticamente.

- Uma subpasta `Financa-dos-Rapazes` recebe arquivos JSON portáteis separados, sem sobrescrever versões anteriores.
- As cópias são geradas a cada cinco minutos se houver alterações e também pelo botão **Gravar cópia agora**. Ao reabrir, alterações pendentes são retomadas.
- A confirmação informa apenas a gravação na pasta. Verifique no Drive para computador se o upload foi concluído.
- Os arquivos da pasta contêm dados financeiros legíveis. Escolha uma pasta privada. A cópia de trabalho local continua protegida pelo Windows.
- Em outro computador, crie um perfil, escolha a pasta sincronizada, abra **Ver cópias da pasta** e restaure a versão desejada. A restauração é manual e exige confirmação; não há mesclagem automática entre dispositivos.
- A lista mostra as 100 cópias mais recentes. Versões mais antigas permanecem na pasta e podem ser importadas pelo botão **Restaurar cópia JSON**.
- Não há limpeza automática das cópias. A exclusão ou manutenção da pasta fica sob controle do usuário.

## Migração da edição anterior

Quem já tinha uma conta Google conectada pode continuar acessando o modo anterior. Em configurações, use **Copiar estes dados para o perfil local**. Isso copia os dados exibidos e preserva os arquivos antigos e o cache anterior.

Na tela inicial, o modo antigo fica em **Tenho dados na edição anterior com Google**. Ele continua sujeito às regras OAuth do Google. A conexão antiga é opcional e não é necessária para novos usuários. Se um perfil local já tiver dados salvos, a migração automática é interrompida; use exportação/restauração JSON para escolher qual conjunto de dados manter.

## Build e publicação

```sh
cd desktop-app
npm ci
cd ..
python3 scripts/build-desktop.py
node --test tests/*.cjs desktop-app/test/*.test.cjs
cd desktop-app
npm run dist:win
```

O workflow **Instalador Windows** executa os testes, compila e publica o instalador e o manifesto de atualização. A publicação não exige credenciais Google. O secret opcional `GOOGLE_DESKTOP_CLIENT_JSON`, quando presente, mantém a conexão OAuth apenas para compatibilidade com a edição anterior. Nunca inclua tokens de usuários no repositório.


## Importar fatura Nubank

Em Lançamentos, escolha **Importar fatura Nubank** para CSV, OFX ou PDF com texto selecionável. Informe o vencimento antes de selecionar um PDF; opcionalmente use o vencimento também com CSV/OFX. Confira a prévia, a fonte de cartão, categorias, datas e totais antes de confirmar. Para a conta corrente há um botão separado (CSV/OFX). PDFs digitalizados ou com layout não reconhecido devem ser exportados em CSV/OFX.

Depois de qualquer build, teste ou manutenção, execute `python scripts/clean-rust-builds.py` na raiz. Não apague o cache de dados financeiros. O CI faz a limpeza também se o build falhar.
