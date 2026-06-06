import { useState } from 'react'
import Modal from '../ui/Modal'
import { formatDiceExpression, isDiceExpression, toTurns } from '../../lib/dice'
import type { Character, ConditionGroup, Condition, ConditionPhase } from '../../lib/types'

interface Props {
  character: Character
  groups: ConditionGroup[]
  conditions: Condition[]
  phases: ConditionPhase[]
  turnsPerMinute: number
  onApply: (params: { character_id: string; condition_id: string; first_phase_turns: number; source_note?: string }) => Promise<unknown>
  onClose: () => void
}

export default function ApplyConditionModal({ character, groups, conditions, phases, turnsPerMinute, onApply, onClose }: Props) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id ?? '')
  const [selectedConditionId, setSelectedConditionId] = useState<string>('')
  const [rolledTurns, setRolledTurns] = useState('')
  const [sourceNote, setSourceNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const groupConditions = conditions.filter(c => c.group_id === selectedGroupId)
  const selectedCondition = conditions.find(c => c.id === selectedConditionId)
  const firstPhase = selectedCondition
    ? phases.filter(p => p.condition_id === selectedCondition.id).sort((a, b) => a.phase_order - b.phase_order)[0]
    : null

  const needsDiceRoll = firstPhase?.duration_type === 'dice'

  function computeFirstPhaseTurns(): number | null {
    if (!firstPhase) return null
    if (firstPhase.duration_type === 'fixed') {
      const raw = parseInt(firstPhase.duration_expression)
      return isNaN(raw) ? null : toTurns(raw, firstPhase.duration_unit, turnsPerMinute)
    }
    const val = parseInt(rolledTurns)
    return val > 0 ? toTurns(val, firstPhase.duration_unit, turnsPerMinute) : null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const turns = computeFirstPhaseTurns()
    if (!selectedConditionId || turns === null) return
    setSaving(true)
    setError(null)
    try {
      await onApply({
        character_id: character.id,
        condition_id: selectedConditionId,
        first_phase_turns: turns,
        source_note: sourceNote.trim() || undefined,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to apply condition')
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = !!selectedConditionId && firstPhase !== null && (!needsDiceRoll || parseInt(rolledTurns) > 0)

  return (
    <Modal title={`Apply Condition — ${character.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Group selector */}
        <div>
          <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.4rem', fontSize: '0.75rem', letterSpacing: '0.08em' }}>
            GROUP
          </label>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {groups.map(g => (
              <button
                key={g.id}
                type="button"
                className={selectedGroupId === g.id ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
                onClick={() => { setSelectedGroupId(g.id); setSelectedConditionId('') }}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>

        {/* Condition list */}
        <div>
          <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.4rem', fontSize: '0.75rem', letterSpacing: '0.08em' }}>
            CONDITION
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '200px', overflowY: 'auto' }}>
            {groupConditions.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No conditions in this group.</p>
            )}
            {groupConditions.map(c => (
              <button
                key={c.id}
                type="button"
                className={selectedConditionId === c.id ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ textAlign: 'left', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                onClick={() => { setSelectedConditionId(c.id); setRolledTurns('') }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* No phases warning */}
        {selectedConditionId && !firstPhase && (
          <p style={{ color: 'var(--text-danger)', fontSize: '0.82rem', margin: 0 }}>
            This condition has no phases defined. Add at least one phase in Settings before applying.
          </p>
        )}

        {/* All phases preview */}
        {selectedCondition && (() => {
          const condPhases = phases
            .filter(p => p.condition_id === selectedCondition.id)
            .sort((a, b) => a.phase_order - b.phase_order)
          if (condPhases.length === 0) return null
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {condPhases.map((phase, i) => (
                <div key={phase.id} style={{
                  padding: '0.6rem 0.75rem',
                  background: 'var(--bg-secondary)',
                  border: `1px solid ${i === 0 ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  borderRadius: 'var(--radius)',
                  opacity: i === 0 ? 1 : 0.7,
                }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: phase.effect_text ? '0.3rem' : 0, letterSpacing: '0.05em' }}>
                    PHASE {i + 1} — {formatDiceExpression(phase.duration_expression, phase.duration_unit)}
                  </div>
                  {phase.effect_text && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>{phase.effect_text}</p>
                  )}
                </div>
              ))}
            </div>
          )
        })()}

        {/* Dice roll input */}
        {needsDiceRoll && firstPhase && (
          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.35rem', fontSize: '0.75rem', letterSpacing: '0.08em' }}>
              ROLL {firstPhase.duration_expression.toUpperCase()} — ENTER {firstPhase.duration_unit.toUpperCase()}
            </label>
            <input
              className="input"
              type="number"
              min={1}
              placeholder={`# of ${firstPhase.duration_unit}`}
              value={rolledTurns}
              onChange={e => setRolledTurns(e.target.value)}
              required={needsDiceRoll}
              autoFocus={needsDiceRoll}
            />
          </div>
        )}

        {!needsDiceRoll && firstPhase && isDiceExpression(firstPhase.duration_expression) === false && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
            Duration: {formatDiceExpression(firstPhase.duration_expression, firstPhase.duration_unit)}
          </p>
        )}

        {/* Source note */}
        <div>
          <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.35rem', fontSize: '0.75rem', letterSpacing: '0.08em' }}>
            SOURCE NOTE (optional)
          </label>
          <input
            className="input"
            placeholder="e.g. from the cave spider"
            value={sourceNote}
            onChange={e => setSourceNote(e.target.value)}
          />
        </div>

        {error && <p style={{ color: 'var(--text-danger)', fontSize: '0.875rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button className="btn btn-secondary" type="button" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" type="submit" disabled={!canSubmit || saving} style={{ flex: 1 }}>
            {saving ? 'Applying...' : 'Apply Condition'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
