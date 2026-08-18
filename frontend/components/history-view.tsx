import { apiUrl } from '@/frontend/api'

import { Link } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'

interface HistoryItem {
  id: string
  status: 'ready' | 'error'
  sourceName: string
  sourceType: string
  mode: string
  llmAssisted?: boolean
  summary: { aiRate: number; humanRate: number; uncertainRate: number; scoredCharacters: number } | null
  error: { code: string; message: string } | null
  createdAt: number
  updatedAt: number
}

interface HistoryResponse {
  items: HistoryItem[]
  maxCount: number
}

export function HistoryView() {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [maxCount, setMaxCount] = useState(50)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const loadHistory = useCallback(async () => {
    const response = await fetch(apiUrl('/api/history'))
    const body = await response.json() as HistoryResponse
    if (!response.ok) throw new Error('无法读取历史记录。')
    return body
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadHistory()
      .then((body) => {
        if (cancelled) return
        setItems(body.items)
        setMaxCount(body.maxCount)
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : '无法读取历史记录。')
      })

    return () => {
      cancelled = true
    }
  }, [loadHistory])

  const saveMaxCount = async () => {
    setError(null)
    setSaved(false)
    try {
      const response = await fetch(apiUrl('/api/history'), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ maxCount }),
      })
      const body = await response.json() as { maxCount?: number; error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? '保存失败。')
      if (body.maxCount) setMaxCount(body.maxCount)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      void loadHistory()
        .then((fresh) => setItems(fresh.items))
        .catch(() => {})
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败。')
    }
  }

  const removeItem = async (item: HistoryItem) => {
    try {
      await fetch(apiUrl(`/api/history/${item.id}`), { method: 'DELETE' })
      setItems((current) => current.filter((entry) => entry.id !== item.id))
    } catch {
      setError('删除失败。')
    }
  }

  return (
    <div className="history-view">
      <div className="rules-toolbar">
        <div>
          <p className="eyebrow">HISTORY</p>
          <h2>历史记录</h2>
          <p>查看之前的检测结果。记录保存在本地磁盘，刷新或重启不会丢失。</p>
        </div>
        <div className="history-config">
          <label htmlFor="history-max-count">保存记录数</label>
          <input
            id="history-max-count"
            aria-label="保存记录数"
            type="number"
            min={1}
            max={500}
            value={maxCount}
            onChange={(event) => setMaxCount(Number(event.target.value))}
          />
          <button className="secondary-button" type="button" onClick={saveMaxCount}>
            {saved ? '已保存 ✓' : '保存'}
          </button>
        </div>
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {items.length === 0 ? (
        <p className="history-empty">还没有检测记录。完成一次检测后会出现在这里。</p>
      ) : (
        <ul className="history-list">
          {items.map((item) => (
            <li key={item.id} className="history-item">
              <div className="history-item-main">
                <strong>{item.sourceName}</strong>
                <span className="history-meta">
                  {new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(item.updatedAt)}
                  {' · '}{item.sourceType.toUpperCase()}{item.llmAssisted ? ' · LLM 复核' : ''}
                </span>
              </div>

              {item.status === 'ready' && item.summary ? (
                <div className="history-rates" aria-label="检测结果比例">
                  <span>AI {item.summary.aiRate}%</span>
                  <span>人工 {item.summary.humanRate}%</span>
                  <span>不确定 {item.summary.uncertainRate}%</span>
                </div>
              ) : (
                <span className="history-error">{item.error?.message ?? '检测失败'}</span>
              )}

              <div className="history-actions">
                {item.status === 'ready' ? (
                  <Link className="secondary-button" to={`/report/${item.id}`}>查看报告</Link>
                ) : null}
                <button
                  className="history-remove"
                  type="button"
                  aria-label={`删除 ${item.sourceName}`}
                  onClick={() => void removeItem(item)}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
