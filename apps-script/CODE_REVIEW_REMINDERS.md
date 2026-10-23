# Revisão de vencimentos recorrentes

- O vencimento é a data de cada ocorrência calculada pelo núcleo Rust existente, sem duplicar regras de calendário no cliente.
- Janela de hoje até a antecedência escolhida; sem suposição de pagamento ou inadimplência.
- Popup automático somente para hoje, deduplicado por sessão e adiado enquanto há outro diálogo.
- Checagem condicionada à identidade/revisão atual; aguarda salvamento antes de calcular a nova lista. Não há consultas de rede por minuto: calendário usa o estado carregado e WASM.
- Avisos dispensados persistem por conta no mesmo JSON, com limite de mil chaves e validação no servidor; backups e restauração preservam os avisos.
- Nomes e descrições escapados na interface; nenhuma permissão Google nova. Controles de aparência preservam as preferências de lembretes.
- Testes reais do Rust: semana, quinze dias, mês curto, ano bissexto, fim da série e exclusão de lançamentos únicos.
- Testes simulados de popup: abrir hoje, evitar repetição na sessão, desativar, dispensar, aguardar salvamento e outro diálogo.
- Versão 6 publicada na mesma implantação. Formulário, configurações e diálogo vazio conferidos no Google real; popup com ocorrência real não testado para evitar adicionar dados financeiros fictícios.
