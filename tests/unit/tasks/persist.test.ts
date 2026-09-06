// @vitest-environment node
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { deleteTaskFromDisk, loadTasksFromDisk } from '@/lib/tasks/persist'
let directory: string
beforeEach(() => {
  directory = mkdtempSync(path.join(os.tmpdir(), 'aigc-persist-'))
  vi.stubEnv('DATA_DIR', directory)
  mkdirSync(path.join(directory, 'tasks'))
})
afterEach(() => { vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }) })
it('rejects path separators even when called without the API', () => {
  const fixture = path.join(directory, 'fixture.json')
  writeFileSync(fixture, '{}')
  for (const id of ['../fixture', '..\\fixture', 'det_x/../../fixture', '/tmp/fixture']) {
    expect(() => deleteTaskFromDisk(id)).toThrow()
  }
  expect(existsSync(fixture)).toBe(true)
})
it('ignores persisted IDs that escape or disagree with their filenames', () => {
  writeFileSync(path.join(directory, 'tasks/first.json'), JSON.stringify({ id: '../fixture' }))
  writeFileSync(path.join(directory, 'tasks/second.json'), JSON.stringify({ id: 'det_different' }))
  expect(loadTasksFromDisk().size).toBe(0)
})
