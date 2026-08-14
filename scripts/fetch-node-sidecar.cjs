'use strict'
// 下载 Windows node.exe 作为 Tauri sidecar（Tauri externalBin 命名约定）
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const VERSION = '22.22.1'
const TARGET = 'x86_64-pc-windows-msvc'
const DEST_DIR = path.resolve(__dirname, '..', 'src-tauri', 'binaries')
const DEST = path.join(DEST_DIR, `node-${TARGET}.exe`)

if (fs.existsSync(DEST)) {
  console.log(`[sidecar] 已存在 ${DEST}`)
  process.exit(0)
}

const tmp = path.join(require('node:os').tmpdir(), `node-${VERSION}-win.zip`)
const url = `https://npmmirror.com/mirrors/node/v${VERSION}/node-v${VERSION}-win-x64.zip`
console.log(`[sidecar] 下载 ${url}`)
execFileSync('curl', ['-sL', '-m', '600', '-o', tmp, url], { stdio: 'inherit' })

fs.mkdirSync(DEST_DIR, { recursive: true })
const { execSync } = require('node:child_process')
const { createRequire } = require('node:module')
// 用 python 解压（无 unzip）
const extractDir = path.join(require('node:os').tmpdir(), `node-${VERSION}-win`)
fs.rmSync(extractDir, { recursive: true, force: true })
fs.mkdirSync(extractDir, { recursive: true })
execSync(`python3 -c "import zipfile; zipfile.ZipFile('${tmp}').extractall('${extractDir}')"`, { stdio: 'inherit' })
fs.copyFileSync(path.join(extractDir, `node-v${VERSION}-win-x64`, 'node.exe'), DEST)
console.log(`[sidecar] 已安装 ${DEST}`)
