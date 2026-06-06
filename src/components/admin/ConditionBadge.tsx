import type { CharacterCondition, Condition, ConditionPhase } from '../../lib/types'

interface Props {
  cc: CharacterCondition
  condition: Condition | undefined
  phase: ConditionPhase | undefined
}

export default function ConditionBadge({ cc, condition, phase }: Props) {
  const turns = cc.remaining_turns
  const urgency = turns <= 1 ? 'danger' : turns <= 3 ? 'warning' : 'normal'

  const borderColor = urgency === 'danger' ? 'var(--text-danger)'
    : urgency === 'warning' ? '#c8a900'
    : 'var(--border-color)'

  return (
    <div style={{
      padding: '0.5rem 0.75rem',
      background: 'var(--bg-secondary)',
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.2rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 'bold' }}>
          {condition?.name ?? 'Unknown'}
        </span>
        <span style={{
          color: borderColor,
          fontSize: '0.75rem',
          fontFamily: 'var(--font-body)',
          flexShrink: 0,
        }}>
          {turns}t
        </span>
      </div>
      {cc.source_note && (
        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontStyle: 'italic' }}>
          {cc.source_note}
        </span>
      )}
      {phase && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: 0, lineHeight: 1.4 }}>
          {phase.effect_text}
        </p>
      )}
      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
        PHASE {cc.current_phase + 1}
      </span>
    </div>
  )
}
