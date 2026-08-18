import { Hono } from 'hono'
import { AppError, errorResponse } from '@/lib/errors'
import {
  loadRuleLibrary,
  rollbackUserRuleGroups,
  ruleGroupSchema,
  ruleThresholdSchema,
  saveUserRuleGroups,
} from '@/lib/rules/loader'
import { validateRegexPattern } from '@/lib/rules/engine'
import { builtinFeatures } from '@/lib/rules/features'
import { createRateLimiter } from '@/lib/tasks/rate-limit'
import { readRequestWithinLimit, validateRequestSize } from '@/lib/validation/input'

export const rulesRoutes = new Hono()

const configuredRulesLimit = Number(process.env.MAX_RULES_WRITES_PER_MINUTE)
const rulesRateLimiter = createRateLimiter({
  limit: Number.isFinite(configuredRulesLimit) && configuredRulesLimit > 0 ? configuredRulesLimit : 10,
  windowMs: 60_000,
})

rulesRoutes.get('/', async (c) => {
  try {
    const library = loadRuleLibrary()

    return c.json({
      groups: library.groups,
      thresholds: library.thresholds,
      revision: library.revision ?? 0,
      features: Object.fromEntries(
        Object.entries(builtinFeatures).map(([name, feature]) => [
          name,
          { weight: feature.weight, note: feature.note },
        ]),
      ),
    })
  } catch (error) {
    return errorResponse(error)
  }
})

rulesRoutes.get('/export', async () => {
  try {
    const library = loadRuleLibrary()
    const payload = JSON.stringify({
      version: library.version ?? 2,
      revision: library.revision ?? 0,
      thresholds: library.thresholds,
      groups: library.groups,
    }, null, 2)
    return new Response(`${payload}\n`, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': 'attachment; filename="aigc-rules.json"',
        'cache-control': 'no-store',
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
})

rulesRoutes.put('/', async (c) => {
  try {
    const rate = rulesRateLimiter.check('rules-write')
    if (!rate.allowed) {
      throw new AppError('RATE_LIMITED', `操作过于频繁，请在 ${rate.retryAfterSeconds} 秒后重试。`, 429)
    }
    validateRequestSize(c.req.raw)

    const limitedRequest = await readRequestWithinLimit(c.req.raw)
    const body: unknown = await limitedRequest.json().catch(() => {
      throw new AppError('INVALID_RULES', '规则内容无法读取。')
    })
    const groups = typeof body === 'object' && body !== null && 'groups' in body ? body.groups : undefined
    const requestedThresholds = typeof body === 'object' && body !== null && 'thresholds' in body
      ? body.thresholds
      : loadRuleLibrary().thresholds
    const parsed = ruleGroupSchema.array().safeParse(groups)
    const parsedThresholds = ruleThresholdSchema.safeParse(requestedThresholds)

    if (!parsed.success || !parsedThresholds.success) {
      throw new AppError('INVALID_RULES', '规则格式不正确，请检查词条、正则与权重。')
    }
    if (parsedThresholds.data.segmentUncertainScore >= parsedThresholds.data.segmentAIScore) {
      throw new AppError('INVALID_RULES', '不确定阈值必须小于 AI 阈值。')
    }

    for (const group of parsed.data) {
      for (const rule of group.rules) {
        const regexError = validateRegexPattern(rule.pattern)
        if (regexError) {
          throw new AppError('INVALID_RULES', `规则「${rule.pattern}」无效：${regexError}`)
        }
      }
    }

    const library = saveUserRuleGroups(parsed.data, parsedThresholds.data)

    return c.json({
      groups: library.groups,
      thresholds: library.thresholds,
      revision: library.revision ?? 0,
      features: Object.fromEntries(
        Object.entries(builtinFeatures).map(([name, feature]) => [
          name,
          { weight: feature.weight, note: feature.note },
        ]),
      ),
    })
  } catch (error) {
    return errorResponse(error)
  }
})

rulesRoutes.post('/rollback', async (c) => {
  try {
    const rate = rulesRateLimiter.check('rules-rollback')
    if (!rate.allowed) {
      throw new AppError('RATE_LIMITED', `操作过于频繁，请在 ${rate.retryAfterSeconds} 秒后重试。`, 429)
    }
    const library = rollbackUserRuleGroups()
    return c.json({
      groups: library.groups,
      thresholds: library.thresholds,
      revision: library.revision ?? 0,
      features: Object.fromEntries(
        Object.entries(builtinFeatures).map(([name, feature]) => [
          name,
          { weight: feature.weight, note: feature.note },
        ]),
      ),
    })
  } catch (error) {
    return errorResponse(error)
  }
})
