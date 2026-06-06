import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useCampaignData } from '../hooks/useCampaignData'
import { useAdminActions } from '../hooks/useAdminActions'
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

  const playerBaseUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}`

  if (data.loading) return <LoadingScreen />
  if (data.error) return <ErrorScreen message={data.error} />
  if (!data.campaign) return <ErrorScreen message="Campaign not found." />

  const { campaign, groups, conditions, phases, characters, charConditions } = data
  const activeChars = characters.filter(c => c.is_active && !c.is_npc)

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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border-color)',
        padding: '0.75rem 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--bg-secondary)',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--text-primary)' }}>
          {campaign.name}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className={`badge ${campaign.mode === 'tactical' ? 'badge-active' : ''}`}>
            {campaign.mode.toUpperCase()}
          </span>
          <button className="btn btn-secondary" onClick={() => setShowSettings(v => !v)}
            style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}>
            ⚙ Settings
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, gap: 0, overflow: 'hidden' }}>
        {/* Left panel: time + mode */}
        <aside style={{
          width: '260px', flexShrink: 0,
          borderRight: '1px solid var(--border-color)',
          padding: '1.25rem',
          display: 'flex', flexDirection: 'column', gap: '1rem',
          background: 'var(--bg-secondary)',
          overflowY: 'auto',
        }}>
          {campaign.mode === 'exploration' ? (
            <ExplorationClock campaign={campaign} onAdvanceTime={actions.advanceTime} />
          ) : (
            <TacticalTracker
              campaign={campaign}
              characters={characters}
              charConditions={charConditions}
              groups={groups}
              conditions={conditions}
              phases={phases}
              onEndTurn={actions.endTurnAdvance}
              onApplyCondition={actions.applyCondition}
            />
          )}

          <hr className="divider" />

          {/* Mode switch */}
          {campaign.mode === 'exploration' ? (
            <button
              className="btn btn-secondary"
              onClick={() => setShowInitiative(true)}
              style={{ fontSize: '0.82rem', padding: '0.45rem' }}
            >
              ⚔ Switch to Tactical
            </button>
          ) : (
            <button
              className="btn btn-secondary"
              onClick={handleSwitchToExploration}
              style={{ fontSize: '0.82rem', padding: '0.45rem' }}
            >
              🕐 Return to Exploration
            </button>
          )}
        </aside>

        {/* Main area: characters (exploration mode shows grid, tactical is in sidebar) */}
        <main style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
          {campaign.mode === 'exploration' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
                  Characters
                </h2>
              </div>
              {activeChars.length === 0 ? (
                <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <p>No characters yet. Add characters in Settings → Characters.</p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '1rem',
                }}>
                  {activeChars.map(char => (
                    <CharacterCard
                      key={char.id}
                      character={char}
                      charConditions={charConditions}
                      groups={groups}
                      conditions={conditions}
                      phases={phases}
                      onApplyCondition={actions.applyCondition}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '3rem' }}>
              <p>Tactical mode active — character cards are in the left panel.</p>
            </div>
          )}
        </main>
      </div>

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
