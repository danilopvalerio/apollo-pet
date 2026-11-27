#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ $(uname -s) == Linux ]] || { echo 'Execute em Linux.'; exit 1; }
command -v cargo >/dev/null || { echo 'Instale Rust/Cargo e as dependências Linux.'; exit 1; }
export CARGO_TARGET_DIR="$PWD/src-tauri/target"
bundle="$CARGO_TARGET_DIR/release/bundle/deb"
rm -rf "$bundle"
rm -f production/linux/desktop-pets.deb
npm install --no-audit --no-fund
npm test
npm run tauri -- build --bundles deb
shopt -s nullglob
packages=("$bundle"/*.deb)
[[ ${#packages[@]} -eq 1 ]] || { echo 'Pacote Debian ausente ou ambíguo.'; exit 1; }
mkdir -p production/linux
cp "${packages[0]}" production/linux/desktop-pets.deb
sha256sum production/linux/desktop-pets.deb
