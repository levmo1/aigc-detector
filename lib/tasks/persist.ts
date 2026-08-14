import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { DetectionTask } from './store'

function dataDirectory(): string {
  return process.env.DATA_DIR ?? path.join(process.cwd(), 'data')
}

function tasksDirectory(): string {
  return path.join(dataDirectory(), 'tasks')
}

export function saveTaskToDisk(task: DetectionTask): void {
  mkdirSync(tasksDirectory(), { recursive: true })
  writeFileSync(path.join(tasksDirectory(), `${task.id}.json`), `${JSON.stringify(task)}\n`, 'utf8')
}

export function deleteTaskFromDisk(id: string): void {
  rmSync(path.join(tasksDirectory(), `${id}.json`), { force: true })
}

export function loadTasksFromDisk(): Map<string, DetectionTask> {
  const tasks = new Map<string, DetectionTask>()

  if (!existsSync(tasksDirectory())) return tasks

  for (const filename of readdirSync(tasksDirectory())) {
    if (!filename.endsWith('.json')) continue
    try {
      const raw = readFileSync(path.join(tasksDirectory(), filename), 'utf8')
      const task = JSON.parse(raw) as DetectionTask
      if (task?.id) tasks.set(task.id, task)
    } catch {
      // 跳过损坏的任务文件
    }
  }

  return tasks
}
