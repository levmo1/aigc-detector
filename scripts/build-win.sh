#!/usr/bin/env bash
set -euo pipefail

# 构建 Windows 安装包（MSVC 交叉编译 + NSIS）
# 前置：cargo-xwin、rustup target x86_64-pc-windows-msvc、makensis、appindicator pkg-config
cd "$(dirname "$0")/.."

# 确保 cargo / 本地工具链在 PATH（按你的环境自行配置）
export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"
export PKG_CONFIG_PATH="${PKG_CONFIG_PATH:-}:$HOME/.local/lib/pkgconfig"

echo '[build] 前端构建'
npm run frontend:build

echo '[build] 后端 dist-server'
node scripts/build-server.cjs

echo '[build] 交叉编译 + NSIS 打包（cargo-xwin）'
npx tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc

echo '[build] 完成：src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/'
ls -lh src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe
