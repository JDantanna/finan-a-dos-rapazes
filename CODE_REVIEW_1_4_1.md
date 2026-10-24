# Revisão em três instâncias — Windows 1.4.1

A revisão foi dividida entre três revisores independentes, com nova conferência das correções: desempenho; integridade e sincronização; interface e manutenção. O objetivo foi reduzir trabalho repetido e corrigir falhas concretas, preservando validações, criptografia, backups e escrita condicional.

## 1. Desempenho

- Um único `Intl.NumberFormat` atende os valores monetários. Antes havia uma construção por célula. O microbenchmark do revisor, com 20 mil formatações, mediu aproximadamente 578 ms recriando contra 11 ms reutilizando; isso é uma medida isolada, não uma estimativa de aceleração geral do aplicativo.
- Relatórios compartilham cálculos em andamento e reaproveitam até três resultados. A chave considera identidade do estado, intervalo e dia atual; uma alteração dos dados invalida os resultados e falhas não ficam retidas no cache.
- O payload enviado ao núcleo Rust contém apenas `entries`, `goals` e `demo`, os campos financeiros consumidos por ele. Cadastros e preferências continuam sendo validados integralmente antes do salvamento.
- Lançamentos, relatórios e planilha exibem até 100 linhas por página. Os totais, exportações e filtros continuam considerando todos os registros; o acumulado da planilha inclui páginas anteriores.
- O envio pendente usa diretamente a leitura condicional já feita por `FinanceDrive.saveFinance`. No fluxo normal, depois da localização inicial, são três GETs a menos: oito requisições viram cinco, sem contar OAuth. Idempotência, revisão, ETag e backup permanecem ativos.
- A inicialização do Drive é compartilhada entre chamadas simultâneas. No salvamento direto, a conta é verificada antes de criar pasta ou arquivo.

## 2. Integridade e sincronização

- Manter a cópia local em um conflito agora marca explicitamente o envio como pendente, inclusive quando a cópia recuperada estava marcada como limpa.
- Usar a versão do Drive revalida a revisão local depois da consulta. Uma edição feita durante a espera exige nova escolha e permanece na interface.
- A atualização da cópia na interface revalida rascunhos, salvamento e identidade do registro após a resposta assíncrona, evitando substituir um formulário iniciado durante a espera.
- O fechamento bloqueia novas chamadas antes de aguardar as gravações locais. Se a gravação falhar, o aplicativo permanece aberto e retoma a sincronização periódica.
- Os testes cobrem resposta de upload perdida, retomada sem duplicação, conflito, edição durante upload, falha de disco e isolamento de contas.

## 3. Interface e manutenção

- Avisos funcionam em diálogos com ou sem formulário, incluindo vencimentos e atualização. O código anterior tentava acrescentar a mensagem a um formulário inexistente.
- O atualizador consulta o progresso apenas durante operações ativas, sem sobrepor consultas. Estados estáveis deixam de gerar polling contínuo. Avisos locais de rascunho e falhas permanecem visíveis até a próxima ação.
- Âncoras críticas dos geradores são verificadas; o build falha se o adaptador desktop, título ou política de conteúdo não forem gerados como esperado.
- Foi removido o método obsoleto de restauração direta do Drive. A restauração atual passa pela cópia local; a validação de propriedade dos backups continua testada diretamente.
- O workflow Windows passou a executar toda a suíte JavaScript/WASM, além dos testes específicos do desktop.

## Validação e limites

- `python3 scripts/build-desktop.py`: geração da interface e dos validadores compartilhados.
- `node --test tests/*.cjs desktop-app/test/*.test.cjs`: 51 testes aprovados localmente.
- `node --check` no processo principal e na interface gerada: aprovado.
- O executável Windows é compilado e a mesma suíte é executada no GitHub Actions antes da publicação.
- O núcleo Rust não foi alterado. As integrações com o binário WASM foram testadas; os testes nativos Cargo não puderam ser executados neste ambiente porque o compilador não está instalado.
- As pastas históricas e arquivos exclusivos da edição web já ficam fora do pacote Electron. Apagá-los não reduziria o instalador; foram preservados. A otimização do avanço de recorrências muito antigas ficou fora desta correção por exigir uma alteração matemática com maior risco.
- Os testes de rede usam respostas controladas. A revisão não substitui uma medição do aplicativo instalado com os dados reais do usuário.
