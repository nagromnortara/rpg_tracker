import { formatRemaining, remainingUrgency } from '../../lib/dice'
import { resolveEffectValue, currentRound, effectsForRound } from '../../lib/effects'
import type { CharacterCondition, Condition, ConditionPhase, PhaseEffect } from '../../lib/types'

interface Props {
  cc: CharacterCondition
  condition: Condition | undefined
  phase: ConditionPhase | undefined
  effects: PhaseEffect[]
  turnsPerMinute: number
}

const TIMING_SHORT: Record<string, string> = {
  first: 'first', last: 'last', every: 'each', distributed: 'spread',
}

function fmtValue(v: number): string {
  return v > 0 ? `+${v}` : `${v}`
}

export default function ConditionBadge({ cc, condition, phase, effects, turnsPerMinute }: Props) {
  const unit = phase?.duration_unit ?? 'turns'
  const urgency = remainingUrgency(cc.remaining_turns, unit, turnsPerMinute)

  const borderColor = urgency === 'danger' ? 'var(--text-danger)'
    : urgency === 'warning' ? '#c8a900'
    : 'var(--border-color)'

  const phaseEffects = phase ? effects.filter(e => e.phase_id === phase.id).sort((a, b) => a.sort_order - b.sort_order) : []
  const r = currentRound(cc.phase_total_turns, cc.remaining_turns)
  const firingNow = phase ? effectsForRound(phaseEffects, cc.effect_values, r, cc.phase_total_turns) : []
  const firingIds = new Set(firingNow.map(f => f.effectId))

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
          {formatRemaining(cc.remaining_turns, unit, turnsPerMinute)}
        </span>
      </div>
      {cc.source_note && (
        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontStyle: 'italic' }}>
          {cc.source_note}
        </span>
      )}
      {phase?.effect_text && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: 0, lineHeight: 1.4 }}>
          {phase.effect_text}
        </p>
      )}

      {/* Effects firing this round */}
      {firingNow.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.1rem' }}>
          {firingNow.map(f => (
            <span key={f.effectId} style={{
              fontSize: '0.72rem', padding: '0.05rem 0.4rem', borderRadius: 'var(--radius)',
              background: 'var(--accent-primary)', color: 'var(--bg-primary)', fontFamily: 'var(--font-body)',
            }}>
              {fmtValue(f.value)} {f.target}
            </span>
          ))}
        </div>
      )}

      {/* Full effect list for the phase */}
      {phaseEffects.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', marginTop: '0.1rem' }}>
          {phaseEffects.map(e => {
            const base = resolveEffectValue(e, cc.effect_values)
            const isDiceUnrolled = e.value_type === 'dice' && !(e.id in cc.effect_values)
            return (
              <span key={e.id} style={{
                fontSize: '0.7rem',
                color: firingIds.has(e.id) ? 'var(--text-primary)' : 'var(--text-muted)',
              }}>
                {TIMING_SHORT[e.timing]}: {e.target}{' '}
                {isDiceUnrolled ? e.value_expression : fmtValue(base)}
              </span>
            )
          })}
        </div>
      )}

      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
        PHASE {cc.current_phase + 1}
      </span>
    </div>
  )
}
