import { build } from 'esbuild'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = process.cwd()
const data = mkdtempSync(path.join(os.tmpdir(), 'aigc-e2e-'))
const outfile = path.join(root, 'node_modules/.cache/aigc-e2e/server.cjs')
let child
const cleanup = () => rmSync(data, { recursive: true, force: true })
try {
  await build({ entryPoints: ['server/index.ts'], bundle: true, platform: 'node', format: 'cjs', packages: 'external', alias: { '@': root }, outfile })
  child = spawn(process.execPath, [outfile, '3211'], {
    stdio: 'inherit',
    env: { ...process.env, DETECTOR_PROVIDER: 'rule', MAX_REQUESTS_PER_MINUTE: '100', DATA_DIR: path.join(data, 'data'), CONFIG_DIR: path.join(data, 'config'), RULES_DIR: path.join(data, 'rules') },
  })
  child.once('error', (error) => { console.error(error); cleanup(); process.exitCode = 1 })
  child.once('exit', (code) => { cleanup(); process.exitCode = code ?? 0 })
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
} catch (error) { cleanup(); throw error }
