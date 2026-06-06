import { useState } from 'react'
import CharacterCard from './CharacterCard'
import DiceRollModal from './DiceRollModal'
import { computePendingDiceRolls } from '../../lib/endTurnCheck'
import type { Campaign, Character, CharacterCondition, ConditionGroup, Condition, ConditionPhase, PendingDiceRoll } from '../../lib/types'

interface Props {
  campaign: Campaign
  characters: Character[]
  charConditions: CharacterCondition[]
  groups: ConditionGroup[]
  conditions: Condition[]
  phases: ConditionPhase[]
  onEndTurn: (characterId: string, diceRolls: { character_condition_id: string; rolled_turns: number }[]) => Promise<unknown>
  onApplyCondition: (params: { character_id: string; condition_id: string; first_phase_turns: number; source_note?: string }) => Promise<unknown>
}

export default function TacticalTracker({
  campaign, characters, charConditions, groups, conditions, phases, onEndTurn, onApplyCondition
}: Props) {
  const [pendingRolls, setPendingRolls] = useState<PendingDiceRoll[] | null>(null)
  const [pendingCharId, setPendingCharId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const sorted = [...characters]
    .filter(c => c.is_active && c.initiative_order !== null)
    .sort((a, b) => (a.initiative_order ?? 0) - (b.initiative_order ?? 0))

  const currentChar = sorted[campaign.current_initiative_index % Math.max(sorted.length, 1)]

  function handleEndTurnClick() {
    if (!currentChar) return
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
    try {
      await onEndTurn(charId, rolls)
    } finally {
      setSaving(false)
      setPendingRolls(null)
      setPendingCharId(null)
    }
  }

  return (
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
        {saving ? 'Processing...' : 'END TURN'}
      </button>

      <hr className="divider" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {sorted.map(char => (
          <div key={char.id} style={{ opacity: char.id === currentChar?.id ? 1 : 0.6 }}>
            <CharacterCard
              character={char}
              charConditions={charConditions}
              groups={groups}
              conditions={conditions}
              phases={phases}
              turnsPerMinute={campaign.turns_per_minute}
              isCurrentTurn={char.id === currentChar?.id}
              onApplyCondition={onApplyCondition}
            />
          </div>
        ))}
      </div>

      {pendingRolls && pendingCharId && (
        <DiceRollModal
          rolls={pendingRolls}
          turnsPerMinute={campaign.turns_per_minute}
          onConfirm={results => doEndTurn(pendingCharId, results)}
          onClose={() => { setPendingRolls(null); setPendingCharId(null) }}
        />
      )}
    </div>
  )
}
