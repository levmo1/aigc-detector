import { apiUrl } from '@/frontend/api'

import { Link, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { DetectorForm } from '@/frontend/components/detector-form'
import { ProcessingView } from '@/frontend/components/processing-view'
import { SiteNav } from '@/frontend/components/site-nav'

const workflow = [
  { index: '01', label: '放入文本', detail: '粘贴正文，或上传 Word / PDF' },
  { index: '02', label: '解析片段', detail: '保留段落关系与原文位置' },
  { index: '03', label: '生成报告', detail: '查看三类比例与逐句说明' },
]

const toolEntries = [
  {
    href: '/history',
    title: '历史记录',
    detail: '查看之前的检测结果，随时重新打开报告',
    mark: '历',
  },
  {
    href: '/rules',
    title: '自定义规则',
    detail: '增删词条与正则，调整检测权重与阈值',
    mark: '规',
  },
  {
    href: '/settings',
    title: '模型设置',
    detail: '配置 Base URL 与模型，启用 AI 辅助判断',
    mark: '模',
  },
]

export default function HomePage() {
  const navigate = useNavigate()
  const [taskId, setTaskId] = useState<string | null>(null)
  const [processingError, setProcessingError] = useState<string | null>(null)
  const [engineLabel, setEngineLabel] = useState('本地规则检测')
  const handleReady = useCallback((id: string) => {
    if (typeof window !== 'undefined') localStorage.setItem('recentTaskId', id)
    navigate(`/report/${id}`)
  }, [navigate])
  const handleSubmitted = useCallback((id: string) => {
    setProcessingError(null)
    setTaskId(id)
    if (typeof window !== 'undefined') localStorage.setItem('recentTaskId', id)
  }, [])
  const handleError = useCallback((message: string) => {
    setProcessingError(message)
    setTaskId(null)
  }, [])

  useEffect(() => {
    void fetch(apiUrl('/api/status'))
      .then((response) => response.json())
      .then((body: { label?: string }) => {
        if (body.label) setEngineLabel(body.label)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const recent = typeof window !== 'undefined' ? localStorage.getItem('recentTaskId') : null
    if (!recent) return

    let cancelled = false
    void fetch(apiUrl(`/api/detections/${recent}`))
      .then((response) => response.json())
      .then((body: { status?: string }) => {
        if (cancelled) return
        if (body.status === 'ready' || body.status === 'error') {
          // 任务已结束：清除恢复标记，停留在首页等待新的检测
          localStorage.removeItem('recentTaskId')
        } else if (body.status) {
          setTaskId(recent)
        } else {
          localStorage.removeItem('recentTaskId')
        }
      })
      .catch(() => {
        if (typeof window !== 'undefined') localStorage.removeItem('recentTaskId')
      })

    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <main className="site-shell">
      <header className="topbar animate-fade-in">
        <Link className="brand" to="/" aria-label="文脉校阅台首页">
          <span className="brand-mark" aria-hidden="true">文</span>
          <span>
            <strong>文脉校阅台</strong>
            <small>CHINESE TEXT LAB</small>
          </span>
        </Link>
        <div className="topbar-right">
          <SiteNav />
          <div className="topbar-note">
            <span className="status-dot" aria-hidden="true" />
            {engineLabel}
          </div>
        </div>
      </header>

      <section className="hero-grid">
        <div className="hero-copy animate-fade-up">
          <p className="eyebrow stagger-1 animate-fade-up">中文论文 · 写作痕迹观察</p>
          <h1 className="stagger-2 animate-fade-up">先读懂文字，<em>再谈 AI。</em></h1>
          <p className="hero-lede stagger-3 animate-fade-up">
            把一段论文放上来。我们会按句子拆开，标出 AI 倾向、人工倾向与需要进一步判断的部分。
          </p>
          <div className="workflow-list stagger-4 animate-fade-up" aria-label="检测流程">
            {workflow.map((item) => (
              <div className="workflow-item" key={item.index}>
                <span className="workflow-index">{item.index}</span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={taskId ? 'panel-stack' : 'panel-stack'}>
          <div className={taskId ? 'is-hidden animate-fade-up' : 'animate-fade-up'}>
            <DetectorForm onSubmitted={handleSubmitted} />
            {processingError ? <p className="form-error" role="alert">{processingError}</p> : null}
          </div>
          {taskId ? (
            <div className="animate-fade-up">
              <ProcessingView taskId={taskId} onReady={handleReady} onError={handleError} />
              {processingError ? <p className="form-error" role="alert">{processingError}</p> : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="tool-entries animate-fade-up stagger-2" aria-label="功能入口">
        {toolEntries.map((entry) => (
          <Link className="tool-entry" to={entry.href} key={entry.href}>
            <span className="tool-entry-mark" aria-hidden="true">{entry.mark}</span>
            <span className="tool-entry-body">
              <strong>{entry.title}</strong>
              <small>{entry.detail}</small>
            </span>
            <span className="tool-entry-arrow" aria-hidden="true">↗</span>
          </Link>
        ))}
      </section>

      <footer className="site-footer">
        <span>一个面向中文学术写作的实验性工具</span>
        <span className="footer-links">
          <span>结果是线索，不是结论</span>
        </span>
      </footer>
    </main>
  )
}
