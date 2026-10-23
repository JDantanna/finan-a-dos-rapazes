# Revisão do filtro de fonte

- Um único seletor puro fornece as ocorrências e os totais para a tela e ambas as exportações.
- O filtro é aplicado às ocorrências do relatório Rust já restritas ao período. Não modifica parcelas, lançamentos ou o arquivo no Drive.
- Ao escolher uma fonte específica, receitas são sempre excluídas, mesmo que tenham o mesmo nome de origem.
- Fontes antigas permanecem selecionáveis; fontes sem despesa no período mostram resultado vazio, sem retornar silenciosamente a todas.
- PDF identifica o filtro e valida que todas as linhas pertencem à fonte/tipo selecionados. CSV mantém proteção contra fórmulas.
- Nomes de fonte são escapados no HTML e higienizados apenas no nome do arquivo. Valores permanecem em centavos inteiros.
- Gerador elimina as funções antigas de relatório e CSV antes de incorporar a edição Apps Script, evitando código morto de exportação.
- Testes report-filter, apps-script (9 grupos) e installments passaram. Versão 3 publicada na implantação existente. Interface e opção Somente despesas confirmadas no Google real com base vazia. Teste do download filtrado não foi concluído nesta sessão.
