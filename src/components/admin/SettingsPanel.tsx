import { useState } from 'react'
import { formatDiceExpression } from '../../lib/dice'
import type {
  Campaign, ConditionGroup, Condition, ConditionPhase, PhaseEffect, Character,
  DurationUnit, EffectTiming, EffectValueType,
} from '../../lib/types'
import type { useAdminActions } from '../../hooks/useAdminActions'

type Actions = ReturnType<typeof useAdminActions>

interface Props {
  campaign: Campaign
  groups: ConditionGroup[]
  conditions: Condition[]
  phases: ConditionPhase[]
  phaseEffects: PhaseEffect[]
  characters: Character[]
  playerBaseUrl: string
  actions: Actions
  onClose: () => void
}

type Tab = 'conditions' | 'characters' | 'settings'

export default function SettingsPanel({ campaign, groups, conditions, phases, phaseEffects, characters, playerBaseUrl, actions, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('conditions')

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', maxWidth: '100vw',
      background: 'var(--bg-modal)', borderLeft: '1px solid var(--border-color)',
      zIndex: 40, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.6)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Settings</h2>
        <button className="btn btn-ghost" onClick={onClose} style={{ padding: '0.25rem 0.5rem' }}>✕</button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
        {(['conditions', 'characters', 'settings'] as Tab[]).map(t => (
          <button
            key={t}
            className="btn btn-ghost"
            onClick={() => setTab(t)}
            style={{
              flex: 1, borderRadius: 0, padding: '0.6rem',
              fontSize: '0.75rem', letterSpacing: '0.05em',
              borderBottom: tab === t ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
        {tab === 'conditions' && (
          <ConditionsTab groups={groups} conditions={conditions} phases={phases} phaseEffects={phaseEffects} actions={actions} />
        )}
        {tab === 'characters' && (
          <CharactersTab characters={characters} playerBaseUrl={playerBaseUrl} actions={actions} />
        )}
        {tab === 'settings' && (
          <CampaignSettingsTab campaign={campaign} actions={actions} />
        )}
      </div>
    </div>
  )
}

/* ---- CONDITIONS TAB ---- */

function ConditionsTab({ groups, conditions, phases, phaseEffects, actions }: {
  groups: ConditionGroup[]
  conditions: Condition[]
  phases: ConditionPhase[]
  phaseEffects: PhaseEffect[]
  actions: Actions
}) {
  const [newGroupName, setNewGroupName] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedConditions, setExpandedConditions] = useState<Set<string>>(new Set())

  function toggleGroup(id: string) {
    setExpandedGroups(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleCondition(id: string) {
    setExpandedConditions(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function addGroup() {
    if (!newGroupName.trim()) return
    await actions.upsertGroup({ name: newGroupName.trim(), sort_order: groups.length })
    setNewGroupName('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {groups.map(group => (
        <GroupEditor
          key={group.id}
          group={group}
          conditions={conditions.filter(c => c.group_id === group.id)}
          phases={phases}
          phaseEffects={phaseEffects}
          expanded={expandedGroups.has(group.id)}
          expandedConditions={expandedConditions}
          onToggle={() => toggleGroup(group.id)}
          onToggleCondition={toggleCondition}
          actions={actions}
        />
      ))}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <input
          className="input"
          placeholder="New group name"
          value={newGroupName}
          onChange={e => setNewGroupName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addGroup()}
        />
        <button className="btn btn-secondary" onClick={addGroup} disabled={!newGroupName.trim()}
          style={{ flexShrink: 0 }}>
          + Group
        </button>
      </div>
    </div>
  )
}

function GroupEditor({ group, conditions, phases, phaseEffects, expanded, expandedConditions, onToggle, onToggleCondition, actions }: {
  group: ConditionGroup
  conditions: Condition[]
  phases: ConditionPhase[]
  phaseEffects: PhaseEffect[]
  expanded: boolean
  expandedConditions: Set<string>
  onToggle: () => void
  onToggleCondition: (id: string) => void
  actions: Actions
}) {
  const [name, setName] = useState(group.name)
  const [newCondName, setNewCondName] = useState('')
  const [editing, setEditing] = useState(false)

  async function saveName() {
    if (name.trim() === group.name) { setEditing(false); return }
    await actions.upsertGroup({ id: group.id, name: name.trim(), sort_order: group.sort_order })
    setEditing(false)
  }

  async function addCondition() {
    if (!newCondName.trim()) return
    await actions.upsertCondition({ group_id: group.id, name: newCondName.trim(), sort_order: conditions.length })
    setNewCondName('')
  }

  return (
    <div className="card" style={{ padding: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button className="btn btn-ghost" onClick={onToggle} style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}>
          {expanded ? '▼' : '▶'}
        </button>
        {editing ? (
          <input
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={e => e.key === 'Enter' && saveName()}
            autoFocus
            style={{ flex: 1 }}
          />
        ) : (
          <span
            style={{ flex: 1, color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.9rem' }}
            onClick={() => setEditing(true)}
          >
            {group.name}
          </span>
        )}
        <ConfirmDeleteButton onConfirm={() => actions.deleteGroup(group.id)} />
      </div>

      {expanded && (
        <div style={{ marginTop: '0.5rem', paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {conditions.map(cond => (
            <ConditionEditor
              key={cond.id}
              cond={cond}
              phases={phases.filter(p => p.condition_id === cond.id).sort((a, b) => a.phase_order - b.phase_order)}
              phaseEffects={phaseEffects}
              expanded={expandedConditions.has(cond.id)}
              onToggle={() => onToggleCondition(cond.id)}
              actions={actions}
            />
          ))}
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
            <input
              className="input"
              placeholder="New condition"
              value={newCondName}
              onChange={e => setNewCondName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCondition()}
              style={{ fontSize: '0.85rem' }}
            />
            <button className="btn btn-secondary" onClick={addCondition} disabled={!newCondName.trim()}
              style={{ flexShrink: 0, fontSize: '0.8rem' }}>
              +
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ConditionEditor({ cond, phases, phaseEffects, expanded, onToggle, actions }: {
  cond: Condition
  phases: ConditionPhase[]
  phaseEffects: PhaseEffect[]
  expanded: boolean
  onToggle: () => void
  actions: Actions
}) {
  const [name, setName] = useState(cond.name)
  const [editing, setEditing] = useState(false)

  async function saveName() {
    if (name.trim() === cond.name) { setEditing(false); return }
    await actions.upsertCondition({ id: cond.id, group_id: cond.group_id, name: name.trim(), sort_order: cond.sort_order })
    setEditing(false)
  }

  async function addPhase() {
    await actions.upsertPhase({
      condition_id: cond.id,
      phase_order: phases.length,
      duration_type: 'fixed',
      duration_unit: 'turns',
      duration_expression: '1',
      effect_text: '',
    })
  }

  return (
    <div style={{ borderLeft: '2px solid var(--border-color)', paddingLeft: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <button className="btn btn-ghost" onClick={onToggle} style={{ padding: '0.15rem 0.3rem', fontSize: '0.75rem' }}>
          {expanded ? '▼' : '▶'}
        </button>
        {editing ? (
          <input
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={e => e.key === 'Enter' && saveName()}
            autoFocus
            style={{ flex: 1, fontSize: '0.85rem' }}
          />
        ) : (
          <span
            style={{ flex: 1, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem' }}
            onClick={() => setEditing(true)}
          >
            {cond.name}
            {phases.length > 0 && (
              <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem', fontSize: '0.75rem' }}>
                ({phases.length} phase{phases.length !== 1 ? 's' : ''})
              </span>
            )}
          </span>
        )}
        <ConfirmDeleteButton onConfirm={() => actions.deleteCondition(cond.id)} />
      </div>

      {expanded && (
        <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {phases.map((phase, i) => (
            <PhaseEditor
              key={phase.id}
              phase={phase}
              index={i}
              conditionId={cond.id}
              effects={phaseEffects.filter(e => e.phase_id === phase.id).sort((a, b) => a.sort_order - b.sort_order)}
              actions={actions}
            />
          ))}
          <button className="btn btn-ghost" onClick={addPhase}
            style={{ fontSize: '0.78rem', alignSelf: 'flex-start', padding: '0.2rem 0.5rem' }}>
            + Add Phase
          </button>
        </div>
      )}
    </div>
  )
}

function ConfirmDeleteButton({ onConfirm, size = 'sm' }: { onConfirm: () => void; size?: 'sm' | 'xs' }) {
  const [confirming, setConfirming] = useState(false)
  const fs = size === 'xs' ? '0.7rem' : '0.75rem'
  const pad = size === 'xs' ? '0.1rem 0.3rem' : '0.2rem 0.4rem'
  if (confirming) {
    return (
      <span style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
        <button
          className="btn btn-ghost"
          style={{ fontSize: fs, padding: pad, color: 'var(--text-danger)' }}
          onClick={() => { onConfirm(); setConfirming(false) }}
        >
          Yes
        </button>
        <button
          className="btn btn-ghost"
          style={{ fontSize: fs, padding: pad, color: 'var(--text-muted)' }}
          onClick={() => setConfirming(false)}
        >
          No
        </button>
      </span>
    )
  }
  return (
    <button
      className="btn btn-ghost"
      style={{ color: 'var(--text-danger)', padding: pad, fontSize: fs }}
      onClick={() => setConfirming(true)}
      title="Delete"
    >
      ✕
    </button>
  )
}

const DURATION_UNITS: DurationUnit[] = ['turns', 'minutes', 'hours', 'days']

function PhaseEditor({ phase, index, conditionId, effects, actions }: {
  phase: ConditionPhase
  index: number
  conditionId: string
  effects: PhaseEffect[]
  actions: Actions
}) {
  const [durationType, setDurationType] = useState(phase.duration_type)
  const [durationUnit, setDurationUnit] = useState<DurationUnit>(phase.duration_unit)
  const [durationExpr, setDurationExpr] = useState(phase.duration_expression)
  const [effectText, setEffectText] = useState(phase.effect_text)
  const [dirty, setDirty] = useState(false)

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setDirty(true) }
  }

  async function save() {
    await actions.upsertPhase({
      id: phase.id,
      condition_id: conditionId,
      phase_order: index,
      duration_type: durationType,
      duration_unit: durationUnit,
      duration_expression: durationExpr,
      effect_text: effectText,
    })
    setDirty(false)
  }

  return (
    <div style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '0.05em' }}>PHASE {index + 1}</span>
        <ConfirmDeleteButton onConfirm={() => actions.deletePhase(conditionId, phase.id)} size="xs" />
      </div>

      {/* Type + expression */}
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <button
          className={durationType === 'fixed' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem' }}
          onClick={() => markDirty(setDurationType)('fixed')}
        >
          Fixed
        </button>
        <button
          className={durationType === 'dice' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem' }}
          onClick={() => markDirty(setDurationType)('dice')}
        >
          Dice
        </button>
        <input
          className="input"
          value={durationExpr}
          onChange={e => markDirty(setDurationExpr)(e.target.value)}
          placeholder={durationType === 'dice' ? '1d6' : '3'}
          style={{ flex: 2, fontSize: '0.8rem' }}
          title={durationType === 'dice' ? 'Dice expression e.g. 1d6, 2d4' : 'Fixed number'}
        />
      </div>

      {/* Unit selector */}
      <div style={{ display: 'flex', gap: '0.3rem' }}>
        {DURATION_UNITS.map(u => (
          <button
            key={u}
            className={durationUnit === u ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ flex: 1, fontSize: '0.7rem', padding: '0.2rem 0' }}
            onClick={() => markDirty(setDurationUnit)(u)}
          >
            {u}
          </button>
        ))}
      </div>

      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '0.1rem' }}>
        {formatDiceExpression(durationExpr, durationUnit)}
      </div>

      <textarea
        className="input"
        value={effectText}
        onChange={e => markDirty(setEffectText)(e.target.value)}
        placeholder="Effect description..."
        rows={2}
        style={{ resize: 'vertical', fontSize: '0.82rem' }}
      />

      {dirty && (
        <button className="btn btn-primary" onClick={save} style={{ fontSize: '0.8rem', padding: '0.3rem' }}>
          Save Phase
        </button>
      )}

      {/* Structured effects */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', letterSpacing: '0.05em' }}>EFFECTS</span>
        {effects.map(eff => (
          <EffectEditor key={eff.id} effect={eff} phaseId={phase.id} actions={actions} />
        ))}
        <button
          className="btn btn-ghost"
          onClick={() => actions.upsertPhaseEffect({
            phase_id: phase.id, timing: 'every', target: '', value_type: 'fixed', value_expression: '1', sort_order: effects.length,
          })}
          style={{ fontSize: '0.74rem', alignSelf: 'flex-start', padding: '0.15rem 0.45rem' }}
        >
          + Add Effect
        </button>
      </div>
    </div>
  )
}

const TIMINGS: { value: EffectTiming; label: string }[] = [
  { value: 'first', label: 'First' },
  { value: 'last', label: 'Last' },
  { value: 'every', label: 'Every' },
  { value: 'distributed', label: 'Spread' },
]

function EffectEditor({ effect, phaseId, actions }: {
  effect: PhaseEffect
  phaseId: string
  actions: Actions
}) {
  const [timing, setTiming] = useState<EffectTiming>(effect.timing)
  const [target, setTarget] = useState(effect.target)
  const [valueType, setValueType] = useState<EffectValueType>(effect.value_type)
  const [valueExpr, setValueExpr] = useState(effect.value_expression)
  const [dirty, setDirty] = useState(false)

  function mark<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setDirty(true) }
  }

  async function save() {
    await actions.upsertPhaseEffect({
      id: effect.id,
      phase_id: phaseId,
      timing,
      target: target.trim(),
      value_type: valueType,
      value_expression: valueExpr.trim() || (valueType === 'dice' ? '1d6' : '1'),
      sort_order: effect.sort_order,
    })
    setDirty(false)
  }

  return (
    <div style={{ background: 'var(--bg-modal)', borderRadius: 'var(--radius)', padding: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        {TIMINGS.map(t => (
          <button
            key={t.value}
            className={timing === t.value ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ flex: 1, fontSize: '0.68rem', padding: '0.2rem 0' }}
            onClick={() => mark(setTiming)(t.value)}
            title={t.value === 'distributed' ? 'Spread the total over the phase (1 on first & last round)' : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
        <input
          className="input"
          value={target}
          onChange={e => mark(setTarget)(e.target.value)}
          placeholder="Target (HP, ST…)"
          style={{ flex: 1, fontSize: '0.78rem' }}
        />
        <button
          className={valueType === 'fixed' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ fontSize: '0.68rem', padding: '0.2rem 0.4rem' }}
          onClick={() => mark(setValueType)('fixed')}
        >
          Fixed
        </button>
        <button
          className={valueType === 'dice' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ fontSize: '0.68rem', padding: '0.2rem 0.4rem' }}
          onClick={() => mark(setValueType)('dice')}
        >
          Dice
        </button>
        <input
          className="input"
          value={valueExpr}
          onChange={e => mark(setValueExpr)(e.target.value)}
          placeholder={valueType === 'dice' ? '1d6' : '2'}
          style={{ width: '3.5rem', fontSize: '0.78rem' }}
          title={valueType === 'dice' ? 'Dice expression, rolled when the phase is entered' : 'Fixed amount'}
        />
        <ConfirmDeleteButton onConfirm={() => actions.deletePhaseEffect(phaseId, effect.id)} size="xs" />
      </div>
      {dirty && (
        <button className="btn btn-primary" onClick={save} style={{ fontSize: '0.72rem', padding: '0.2rem' }}>
          Save Effect
        </button>
      )}
    </div>
  )
}

/* ---- CHARACTERS TAB ---- */

function CharactersTab({ characters, playerBaseUrl, actions }: {
  characters: Character[]
  playerBaseUrl: string
  actions: Actions
}) {
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const active = characters.filter(c => c.is_active && !c.is_npc)
  const inactive = characters.filter(c => !c.is_active && !c.is_npc)

  async function addCharacter() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await actions.addCharacter(newName.trim())
      setNewName('')
    } finally {
      setSaving(false)
    }
  }

  function copyLink(char: Character) {
    const url = `${playerBaseUrl}/campaign/${char.campaign_id}/player/${char.player_token}`
    navigator.clipboard.writeText(url)
    setCopiedId(char.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {active.map(char => (
        <div key={char.id} className="card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{char.name}</span>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
              onClick={() => copyLink(char)}
            >
              {copiedId === char.id ? '✓ Copied' : 'Player Link'}
            </button>
            <button
              className="btn btn-ghost"
              style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.3rem 0.5rem' }}
              onClick={() => actions.deactivateCharacter(char.id)}
              title="Deactivate"
            >
              ✕
            </button>
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          className="input"
          placeholder="Character name"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addCharacter()}
        />
        <button className="btn btn-secondary" onClick={addCharacter} disabled={!newName.trim() || saving}
          style={{ flexShrink: 0 }}>
          + Add
        </button>
      </div>

      {inactive.length > 0 && (
        <details style={{ marginTop: '0.5rem' }}>
          <summary style={{ color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer' }}>
            Inactive ({inactive.length})
          </summary>
          {inactive.map(char => (
            <div key={char.id} style={{ padding: '0.4rem 0', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{char.name}</span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button className="btn btn-ghost" style={{ fontSize: '0.75rem' }} onClick={() => actions.reactivateCharacter(char.id)}>
                  Reactivate
                </button>
                <button className="btn btn-ghost" style={{ fontSize: '0.75rem' }} onClick={() => copyLink(char)}>
                  {copiedId === char.id ? '✓' : 'Link'}
                </button>
              </div>
            </div>
          ))}
        </details>
      )}
    </div>
  )
}

/* ---- CAMPAIGN SETTINGS TAB ---- */

function CampaignSettingsTab({ campaign, actions }: { campaign: Campaign; actions: Actions }) {
  const [name, setName] = useState(campaign.name)
  const [saving, setSaving] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await actions.updateSettings({ name: name.trim() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.35rem', fontSize: '0.75rem', letterSpacing: '0.08em' }}>
          CAMPAIGN NAME
        </label>
        <input className="input" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div>
        <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.35rem', fontSize: '0.75rem', letterSpacing: '0.08em' }}>
          TURNS PER MINUTE
        </label>
        <div style={{
          padding: '0.5rem 0.75rem',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius)',
          color: 'var(--text-secondary)',
          fontSize: '0.9rem',
        }}>
          {campaign.turns_per_minute}
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
            (set at campaign creation, cannot be changed)
          </span>
        </div>
      </div>
      <button className="btn btn-primary" type="submit" disabled={saving} style={{ padding: '0.5rem', letterSpacing: '0.05em' }}>
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </form>
  )
}
