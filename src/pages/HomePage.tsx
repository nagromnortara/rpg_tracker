import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function HomePage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [turnsPerMinute, setTurnsPerMinute] = useState(6)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ id: string; adminToken: string } | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('create_campaign', {
        p_name: name.trim(),
        p_turns_per_minute: turnsPerMinute,
      })
      if (rpcError) throw rpcError
      const result = data as { id: string; admin_token: string }
      setCreated({ id: result.id, adminToken: result.admin_token })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create campaign')
    } finally {
      setLoading(false)
    }
  }

  function handleEnter() {
    if (!created) return
    navigate(`/campaign/${created.id}/admin/${created.adminToken}`)
  }

  const adminUrl = created
    ? `${window.location.origin}/rpg_tracker/campaign/${created.id}/admin/${created.adminToken}`
    : ''

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '2rem',
    }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '2.5rem',
          color: 'var(--text-primary)', textAlign: 'center',
          marginBottom: '0.25rem', letterSpacing: '0.05em',
        }}>
          RPG Tracker
        </h1>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginBottom: '2.5rem', fontSize: '0.875rem' }}>
          Condition &amp; time tracker for tabletop campaigns
        </p>

        {!created ? (
          <form onSubmit={handleCreate} className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontSize: '0.8rem', letterSpacing: '0.08em' }}>
                CAMPAIGN NAME
              </label>
              <input
                className="input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="The Darkened Wastes"
                required
                autoFocus
              />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontSize: '0.8rem', letterSpacing: '0.08em' }}>
                TURNS PER MINUTE
              </label>
              <input
                className="input"
                type="number"
                min={1}
                max={60}
                value={turnsPerMinute}
                onChange={e => setTurnsPerMinute(parseInt(e.target.value) || 6)}
              />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                Used to convert between exploration and tactical time
              </p>
            </div>
            {error && <p style={{ color: 'var(--text-danger)', fontSize: '0.875rem' }}>{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={loading || !name.trim()}
              style={{ marginTop: '0.5rem', padding: '0.65rem', letterSpacing: '0.1em' }}>
              {loading ? 'CREATING...' : 'BEGIN CAMPAIGN'}
            </button>
          </form>
        ) : (
          <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', margin: 0 }}>
              Campaign Created
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
              Bookmark your admin link — it is the only way to manage this campaign.
            </p>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.35rem', fontSize: '0.75rem', letterSpacing: '0.08em' }}>
                ADMIN LINK
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  className="input"
                  value={adminUrl}
                  readOnly
                  style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
                />
                <button
                  className="btn btn-secondary"
                  type="button"
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  onClick={() => navigator.clipboard.writeText(adminUrl)}
                >
                  Copy
                </button>
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleEnter}
              style={{ padding: '0.65rem', letterSpacing: '0.1em' }}>
              ENTER CAMPAIGN
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
