import { Hono } from 'hono'
import { AppError, errorResponse } from '@/lib/errors'
import { LLM_PRESETS, llmApiKeySource, llmApiKeySourceFor, loadLlmConfig, llmConfigSchema, saveLlmConfig } from '@/lib/llm/config'
import { getModelsForPreset } from '@/lib/llm/models'
import { llmFetch } from '@/lib/llm/http'
import { createRateLimiter } from '@/lib/tasks/rate-limit'
import { readRequestWithinLimit } from '@/lib/validation/input'

export const llmConfigRoutes = new Hono()

const configRateLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 })
const testRateLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 })

function publicConfig() {
  const config = loadLlmConfig()
  return {
    enabled: config.enabled,
    presetId: config.presetId ?? null,
    baseUrl: config.baseUrl,
    model: config.model,
    timeoutMs: config.timeoutMs,
    maxSegments: config.maxSegments,
    hasApiKey: Boolean(config.apiKey),
    apiKeySource: llmApiKeySource(config),
    presets: LLM_PRESETS.map((preset) => ({
      ...preset,
      apiKeySource: llmApiKeySourceFor(config, preset.id),
      models: getModelsForPreset(preset.id),
    })),
  }
}

llmConfigRoutes.get('/', async (c) => {
  try {
    return c.json(publicConfig())
  } catch (error) {
    return errorResponse(error)
  }
})

llmConfigRoutes.put('/', async (c) => {
  try {
    const rate = configRateLimiter.check('llm-config-write')
    if (!rate.allowed) {
      throw new AppError('RATE_LIMITED', `操作过于频繁，请在 ${rate.retryAfterSeconds} 秒后重试。`, 429)
    }

    const limitedRequest = await readRequestWithinLimit(c.req.raw)
    const body: unknown = await limitedRequest.json().catch(() => {
      throw new AppError('INVALID_LLM_CONFIG', '配置内容无法读取。')
    })

    const incoming = llmConfigSchema.safeParse(body)
    if (!incoming.success) {
      throw new AppError('INVALID_LLM_CONFIG', '配置格式不正确，请检查地址、密钥与模型名称。')
    }

    const resetApiKey = typeof body === 'object' && body !== null && (body as { resetApiKey?: unknown }).resetApiKey === true
    const saved = saveLlmConfig(incoming.data, { resetApiKey })

    return c.json({
      ...publicConfig(),
      hasApiKey: Boolean(saved.apiKey),
    })
  } catch (error) {
    return errorResponse(error)
  }
})

llmConfigRoutes.post('/test', async (c) => {
  try {
    const rate = testRateLimiter.check('llm-config-test')
    if (!rate.allowed) {
      throw new AppError('RATE_LIMITED', `测试过于频繁，请在 ${rate.retryAfterSeconds} 秒后重试。`, 429)
    }

    const limitedRequest = await readRequestWithinLimit(c.req.raw)
    const body: unknown = await limitedRequest.json().catch(() => {
      throw new AppError('INVALID_LLM_CONFIG', '配置内容无法读取。')
    })

    const incoming = llmConfigSchema.safeParse(body)
    if (!incoming.success) {
      throw new AppError('INVALID_LLM_CONFIG', '配置格式不正确，请检查地址、密钥与模型名称。')
    }

    const current = loadLlmConfig()
    const apiKey = incoming.data.apiKey || current.apiKey
    const config = { ...incoming.data, apiKey }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)

    try {
      const endpoint = `${config.baseUrl.replace(/\/$/u, '')}/chat/completions`
      const response = await llmFetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: '你好' }],
          max_tokens: 8,
        }),
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (!response.ok) {
        return c.json(
          { ok: false, message: `连接失败：服务返回 ${response.status}` },
          200,
        )
      }

      return c.json({ ok: true, message: '连接成功' })
    } catch (error) {
      clearTimeout(timer)
      const message = error instanceof Error && error.name === 'AbortError'
        ? '连接超时'
        : '无法连接到该地址，请检查 Base URL 与网络'
      return c.json({ ok: false, message }, 200)
    }
  } catch (error) {
    return errorResponse(error)
  }
})
