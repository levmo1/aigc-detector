import { spawn } from 'node:child_process'
import { once } from 'node:events'

const dir = process.argv[2]
if (!dir) throw new Error('usage: node scripts/smoke-server.mjs <dir>')

const child = spawn(process.execPath, ['electron/server.cjs', dir], {
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stdout = ''
child.stdout.on('data', (chunk) => {
  stdout += chunk.toString()
})
const closed = once(child, 'close')

const ready = /AIGC-DETECTOR-READY (\d+)/
const readyTimeout = new Promise((_, reject) => {
  setTimeout(() => {
    child.kill('SIGKILL')
    reject(new Error('timed out waiting for AIGC-DETECTOR-READY (30s)'))
  }, 30_000).unref()
})

let port
for (;;) {
  const match = stdout.match(ready)
  if (match) { port = Number(match[1]); break }
  if (child.exitCode !== null) {
    throw new Error(`server exited (code ${child.exitCode}) before ready:\n${stdout}`)
  }
  await Promise.race([once(child.stdout, 'data'), closed, readyTimeout])
}

const response = await fetch(`http://127.0.0.1:${port}/`, {
  signal: AbortSignal.timeout(30_000),
})
console.log(`smoke status: ${response.status}`)
if (response.status !== 200) throw new Error('expected 200')

child.kill('SIGTERM')
const exited = once(child, 'exit')
setTimeout(() => child.kill('SIGKILL'), 10_000).unref()
await exited
console.log('SMOKE OK')
