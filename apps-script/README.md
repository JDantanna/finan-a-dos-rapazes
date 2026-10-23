# Finança dos Rapazes no Google Apps Script

Esta edição foi preparada para hospedar o aplicativo no Google e salvar os registros numa pasta visível no Drive de cada usuário. Os arquivos soltos de um site dentro de uma pasta do Drive não são um site executável.

## Situação desta entrega

Versão 2 publicada no Google Apps Script. Nome da conta Google e download de PDF foram confirmados na aplicação real.

[Abrir aplicativo](https://script.google.com/macros/s/AKfycbwOkdb82APBmRG7z1C7tSSurWCsrs0eEZNbF9V9OjBpE6TcF2dmk6D0qvef5goFa8asKQ/exec).

## Instalar uma vez na conta do proprietário

1. Crie um projeto independente no Google Apps Script.
2. Copie o conteúdo de `Code.gs` para o arquivo de código do projeto.
3. Crie um arquivo HTML chamado `Index` e copie o conteúdo integral de `Index.html`.
4. Nas configurações do projeto, habilite a exibição do manifesto `appsscript.json` e substitua seu conteúdo pelo manifesto desta pasta. Ele habilita o serviço avançado Drive v3 e usa o escopo `drive.file`, limitado aos arquivos usados/criados pelo aplicativo.
5. Use **Implantar → Nova implantação → Aplicativo da Web**.
6. Selecione **Executar como: usuário que acessa o aplicativo da Web** e acesso para **qualquer pessoa com uma conta Google**. Nunca publique para executar como você ao compartilhar o aplicativo com outras pessoas. O código também bloqueia execução quando a conta ativa e a conta de execução diferem.
7. Autorize as permissões solicitadas pelo Google e conclua a publicação. Cada visitante também precisará autorizar o aplicativo na própria conta. As políticas do Google podem exigir verificação adicional conforme a configuração do projeto e o público; não é possível prometer acesso sem avisos antes de testar a implantação.
8. Abra o endereço terminado em `/exec`, cadastre um lançamento de teste, reabra o link e confira o arquivo `financas.json` na pasta **Finança dos Rapazes** do seu Drive.
9. Teste uma segunda conta Google antes de compartilhar amplamente. Ela deve começar com uma pasta e base vazias, sem acesso às suas finanças.

Não é necessário copiar um Client ID ou Client Secret para esta edição: a autorização é administrada pelo próprio Apps Script. O serviço Drive precisa estar habilitado; em projetos Cloud padrão, habilitar o serviço avançado no Apps Script habilita a API correspondente. Projetos Cloud próprios podem exigir a ativação manual da API.

## Compartilhar e usar

- Compartilhe o **link do aplicativo**, não a pasta que contém suas finanças.
- Cada conta Google terá a própria pasta **Finança dos Rapazes**, um arquivo atual `financas.json` e backups das versões anteriores.
- O projeto Apps Script pode ser organizado em uma pasta do seu Drive. Copiar o projeto para outra conta não copia automaticamente a implantação; quem fizer uma cópia precisa publicar a própria cópia.
- O aplicativo não grava senhas ou tokens de autorização nos seus arquivos. Os tokens usados para acessar o Drive ficam no servidor Apps Script.
- Os arquivos JSON de finanças não são criptografados pelo aplicativo; mantenha a pasta privada.
- Esta edição exige internet para carregar e salvar. Sem confirmação do servidor, a interface não informa que o salvamento foi concluído.
- Duas abas ou dispositivos tentando substituir versões diferentes recebem um aviso de conflito. Não há mesclagem automática. Cada salvamento confirmado preserva a versão anterior em um arquivo de backup.
- Há limite de 4 MB por arquivo. Backups consomem espaço no seu Drive e não são apagados automaticamente. A interface lista as 20 cópias mais recentes.
- O Apps Script possui cotas e limitações do Google. Esta edição é destinada a uso pessoal; não foi validada para distribuição em grande escala.

## Transferir dados existentes

Na versão GitHub Pages, vá a **Configurações → Baixar cópia JSON**. Abra o link Apps Script usando a conta Google correta e escolha **Configurações → Restaurar cópia JSON**. O aplicativo pede confirmação antes de substituir a base exibida; a versão anterior permanece como backup no Drive.

## Atualizar o código

O núcleo financeiro continua sendo Rust compilado para WebAssembly. A interface é reaproveitada a partir de `dist/` e empacotada no HTML para dispensar arquivos externos e hospedagem no GitHub durante a execução.

```sh
python scripts/build-apps-script.py
node tests/apps-script.cjs
```

Depois de alterar os arquivos no editor Apps Script, atualize a implantação para uma **nova versão**. Alterar apenas o código salvo não atualiza automaticamente o link `/exec` já publicado.

O arquivo `Index.html` é gerado. `client.js` e `view.js` são fontes do empacotamento, não arquivos de servidor para copiar ao editor. `.claspignore` limita um envio opcional por clasp aos três arquivos implantáveis.

## Testes executados

Oito grupos de testes locais usam serviços Google simulados: isolamento por usuário, idempotência, conflitos, restauração, bloqueio de conta incorreta, validação de dados e erro de upload. O HTML gerado é validado sintaticamente e contém o módulo Rust.

Esses testes não substituem a publicação, a autorização Google e a validação real em duas contas.

## Perfil e exportação PDF

O nome e a foto são consultados com `Drive.About.get` para a conta que está executando o aplicativo, sem novos escopos. Se a foto não estiver disponível, a interface apresenta a inicial do nome. Uma falha temporária na consulta do perfil preserva o acesso financeiro e usa o e-mail como identificação.

Em **Relatórios**, selecione o período e escolha **Exportar PDF** ou **Exportar CSV**. O PDF A4 contém somente a identificação do usuário, período, totais, todos os lançamentos previstos e despesas por conta/cartão. Não inclui a marca do aplicativo. A conversão ocorre no Google, sem gravar um PDF adicional no Drive; o download usa os dados já carregados na tela. O limite é de 10.000 ocorrências por relatório, sujeito às cotas de conversão do Apps Script.

Validação real: versão 2, nome Rafael Dantanna e PDF de outubro/2026 baixado, aberto e revisado visualmente. A base acessada estava vazia; detalhes preenchidos, centavos, escaping e isolamento foram cobertos em testes simulados. Não foi feito teste real com uma segunda conta.

## Atualização preparada: filtro de fonte de despesa

Em **Relatórios**, o seletor **Lançamentos** permite receitas e despesas ou somente despesas. O seletor **Fonte de despesa (conta ou cartão)** oferece os cadastros e os nomes usados em despesas antigas. Selecionar uma fonte ativa somente despesas dessa fonte; receitas com o mesmo nome são excluídas. O período selecionado continua sendo respeitado. A tabela, os totais, CSV e PDF compartilham o mesmo filtro. O PDF identifica a fonte, inclusive quando não há despesas no período.

Esta atualização está preparada no código, mas não foi publicada no link `/exec`: a sessão do navegador de administração não pôde ser retomada. Para aplicá-la, substitua `Código.gs` pelo conteúdo de `Code.gs`, substitua `Index.html` pelo HTML gerado e use **Implantar → Gerenciar implantações → Editar → Nova versão → Implantar**. As permissões não mudaram. O arquivo `report-filter.js` é fonte do empacotamento e não deve ser adicionado separadamente ao projeto Apps Script.

Testes adicionais: filtros com várias fontes, receitas homônimas excluídas, centavos, fontes antigas, período vazio e validação do filtro no PDF. Não houve teste desta alteração no Google real.
