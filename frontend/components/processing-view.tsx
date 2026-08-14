import { apiUrl } from '@/frontend/api'

import { useEffect, useState } from 'react'

interface ProcessingViewProps {
  taskId: string
  onReady: (taskId: string) => void
  onError: (message: string) => void
}

interface TaskSnapshot {
  status: 'queued' | 'parsing' | 'detecting' | 'ready' | 'error'
  stage: string
  progress: number
  error?: { message?: string }
}

const processSteps = ['接收文本', '解析文档', '分析文本片段', '模型辅助判断', '报告已生成']

const MAX_POLL_DURATION_MS = 5 * 60_000

export function ProcessingView({ taskId, onReady, onError }: ProcessingViewProps) {
  const [snapshot, setSnapshot] = useState<TaskSnapshot>({
    status: 'queued',
    stage: '接收文本',
    progress: 4,
  })

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const startedAt = Date.now()

    const poll = async () => {
      if (Date.now() - startedAt > MAX_POLL_DURATION_MS) {
        onError('检测超时，请重新提交。')
        return
      }

      try {
        const response = await fetch(apiUrl(`/api/detections/${taskId}`))
        const body = await response.json() as TaskSnapshot

        if (cancelled) return
        if (!response.ok || body.status === 'error') {
          onError(body.error?.message ?? '检测失败，请重新提交。')
          return
        }
        if (body.status === 'ready') {
          onReady(taskId)
          return
        }

        setSnapshot(body)
        timer = setTimeout(poll, 350)
      } catch {
        if (!cancelled) onError('暂时无法读取检测进度，请稍后重试。')
      }
    }

    void poll()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [onError, onReady, taskId])

  const activeIndex = Math.max(0, processSteps.indexOf(snapshot.stage))

  return (
    <section className="processing-card" aria-live="polite" aria-label="检测进度">
      <div className="processing-orbit" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="card-kicker">PROCESSING NOTE</p>
      <h2>正在整理这篇文字的脉络</h2>
      <p className="processing-copy">先解析结构，再生成逐句观察。检测完成后结果将保存到历史记录，可随时重新查看。</p>
      <div className="progress-track" aria-label={`当前进度 ${snapshot.progress}%`}>
        <span style={{ width: `${snapshot.progress}%` }} />
      </div>
      <div className="processing-stage">
        <strong>{snapshot.stage}</strong>
        <span>{snapshot.progress}%</span>
      </div>
      <div className="processing-steps">
        {processSteps.map((step, index) => (
          <span className={index <= activeIndex ? 'is-active' : ''} key={step}>
            <i aria-hidden="true" />{step}
          </span>
        ))}
      </div>
    </section>
  )
}
