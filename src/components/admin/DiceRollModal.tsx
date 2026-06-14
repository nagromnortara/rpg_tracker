import { useState } from 'react'
import Modal from '../ui/Modal'
import { toTurns } from '../../lib/dice'
import type { PendingDiceRoll } from '../../lib/types'
import type { DiceRollResult } from '../../hooks/useAdminActions'

interface Props {
  rolls: PendingDiceRoll[]
  turnsPerMinute: number
  onConfirm: (results: DiceRollResult[]) => void
  onClose: () => void
}

// State key for a single numeric input: either the duration of a roll, or one
// of its effects.
function durKey(ccId: string) { return `${ccId}::duration` }
function effKey(ccId: string, effectId: string) { return `${ccId}::eff::${effectId}` }

export default function DiceRollModal({ rolls, turnsPerMinute, onConfirm, onClose }: Props) {
  const [values, setValues] = useState<Record<string, string>>({})

  function set(key: string, v: string) {
    setValues(prev => ({ ...prev, [key]: v }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const results: DiceRollResult[] = rolls.map(r => {
      const effect_values: Record<string, number> = {}
      for (const eff of r.effects) {
        effect_values[eff.effectId] = parseInt(values[effKey(r.characterConditionId, eff.effectId)]) || 0
      }
      // rolled_turns matters only when the phase's duration is dice; for a fixed
      // duration the server recomputes it from the phase expression.
      const rolled_turns = r.diceExpression
        ? toTurns(parseInt(values[durKey(r.characterConditionId)]) || 1, r.durationUnit, turnsPerMinute)
        : 0
      return { character_condition_id: r.characterConditionId, rolled_turns, effect_values }
    })
    onConfirm(results)
  }

  const allFilled = rolls.every(r => {
    const durOk = !r.diceExpression || parseInt(values[durKey(r.characterConditionId)]) > 0
    const effOk = r.effects.every(eff => parseInt(values[effKey(r.characterConditionId, eff.effectId)]) >= 0
      && values[effKey(r.characterConditionId, eff.effectId)] !== undefined
      && values[effKey(r.characterConditionId, eff.effectId)] !== '')
    return durOk && effOk
  })

  return (
    <Modal title="Phase Transition — Roll Required" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
          The following conditions are advancing to a new phase. Roll and enter the result(s).
        </p>
        {rolls.map(roll => (
          <div key={roll.characterConditionId} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                {roll.conditionName}
                {roll.characterName && (
                  <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: '0.4rem', fontSize: '0.8rem' }}>
                    ({roll.characterName})
                  </span>
                )}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Phase {roll.phaseOrder + 1}</span>
            </div>

            {roll.diceExpression && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  Duration — roll {roll.diceExpression}, enter {roll.durationUnit}
                </span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  placeholder={`# of ${roll.durationUnit}`}
                  value={values[durKey(roll.characterConditionId)] ?? ''}
                  onChange={e => set(durKey(roll.characterConditionId), e.target.value)}
                  required
                  autoFocus
                />
              </label>
            )}

            {roll.effects.map(eff => (
              <label key={eff.effectId} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  {eff.target} — roll {eff.diceExpression}
                </span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  placeholder={`${eff.target} value`}
                  value={values[effKey(roll.characterConditionId, eff.effectId)] ?? ''}
                  onChange={e => set(effKey(roll.characterConditionId, eff.effectId), e.target.value)}
                  required
                />
              </label>
            ))}
          </div>
        ))}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button className="btn btn-secondary" type="button" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" type="submit" disabled={!allFilled} style={{ flex: 1 }}>
            Confirm
          </button>
        </div>
      </form>
    </Modal>
  )
}
