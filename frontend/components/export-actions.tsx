import { apiUrl } from '@/frontend/api'

interface ExportActionsProps {
  taskId: string
}

const formats = [
  { format: 'pdf', label: 'PDF' },
  { format: 'html', label: 'HTML' },
  { format: 'docx', label: 'Word' },
]

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function fileNameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1])
    } catch {
      // 继续尝试普通 filename
    }
  }
  const plain = header.match(/filename="?([^";]+)"?/i)
  if (plain) return plain[1]
  return fallback
}

export function ExportActions({ taskId }: ExportActionsProps) {
  const download = async (format: string) => {
    try {
      const response = await fetch(apiUrl(`/api/detections/${taskId}/export?format=${format}`))
      if (!response.ok) throw new Error(`导出失败（${response.status}）`)
      const blob = await response.blob()
      const filename = fileNameFromDisposition(
        response.headers.get('content-disposition'),
        `检测报告.${format}`,
      )

      if (isTauri()) {
        const { save } = await import('@tauri-apps/plugin-dialog')
        const { writeFile } = await import('@tauri-apps/plugin-fs')
        const target = await save({ defaultPath: filename })
        if (target) {
          await writeFile(target, new Uint8Array(await blob.arrayBuffer()))
        }
        return
      }

      // 浏览器回退：object URL + 临时下载链接
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      console.error('[export] 导出失败', error)
      alert('导出失败，请重试。')
    }
  }

  return (
    <div className="export-actions" aria-label="导出报告">
      <span>下载报告</span>
      {formats.map((item) => (
        <button type="button" onClick={() => void download(item.format)} key={item.format}>
          {item.label} <span aria-hidden="true">↓</span>
        </button>
      ))}
    </div>
  )
}
