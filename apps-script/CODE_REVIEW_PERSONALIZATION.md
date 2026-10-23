# Revisão de personalização

- Preferências no estado privado de cada usuário; nenhuma mudança em identidade, escopos ou chave da pasta Drive.
- Validação central no servidor: cor hexadecimal, nomes/títulos com no máximo 80 caracteres, valores padrão para arquivos antigos.
- Exibição por textContent/HTML escapado; a cor não admite CSS arbitrário.
- Atualização visual após confirmação de salvamento; erro no Drive preserva a versão exibida.
- Preferências preservadas nos fluxos de backup JSON, restauração, demonstração e remoção da demonstração.
- PDF usa o nome personalizado salvo no Drive, com fallback para o nome Google.
- Contraste de botões principais escolhido pela luminosidade; interface real confirmada na versão 4.
- Dez grupos de testes Apps Script e testes de filtros passaram. Versão 4 publicada na mesma implantação. Salvamento e recarga reais passaram; conflito entre abas bloqueado sem sobrescrita e preferências mais recentes preservadas.
