import { processDetectionTask } from './processor'
import { AppError } from '@/lib/errors'

type TaskRunner = (id: string) => Promise<void>

interface QueueItem {
  id: string
  runner: TaskRunner
  resolve: () => void
  reject: (error: unknown) => void
}

const maxConcurrentTasks = 2
const maxPendingTasks = 12
const queue: QueueItem[] = []
let activeTasks = 0

export function enqueueDetectionTask(id: string, runner: TaskRunner = processDetectionTask): Promise<void> {
  if (activeTasks + queue.length >= maxPendingTasks) {
    throw new AppError('QUEUE_FULL', '当前检测任务较多，请稍后重试。', 503)
  }

  return new Promise((resolve, reject) => {
    queue.push({ id, runner, resolve, reject })
    drainQueue()
  })
}

function drainQueue(): void {
  while (activeTasks < maxConcurrentTasks && queue.length > 0) {
    const item = queue.shift()
    if (!item) return

    activeTasks += 1
    void runItem(item)
  }
}

async function runItem(item: QueueItem): Promise<void> {
  try {
    await item.runner(item.id)
    item.resolve()
  } catch (error) {
    item.reject(error)
  } finally {
    activeTasks -= 1
    drainQueue()
  }
}
