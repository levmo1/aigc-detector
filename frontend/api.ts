export function apiBase(): string {
  if (typeof window === 'undefined') return ''
  const base = (window as { __API_BASE__?: string }).__API_BASE__
  // 桌面使用注入的后端地址；浏览器通过同源 /api 代理访问后端。
  return base ?? ''
}

export function apiUrl(path: string): string {
  return `${apiBase()}${path}`
}
