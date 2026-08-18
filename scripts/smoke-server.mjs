import { spawn } from 'node:child_process'
import { once } from 'node:events'
import path from 'node:path'

const dir = process.argv[2]
if (!dir) throw new Error('usage: node scripts/smoke-server.mjs <dir>')

const serverDir = path.resolve(dir, 'dist-server')
const serverPath = path.join(serverDir, 'server.js')
const child = spawn(process.execPath, [serverPath, '0'], {
  cwd: serverDir,
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stdout = ''
let stderr = ''
child.stdout.on('data', (chunk) => {
  stdout += chunk.toString()
})
child.stderr.on('data', (chunk) => {
  stderr += chunk.toString()
})
const closed = once(child, 'close')

const ready = /AIGC-SERVER-READY (\d+)/
const readyTimeout = new Promise((_, reject) => {
  setTimeout(() => {
    child.kill('SIGKILL')
    reject(new Error('timed out waiting for AIGC-SERVER-READY (30s)'))
  }, 30_000).unref()
})

let port
for (;;) {
  const match = stdout.match(ready)
  if (match) { port = Number(match[1]); break }
  if (child.exitCode !== null) {
    throw new Error(`server exited (code ${child.exitCode}) before ready:\n${stdout}\n${stderr}`)
  }
  await Promise.race([once(child.stdout, 'data'), closed, readyTimeout])
}

const response = await fetch(`http://127.0.0.1:${port}/api/status`, {
  signal: AbortSignal.timeout(30_000),
})
console.log(`smoke status: ${response.status}`)
if (response.status !== 200) throw new Error('expected 200')

child.kill('SIGTERM')
const exited = once(child, 'exit')
setTimeout(() => child.kill('SIGKILL'), 10_000).unref()
await exited
console.log('SMOKE OK')
