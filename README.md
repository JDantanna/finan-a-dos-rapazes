# Finança dos Rapazes

Aplicativo de controle financeiro pessoal, em português, com cálculos em Rust.

[Abrir o aplicativo no GitHub Pages](https://jdantanna.github.io/finan-a-dos-rapazes/)

## Versão online atual

- Receitas e despesas, únicas ou recorrentes.
- Cadastro de fontes de receita, com edição, exclusão e sugestões nos lançamentos.
- Recorrências semanais, a cada 15 dias, mensais e anuais.
- Cadastro de contas correntes, cartões de crédito, cartões de benefícios e dinheiro.
- Compras parceladas no crédito, com datas mensais e divisão exata dos centavos.
- Visão geral com despesas por categoria, tipo de conta e conta/cartão.
- Metas e simulações de economia.
- Relatórios semanais, mensais e anuais; exportação CSV.
- Backup e restauração JSON.
- Formatação monetária durante a digitação.

Os cálculos executam em Rust compilado para WebAssembly. Os dados desta versão ficam no navegador e dispositivo utilizados. Publicar o código no GitHub não faz backup dos seus lançamentos nem sincroniza dispositivos. A integração de perfis Google e cópias no Drive está implementada, mas exige configurar um Client ID OAuth e validar login/envio reais. Veja [GOOGLE_SETUP.md](GOOGLE_SETUP.md).

## Estrutura

| Pasta | Conteúdo |
| --- | --- |
| `dist/` | Interface online atual e módulo WebAssembly compilado |
| `rust-core/` | Código Rust usado pela versão online |
| `tests/` | Testes JavaScript e integração com WebAssembly |
| `scripts/` | Servidor local para experimentar a versão online |
| `desktop/` | Código da versão inicial para Windows, com SQLite local |
| `desktop-app/` | Nova edição Windows com a interface atual, Google Drive e atualizações pelo GitHub |

O diretório `desktop/` contém a implementação inicial com SQLite, mantida como histórico. A nova edição está em [`desktop-app/`](desktop-app/README.md) e reutiliza a interface atual, incluindo parcelas, fontes, PDF, personalização e vencimentos. O instalador e o fluxo de atualização estão implementados; a primeira distribuição funcional depende da configuração única de um cliente OAuth Google do tipo App para computador e da validação no Windows. O workflow gera artefatos de teste e bloqueia a publicação de releases sem configuração Google.

## Executar a versão online localmente

Requisito: Node.js 18 ou superior.

```sh
node scripts/serve.cjs
```

Abra http://localhost:8080 no navegador. Para alterar a porta, defina `PORT`. O endereço de desenvolvimento é local; para acesso remoto, use o link acima.

## Compilar o núcleo Rust

Instale Rust e o alvo WebAssembly:

```sh
rustup target add wasm32-unknown-unknown
cargo build --manifest-path rust-core/Cargo.toml --target wasm32-unknown-unknown --release
```

Copie `rust-core/target/wasm32-unknown-unknown/release/financa_web_core.wasm` para `dist/finance.wasm`.

## Testes

```sh
cargo test --manifest-path rust-core/Cargo.toml
node tests/currency.cjs
node tests/expense-summary.cjs
node tests/installments.cjs
cargo test --manifest-path desktop/Cargo.toml
```

## Versão inicial desktop

Em um ambiente de desenvolvimento com Rust:

```sh
cargo run --manifest-path desktop/Cargo.toml
```

A aplicação abre uma interface no navegador local e salva os dados em SQLite no computador. O destino padrão no Windows é `%APPDATA%/NorteFinancas`, nome interno legado. Pode ser alterado pela variável `NORTE_DATA_DIR`. A execução e distribuição no Windows ainda precisam de validação em Windows.

## Parcelas

Em **Novo lançamento**, escolha **Compra parcelada no crédito**, selecione um cartão cadastrado como cartão de crédito, informe o valor total, o número de parcelas (2 a 120) e a data da primeira parcela na fatura. Cada parcela vira um lançamento único, identificado como 1/4, 2/4 etc. Editar ou excluir uma parcela afeta somente esse lançamento. Centavos restantes são distribuídos nas primeiras parcelas. O programa não consulta faturas bancárias.

## Limitações atuais

- Os relatórios representam previsões dos lançamentos cadastrados; não há conciliação de pagamentos.
- Login Google e backup no Drive dependem da configuração OAuth; ainda não foram validados com Google real. Não há mesclagem automática de alterações entre dispositivos.
- Os relatórios não substituem uma declaração de Imposto de Renda.
- Backup JSON não é criptografado.
- Não envie bases financeiras, backups, senhas ou comprovantes para o repositório.

Uso pessoal. Este repositório não contém dados financeiros reais.


## Publicação no GitHub Pages

Site público: https://jdantanna.github.io/finan-a-dos-rapazes/

A publicação utiliza a branch `gh-pages`, pasta `/ (root)`. Ela contém os arquivos de `dist/` na raiz e `.nojekyll`. Alterações em `main` devem ser refletidas nessa branch para atualizar a página. A configuração atual não faz essa cópia automaticamente.

Ao mudar do endereço anterior para o GitHub Pages, exporte seu backup JSON em Configurações no endereço antigo e restaure-o no novo. Cada origem mantém seus próprios dados locais. O repositório e a página são públicos, mas seus lançamentos não são enviados para o GitHub.

## Perfis Google e revisão

Consulte [GOOGLE_SETUP.md](GOOGLE_SETUP.md) para ativação, limites de salvamento offline e restauração. As três revisões independentes e verificações estão registradas em [CODE_REVIEW_PROFILES.md](CODE_REVIEW_PROFILES.md).

Testes adicionais: `node tests/profiles-drive.cjs` e `node tests/google-profiles.cjs`. Ambos usam respostas simuladas.


### Windows 1.3.0

- Galeria de mais de 500 emojis para categorias, com busca por tema e entrada livre.
- Consulta, download e progresso de atualização dentro da aplicação, inclusive na tela de entrada. O botão Reiniciar e atualizar usa instalação silenciosa, preservando a cópia local e os dados do Drive. Não reinicia com formulários pendentes ou gravação/sincronização em andamento.
- Novo ícone de um pato original segurando notas de reais, aplicado ao executável, instalador, atalhos e janela.

A passagem de uma versão antiga para 1.3.0 ainda usa o atualizador instalado anteriormente. As atualizações seguintes usam a nova interface interna. Uma instalação inicial continua usando o instalador Windows.
