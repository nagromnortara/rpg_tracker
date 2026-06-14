import { useState } from 'react'
import { formatTime, formatDay } from '../../lib/time'
import { computeExplorationPendingRolls } from '../../lib/endTurnCheck'
import { currentRound, aggregateRounds } from '../../lib/effects'
import DiceRollModal from './DiceRollModal'
import type { Campaign, Character, CharacterCondition, Condition, ConditionPhase, PhaseEffect, PendingDiceRoll } from '../../lib/types'
import type { DiceRollResult, EffectLogInput } from '../../hooks/useAdminActions'

interface Props {
  campaign: Campaign
  characters: Character[]
  charConditions: CharacterCondition[]
  conditions: Condition[]
  phases: ConditionPhase[]
  phaseEffects: PhaseEffect[]
  onAdvanceTime: (minutes: number, diceRolls?: DiceRollResult[], effectLog?: EffectLogInput[]) => Promise<unknown>
}

export default function ExplorationClock({ campaign, characters, charConditions, conditions, phases, phaseEffects, onAdvanceTime }: Props) {
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(0)
  const [saving, setSaving] = useState(false)
  const [pendingMinutes, setPendingMinutes] = useState(0)
  const [pendingRolls, setPendingRolls] = useState<PendingDiceRoll[]>([])

  async function handleAdvance(e: React.FormEvent) {
    e.preventDefault()
    const total = hours * 60 + minutes
    if (total <= 0) return

    const advTurns = total * campaign.turns_per_minute
    const rolls = computeExplorationPendingRolls(advTurns, charConditions, characters, conditions, phases, phaseEffects)

    if (rolls.length > 0) {
      setPendingMinutes(total)
      setPendingRolls(rolls)
      return
    }

    await doAdvance(total)
  }

  // Cumulative effects across all rounds traversed within each condition's
  // current phase during a bulk time-skip (one entry per condition/target).
  function buildEffectLog(total: number): EffectLogInput[] {
    const advTurns = total * campaign.turns_per_minute
    const activeCharIds = new Set(characters.filter(c => c.is_active).map(c => c.id))
    const out: EffectLogInput[] = []
    for (const cc of charConditions.filter(c => c.is_active && activeCharIds.has(c.character_id))) {
      const phase = phases.find(p => p.condition_id === cc.condition_id && p.phase_order === cc.current_phase)
      if (!phase) continue
      const effs = phaseEffects.filter(e => e.phase_id === phase.id)
      if (effs.length === 0) continue
      const r = currentRound(cc.phase_total_turns, cc.remaining_turns)
      const roundsInPhase = Math.min(advTurns, cc.remaining_turns)
      const cond = conditions.find(c => c.id === cc.condition_id)
      for (const f of aggregateRounds(effs, cc.effect_values, r, r + roundsInPhase - 1, cc.phase_total_turns)) {
        out.push({
          character_id: cc.character_id,
          condition_id: cc.condition_id,
          turn: campaign.current_turn,
          label: cond?.name ?? 'Unknown',
          target: f.target,
          value: f.value,
          detail: f.detail,
        })
      }
    }
    return out
  }

  async function doAdvance(total: number, diceRolls?: DiceRollResult[]) {
    setSaving(true)
    try {
      await onAdvanceTime(total, diceRolls, buildEffectLog(total))
      setHours(0)
      setMinutes(0)
    } finally {
      setSaving(false)
    }
  }

  async function handleDiceConfirm(results: DiceRollResult[]) {
    setPendingRolls([])
    await doAdvance(pendingMinutes, results)
    setPendingMinutes(0)
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', color: 'var(--text-primary)', lineHeight: 1 }}>
            {formatTime(campaign.current_turn, campaign.turns_per_minute)}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem', letterSpacing: '0.08em' }}>
            {formatDay(campaign.current_turn, campaign.turns_per_minute)}
          </div>
        </div>

        <hr className="divider" />

        <form onSubmit={handleAdvance} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '0.08em' }}>ADVANCE TIME</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flex: 1 }}>
              <input
                className="input"
                type="number" min={0} max={999} value={hours}
                onChange={e => setHours(parseInt(e.target.value) || 0)}
                style={{ textAlign: 'center', padding: '0.4rem 0.25rem' }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', flexShrink: 0 }}>h</span>
            </div>
            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flex: 1 }}>
              <input
                className="input"
                type="number" min={0} max={59} value={minutes}
                onChange={e => setMinutes(parseInt(e.target.value) || 0)}
                style={{ textAlign: 'center', padding: '0.4rem 0.25rem' }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', flexShrink: 0 }}>m</span>
            </div>
            <button className="btn btn-secondary" type="submit" disabled={saving || (hours === 0 && minutes === 0)}
              style={{ flexShrink: 0, padding: '0.4rem 0.75rem' }}>
              {saving ? '...' : '+'}
            </button>
          </div>
        </form>
      </div>

      {pendingRolls.length > 0 && (
        <DiceRollModal
          rolls={pendingRolls}
          turnsPerMinute={campaign.turns_per_minute}
          onConfirm={handleDiceConfirm}
          onClose={() => { setPendingRolls([]); setPendingMinutes(0) }}
        />
      )}
    </>
  )
}
