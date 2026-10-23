# Finança dos Rapazes

Aplicativo de controle financeiro pessoal, em português, com cálculos em Rust.

[Abrir o aplicativo no GitHub Pages](https://jdantanna.github.io/finan-a-dos-rapazes/)

## Versão online atual

- Receitas e despesas, únicas ou recorrentes.
- Recorrências semanais, a cada 15 dias, mensais e anuais.
- Cadastro de contas correntes, cartões de crédito, cartões de benefícios e dinheiro.
- Compras parceladas no crédito, com datas mensais e divisão exata dos centavos.
- Visão geral com despesas por categoria, tipo de conta e conta/cartão.
- Metas e simulações de economia.
- Relatórios semanais, mensais e anuais; exportação CSV.
- Backup e restauração JSON.
- Formatação monetária durante a digitação.

Os cálculos executam em Rust compilado para WebAssembly. Os dados desta versão ficam no navegador e dispositivo utilizados. Publicar o código no GitHub não faz backup dos seus lançamentos nem sincroniza dispositivos. Google Drive ainda não está implementado.

## Estrutura

| Pasta | Conteúdo |
| --- | --- |
| `dist/` | Interface online atual e módulo WebAssembly compilado |
| `rust-core/` | Código Rust usado pela versão online |
| `tests/` | Testes JavaScript e integração com WebAssembly |
| `scripts/` | Servidor local para experimentar a versão online |
| `desktop/` | Código da versão inicial para Windows, com SQLite local |

**A versão desktop é anterior às alterações mais recentes da versão online.** O cadastro de contas e cartões, o parcelamento e o resumo por conta implementados na versão online ainda precisam ser integrados ao desktop. Nenhum executável Windows é distribuído neste repositório.

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
- A nuvem, a sincronização entre dispositivos e o login Google ainda estão pendentes.
- Os relatórios não substituem uma declaração de Imposto de Renda.
- Backup JSON não é criptografado.
- Não envie bases financeiras, backups, senhas ou comprovantes para o repositório.

Uso pessoal. Este repositório não contém dados financeiros reais.


## Publicação no GitHub Pages

Site público: https://jdantanna.github.io/finan-a-dos-rapazes/

A publicação utiliza a branch `gh-pages`, pasta `/ (root)`. Ela contém os arquivos de `dist/` na raiz e `.nojekyll`. Alterações em `main` devem ser refletidas nessa branch para atualizar a página. A configuração atual não faz essa cópia automaticamente.

Ao mudar do endereço anterior para o GitHub Pages, exporte seu backup JSON em Configurações no endereço antigo e restaure-o no novo. Cada origem mantém seus próprios dados locais. O repositório e a página são públicos, mas seus lançamentos não são enviados para o GitHub.
