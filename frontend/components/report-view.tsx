import { apiUrl } from '@/frontend/api'

import { Link } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import type { DetectionReport } from '@/lib/domain/report'
import type { DetectedSegment } from '@/lib/domain/segments'
import { AnnotatedText } from './annotated-text'
import { ExportActions } from './export-actions'
import { FeaturePanel } from './feature-panel'
import { ProcessingView } from './processing-view'
import { ReportSummary } from './report-summary'
import { SiteNav } from './site-nav'

interface ReportViewProps {
  taskId: string
}

interface TaskResponse {
  status: 'queued' | 'parsing' | 'detecting' | 'ready' | 'error'
  report?: DetectionReport
  error?: { message?: string }
}

export function ReportView({ taskId }: ReportViewProps) {
  const [task, setTask] = useState<TaskResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<DetectedSegment | null>(null)

  const requestTask = useCallback(async (): Promise<TaskResponse> => {
    const response = await fetch(apiUrl(`/api/detections/${taskId}`))
    const body = await response.json() as TaskResponse
    if (!response.ok) {
      throw new Error(body.error?.message ?? '检测任务不存在或已过期。')
    }
    return body
  }, [taskId])

  const loadTask = useCallback(async () => {
    try {
      setTask(await requestTask())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '暂时无法读取报告，请稍后重试。')
    }
  }, [requestTask])

  useEffect(() => {
    let cancelled = false
    void requestTask()
      .then((body) => {
        if (cancelled) return
        setTask(body)
        if (body.status === 'ready' && typeof window !== 'undefined') {
          localStorage.removeItem('recentTaskId')
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : '暂时无法读取报告，请稍后重试。')
      })

    return () => {
      cancelled = true
    }
  }, [requestTask])

  const handleProcessingReady = useCallback(() => {
    void loadTask()
  }, [loadTask])

  if (error) {
    return <ReportError message={error} />
  }

  if (!task || task.status !== 'ready' || !task.report) {
    return (
      <main className="site-shell report-shell animate-fade-up">
        <ReportTopbar />
        <div className="report-processing-wrap">
          <ProcessingView taskId={taskId} onReady={handleProcessingReady} onError={setError} />
        </div>
      </main>
    )
  }

  const { report } = task

  return (
    <main className="site-shell report-shell animate-fade-up">
      <ReportTopbar />
      <header className="report-header">
        <div>
          <p className="eyebrow">REPORT / {report.sourceType.toUpperCase()}</p>
          <h1>{report.sourceName}</h1>
          <p>生成于 {formatGeneratedAt(report.generatedAt)} · 结果按有效正文片段统计</p>
        </div>
        <span className="report-stamp">DEMO<br />READING</span>
      </header>
      <ReportSummary summary={report.summary} mode={report.mode} />
      <ExportActions taskId={taskId} />
      {report.warnings.length > 0 ? (
        <div className="report-warning" role="note">
          <strong>解析提示</strong>
          <span>{report.warnings.join(' ')}</span>
        </div>
      ) : null}
      <div className="report-layout">
        <AnnotatedText text={report.text} segments={report.segments} selectedId={selected?.id ?? null} onSelect={setSelected} />
        <FeaturePanel segment={selected} />
      </div>
    </main>
  )
}

function ReportTopbar() {
  return (
    <header className="topbar report-topbar">
      <Link className="brand" to="/" aria-label="返回首页">
        <span className="brand-mark" aria-hidden="true">文</span>
        <span>
          <strong>文脉校阅台</strong>
          <small>CHINESE TEXT LAB</small>
        </span>
      </Link>
      <div className="topbar-right">
        <SiteNav />
      </div>
    </header>
  )
}

function ReportError({ message }: { message: string }) {
  const expired = message.includes('过期') || message.includes('不存在')

  return (
    <main className="site-shell report-shell">
      <ReportTopbar />
      <section className="report-error-card" role="alert">
        <p className="eyebrow">REPORT UNAVAILABLE</p>
        <h1>{message}</h1>
        {expired ? (
          <p className="report-error-note">
            该记录可能已被历史数量限制清理。你可以在历史记录页查看仍保留的检测结果。
          </p>
        ) : null}
        <div className="report-error-actions">
          <Link className="secondary-button" to="/history">查看历史记录</Link>
          <Link className="primary-button inline-button" to="/">重新开始</Link>
        </div>
      </section>
    </main>
  )
}

function formatGeneratedAt(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
