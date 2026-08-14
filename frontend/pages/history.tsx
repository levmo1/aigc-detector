import { Link } from 'react-router-dom'
import { SiteNav } from '@/frontend/components/site-nav'
import { HistoryView } from '@/frontend/components/history-view'

export default function HistoryPage() {
  return (
    <main className="site-shell rules-shell animate-fade-up">
      <header className="topbar report-topbar">
        <Link className="brand" to="/" aria-label="返回首页">
          <span className="brand-mark" aria-hidden="true">文</span>
          <span>
            <strong>文脉校阅台</strong>
            <small>CHINESE TEXT LAB</small>
          </span>
        </Link>
      <div className="topbar-right">
        <SiteNav />
      </div>
      </header>
      <HistoryView />
    </main>
  )
}
