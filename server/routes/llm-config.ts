import { Hono } from 'hono'
import { AppError, errorResponse } from '@/lib/errors'
import {
  addCustomLlmPreset,
  apiKeyForPreset,
  customPresetInputSchema,
  listLlmPresets,
  llmApiKeySource,
  llmApiKeySourceFor,
  loadLlmConfig,
  llmConfigSchema,
  removeCustomLlmPreset,
  saveLlmConfig,
} from '@/lib/llm/config'
import { getModelsForPreset } from '@/lib/llm/models'
import { llmFetch } from '@/lib/llm/http'
import { createRateLimiter } from '@/lib/tasks/rate-limit'
import { readRequestWithinLimit } from '@/lib/validation/input'
import { z } from 'zod'

export const llmConfigRoutes = new Hono()

const configRateLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 })
const testRateLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 })
const modelsRateLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 })

const modelDiscoverySchema = z.object({
  baseUrl: z.string().url().max(300),
  apiKey: z.string().max(300).optional(),
  presetId: z.string().max(80).optional(),
})

function publicConfig(config = loadLlmConfig()) {
  const presets = listLlmPresets(config)
  return {
    enabled: config.enabled,
    secondReviewEnabled: config.secondReviewEnabled === true,
    presetId: config.presetId ?? null,
    baseUrl: config.baseUrl,
    model: config.model,
    timeoutMs: config.timeoutMs,
    maxSegments: config.maxSegments,
    hasApiKey: Boolean(config.apiKey),
    apiKeySource: llmApiKeySource(config),
    presets: presets.map((preset) => ({
      ...preset,
      apiKeySource: llmApiKeySourceFor(config, preset.id),
      models: getModelsForPreset(preset.id),
    })),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeModels(body: unknown): Array<{ id: string; name: string }> {
  const items = Array.isArray(body)
    ? body
    : isRecord(body) && Array.isArray(body.data)
      ? body.data
      : isRecord(body) && Array.isArray(body.models)
        ? body.models
        : []
  const seen = new Set<string>()

  return items.flatMap((item) => {
    const id = typeof item === 'string'
      ? item
      : isRecord(item) && typeof item.id === 'string'
        ? item.id
        : null
    if (!id || seen.has(id)) return []
    seen.add(id)
    const name = isRecord(item) && typeof item.name === 'string' ? item.name : id
    return [{ id, name }]
  })
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

llmConfigRoutes.post('/presets', async (c) => {
  try {
    const rate = configRateLimiter.check('llm-preset-create')
    if (!rate.allowed) {
      throw new AppError('RATE_LIMITED', `操作过于频繁，请在 ${rate.retryAfterSeconds} 秒后重试。`, 429)
    }

    const limitedRequest = await readRequestWithinLimit(c.req.raw)
    const body: unknown = await limitedRequest.json().catch(() => {
      throw new AppError('INVALID_LLM_CONFIG', '方案内容无法读取。')
    })
    const incoming = customPresetInputSchema.safeParse(body)
    if (!incoming.success) {
      throw new AppError('INVALID_LLM_CONFIG', '方案名称或 Base URL 不正确。')
    }

    const preset = addCustomLlmPreset(incoming.data)
    return c.json({ ...publicConfig(), presetId: preset.id }, 201)
  } catch (error) {
    return errorResponse(error)
  }
})

llmConfigRoutes.delete('/presets/:id', async (c) => {
  try {
    const rate = configRateLimiter.check('llm-preset-delete')
    if (!rate.allowed) {
      throw new AppError('RATE_LIMITED', `操作过于频繁，请在 ${rate.retryAfterSeconds} 秒后重试。`, 429)
    }

    const id = c.req.param('id')
    if (!id.startsWith('custom-')) {
      throw new AppError('INVALID_LLM_CONFIG', '内置方案不能删除。')
    }

    const saved = removeCustomLlmPreset(id)
    return c.json(publicConfig(saved))
  } catch (error) {
    return errorResponse(error)
  }
})

llmConfigRoutes.post('/models', async (c) => {
  try {
    const rate = modelsRateLimiter.check('llm-model-discovery')
    if (!rate.allowed) {
      throw new AppError('RATE_LIMITED', `检测过于频繁，请在 ${rate.retryAfterSeconds} 秒后重试。`, 429)
    }

    const limitedRequest = await readRequestWithinLimit(c.req.raw)
    const body: unknown = await limitedRequest.json().catch(() => {
      throw new AppError('INVALID_LLM_CONFIG', '模型检测配置无法读取。')
    })
    const incoming = modelDiscoverySchema.safeParse(body)
    if (!incoming.success) {
      throw new AppError('INVALID_LLM_CONFIG', '请先填写有效的 Base URL。')
    }

    const current = loadLlmConfig()
    const apiKey = incoming.data.apiKey || apiKeyForPreset(current, incoming.data.presetId)
    const endpoint = `${incoming.data.baseUrl.replace(/\/+$/u, '')}/models`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)

    try {
      const headers: Record<string, string> = { accept: 'application/json' }
      if (apiKey) headers.authorization = `Bearer ${apiKey}`
      const response = await llmFetch(endpoint, {
        method: 'GET',
        headers,
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (!response.ok) {
        return c.json({ ok: false, models: [], message: `模型列表请求失败：服务返回 ${response.status}` }, 200)
      }

      const models = normalizeModels(await response.json())
      if (models.length === 0) {
        return c.json({ ok: false, models: [], message: '接口没有返回可识别的模型列表。' }, 200)
      }

      return c.json({ ok: true, models, message: `已检测到 ${models.length} 个可用模型。` })
    } catch (error) {
      clearTimeout(timer)
      const message = error instanceof Error && error.name === 'AbortError'
        ? '模型检测超时'
        : '无法读取模型列表，请检查 Base URL、API Key 与接口兼容性'
      return c.json({ ok: false, models: [], message }, 200)
    }
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
    const apiKey = incoming.data.apiKey || apiKeyForPreset(current, incoming.data.presetId)
    const config = { ...incoming.data, apiKey }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)

    try {
      const endpoint = `${config.baseUrl.replace(/\/$/u, '')}/chat/completions`
      const response = await llmFetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: '你好' }],
          temperature: 0,
          max_tokens: 32,
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
