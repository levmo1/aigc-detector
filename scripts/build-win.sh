#!/usr/bin/env bash
set -euo pipefail

# 构建 Windows 安装包（MSVC 交叉编译 + NSIS）
# 前置：cargo-xwin、rustup target x86_64-pc-windows-msvc、llvm-rc、makensis
cd "$(dirname "$0")/.."

# 确保 cargo / 本地工具链在 PATH（按你的环境自行配置）
export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"
export PKG_CONFIG_PATH="${PKG_CONFIG_PATH:-}:$HOME/.local/lib/pkgconfig"

# cargo-xwin 下载的 sysroot 不包含资源编译器；优先使用系统 llvm-rc，
# 再兼容 Codex/Linux 环境里常见的 llvm-mingw 安装目录。
if ! command -v llvm-rc >/dev/null 2>&1; then
  for llvm_dir in "$HOME"/.local/mingw/llvm-mingw-*/bin; do
    if [[ -x "$llvm_dir/llvm-rc" ]]; then
      export PATH="$llvm_dir:$PATH"
      break
    fi
  done
fi

if ! command -v llvm-rc >/dev/null 2>&1; then
  echo '[build] 错误：未找到 llvm-rc，请先安装 LLVM 或 llvm-mingw。' >&2
  exit 1
fi

echo '[build] 前端构建'
npm run frontend:build

echo '[build] 后端 dist-server'
node scripts/build-server.cjs

echo '[build] 交叉编译 + NSIS 打包（cargo-xwin）'
npx tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc

echo '[build] 完成：src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/'
ls -lh src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe
