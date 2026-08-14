import { apiUrl } from '@/frontend/api'

import { useCallback, useEffect, useState } from 'react'

interface LlmPreset {
  id: string
  name: string
  baseUrl: string
  model: string
  apiKeySource: 'opencode-auth' | 'user' | 'none'
  models: Array<{ id: string; name: string }>
}

interface LlmConfigResponse {
  enabled: boolean
  presetId: string | null
  baseUrl: string
  model: string
  timeoutMs: number
  maxSegments: number
  hasApiKey: boolean
  apiKeySource: 'opencode-auth' | 'user' | 'none'
  presets: LlmPreset[]
}

interface LlmSettingsForm {
  enabled: boolean
  presetId: string
  baseUrl: string
  apiKey: string
  model: string
}

export function LlmSettings() {
  const [form, setForm] = useState<LlmSettingsForm>({
    enabled: false,
    presetId: 'deepseek',
    baseUrl: '',
    apiKey: '',
    model: '',
  })
  const [presets, setPresets] = useState<LlmPreset[]>([])
  const [hasApiKey, setHasApiKey] = useState(false)
  const [apiKeySource, setApiKeySource] = useState<'opencode-auth' | 'user' | 'none'>('none')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  const loadConfig = useCallback(async () => {
    const response = await fetch(apiUrl('/api/llm-config'))
    const body = await response.json() as LlmConfigResponse
    if (!response.ok) throw new Error('无法读取模型配置。')
    return body
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadConfig()
      .then((body) => {
        if (cancelled) return
        setPresets(body.presets)
        setHasApiKey(body.hasApiKey)
        setApiKeySource(body.apiKeySource ?? 'none')
        setForm({
          enabled: body.enabled,
          presetId: body.presetId ?? body.presets[0]?.id ?? 'deepseek',
          baseUrl: body.baseUrl,
          apiKey: '',
          model: body.model,
        })
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : '无法读取模型配置。')
      })

    return () => {
      cancelled = true
    }
  }, [loadConfig])

  const applyPreset = (preset: LlmPreset) => {
    const isCustom = preset.id === 'custom'
    setForm((current) => ({
      ...current,
      presetId: preset.id,
      baseUrl: isCustom ? '' : preset.baseUrl,
      model: isCustom ? '' : (preset.models[0]?.id ?? current.model),
    }))
    setApiKeySource(preset.apiKeySource)
    setTestResult(null)
  }

  const activeModels = presets.find((preset) => preset.id === form.presetId)?.models ?? []
  const usingCustomModel = activeModels.length > 0 && !activeModels.some((model) => model.id === form.model)

  const saveConfig = async () => {
    setError(null)
    setSaved(false)
    try {
      const response = await fetch(apiUrl('/api/llm-config'), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          enabled: form.enabled,
          presetId: form.presetId,
          baseUrl: form.baseUrl,
          apiKey: form.apiKey,
          model: form.model,
        }),
      })
      const body = await response.json() as LlmConfigResponse & { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? '保存失败。')
      setHasApiKey(body.hasApiKey)
      setApiKeySource(body.apiKeySource ?? 'none')
      setForm((current) => ({ ...current, apiKey: '' }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败。')
    }
  }

  const resetApiKey = async () => {
    if (!window.confirm('确定要重置 API Key 吗？已填写的密钥将被清除。')) return
    setError(null)
    setTestResult(null)
    try {
      const response = await fetch(apiUrl('/api/llm-config'), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          enabled: form.enabled,
          presetId: form.presetId,
          baseUrl: form.baseUrl,
          apiKey: '',
          model: form.model,
          resetApiKey: true,
        }),
      })
      const body = await response.json() as LlmConfigResponse & { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? '重置失败。')
      setHasApiKey(body.hasApiKey)
      setApiKeySource(body.apiKeySource ?? 'none')
      setForm((current) => ({ ...current, apiKey: '' }))
      setTestResult(body.hasApiKey
        ? '已重置。当前预设会自动使用 opencode 登录（auth.json）中的密钥。'
        : 'API Key 已重置。')
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : '重置失败。')
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const response = await fetch(apiUrl('/api/llm-config/test'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          enabled: form.enabled,
          presetId: form.presetId,
          baseUrl: form.baseUrl,
          apiKey: form.apiKey,
          model: form.model,
        }),
      })
      const body = await response.json() as { ok?: boolean; message?: string }
      setTestResult(body.message ?? '已发送测试请求')
    } catch {
      setTestResult('测试失败，请检查配置')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="llm-settings">
      <div className="rules-toolbar">
        <div>
          <p className="eyebrow">AI MODEL</p>
          <h2>模型辅助判断</h2>
          <p>启用后，AI 模型会参与每个片段的判断（AI/人工/不确定）并给出理由与修改建议；未配置或失败时自动回退本地规则判断。</p>
        </div>
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="preset-grid">
        {presets.map((preset) => (
          <button
            className={`preset-card${form.presetId === preset.id ? ' is-active' : ''}`}
            key={preset.id}
            type="button"
            onClick={() => applyPreset(preset)}
          >
            <strong>{preset.name}</strong>
            <small>{preset.id === 'custom' ? '手动填写 Base URL 与模型名称' : preset.baseUrl}</small>
            {preset.model ? <small>{preset.model}</small> : null}
          </button>
        ))}
      </div>

      <div className="llm-form animate-fade-up" key={form.presetId}>
        <label className="llm-toggle">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
          />
          <span>启用模型辅助判断</span>
        </label>

        <label>
          <span>Base URL</span>
          <input
            aria-label="Base URL"
            type="text"
            placeholder="https://api.deepseek.com/v1"
            value={form.baseUrl}
            onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))}
          />
        </label>

        <label>
          <span>API Key</span>
          <input
            aria-label="API Key"
            type="password"
            placeholder={
              apiKeySource === 'opencode-auth'
                ? '来自 opencode 登录（留空即使用）'
                : apiKeySource === 'user'
                  ? '已设置（留空保持不变）'
                  : '输入 API Key'
            }
            value={form.apiKey}
            onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
          />
          <button className="key-reset-button" type="button" onClick={resetApiKey}>
            重置 API Key
          </button>
        </label>

        <label>
          <span>模型名称{activeModels.length > 0 ? `（已自动检测 ${activeModels.length} 个可用模型）` : ''}</span>
          {activeModels.length > 0 ? (
            <select
              aria-label="模型名称"
              value={usingCustomModel ? '__custom__' : form.model}
              onChange={(event) => {
                const value = event.target.value
                if (value === '__custom__') return
                setForm((current) => ({ ...current, model: value }))
              }}
            >
              {activeModels.map((model) => (
                <option value={model.id} key={model.id}>{model.name}（{model.id}）</option>
              ))}
              <option value="__custom__">自定义模型…</option>
            </select>
          ) : null}
          {activeModels.length === 0 || usingCustomModel ? (
            <input
              aria-label="模型名称"
              type="text"
              placeholder="deepseek-chat"
              value={form.model}
              onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
            />
          ) : null}
        </label>

        <div className="llm-actions">
          <button className="secondary-button" type="button" onClick={testConnection} disabled={testing}>
            {testing ? '测试中…' : '测试连接'}
          </button>
          <button className="primary-button" type="button" onClick={saveConfig}>
            {saved ? '已保存 ✓' : '保存设置'}
          </button>
        </div>

        {testResult ? (
          <p className={`llm-test-result${testResult.startsWith('连接成功') ? ' is-ok' : ''}`} role="status">
            {testResult}
          </p>
        ) : null}
      </div>
    </div>
  )
}
