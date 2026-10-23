# Revisão de perfis Google e backup no Drive

Três revisões independentes foram realizadas após a implementação, seguidas de correções e nova inspeção dos revisores.

| Revisão | Foco | Correções aplicadas |
| --- | --- | --- |
| 1 | Segurança e isolamento | Checkpoints de perfil antes/depois de operações assíncronas; reconexão Google para abrir perfis; tokens apenas em memória; indicação de backup dependente de confirmação |
| 2 | Persistência e concorrência | Proteção de restauração/importação durante troca de perfil; fila de envio preservada; detecção conservadora de versões concorrentes; cópias imutáveis |
| 3 | Eficiência e código sem uso | Reuso do relatório do mês atual; cache do parse do perfil; remoção de renderização duplicada e CSS sem uso; atualização visual na expiração; eventos entre abas limitados à base ativa |

## Verificações

- 10 testes do núcleo Rust.
- 8 grupos de testes de perfis e Drive com respostas simuladas.
- 5 grupos de testes da integração OAuth e do adaptador com respostas simuladas.
- Regressões de fontes de receita, parcelas, formatação monetária e resumo de contas.
- Interface real: navegação em Perfis, aviso de configuração pendente e cadastro/persistência do perfil local sem OAuth.

Não foram adicionados frameworks ou dependências de runtime. O login usa a biblioteca oficial Google Identity Services, carregada diretamente do Google; o Drive é acessado via REST.

## Limite da verificação

O Client ID OAuth ainda não está configurado. O Google Cloud Console estava inacessível no navegador de execução. Login, consentimento, criação e restauração de arquivos contra o Google real ainda precisam da configuração e do roteiro em [GOOGLE_SETUP.md](GOOGLE_SETUP.md). Os testes simulados não substituem essa validação.
