import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { DetectionTask } from './store'
import { AppError } from '@/lib/errors'

export function validateTaskId(id: string): void {
  if (!/^det_[a-zA-Z0-9_-]+$/u.test(id)) {
    throw new AppError('INVALID_TASK_ID', '检测任务 ID 无效。', 400)
  }
}

function taskPath(id: string): string {
  validateTaskId(id)
  const directory = path.resolve(tasksDirectory())
  const target = path.resolve(directory, `${id}.json`)
  if (path.dirname(target) !== directory) throw new AppError('INVALID_TASK_ID', '检测任务 ID 无效。', 400)
  return target
}

function dataDirectory(): string {
  return process.env.DATA_DIR ?? path.join(process.cwd(), 'data')
}

function tasksDirectory(): string {
  return path.join(dataDirectory(), 'tasks')
}

export function saveTaskToDisk(task: DetectionTask): void {
  mkdirSync(tasksDirectory(), { recursive: true })
  writeFileSync(taskPath(task.id), `${JSON.stringify(task)}\n`, 'utf8')
}

export function deleteTaskFromDisk(id: string): void {
  rmSync(taskPath(id), { force: true })
}

export function loadTasksFromDisk(): Map<string, DetectionTask> {
  const tasks = new Map<string, DetectionTask>()

  if (!existsSync(tasksDirectory())) return tasks

  for (const filename of readdirSync(tasksDirectory())) {
    if (!filename.endsWith('.json')) continue
    try {
      const raw = readFileSync(path.join(tasksDirectory(), filename), 'utf8')
      const task = JSON.parse(raw) as DetectionTask
      if (task?.id) {
        validateTaskId(task.id)
        if (filename === `${task.id}.json`) tasks.set(task.id, task)
      }
    } catch {
      // 跳过损坏的任务文件
    }
  }

  return tasks
}
