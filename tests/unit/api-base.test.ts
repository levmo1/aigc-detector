import { afterEach, expect, it } from 'vitest'
import { apiUrl } from '@/frontend/api'
const desktopWindow = window as Window & { __API_BASE__?: string }
afterEach(() => { delete desktopWindow.__API_BASE__ })
it('uses the same origin in browsers', () => { expect(apiUrl('/api/status')).toBe('/api/status') })
it('keeps the injected desktop port', () => {
  desktopWindow.__API_BASE__ = 'http://127.0.0.1:41234'
  expect(apiUrl('/api/status')).toBe('http://127.0.0.1:41234/api/status')
})
