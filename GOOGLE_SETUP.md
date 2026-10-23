# Ativar perfis Google e cópias no Drive

A integração está implementada, mas o login real depende de um Client ID OAuth configurado no Google. A versão publicada informa quando essa configuração está ausente. Nenhuma credencial fictícia é usada em produção.

## Configuração inicial, uma única vez

1. Abra https://console.cloud.google.com/ e crie ou selecione um projeto para o Finança dos Rapazes. Não é necessário habilitar faturamento para configurar OAuth e a API Drive.
2. Em **APIs e serviços → Biblioteca**, habilite **Google Drive API**.
3. Em **Google Auth Platform**, configure o aplicativo com o nome **Finança dos Rapazes**, seu e-mail de suporte e o público **Externo**. Se estiver em teste, adicione seu próprio e-mail aos usuários de teste. Não é necessário tornar o app disponível para outras pessoas para seu uso pessoal.
4. Em **Clientes**, crie um cliente OAuth do tipo **Aplicativo da Web**.
5. Adicione **https://jdantanna.github.io** às **Origens JavaScript autorizadas**, sem o caminho do repositório. O fluxo usado é popup; não exige um backend ou Client Secret no aplicativo.
6. Para desenvolvimento local, acrescente **http://localhost** e **http://localhost:8080** se for usar esses endereços. O preview interno terminal.local não é uma origem de teste Google suportada por esta configuração.
7. Copie o **Client ID**, que termina em `.apps.googleusercontent.com`. Nunca coloque **Client Secret**, senha ou tokens no código ou no repositório.
8. No aplicativo, abra **Perfis e Google Drive → Configuração do aplicativo Google**, cole o Client ID e salve. Essa configuração fica neste navegador.
9. Clique em **Entrar com Google** e autorize o perfil e a pasta privada do aplicativo no Drive. O perfil só será criado após confirmação pelo Google. Confira a data da primeira cópia confirmada.

O Client ID é uma identificação pública da aplicação. Para tornar a configuração padrão de todos os dispositivos, o proprietário pode preencher `dist/oauth-config.js` e republicar. Mantenha a mesma aplicação OAuth para acessar as cópias já existentes; a pasta do aplicativo é vinculada à aplicação autorizada.

## Comportamento dos dados

- Os registros existentes continuam no **Perfil local**; eles não são enviados automaticamente a uma conta Google.
- Cada conta Google tem seu próprio espaço de dados local, vinculado ao identificador estável `sub` retornado pelo Google.
- Após recarregar a página, é necessário reconectar ao Google para abrir o perfil da conta. O aplicativo mantém a possibilidade de usar o perfil local.
- Use **Copiar dados do perfil local** no perfil Google para transferir os registros existentes. O aplicativo pede confirmação antes de substituir os dados exibidos e enviar a nova cópia.
- O envio automático é agendado após salvar um cadastro ou lançamento. Funciona com a página aberta e autorização Google válida; não é uma tarefa em segundo plano com o navegador fechado.
- Sem rede ou após expiração da autorização, os dados ficam no navegador e o envio aparece pendente. Reconecte e confira o status de envio.
- O Drive usa `appDataFolder`, uma pasta privada do aplicativo; as cópias não aparecem como arquivos comuns no Meu Drive. A API não tem acesso geral aos demais arquivos do seu Drive.
- Cópias são versionadas e imutáveis. O aplicativo não apaga cópias antigas automaticamente. A tela mostra as 20 mais recentes para restauração. Isso consome espaço do seu Drive conforme a quantidade e o tamanho das cópias.
- Alterações simultâneas detectadas entre dispositivos exigem uma escolha explícita; não há mesclagem automática de lançamentos.
- JSON exportado e cópias locais não são criptografados pelo aplicativo. Proteja a sessão do computador. O aplicativo usa HTTPS para o Drive; tokens só ficam na memória da sessão e não entram nos backups.
- A estrutura de perfis é atualmente da versão web. A integração equivalente na versão desktop ainda está pendente.

## Validação final necessária com Google real

1. Entrar com a primeira conta e confirmar a criação automática da cópia no Drive.
2. Cadastrar uma receita; aguardar confirmação do novo envio.
3. Reabrir o aplicativo em outro navegador autorizado, conectar a mesma conta e conferir os registros restaurados.
4. Conectar uma segunda conta e verificar que ela começa sem os registros da primeira.
5. Fazer uma alteração offline, reconectar e confirmar a pendência enviada.
6. Restaurar uma cópia anterior e conferir os valores antes de enviá-la como nova versão.

A suíte `tests/google-profiles.cjs` usa respostas simuladas e **não comprova** que um Client ID ou consentimento real funciona. `tests/profiles-drive.cjs` testa o protocolo de backup com um servidor Google simulado.

Referências oficiais:
- https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/workspace/drive/api/guides/appdata
