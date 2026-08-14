'use strict'

const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const CACHE = path.resolve(__dirname, '..', '.electron-builder-cache')

// 原生模块系列：scope（相对 node_modules）+ 前缀 + win32-x64 变体名 + 主包路径
// win = null 表示该系列在 win32-x64 目标下完全不需要（如 sharp 的 libvips 平台包）
const NATIVE_SERIES = [
  { scope: '@next', prefix: 'swc-', win: '@next/swc-win32-x64-msvc', host: 'next' },
  { scope: '@napi-rs', prefix: 'canvas-', win: '@napi-rs/canvas-win32-x64-msvc', host: '@napi-rs/canvas' },
  { scope: '@img', prefix: 'sharp-', win: '@img/sharp-win32-x64', host: 'sharp' },
  { scope: '@img', prefix: 'sharp-libvips-', win: null, host: 'sharp' },
]

function installedVariants(nodeModules, scope, prefix) {
  const dir = path.join(nodeModules, ...scope.split('/'))
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((name) => name.startsWith(prefix) && fs.statSync(path.join(dir, name)).isDirectory())
}

function variantPath(nodeModules, name) {
  return path.join(nodeModules, ...name.split('/'))
}

function readWinVersion(nodeModules, host, winName) {
  const pkgPath = path.join(nodeModules, ...host.split('/'), 'package.json')
  if (!fs.existsSync(pkgPath)) return null
  const optionalDeps = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).optionalDependencies ?? {}
  return optionalDeps[winName] ?? null
}

function npmPack(pkgSpec, cacheDir) {
  fs.mkdirSync(cacheDir, { recursive: true })
  execFileSync('npm', ['pack', pkgSpec, '--pack-destination', cacheDir], { stdio: 'inherit' })
  const packed = fs.readdirSync(cacheDir).find((f) => f.endsWith('.tgz'))
  if (!packed) throw new Error(`npm pack 未产出 ${pkgSpec} 的 tgz 到 ${cacheDir}`)
  return path.join(cacheDir, packed)
}

function inject(nodeModules, winName) {
  const targetDir = variantPath(nodeModules, winName)
  if (fs.existsSync(targetDir)) return

  const winVersion = readWinVersion(nodeModules, NATIVE_SERIES.find((s) => s.win === winName)?.host ?? '', winName)
  if (!winVersion) {
    console.warn(`[prune] 无法确定 ${winName} 版本，跳过注入`)
    return
  }

  const cacheDir = path.join(CACHE, winName)
  let tarballPath = path.join(cacheDir, `${winName.replace(/^@/, '').replace(/\//g, '-')}-${winVersion}.tgz`)
  if (!fs.existsSync(tarballPath)) {
    tarballPath = npmPack(`${winName}@${winVersion}`, cacheDir)
  }
  const unpackDir = path.join(cacheDir, 'unpacked')
  fs.rmSync(unpackDir, { recursive: true, force: true })
  fs.mkdirSync(unpackDir, { recursive: true })
  execFileSync('tar', ['-xzf', tarballPath, '-C', unpackDir], { stdio: 'inherit' })
  fs.cpSync(path.join(unpackDir, 'package'), targetDir, { recursive: true })
  console.log(`[prune] injected ${winName}@${winVersion}`)
}

function remove(nodeModules, scopedName) {
  const dir = variantPath(nodeModules, scopedName)
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
    console.log(`[prune] removed ${scopedName}`)
  }
}

// 删除非 win32-x64 平台二进制，注入 win32-x64 变体。幂等。
function pruneNodeModules(nodeModules) {
  for (const { scope, prefix, win } of NATIVE_SERIES) {
    const installed = installedVariants(nodeModules, scope, prefix)
    if (installed.length === 0) continue

    if (win === null) {
      for (const name of installed) remove(nodeModules, `${scope}/${name}`)
      continue
    }

    const winDirName = win.split('/').pop()
    for (const name of installed) {
      if (name === winDirName) continue
      remove(nodeModules, `${scope}/${name}`)
    }
    inject(nodeModules, win)
  }
}

module.exports = { pruneNodeModules }

if (require.main === module) {
  const DIST_APP = path.resolve(__dirname, '..', 'dist-app')
  pruneNodeModules(path.join(DIST_APP, 'node_modules'))
}
