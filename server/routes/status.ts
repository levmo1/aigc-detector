import { Hono } from 'hono'
import { getDetectorProvider } from '@/lib/detection/provider'

export const statusRoutes = new Hono()

statusRoutes.get('/', async (c) => {
  const provider = getDetectorProvider()

  return c.json({
    mode: provider.mode,
    label: provider.mode === 'mock' ? 'Mock 演示模式' : provider.mode === 'rule' ? '本地规则检测' : '外部检测服务',
  })
})
