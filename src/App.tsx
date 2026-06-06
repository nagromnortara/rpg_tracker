import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import AdminPage from './pages/AdminPage'
import PlayerPage from './pages/PlayerPage'
import { useVersionCheck } from './hooks/useVersionCheck'

export default function App() {
  useVersionCheck()

  return (
    <div data-theme="fallout1945" style={{ minHeight: '100vh' }}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/campaign/:campaignId/admin/:adminToken" element={<AdminPage />} />
        <Route path="/campaign/:campaignId/player/:playerToken" element={<PlayerPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  )
}

function NotFound() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--text-primary)' }}>404</h1>
      <p style={{ color: 'var(--text-muted)' }}>This page does not exist.</p>
      <a href={import.meta.env.BASE_URL} style={{ color: 'var(--accent-secondary)' }}>Return home</a>
    </div>
  )
}
