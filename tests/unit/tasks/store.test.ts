import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createTask, deleteTask, getTask, updateTask } from '@/lib/tasks/store'

const tempData = mkdtempSync(path.join(tmpdir(), 'aigc-store-'))

beforeAll(() => {
  vi.stubEnv('DATA_DIR', tempData)
})

afterAll(() => {
  vi.unstubAllEnvs()
  rmSync(tempData, { recursive: true, force: true })
})

describe('task store', () => {
  it('creates, updates, and deletes an in-memory task', () => {
    const task = createTask({
      kind: 'text',
      text: '一段用于测试任务存储的正文。',
      sourceName: '粘贴文本',
      warnings: [],
    })

    expect(getTask(task.id)?.status).toBe('queued')

    updateTask(task.id, { status: 'detecting' })
    expect(getTask(task.id)?.status).toBe('detecting')

    deleteTask(task.id)
    expect(getTask(task.id)).toBeUndefined()
  })

  it('can clear the raw input after processing', () => {
    const task = createTask({ kind: 'text', text: '原始正文', sourceName: '测试', warnings: [] })

    updateTask(task.id, { input: undefined })

    expect(getTask(task.id)?.input).toBeUndefined()
  })
})

it('does not forget a task when deleting its disk record fails', async () => {
  const persist = await import('@/lib/tasks/persist')
  const task = createTask({ kind: 'text', text: '正文', sourceName: '测试', warnings: [] })
  const deletion = vi.spyOn(persist, 'deleteTaskFromDisk').mockImplementation(() => { throw new Error('fixture disk failure') })
  try {
    expect(() => deleteTask(task.id)).toThrow('fixture disk failure')
    expect(getTask(task.id)).toBeDefined()
  } finally { deletion.mockRestore(); deleteTask(task.id) }
})
