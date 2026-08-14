import { randomUUID } from 'node:crypto'
import type { DetectionReport } from '@/lib/domain/report'
import type { DetectionInput } from '@/lib/validation/input'
import { loadHistoryConfig } from '@/lib/history/config'
import { deleteTaskFromDisk, loadTasksFromDisk, saveTaskToDisk } from './persist'

export type DetectionStatus = 'queued' | 'parsing' | 'detecting' | 'ready' | 'error'

export interface DetectionTask {
  id: string
  status: DetectionStatus
  stage: string
  progress: number
  createdAt: number
  updatedAt: number
  input?: DetectionInput
  report?: DetectionReport
  error?: { code: string; message: string }
}

const tasks = loadTasksFromDisk()

function migrateLegacyTasks(): void {
  const now = Date.now()

  for (const task of tasks.values()) {
    if (task.status === 'queued' || task.status === 'parsing' || task.status === 'detecting') {
      Object.assign(task, {
        status: 'error',
        stage: '服务重启，任务中断',
        progress: 100,
        updatedAt: now,
        input: undefined,
        error: { code: 'TASK_INTERRUPTED', message: '服务重启，本次检测已中断，请重新提交。' },
      })
      saveTaskToDisk(task)
    } else if (task.status === 'ready' && !task.report) {
      tasks.delete(task.id)
      deleteTaskFromDisk(task.id)
    } else if (task.input) {
      delete task.input
      saveTaskToDisk(task)
    }
  }
}

migrateLegacyTasks()

const cleanupTimer = setInterval(() => {
  const { maxCount } = loadHistoryConfig()
  pruneHistory(maxCount)
}, 60_000)
cleanupTimer.unref?.()

export function createTask(input: DetectionInput): DetectionTask {
  const now = Date.now()
  const task: DetectionTask = {
    id: `det_${randomUUID()}`,
    status: 'queued',
    stage: '等待处理',
    progress: 0,
    createdAt: now,
    updatedAt: now,
    input,
  }

  tasks.set(task.id, task)
  saveTaskToDisk(task)
  return task
}

export function getTask(id: string): DetectionTask | undefined {
  return tasks.get(id)
}

export function updateTask(id: string, patch: Partial<Omit<DetectionTask, 'id' | 'createdAt'>>): DetectionTask | undefined {
  const task = tasks.get(id)
  if (!task) return undefined

  // 任务结束时释放原始输入（含文件 buffer，避免积压占用内存/磁盘）
  if (patch.status === 'ready' || patch.status === 'error') {
    patch = { ...patch, input: undefined }
  }

  Object.assign(task, patch, { updatedAt: Date.now() })
  saveTaskToDisk(task)
  return task
}

export function deleteTask(id: string): void {
  tasks.delete(id)
  deleteTaskFromDisk(id)
}

export function listFinishedTasks(): DetectionTask[] {
  return [...tasks.values()]
    .filter((task) => task.status === 'ready' || task.status === 'error')
    .sort((left, right) => right.updatedAt - left.updatedAt)
}

export function pruneHistory(maxCount: number): void {
  const finished = listFinishedTasks()
  const excess = finished.slice(maxCount)

  for (const task of excess) {
    tasks.delete(task.id)
    deleteTaskFromDisk(task.id)
  }
}
