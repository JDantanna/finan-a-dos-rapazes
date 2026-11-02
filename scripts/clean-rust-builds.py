#!/usr/bin/env python3
"""Remove only this project's disposable Cargo build directories, never user data."""
from pathlib import Path
import shutil


def clean(root):
    root = Path(root).resolve()
    removed = []
    for crate in (root, root / 'rust-core', root / 'desktop'):
        if crate.is_symlink():
            raise RuntimeError(f'Recusa de limpeza de crate simbólico: {crate}')
        if not (crate / 'Cargo.toml').is_file():
            continue
        target = crate / 'target'
        if target.is_symlink():
            raise RuntimeError(f'Recusa de limpeza de link simbólico: {target}')
        if not target.exists():
            continue
        if not target.is_dir() or target.resolve().parent != crate.resolve():
            raise RuntimeError(f'Diretório de build inesperado: {target}')
        shutil.rmtree(target)
        removed.append(str(target.relative_to(root)))
    return removed


if __name__ == '__main__':
    for item in clean(Path(__file__).resolve().parents[1]):
        print(f'Build Rust removido: {item}')
    print('Limpeza Rust concluída; fontes, WASM distribuído e dados do usuário preservados.')
