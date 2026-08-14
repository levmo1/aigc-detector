import { fetch as undiciFetch, ProxyAgent, type Dispatcher, type RequestInit as UndiciRequestInit } from 'undici'

function noProxyMatches(hostname: string, noProxy: string): boolean {
  return noProxy.split(',').some((entry) => {
    const normalized = entry.trim().replace(/^\./u, '')
    if (!normalized) return false
    if (normalized === '*') return true
    if (normalized === hostname) return true
    if (hostname.endsWith(`.${normalized}`)) return true
    return false
  })
}

function createDispatcher(targetUrl: string): Dispatcher | undefined {
  const proxyUrl = process.env.HTTPS_PROXY
    ?? process.env.https_proxy
    ?? process.env.HTTP_PROXY
    ?? process.env.http_proxy

  if (!proxyUrl) return undefined

  const hostname = new URL(targetUrl).hostname
  const noProxy = process.env.NO_PROXY ?? process.env.no_proxy ?? ''

  if (noProxyMatches(hostname, noProxy)) return undefined

  try {
    return new ProxyAgent(proxyUrl)
  } catch {
    return undefined
  }
}

export function llmFetch(url: string, init: UndiciRequestInit): Promise<Response> {
  const dispatcher = createDispatcher(url)
  const promise = dispatcher ? undiciFetch(url, { ...init, dispatcher }) : undiciFetch(url, init)
  return promise as unknown as Promise<Response>
}
