# Revisão de perfil e PDF

- Identidade continua vinculada à conta ativa e à conta de execução, com bloqueio de divergência; metadados de nome/foto não alteram a chave dos dados.
- Perfil usa o escopo existente drive.file. Nenhum token OAuth é enviado ao navegador.
- Nome, descrições, categorias e fontes são escapados no HTML do relatório. URLs externas não são aceitas no PDF.
- Exportação exige a mesma identidade, valida datas/período, limita ocorrências, calcula totais em centavos inteiros e protege chaves especiais no agrupamento.
- Exportação não modifica registros nem cria cópias financeiras públicas. CSV continua disponível.
- Testes: oito grupos de Apps Script aprovados; PDF real A4 baixado e renderizado sem defeitos na base vazia.
- Limites: imagem ausente usa inicial, falha de metadados usa e-mail; cotas Google podem limitar conversões. Segunda conta e relatório preenchido não foram validados no Google real.
