import { formatTurnTimestamp } from '../lib/time'
import type { Character, EffectLogEntry } from '../lib/types'

interface Props {
  entries: EffectLogEntry[]
  characters: Character[]
  turnsPerMinute: number
  characterId?: string   // when set, only this character's entries are shown
  title?: string
}

function fmtValue(v: number): string {
  return v > 0 ? `+${v}` : `${v}`
}

// Shared, newest-first list of effects that have fired. Backed by the persisted
// effect_log table so the GM and every player tab see the same history.
export default function EffectLogPanel({ entries, characters, turnsPerMinute, characterId, title = 'Effect Log' }: Props) {
  const nameOf = new Map(characters.map(c => [c.id, c.name]))
  const shown = characterId ? entries.filter(e => e.character_id === characterId) : entries

  if (shown.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>
        No effects logged yet.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', letterSpacing: '0.08em', margin: '0 0 0.25rem' }}>
        {title.toUpperCase()}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '260px', overflowY: 'auto' }}>
        {shown.map(e => (
          <div key={e.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem',
            padding: '0.3rem 0.5rem', background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)', borderRadius: 'var(--radius)',
          }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.76rem', minWidth: 0 }}>
              <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                {fmtValue(e.value)} {e.target}
              </span>
              {' · '}{e.label}
              {!characterId && <span style={{ color: 'var(--text-muted)' }}> · {nameOf.get(e.character_id) ?? '?'}</span>}
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}> ({e.detail})</span>
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {formatTurnTimestamp(e.turn, turnsPerMinute)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
