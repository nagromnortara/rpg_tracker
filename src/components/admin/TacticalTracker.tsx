import { useState } from 'react'
import DiceRollModal from './DiceRollModal'
import { computePendingDiceRolls } from '../../lib/endTurnCheck'
import type { Campaign, Character, CharacterCondition, Condition, ConditionPhase, PendingDiceRoll } from '../../lib/types'

interface Props {
  campaign: Campaign
  characters: Character[]
  charConditions: CharacterCondition[]
  conditions: Condition[]
  phases: ConditionPhase[]
  currentCharId: string | undefined
  onEndTurn: (characterId: string, diceRolls: { character_condition_id: string; rolled_turns: number }[]) => Promise<unknown>
}

export default function TacticalTracker({ campaign, characters, charConditions, conditions, phases, currentCharId, onEndTurn }: Props) {
  const [pendingRolls, setPendingRolls] = useState<PendingDiceRoll[] | null>(null)
  const [pendingCharId, setPendingCharId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [endTurnError, setEndTurnError] = useState<string | null>(null)

  const sorted = [...characters]
    .filter(c => c.is_active && c.initiative_order !== null)
    .sort((a, b) => (a.initiative_order ?? 0) - (b.initiative_order ?? 0))

  const currentChar = characters.find(c => c.id === currentCharId)

  function handleEndTurnClick() {
    if (!currentChar) return
    setEndTurnError(null)
    const rolls = computePendingDiceRolls(currentChar.id, charConditions, conditions, phases)
    if (rolls.length > 0) {
      setPendingRolls(rolls)
      setPendingCharId(currentChar.id)
    } else {
      doEndTurn(currentChar.id, [])
    }
  }

  async function doEndTurn(charId: string, rolls: { character_condition_id: string; rolled_turns: number }[]) {
    setSaving(true)
    setEndTurnError(null)
    try {
      await onEndTurn(charId, rolls)
    } catch (e) {
      setEndTurnError(e instanceof Error ? e.message : 'Failed to advance turn')
    } finally {
      setSaving(false)
      setPendingRolls(null)
      setPendingCharId(null)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {currentChar && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
              CURRENT TURN
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--text-primary)' }}>
              {currentChar.name}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Initiative #{currentChar.initiative_order}
            </div>
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={handleEndTurnClick}
          disabled={saving || !currentChar}
          style={{ padding: '0.6rem', letterSpacing: '0.08em', fontFamily: 'var(--font-body)' }}
        >
          {saving ? 'Processing...' : 'Move to next'}
        </button>
        {endTurnError && (
          <p style={{ color: 'var(--text-danger)', fontSize: '0.8rem', margin: 0, textAlign: 'center' }}>
            {endTurnError}
          </p>
        )}

        <hr className="divider" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', letterSpacing: '0.08em', marginBottom: '0.15rem' }}>
            INITIATIVE ORDER
          </div>
          {sorted.map(char => (
            <div key={char.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.3rem 0.5rem',
              background: char.id === currentCharId ? 'var(--bg-card)' : 'transparent',
              border: `1px solid ${char.id === currentCharId ? 'var(--accent-primary)' : 'transparent'}`,
              borderRadius: 'var(--radius)',
              opacity: char.id === currentCharId ? 1 : 0.55,
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', minWidth: '1.5rem', flexShrink: 0 }}>
                #{char.initiative_order}
              </span>
              <span style={{ color: char.id === currentCharId ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.85rem', flex: 1 }}>
                {char.name}
              </span>
              {char.is_npc && <span className="badge" style={{ fontSize: '0.6rem' }}>NPC</span>}
            </div>
          ))}
        </div>
      </div>

      {pendingRolls && pendingCharId && (
        <DiceRollModal
          rolls={pendingRolls}
          turnsPerMinute={campaign.turns_per_minute}
          onConfirm={results => doEndTurn(pendingCharId, results)}
          onClose={() => { setPendingRolls(null); setPendingCharId(null) }}
        />
      )}
    </>
  )
}
