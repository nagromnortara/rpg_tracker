import { useState } from 'react'
import Modal from '../ui/Modal'
import type { PendingDiceRoll } from '../../lib/types'

interface Props {
  rolls: PendingDiceRoll[]
  onConfirm: (results: { character_condition_id: string; rolled_turns: number }[]) => void
  onClose: () => void
}

export default function DiceRollModal({ rolls, onConfirm, onClose }: Props) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(rolls.map(r => [r.characterConditionId, '']))
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const results = rolls.map(r => ({
      character_condition_id: r.characterConditionId,
      rolled_turns: parseInt(values[r.characterConditionId]) || 1,
    }))
    onConfirm(results)
  }

  const allFilled = rolls.every(r => parseInt(values[r.characterConditionId]) > 0)

  return (
    <Modal title="Phase Transition — Roll Required" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
          The following conditions are advancing to a new phase. Enter the rolled duration for each.
        </p>
        {rolls.map(roll => (
          <div key={roll.characterConditionId}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{roll.conditionName}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Phase {roll.phaseOrder + 1} — {roll.diceExpression}</span>
            </div>
            <input
              className="input"
              type="number"
              min={1}
              placeholder={`Roll ${roll.diceExpression}`}
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
