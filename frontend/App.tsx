import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/home'
import HistoryPage from './pages/history'
import ReportPage from './pages/report'
import RulesPage from './pages/rules'
import SettingsPage from './pages/settings'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/report/:id" element={<ReportPage />} />
      <Route path="/rules" element={<RulesPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  )
}
