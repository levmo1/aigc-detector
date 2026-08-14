
import { Link, useLocation } from 'react-router-dom'

const links = [
  { href: '/', label: '检测' },
  { href: '/history', label: '历史记录' },
  { href: '/rules', label: '自定义规则' },
  { href: '/settings', label: '模型设置' },
]

export function SiteNav() {
  const pathname = useLocation().pathname

  return (
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
  )
}
