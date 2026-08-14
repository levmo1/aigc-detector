export function apiBase(): string {
  if (typeof window === 'undefined') return ''
  const base = (window as { __API_BASE__?: string }).__API_BASE__
  // __API_BASE__ 由 Tauri 注入；注入失败（浏览器预览等）回退默认端口 3210
  return base ?? 'http://127.0.0.1:3210'
}

export function apiUrl(path: string): string {
  return `${apiBase()}${path}`
}
