import { Hono } from 'hono'
import { AppError, errorResponse } from '@/lib/errors'
import { loadHistoryConfig, historyConfigSchema, saveHistoryConfig } from '@/lib/history/config'
import { validateTaskId } from '@/lib/tasks/persist'
import { listFinishedTasks, pruneHistory, deleteTask, getTask } from '@/lib/tasks/store'
import { createRateLimiter } from '@/lib/tasks/rate-limit'
import { readRequestWithinLimit } from '@/lib/validation/input'

export const historyRoutes = new Hono()

const historyRateLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 })

historyRoutes.get('/', async (c) => {
  try {
    const { maxCount } = loadHistoryConfig()
    const tasks = listFinishedTasks()
    const items = tasks.slice(0, maxCount).map((task) => ({
      id: task.id,
      status: task.status,
      sourceName: task.report?.sourceName ?? '未知来源',
      sourceType: task.report?.sourceType ?? 'text',
      mode: task.report?.mode ?? 'rule',
      llmAssisted: task.report?.llmAssisted ?? false,
      summary: task.report?.summary ?? null,
      error: task.error ?? null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }))

    return c.json({ items, maxCount })
  } catch (error) {
    return errorResponse(error)
  }
})

historyRoutes.put('/', async (c) => {
  try {
    const rate = historyRateLimiter.check('history-config-write')
    if (!rate.allowed) {
      throw new AppError('RATE_LIMITED', `操作过于频繁，请在 ${rate.retryAfterSeconds} 秒后重试。`, 429)
    }

    const limitedRequest = await readRequestWithinLimit(c.req.raw)
    const body: unknown = await limitedRequest.json().catch(() => {
      throw new AppError('INVALID_HISTORY_CONFIG', '配置内容无法读取。')
    })
    const parsed = historyConfigSchema.safeParse(body)
    if (!parsed.success) {
      throw new AppError('INVALID_HISTORY_CONFIG', '保存条数需为 1-500 的整数。')
    }

    saveHistoryConfig(parsed.data)
    pruneHistory(parsed.data.maxCount)

    return c.json({ maxCount: parsed.data.maxCount })
  } catch (error) {
    return errorResponse(error)
  }
})

historyRoutes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    validateTaskId(id)
    const task = getTask(id)
    if (!task) throw new AppError('TASK_NOT_FOUND', '检测任务不存在或已过期。', 404)
    if (task.status !== 'ready' && task.status !== 'error') {
      throw new AppError('TASK_NOT_READY', '检测仍在进行中，暂时无法删除。', 409)
    }
    deleteTask(id)

    return c.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
})
