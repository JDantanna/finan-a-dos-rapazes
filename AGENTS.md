# Rotina de manutenção

Depois de cada pedido de desenvolvimento, teste ou atualização neste repositório, execute:

```sh
python scripts/clean-rust-builds.py
```

A limpeza deve acontecer também se um teste ou build falhar. O script remove apenas os diretórios `target` dos crates deste projeto. Copie os binários/WASM que serão distribuídos para o destino final antes de limpar.

Nunca apague o cache financeiro local, arquivos de perfis, credenciais, backups do usuário ou o cache global de outros projetos. Não remova `dist/finance.wasm` nem os arquivos de uma versão publicada. Ao introduzir uma nova rotina de build/teste, preserve a limpeza no encerramento.
