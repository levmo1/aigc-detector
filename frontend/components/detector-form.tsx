import { apiUrl } from '@/frontend/api'

import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { readFile } from '@tauri-apps/plugin-fs'
import { useCallback, useEffect, useState } from 'react'

interface DetectorFormProps {
  onSubmitted: (taskId: string) => void
}

type InputMode = 'text' | 'file'

export function DetectorForm({ onSubmitted }: DetectorFormProps) {
  const [mode, setMode] = useState<InputMode>('text')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const canSubmit = mode === 'text' ? text.trim().length > 0 : file !== null

  const switchMode = (nextMode: InputMode) => {
    setMode(nextMode)
    setError(null)
  }

  const selectDroppedFile = useCallback((dropped: File | undefined) => {
    if (!dropped) {
      setError('没有读取到文件，请重新拖入 Word 或 PDF 文件。')
      return
    }

    const fileName = dropped.name.toLowerCase()
    if (!fileName.endsWith('.docx') && !fileName.endsWith('.pdf')) {
      setFile(null)
      setError('暂不支持该文件类型，请拖入 .docx 或 .pdf 文件。')
      return
    }

    setError(null)
    setFile(dropped)
  }, [])

  const selectNativeDroppedFile = useCallback(async (filePath: string) => {
    try {
      const bytes = await readFile(filePath)
      const name = filePath.replaceAll('\\', '/').split('/').pop() || '拖入文件'
      const lowerName = name.toLowerCase()
      const type = lowerName.endsWith('.pdf')
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      selectDroppedFile(new File([bytes], name, { type }))
    } catch {
      setError('无法读取拖入的文件，请确认文件仍然存在且未被其他程序独占。')
    }
  }, [selectDroppedFile])

  useEffect(() => {
    if (!isTauri() || mode !== 'file') return

    let active = true
    let unlisten: (() => void) | undefined
    void getCurrentWebview().onDragDropEvent((event) => {
      if (!active) return

      if (event.payload.type === 'enter' || event.payload.type === 'over') {
        setIsDragOver(true)
        return
      }

      if (event.payload.type === 'leave') {
        setIsDragOver(false)
        return
      }

      setIsDragOver(false)
      const filePath = event.payload.paths[0]
      if (!filePath) {
        selectDroppedFile(undefined)
        return
      }
      void selectNativeDroppedFile(filePath)
    }).then((cleanup) => {
      if (active) {
        unlisten = cleanup
      } else {
        cleanup()
      }
    }).catch(() => {
      // Browser preview and older WebView runtimes may not expose native drag events.
    })

    return () => {
      active = false
      unlisten?.()
    }
  }, [mode, selectNativeDroppedFile, selectDroppedFile])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit || isSubmitting) return

    setError(null)
    setIsSubmitting(true)

    try {
      const response = mode === 'text'
        ? await fetch(apiUrl('/api/detections'), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text }),
          })
        : await submitFile(file as File)
      const body = await response.json() as { id?: string; error?: { message?: string } }

      if (!response.ok || !body.id) {
        throw new Error(body.error?.message ?? '提交失败，请稍后重试。')
      }

      onSubmitted(body.id)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : '提交失败，请稍后重试。')
      setIsSubmitting(false)
    }
  }

  return (
    <form className="intake-card" onSubmit={submit} aria-labelledby="intake-title">
      <div className="card-ribbon">快速开始</div>
      <div className="card-heading">
        <div>
          <p className="card-kicker">NEW CHECK</p>
          <h2 id="intake-title">选择你的入口</h2>
        </div>
        <span className="card-code">TXT / DOCX / PDF</span>
      </div>

      <div className="input-switcher" role="tablist" aria-label="检测输入方式">
        <button
          className={`input-tab${mode === 'text' ? ' is-active' : ''}`}
          role="tab"
          aria-selected={mode === 'text'}
          type="button"
          onClick={() => switchMode('text')}
        >
          粘贴文字
        </button>
        <button
          className={`input-tab${mode === 'file' ? ' is-active' : ''}`}
          role="tab"
          aria-selected={mode === 'file'}
          type="button"
          onClick={() => switchMode('file')}
        >
          上传文件
        </button>
      </div>

      {mode === 'text' ? (
        <div className="text-editor">
          <label className="sr-only" htmlFor="paper-text">论文正文</label>
          <textarea
            id="paper-text"
            aria-label="论文正文"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="把论文正文粘贴到这里"
          />
          <div className="textarea-meta">
            <span>建议至少 300 字，结果会更有参考价值</span>
            <span>{countScoredCharacters(text).toLocaleString('zh-CN')} 有效字</span>
          </div>
        </div>
      ) : (
        <label
          className={isDragOver ? 'file-drop is-dragging' : 'file-drop'}
          htmlFor="paper-file"
          onDragOver={(event) => {
            event.preventDefault()
            event.stopPropagation()
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
            setIsDragOver(true)
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setIsDragOver(false)
            }
          }}
          onDrop={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setIsDragOver(false)
            const dataTransfer = event.dataTransfer
            const dropped = dataTransfer?.files?.[0]
              ?? Array.from(dataTransfer?.items ?? [])
                .find((item) => item.kind === 'file')
                ?.getAsFile()
              ?? undefined
            selectDroppedFile(dropped)
          }}
        >
          <input
            id="paper-file"
            className="file-input"
            aria-label="上传 Word 或 PDF"
            type="file"
            accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <span className="file-drop-mark" aria-hidden="true">＋</span>
          <strong>{file ? file.name : '拖入论文文件，或点击选择'}</strong>
          <small>{file ? '已准备好，点击开始检测' : '支持 Word / PDF，扫描 PDF 将尝试 OCR'}</small>
        </label>
      )}

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="card-footer">
        <span>内容保存在本机，检测结果可在历史记录中查看</span>
        <button className="primary-button" type="submit" disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? '正在提交…' : '开始检测'} <span aria-hidden="true">↗</span>
        </button>
      </div>
    </form>
  )
}

function countScoredCharacters(text: string): number {
  return Array.from(text).filter((character) => !/\s/u.test(character)).length
}

async function submitFile(file: File): Promise<Response> {
  const formData = new FormData()
  formData.set('file', file)

  return fetch(apiUrl('/api/detections'), {
    method: 'POST',
    body: formData,
  })
}
