import { useState } from 'react'
import Modal from '../ui/Modal'
import { toTurns } from '../../lib/dice'
import type { PendingDiceRoll } from '../../lib/types'

interface Props {
  rolls: PendingDiceRoll[]
  turnsPerMinute: number
  onConfirm: (results: { character_condition_id: string; rolled_turns: number }[]) => void
  onClose: () => void
}

export default function DiceRollModal({ rolls, turnsPerMinute, onConfirm, onClose }: Props) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(rolls.map(r => [r.characterConditionId, '']))
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const results = rolls.map(r => ({
      character_condition_id: r.characterConditionId,
      rolled_turns: toTurns(parseInt(values[r.characterConditionId]) || 1, r.durationUnit, turnsPerMinute),
    }))
    onConfirm(results)
  }

  const allFilled = rolls.every(r => parseInt(values[r.characterConditionId]) > 0)

  return (
    <Modal title="Phase Transition — Roll Required" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
          The following conditions are advancing to a new phase. Roll and enter the result.
        </p>
        {rolls.map(roll => (
          <div key={roll.characterConditionId}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{roll.conditionName}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Phase {roll.phaseOrder + 1} — {roll.diceExpression} {roll.durationUnit}
              </span>
            </div>
            <input
              className="input"
              type="number"
              min={1}
              placeholder={`# of ${roll.durationUnit}`}
              value={values[roll.characterConditionId]}
              onChange={e => setValues(v => ({ ...v, [roll.characterConditionId]: e.target.value }))}
              required
              autoFocus
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button className="btn btn-secondary" type="button" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" type="submit" disabled={!allFilled} style={{ flex: 1 }}>
            Confirm &amp; End Turn
          </button>
        </div>
      </form>
    </Modal>
  )
}
