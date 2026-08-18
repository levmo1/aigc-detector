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
  secondReviewEnabled: boolean
  presetId: string | null
  baseUrl: string
  model: string
  timeoutMs: number
  maxSegments: number
  hasApiKey: boolean
  apiKeySource: 'opencode-auth' | 'user' | 'none'
  presets: LlmPreset[]
}

interface ModelDiscoveryResponse {
  ok?: boolean
  models?: Array<{ id: string; name: string }>
  message?: string
  error?: { message?: string }
}

interface LlmSettingsForm {
  enabled: boolean
  secondReviewEnabled: boolean
  presetId: string
  baseUrl: string
  apiKey: string
  model: string
  maxSegments: number
}

export function LlmSettings() {
  const [form, setForm] = useState<LlmSettingsForm>({
    enabled: false,
    secondReviewEnabled: false,
    presetId: 'deepseek',
    baseUrl: '',
    apiKey: '',
    model: '',
    maxSegments: 6,
  })
  const [presets, setPresets] = useState<LlmPreset[]>([])
  const [hasApiKey, setHasApiKey] = useState(false)
  const [apiKeySource, setApiKeySource] = useState<'opencode-auth' | 'user' | 'none'>('none')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [discoveringModels, setDiscoveringModels] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [isAddingPreset, setIsAddingPreset] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')
  const [newPresetUrl, setNewPresetUrl] = useState('')
  const [addingPreset, setAddingPreset] = useState(false)

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
          secondReviewEnabled: body.secondReviewEnabled === true,
          presetId: body.presetId ?? body.presets[0]?.id ?? 'deepseek',
          baseUrl: body.baseUrl,
          apiKey: '',
          model: body.model,
          maxSegments: body.maxSegments,
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
    setForm((current) => ({
      ...current,
      presetId: preset.id,
      baseUrl: preset.baseUrl,
      model: preset.model || preset.models[0]?.id || '',
    }))
    setApiKeySource(preset.apiKeySource)
    setTestResult(null)
  }

  const activeModels = presets.find((preset) => preset.id === form.presetId)?.models ?? []
  const usingCustomModel = activeModels.length > 0 && !activeModels.some((model) => model.id === form.model)

  const createPreset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setAddingPreset(true)
    try {
      const response = await fetch(apiUrl('/api/llm-config/presets'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: newPresetName, baseUrl: newPresetUrl }),
      })
      const body = await response.json() as LlmConfigResponse & { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? '添加方案失败。')

      setPresets(body.presets)
      const created = body.presets.find((preset) => preset.id === body.presetId)
      if (created) applyPreset(created)
      setNewPresetName('')
      setNewPresetUrl('')
      setIsAddingPreset(false)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '添加方案失败。')
    } finally {
      setAddingPreset(false)
    }
  }

  const discoverModels = async () => {
    setDiscoveringModels(true)
    setTestResult(null)
    try {
      const response = await fetch(apiUrl('/api/llm-config/models'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          presetId: form.presetId,
          baseUrl: form.baseUrl,
          apiKey: form.apiKey,
        }),
      })
      const body = await response.json() as ModelDiscoveryResponse
      if (!response.ok || !body.ok || !body.models?.length) {
        throw new Error(body.error?.message ?? body.message ?? '没有检测到可用模型。')
      }

      const models = body.models
      setPresets((current) => current.map((preset) => (
        preset.id === form.presetId ? { ...preset, models } : preset
      )))
      setForm((current) => ({
        ...current,
        model: models.some((model) => model.id === current.model) ? current.model : models[0].id,
      }))
      setTestResult(body.message ?? `已检测到 ${models.length} 个可用模型。`)
    } catch (discoverError) {
      setTestResult(discoverError instanceof Error ? discoverError.message : '模型检测失败。')
    } finally {
      setDiscoveringModels(false)
    }
  }

  const removePreset = async (preset: LlmPreset) => {
    if (!preset.id.startsWith('custom-')) return
    if (!window.confirm(`确定删除方案“${preset.name}”吗？`)) return

    setError(null)
    try {
      const response = await fetch(apiUrl(`/api/llm-config/presets/${preset.id}`), { method: 'DELETE' })
      const body = await response.json() as LlmConfigResponse & { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? '删除方案失败。')
      setPresets(body.presets)
      if (form.presetId === preset.id) {
        const fallback = body.presets[0]
        if (fallback) applyPreset(fallback)
      }
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : '删除方案失败。')
    }
  }

  const saveConfig = async () => {
    setError(null)
    setSaved(false)
    try {
      const response = await fetch(apiUrl('/api/llm-config'), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          enabled: form.enabled,
          secondReviewEnabled: form.secondReviewEnabled,
          presetId: form.presetId,
          baseUrl: form.baseUrl,
          apiKey: form.apiKey,
          model: form.model,
          maxSegments: form.maxSegments,
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
          secondReviewEnabled: form.secondReviewEnabled,
          presetId: form.presetId,
          baseUrl: form.baseUrl,
          apiKey: '',
          model: form.model,
          maxSegments: form.maxSegments,
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
          secondReviewEnabled: form.secondReviewEnabled,
          presetId: form.presetId,
          baseUrl: form.baseUrl,
          apiKey: form.apiKey,
          model: form.model,
          maxSegments: form.maxSegments,
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

      <div className="preset-toolbar">
        <div>
          <p className="preset-toolbar-title">连接方案</p>
          <p className="preset-toolbar-note">内置方案保留在这里，也可以保存自己的兼容接口。</p>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => setIsAddingPreset((current) => !current)}
        >
          {isAddingPreset ? '取消添加' : '＋ 添加方案'}
        </button>
      </div>

      {isAddingPreset ? (
        <form className="preset-create-form" onSubmit={createPreset}>
          <label>
            <span>方案名称</span>
            <input
              aria-label="方案名称"
              type="text"
              placeholder="例如：公司网关"
              value={newPresetName}
              onChange={(event) => setNewPresetName(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Base URL</span>
            <input
              aria-label="新方案 Base URL"
              type="url"
              placeholder="https://example.com/v1"
              value={newPresetUrl}
              onChange={(event) => setNewPresetUrl(event.target.value)}
              required
            />
          </label>
          <button className="primary-button" type="submit" disabled={addingPreset}>
            {addingPreset ? '保存中…' : '保存方案'}
          </button>
        </form>
      ) : null}

      <div className="preset-grid">
        {presets.map((preset) => (
          <div className="preset-card-wrap" key={preset.id}>
            <button
              className={`preset-card${form.presetId === preset.id ? ' is-active' : ''}`}
              type="button"
              onClick={() => applyPreset(preset)}
            >
              <strong>{preset.name}</strong>
              <small>{preset.baseUrl}</small>
              {preset.model ? <small>{preset.model}</small> : null}
            </button>
            {preset.id.startsWith('custom-') ? (
              <button
                className="preset-card-remove"
                type="button"
                onClick={() => void removePreset(preset)}
              >
                删除方案
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="llm-form animate-fade-up" key={form.presetId}>
        <label className="llm-toggle">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
          />
          <span className="llm-toggle-copy">
            <strong>启用模型辅助判断</strong>
            <small>原有模型辅助流程总开关；关闭时完全使用本地规则，不会调用外部模型。</small>
          </span>
        </label>

        <label className="llm-toggle llm-toggle-secondary">
          <input
            type="checkbox"
            checked={form.secondReviewEnabled}
            disabled={!form.enabled}
            onChange={(event) => setForm((current) => ({ ...current, secondReviewEnabled: event.target.checked }))}
          />
          <span className="llm-toggle-copy">
            <strong>启用单模型二次复核</strong>
            <small>开启后使用低 Token 的单模型二次复核模式；关闭时保留原来的模型辅助判断流程。</small>
          </span>
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
          {hasApiKey ? <small className="field-hint">已有密钥，留空会继续使用已保存的密钥</small> : null}
          <button className="key-reset-button" type="button" onClick={resetApiKey}>
            重置 API Key
          </button>
        </label>

        <div className="llm-model-field">
          <div className="field-label-row">
            <label htmlFor="llm-model">模型名称{activeModels.length > 0 ? `（已检测 ${activeModels.length} 个可用模型）` : ''}</label>
            <button
              className="inline-action"
              aria-label="自动检测模型"
              type="button"
              onClick={() => void discoverModels()}
              disabled={discoveringModels || !form.baseUrl}
            >
              {discoveringModels ? '检测中…' : '自动检测模型'}
            </button>
          </div>
          {activeModels.length > 0 ? (
            <select
              id="llm-model"
              aria-label="模型名称"
              value={usingCustomModel ? '__custom__' : form.model}
              onChange={(event) => {
                const value = event.target.value
                if (value === '__custom__') {
                  setForm((current) => ({ ...current, model: '' }))
                  return
                }
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
              id="llm-model"
              aria-label="模型名称"
              type="text"
              placeholder="deepseek-chat"
              value={form.model}
              onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
            />
          ) : null}
        </div>

        <label>
          <span>二次复核预算</span>
          <select
            aria-label="二次复核预算"
            value={form.maxSegments}
            onChange={(event) => setForm((current) => ({ ...current, maxSegments: Number(event.target.value) }))}
          >
            {[3, 6, 10, 15, 30].map((value) => (
              <option value={value} key={value}>最多复核 {value} 个片段</option>
            ))}
          </select>
          <small className="field-hint">默认只复核本地规则最值得复核的片段，不会把整篇文本发送给模型。</small>
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
