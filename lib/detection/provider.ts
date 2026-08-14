import { AppError } from '@/lib/errors'
import { createMockDetector } from './mock-detector'
import { createRuleDetector } from './rule-detector'
import type { DetectorProvider } from './types'

export function getDetectorProvider(mode = process.env.DETECTOR_PROVIDER ?? 'rule'): DetectorProvider {
  if (mode === 'mock') return createMockDetector()
  if (mode === 'rule') return createRuleDetector()

  throw new AppError('DETECTOR_UNAVAILABLE', `检测引擎不可用：不支持的配置 ${mode}。`, 503)
}
