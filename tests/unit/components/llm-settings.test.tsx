import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LlmSettings } from '@/frontend/components/llm-settings'

const configResponse = {
  enabled: false,
  secondReviewEnabled: true,
  presetId: 'deepseek',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  timeoutMs: 30000,
  maxSegments: 30,
  hasApiKey: false,
  presets: [
    {
      id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat',
      models: [
        { id: 'deepseek-chat', name: 'DeepSeek Chat' },
        { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' },
      ],
    },
    {
      id: 'opencodego', name: 'OpencodeGO', baseUrl: 'https://opencode.ai/zen/go/v1', model: 'deepseek-v4-flash',
      models: [
        { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
        { id: 'kimi-k3', name: 'Kimi K3' },
      ],
    },
  ],
}

describe('LlmSettings', () => {
  it('keeps the model-assistance and second-review switches visible separately', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => configResponse }))

    render(<LlmSettings />)

    await waitFor(() => expect(screen.getByText('启用模型辅助判断')).toBeInTheDocument())
    expect(screen.getByText('启用单模型二次复核')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    expect(screen.getAllByRole('checkbox')[1]).toBeDisabled()
  })

  it('loads config and shows both preset options', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => configResponse }))

    render(<LlmSettings />)

    await waitFor(() => expect(screen.getByText('DeepSeek')).toBeInTheDocument())
    expect(screen.getByText('OpencodeGO')).toBeInTheDocument()
    expect(screen.getByLabelText('Base URL')).toHaveValue('https://api.deepseek.com')
  })

  it('applies a preset to the form fields and its first detected model', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => configResponse }))

    render(<LlmSettings />)
    await waitFor(() => expect(screen.getByText('OpencodeGO')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /OpencodeGO/ }))

    expect(screen.getByLabelText('Base URL')).toHaveValue('https://opencode.ai/zen/go/v1')
    expect(screen.getByLabelText('模型名称')).toHaveValue('deepseek-v4-flash')
  })

  it('lists detected models in the dropdown and switches between them', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => configResponse }))

    render(<LlmSettings />)
    await waitFor(() => expect(screen.getByText('DeepSeek')).toBeInTheDocument())

    const modelSelect = screen.getByLabelText('模型名称') as HTMLSelectElement
    expect(modelSelect.tagName).toBe('SELECT')
    expect(modelSelect.options.length).toBeGreaterThanOrEqual(3)

    await user.selectOptions(modelSelect, 'deepseek-reasoner')
    expect(modelSelect.value).toBe('deepseek-reasoner')
  })

  it('saves the configuration via PUT', async () => {
    const user = userEvent.setup()
    const putMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...configResponse, enabled: true }) })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => configResponse })
      .mockImplementationOnce(putMock)
    vi.stubGlobal('fetch', fetchMock)

    render(<LlmSettings />)
    await waitFor(() => expect(screen.getByText('DeepSeek')).toBeInTheDocument())

    await user.type(screen.getByLabelText('API Key'), 'sk-test')
    await user.click(screen.getByRole('button', { name: '保存设置' }))

    await waitFor(() => expect(putMock).toHaveBeenCalled())
    const body = JSON.parse(putMock.mock.calls[0][1].body as string)
    expect(body.apiKey).toBe('sk-test')
    expect(body.model).toBe('deepseek-chat')
  })

  it('tests the connection with current settings', async () => {
    const user = userEvent.setup()
    const testMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, message: '连接成功' }) })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => configResponse })
      .mockImplementationOnce(testMock)
    vi.stubGlobal('fetch', fetchMock)

    render(<LlmSettings />)
    await waitFor(() => expect(screen.getByText('DeepSeek')).toBeInTheDocument())

    await user.type(screen.getByLabelText('API Key'), 'sk-test')
    await user.click(screen.getByRole('button', { name: '测试连接' }))

    await waitFor(() => expect(screen.getByText(/连接成功/)).toBeInTheDocument())
  })

  it('adds a named custom preset', async () => {
    const user = userEvent.setup()
    const customPreset = {
      id: 'custom-company',
      name: '公司网关',
      baseUrl: 'https://gateway.example.com/v1',
      model: '',
      models: [],
    }
    const createMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...configResponse, presetId: customPreset.id, presets: [...configResponse.presets, customPreset] }),
    })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => configResponse })
      .mockImplementationOnce(createMock)
    vi.stubGlobal('fetch', fetchMock)

    render(<LlmSettings />)
    await waitFor(() => expect(screen.getByText('DeepSeek')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: '＋ 添加方案' }))
    await user.type(screen.getByLabelText('方案名称'), '公司网关')
    await user.type(screen.getByLabelText('新方案 Base URL'), 'https://gateway.example.com/v1')
    await user.click(screen.getByRole('button', { name: '保存方案' }))

    await waitFor(() => expect(createMock).toHaveBeenCalled())
    expect(screen.getByText('公司网关')).toBeInTheDocument()
    expect(JSON.parse(createMock.mock.calls[0][1].body as string)).toEqual({
      name: '公司网关',
      baseUrl: 'https://gateway.example.com/v1',
    })
  })

  it('deletes a user-created preset and falls back to the built-in provider', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const customPreset = {
      id: 'custom-company',
      name: '公司网关',
      baseUrl: 'https://gateway.example.com/v1',
      model: '',
      models: [],
    }
    const deleteMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => configResponse,
    })
    const withCustom = { ...configResponse, presetId: customPreset.id, presets: [...configResponse.presets, customPreset] }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => withCustom })
      .mockImplementationOnce(deleteMock)
    vi.stubGlobal('fetch', fetchMock)

    render(<LlmSettings />)
    await waitFor(() => expect(screen.getByText('公司网关')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: '删除方案' }))

    await waitFor(() => expect(deleteMock).toHaveBeenCalled())
    expect(deleteMock.mock.calls[0][0]).toContain('/api/llm-config/presets/custom-company')
    expect(screen.queryByText('公司网关')).not.toBeInTheDocument()
    expect(screen.getByText('DeepSeek')).toBeInTheDocument()
  })

  it('detects models and updates the model dropdown', async () => {
    const user = userEvent.setup()
    const modelsMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        message: '已检测到 2 个可用模型。',
        models: [
          { id: 'gateway-a', name: 'Gateway A' },
          { id: 'gateway-b', name: 'Gateway B' },
        ],
      }),
    })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => configResponse })
      .mockImplementationOnce(modelsMock)
    vi.stubGlobal('fetch', fetchMock)

    render(<LlmSettings />)
    await waitFor(() => expect(screen.getByText('DeepSeek')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: '自动检测模型' }))

    await waitFor(() => expect(screen.getByText('已检测到 2 个可用模型。')).toBeInTheDocument())
    expect(screen.getByLabelText('模型名称')).toHaveValue('gateway-a')
    expect(JSON.parse(modelsMock.mock.calls[0][1].body as string)).toMatchObject({
      presetId: 'deepseek',
      baseUrl: 'https://api.deepseek.com',
    })
  })

  it('resets the API key with confirmation', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const putMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...configResponse, hasApiKey: false }),
    })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...configResponse, hasApiKey: true }) })
      .mockImplementationOnce(putMock)
    vi.stubGlobal('fetch', fetchMock)

    render(<LlmSettings />)
    await waitFor(() => expect(screen.getByText('DeepSeek')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: '重置 API Key' }))

    await waitFor(() => expect(putMock).toHaveBeenCalled())
    const body = JSON.parse(putMock.mock.calls[0][1].body as string)
    expect(body.resetApiKey).toBe(true)
    expect(body.apiKey).toBe('')
    expect(screen.getByText(/API Key 已重置/)).toBeInTheDocument()
  })
})
