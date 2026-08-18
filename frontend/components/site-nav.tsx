
import { apiUrl } from '@/frontend/api'

import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

const links = [
  { href: '/', label: '检测' },
  { href: '/history', label: '历史记录' },
  { href: '/rules', label: '自定义规则' },
  { href: '/settings', label: '模型设置' },
]

export function SiteNav() {
  const pathname = useLocation().pathname
  const [engineLabel, setEngineLabel] = useState('本地规则检测')

  useEffect(() => {
    let cancelled = false
    void fetch(apiUrl('/api/status'))
      .then((response) => response.json() as Promise<{ label?: string }>)
      .then((body) => {
        if (!cancelled && body.label) setEngineLabel(body.label)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="site-nav-wrap">
      <nav className="site-nav" aria-label="主导航">
        {links.map((link) => (
          <Link
            className={pathname === link.href ? 'site-nav-link is-active' : 'site-nav-link'}
            to={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="topbar-note" aria-label="当前检测引擎">
        <span className="status-dot" aria-hidden="true" />
        {engineLabel}
      </div>
    </div>
  )
}
