import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useCampaignData } from '../hooks/useCampaignData'
import { useAdminActions } from '../hooks/useAdminActions'
import { useIsMobile } from '../hooks/useIsMobile'
import ExplorationClock from '../components/admin/ExplorationClock'
import TacticalTracker from '../components/admin/TacticalTracker'
import InitiativeSetupModal from '../components/admin/InitiativeSetupModal'
import CharacterCard from '../components/admin/CharacterCard'
import SettingsPanel from '../components/admin/SettingsPanel'

export default function AdminPage() {
  const { campaignId, adminToken } = useParams<{ campaignId: string; adminToken: string }>()
  const { refetch, ...data } = useCampaignData(campaignId)
  const actions = useAdminActions(campaignId!, adminToken!, refetch)

  const [showSettings, setShowSettings] = useState(false)
  const [showInitiative, setShowInitiative] = useState(false)
  const [mobileTab, setMobileTab] = useState<'characters' | 'controls'>('characters')
  const isMobile = useIsMobile()

  const playerBaseUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}`

  if (data.loading) return <LoadingScreen />
  if (data.error) return <ErrorScreen message={data.error} />
  if (!data.campaign) return <ErrorScreen message="Campaign not found." />

  const { campaign, groups, conditions, phases, characters, charConditions } = data
  const activeChars = characters.filter(c => c.is_active && !c.is_npc)
  const tacticalSorted = [...characters]
    .filter(c => c.is_active && c.initiative_order !== null)
    .sort((a, b) => (a.initiative_order ?? 0) - (b.initiative_order ?? 0))
  const currentTurnCharId = campaign.mode === 'tactical'
    ? tacticalSorted[campaign.current_initiative_index % Math.max(tacticalSorted.length, 1)]?.id
    : undefined

  async function handleSwitchToTactical(rows: { tempId: string; characterId: string | null; name: string; isNpc: boolean }[], npcNames: string[]) {
    // Create NPC characters first
    const npcResults: { name: string; id: string }[] = []
    for (const npcName of npcNames) {
      const result = await actions.addCharacter(npcName, true)
      npcResults.push({ name: npcName, id: result.id })
    }

    // Build assignments: existing chars + newly created NPCs
    let npcIdx = 0
    const assignments: { character_id: string; initiative_order: number }[] = []
    rows.forEach((row, i) => {
      if (row.characterId) {
        assignments.push({ character_id: row.characterId, initiative_order: i + 1 })
      } else {
        // match by order of npcResults
        assignments.push({ character_id: npcResults[npcIdx++].id, initiative_order: i + 1 })
      }
    })

    await actions.switchToTactical(assignments)
  }

  async function handleSwitchToExploration() {
    await actions.switchToExploration()
  }

  const controlsPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>
      {campaign.mode === 'exploration' ? (
        <ExplorationClock
          campaign={campaign}
          characters={characters}
          charConditions={charConditions}
          conditions={conditions}
          phases={phases}
          onAdvanceTime={actions.advanceTime}
        />
      ) : (
        <TacticalTracker
          campaign={campaign}
          characters={characters}
          charConditions={charConditions}
          conditions={conditions}
          phases={phases}
          currentCharId={currentTurnCharId}
          onEndTurn={actions.endTurnAdvance}
        />
      )}
      <hr className="divider" />
      {campaign.mode === 'exploration' ? (
        <button
          className="btn btn-secondary"
          onClick={() => setShowInitiative(true)}
          style={{ fontSize: '0.82rem', padding: '0.55rem' }}
        >
          ⚔ Switch to Tactical
        </button>
      ) : (
        <button
          className="btn btn-secondary"
          onClick={handleSwitchToExploration}
          style={{ fontSize: '0.82rem', padding: '0.55rem' }}
        >
          🕐 Return to Exploration
        </button>
      )}
    </div>
  )

  const displayChars = campaign.mode === 'tactical' ? tacticalSorted : activeChars
  const charactersPanel = (
    <div style={{ padding: isMobile ? '1rem' : '1.5rem', paddingBottom: isMobile ? '80px' : '1.5rem' }}>
      {displayChars.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p>No characters yet. Add characters in Settings → Characters.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem',
        }}>
          {displayChars.map(char => (
            <CharacterCard
              key={char.id}
              character={char}
              charConditions={charConditions}
              groups={groups}
              conditions={conditions}
              phases={phases}
              turnsPerMinute={campaign.turns_per_minute}
              isCurrentTurn={char.id === currentTurnCharId}
              onApplyCondition={actions.applyCondition}
            />
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border-color)',
        padding: isMobile ? '0.6rem 1rem' : '0.75rem 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--bg-secondary)',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: isMobile ? '1.1rem' : '1.4rem', color: 'var(--text-primary)' }}>
          {campaign.name}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={`badge ${campaign.mode === 'tactical' ? 'badge-active' : ''}`} style={{ fontSize: '0.7rem' }}>
            {campaign.mode.toUpperCase()}
          </span>
          <button className="btn btn-secondary" onClick={() => setShowSettings(v => !v)}
            style={{ fontSize: '0.82rem', padding: '0.35rem 0.65rem' }}>
            ⚙{!isMobile && ' Settings'}
          </button>
        </div>
      </header>

      {isMobile ? (
        /* Mobile: full-width single column, tab bar at bottom */
        <>
          <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
            {mobileTab === 'characters' ? charactersPanel : (
              <div style={{ background: 'var(--bg-secondary)', minHeight: '100%' }}>
                {controlsPanel}
              </div>
            )}
          </div>

          <nav style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            display: 'flex',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            zIndex: 25,
          }}>
            <button
              onClick={() => setMobileTab('characters')}
              style={{
                flex: 1, padding: '0.75rem 0.5rem',
                background: mobileTab === 'characters' ? 'var(--bg-card)' : 'transparent',
                color: mobileTab === 'characters' ? 'var(--text-primary)' : 'var(--text-muted)',
                border: 'none', borderTop: `2px solid ${mobileTab === 'characters' ? 'var(--accent-primary)' : 'transparent'}`,
                fontFamily: 'var(--font-body)', fontSize: '0.75rem', letterSpacing: '0.06em', cursor: 'pointer',
              }}
            >
              CHARACTERS
            </button>
            <button
              onClick={() => setMobileTab('controls')}
              style={{
                flex: 1, padding: '0.75rem 0.5rem',
                background: mobileTab === 'controls' ? 'var(--bg-card)' : 'transparent',
                color: mobileTab === 'controls' ? 'var(--text-primary)' : 'var(--text-muted)',
                border: 'none', borderTop: `2px solid ${mobileTab === 'controls' ? 'var(--accent-primary)' : 'transparent'}`,
                fontFamily: 'var(--font-body)', fontSize: '0.75rem', letterSpacing: '0.06em', cursor: 'pointer',
              }}
            >
              CONTROLS
            </button>
          </nav>
        </>
      ) : (
        /* Desktop: sidebar + main area */
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <aside style={{
            width: '260px', flexShrink: 0,
            borderRight: '1px solid var(--border-color)',
            display: 'flex', flexDirection: 'column',
            background: 'var(--bg-secondary)',
            overflowY: 'auto',
          }}>
            {controlsPanel}
          </aside>
          <main style={{ flex: 1, overflowY: 'auto' }}>
            {charactersPanel}
          </main>
        </div>
      )}

      {/* Initiative setup modal */}
      {showInitiative && (
        <InitiativeSetupModal
          characters={characters}
          onConfirm={handleSwitchToTactical}
          onClose={() => setShowInitiative(false)}
        />
      )}

      {/* Settings drawer */}
      {showSettings && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 30 }}
            onClick={() => setShowSettings(false)}
          />
          <SettingsPanel
            campaign={campaign}
            groups={groups}
            conditions={conditions}
            phases={phases}
            characters={characters}
            playerBaseUrl={playerBaseUrl}
            actions={actions}
            onClose={() => setShowSettings(false)}
          />
        </>
      )}
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', letterSpacing: '0.1em' }}>LOADING...</p>
    </div>
  )
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
      <p style={{ color: 'var(--text-danger)' }}>{message}</p>
      <a href={import.meta.env.BASE_URL} style={{ color: 'var(--text-secondary)' }}>Return home</a>
    </div>
  )
}
