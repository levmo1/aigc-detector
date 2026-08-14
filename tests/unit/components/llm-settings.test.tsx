import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LlmSettings } from '@/frontend/components/llm-settings'

const configResponse = {
  enabled: false,
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
    { id: 'custom', name: '自定义方案', baseUrl: '', model: '', models: [] },
  ],
}

describe('LlmSettings', () => {
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

  it('switches to the custom preset and lets the user fill in everything', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => configResponse }))

    render(<LlmSettings />)
    await waitFor(() => expect(screen.getByText('自定义方案')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /自定义方案/ }))

    expect(screen.getByLabelText('Base URL')).toHaveValue('')
    const modelInput = screen.getByLabelText('模型名称') as HTMLInputElement
    expect(modelInput.tagName).toBe('INPUT')

    await user.type(screen.getByLabelText('Base URL'), 'https://my-gateway.example.com/v1')
    await user.type(modelInput, 'my-model')
    expect(modelInput.value).toBe('my-model')
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
