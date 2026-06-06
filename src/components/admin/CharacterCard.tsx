import { useState } from 'react'
import ConditionBadge from './ConditionBadge'
import ApplyConditionModal from './ApplyConditionModal'
import { formatTurnTimestamp } from '../../lib/time'
import type { Character, CharacterCondition, ConditionGroup, Condition, ConditionPhase } from '../../lib/types'

interface Props {
  character: Character
  charConditions: CharacterCondition[]
  groups: ConditionGroup[]
  conditions: Condition[]
  phases: ConditionPhase[]
  turnsPerMinute: number
  isCurrentTurn?: boolean
  onApplyCondition: (params: { character_id: string; condition_id: string; first_phase_turns: number; source_note?: string }) => Promise<unknown>
}

export default function CharacterCard({ character, charConditions, groups, conditions, phases, turnsPerMinute, isCurrentTurn, onApplyCondition }: Props) {
  const [showApply, setShowApply] = useState(false)
  const [showLog, setShowLog] = useState(false)

  const activeConditions = charConditions.filter(cc => cc.character_id === character.id && cc.is_active)
  const expiredConditions = charConditions
    .filter(cc => cc.character_id === character.id && !cc.is_active)
    .sort((a, b) => (b.expired_turn ?? 0) - (a.expired_turn ?? 0))

  return (
    <div
      className={`card ${isCurrentTurn ? 'turn-active' : ''}`}
      style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
            {character.name}
          </h3>
          {character.is_npc && (
            <span className="badge" style={{ fontSize: '0.65rem', marginTop: '0.25rem' }}>NPC</span>
          )}
          {character.initiative_order !== null && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginTop: '0.2rem' }}>
              Initiative #{character.initiative_order}
            </span>
          )}
        </div>
        {isCurrentTurn && (
          <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>ACTIVE TURN</span>
        )}
      </div>

      {activeConditions.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>No active conditions</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {activeConditions.map(cc => {
          const cond = conditions.find(c => c.id === cc.condition_id)
          const phase = phases.find(p => p.condition_id === cc.condition_id && p.phase_order === cc.current_phase)
          return <ConditionBadge key={cc.id} cc={cc} condition={cond} phase={phase} turnsPerMinute={turnsPerMinute} />
        })}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          className="btn btn-secondary"
          style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
          onClick={() => setShowApply(true)}
          disabled={groups.length === 0}
          title={groups.length === 0 ? 'Add condition groups in Settings first' : undefined}
        >
          + Condition
        </button>
        {expiredConditions.length > 0 && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
            onClick={() => setShowLog(v => !v)}
          >
            {showLog ? 'Hide Log' : `Log (${expiredConditions.length})`}
          </button>
        )}
      </div>

      {showLog && expiredConditions.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>CONDITION HISTORY</p>
          {expiredConditions.map(cc => {
            const cond = conditions.find(c => c.id === cc.condition_id)
            return (
              <div key={cc.id} style={{ color: 'var(--text-muted)', fontSize: '0.78rem', padding: '0.25rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{cond?.name ?? 'Unknown'}</span>
                {cc.source_note && <span style={{ fontStyle: 'italic' }}> — {cc.source_note}</span>}
                {cc.expired_turn != null && (
                  <span style={{ float: 'right' }}>expired {formatTurnTimestamp(cc.expired_turn, turnsPerMinute)}</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showApply && (
        <ApplyConditionModal
          character={character}
          groups={groups}
          conditions={conditions}
          phases={phases}
          turnsPerMinute={turnsPerMinute}
          onApply={onApplyCondition}
          onClose={() => setShowApply(false)}
        />
      )}
    </div>
  )
}
