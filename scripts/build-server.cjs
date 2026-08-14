'use strict'

const esbuild = require('esbuild')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'dist-server')

// 后端运行所需的生产依赖（npm 解析传递依赖）。
// 只列 external 的原生/资源型包；纯 JS 依赖（hono/zod/docx/mammoth/undici 等）
// 已被 esbuild bundle 进 server.js，无需安装。
const BACKEND_DEPS = {
  '@napi-rs/canvas': '1.0.5',
  '@tesseract.js-data/chi_sim': '1.0.0',
  'pdfjs-dist': '6.2.108',
  pdfmake: '0.3.11',
  'tesseract.js': '7.0.0',
}

// 原生/资源型依赖必须 external（.node/.wasm/worker/langdata/base64 字体无法 bundle）
const external = Object.keys(BACKEND_DEPS).filter((name) =>
  /canvas|pdfjs|tesseract|pdfmake/.test(name),
)

console.log('[build-server] esbuild bundle')
fs.mkdirSync(OUT, { recursive: true })
esbuild.buildSync({
  entryPoints: [path.join(ROOT, 'server', 'index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: path.join(OUT, 'server.js'),
  external,
  alias: { '@': ROOT },
  sourcemap: false,
  minify: false,
})

console.log('[build-server] write backend package.json')
fs.writeFileSync(
  path.join(OUT, 'package.json'),
  `${JSON.stringify({ name: 'aigc-server', private: true, version: '0.1.0', dependencies: BACKEND_DEPS }, null, 2)}\n`,
  'utf8',
)

console.log('[build-server] npm install backend deps')
execFileSync(
  'npm',
  ['install', '--omit=dev', '--no-audit', '--no-fund', '--ignore-scripts', '--prefix', OUT],
  { stdio: 'inherit' },
)

console.log('[build-server] prune to win32-x64 native binaries')
const { pruneNodeModules } = require('./prune-node-modules.cjs')
pruneNodeModules(path.join(OUT, 'node_modules'))

console.log('[build-server] trim pdfmake built-in fonts (custom NotoSansSC used)')
for (const rel of [
  'node_modules/pdfmake/build/vfs_fonts.js',
  'node_modules/pdfmake/build/fonts',
  'node_modules/pdfmake/build/standard-fonts',
]) {
  fs.rmSync(path.join(OUT, rel), { recursive: true, force: true })
}

console.log('[build-server] remove unreferenced packages')
for (const rel of [
  'node_modules/@swc',
  'node_modules/@noble',
]) {
  fs.rmSync(path.join(OUT, rel), { recursive: true, force: true })
}

console.log('[build-server] trim pdfjs-dist to legacy build only')
for (const rel of [
  'node_modules/pdfjs-dist/build',
  'node_modules/pdfjs-dist/web',
  'node_modules/pdfjs-dist/wasm',
  'node_modules/pdfjs-dist/types',
  'node_modules/pdfjs-dist/image_decoders',
  // 注意：standard_fonts 保留——legacy 的 page.render() 对标准-14 字体的 PDF 需要它
]) {
  fs.rmSync(path.join(OUT, rel), { recursive: true, force: true })
}

console.log('[build-server] copy pdf font (subset)')
const fontSource = path.join(ROOT, 'assets', 'fonts', 'NotoSansSC-subset.ttf')
if (!fs.existsSync(fontSource)) {
  console.warn('[build-server] 未找到子集字体，回退全量字体')
  fs.cpSync(path.join(ROOT, 'assets', 'fonts', 'NotoSansSC.ttf'), path.join(OUT, 'assets', 'fonts', 'NotoSansSC-subset.ttf'))
} else {
  fs.cpSync(fontSource, path.join(OUT, 'assets', 'fonts', 'NotoSansSC-subset.ttf'))
}

console.log('[build-server] copy default rule library')
fs.mkdirSync(path.join(OUT, 'rules'), { recursive: true })
fs.cpSync(
  path.join(ROOT, 'rules', 'ai-writing-rules.json'),
  path.join(OUT, 'rules', 'ai-writing-rules.json'),
)

console.log('[build-server] prune tesseract.js-core to Node-22 variants')
pruneTesseractCore(path.join(OUT, 'node_modules', 'tesseract.js-core'))

function pruneTesseractCore(coreDir) {
  if (!fs.existsSync(coreDir)) return
  // Node 22 x64 支持 relaxed SIMD，getCore 优先用 relaxedsimd-lstm；
  // 保留 simd-lstm（SIMD 但不支持 relaxed）与 tesseract-core-lstm（非 SIMD 老机器回退）
  // 以及 tesseract-core 入口（index.js require 它），删除其余变体
  const keepVariants = [
    'tesseract-core-relaxedsimd-lstm',
    'tesseract-core-simd-lstm',
    'tesseract-core-lstm',
  ]
  const keepExact = new Set([
    'index.js',
    'package.json',
    'README.md',
    'LICENSE',
    'tesseract-core.js',
    'tesseract-core.wasm',
    'tesseract-core.wasm.js',
  ])
  for (const name of fs.readdirSync(coreDir)) {
    const keep = keepExact.has(name) || keepVariants.some((variant) => name.startsWith(variant))
    if (keep) continue
    const p = path.join(coreDir, name)
    fs.rmSync(p, { recursive: true, force: true })
    console.log(`[build-server] pruned ${name}`)
  }
}
