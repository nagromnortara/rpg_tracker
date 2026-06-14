import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCampaignData } from '../hooks/useCampaignData'
import { useIsMobile } from '../hooks/useIsMobile'
import { formatTime, formatDay, formatTurnTimestamp } from '../lib/time'
import { formatRemaining, remainingUrgency } from '../lib/dice'
import { currentRound, effectsForRound } from '../lib/effects'
import ApplyConditionModal from '../components/admin/ApplyConditionModal'
import EffectLogPanel from '../components/EffectLogPanel'
import type { Character, DurationUnit, FiredEffect, PhaseEffect } from '../lib/types'

export default function PlayerPage() {
  const { campaignId, playerToken } = useParams<{ campaignId: string; playerToken: string }>()
  const [character, setCharacter] = useState<Character | null>(null)
  const [charError, setCharError] = useState<string | null>(null)
  const [showLog, setShowLog] = useState(false)
  const [showApply, setShowApply] = useState(false)

  const data = useCampaignData(campaignId)
  const isMobile = useIsMobile()

  useEffect(() => {
    if (!campaignId || !playerToken) return
    supabase
      .from('characters')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('player_token', playerToken)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setCharError('Character not found.')
        else setCharacter(data as Character)
      })
  }, [campaignId, playerToken])

  if (data.loading || (!character && !charError)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>LOADING...</p>
      </div>
    )
  }

  if (charError || !character || !data.campaign) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
        <p style={{ color: 'var(--text-danger)' }}>{charError ?? 'Campaign not found.'}</p>
      </div>
    )
  }

  const { campaign, groups, conditions, phases, phaseEffects, charConditions, effectLog } = data

  const myActive = charConditions.filter(cc => cc.character_id === character.id && cc.is_active)
  const myExpired = charConditions
    .filter(cc => cc.character_id === character.id && !cc.is_active)
    .sort((a, b) => (b.expired_turn ?? 0) - (a.expired_turn ?? 0))

  // Group active conditions by their group
  const groupedConditions = groups.map(g => ({
    group: g,
    items: myActive
      .filter(cc => conditions.find(c => c.id === cc.condition_id)?.group_id === g.id)
      .map(cc => ({
        cc,
        condition: conditions.find(c => c.id === cc.condition_id),
        phase: phases.find(p => p.condition_id === cc.condition_id && p.phase_order === cc.current_phase),
      })),
  })).filter(g => g.items.length > 0)

  async function handleApplyCondition(params: {
    character_id: string; condition_id: string; first_phase_turns: number;
    source_note?: string; effect_values?: Record<string, number>
  }) {
    const { error } = await supabase.rpc('player_apply_condition', {
      p_campaign_id: campaignId,
      p_player_token: playerToken,
      p_condition_id: params.condition_id,
      p_first_phase_turns: params.first_phase_turns,
      p_source_note: params.source_note ?? null,
      p_effect_values: params.effect_values ?? {},
    })
    if (error) throw new Error(error.message)
  }

  async function handleRemoveCondition(charConditionId: string) {
    const { error } = await supabase.rpc('player_remove_condition', {
      p_campaign_id: campaignId,
      p_player_token: playerToken,
      p_character_condition_id: charConditionId,
    })
    if (error) throw new Error(error.message)
  }

  const tacticalSorted = [...data.characters]
    .filter(c => c.is_active && c.initiative_order !== null)
    .sort((a, b) => (a.initiative_order ?? 0) - (b.initiative_order ?? 0))
  const tacticalChar = campaign.mode === 'tactical'
    ? data.characters.find(c => c.id === character.id)
    : null
  const isMyTurn = campaign.mode === 'tactical' &&
    tacticalSorted[campaign.current_initiative_index % Math.max(tacticalSorted.length, 1)]?.id === character.id

  return (
    <div style={{ minHeight: '100vh', maxWidth: '600px', margin: '0 auto', padding: isMobile ? '1rem 0.75rem' : '1.5rem 1rem' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: isMobile ? '1.25rem' : '2rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? '1.6rem' : '2rem', color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
          {character.name}
        </h1>

        {campaign.mode === 'exploration' && (
          <div style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
            <span style={{ fontSize: '1.3rem' }}>{formatTime(campaign.current_turn, campaign.turns_per_minute)}</span>
            <span style={{ color: 'var(--text-muted)', marginLeft: '0.75rem', fontSize: '0.9rem' }}>{formatDay(campaign.current_turn, campaign.turns_per_minute)}</span>
          </div>
        )}

        {campaign.mode === 'tactical' && (
          <div style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
            {isMyTurn ? (
              <span style={{
                display: 'inline-block',
                padding: '0.35rem 1.25rem',
                background: 'var(--accent-primary)',
                color: 'var(--bg-primary)',
                fontFamily: 'var(--font-display)',
                fontSize: '1rem',
                letterSpacing: '0.12em',
                borderRadius: 'var(--radius)',
              }}>
                YOUR TURN
              </span>
            ) : (
              <span className="badge" style={{ fontSize: '0.8rem' }}>TACTICAL MODE</span>
            )}
            {tacticalChar?.initiative_order !== null && tacticalChar?.initiative_order !== undefined && (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Initiative #{tacticalChar.initiative_order}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Condition actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
        <button
          className="btn btn-secondary"
          style={{ fontSize: '0.85rem', padding: '0.35rem 0.85rem' }}
          onClick={() => setShowApply(true)}
          disabled={groups.length === 0}
          title={groups.length === 0 ? 'No condition groups configured' : undefined}
        >
          + Add Condition
        </button>
      </div>

      {/* Active conditions */}
      {myActive.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No active conditions
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {groupedConditions.length > 0 ? (
            groupedConditions.map(({ group, items }) => (
              <div key={group.id}>
                <h3 style={{ margin: '0 0 0.6rem', color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '0.1em' }}>
                  {group.name.toUpperCase()}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {items.map(({ cc, condition, phase }) => (
                    <PlayerConditionCard
                      key={cc.id}
                      ccId={cc.id}
                      conditionName={condition?.name ?? 'Unknown'}
                      remainingTurns={cc.remaining_turns}
                      durationUnit={phase?.duration_unit ?? 'turns'}
                      turnsPerMinute={campaign.turns_per_minute}
                      phaseIndex={cc.current_phase}
                      phaseText={phase?.effect_text ?? ''}
                      effects={phase ? phaseEffects.filter(e => e.phase_id === phase.id) : []}
                      effectValues={cc.effect_values}
                      phaseTotalTurns={cc.phase_total_turns}
                      sourceNote={cc.source_note}
                      isMobile={isMobile}
                      onRemove={handleRemoveCondition}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            myActive.map(cc => {
              const condition = conditions.find(c => c.id === cc.condition_id)
              const phase = phases.find(p => p.condition_id === cc.condition_id && p.phase_order === cc.current_phase)
              return (
                <PlayerConditionCard
                  key={cc.id}
                  ccId={cc.id}
                  conditionName={condition?.name ?? 'Unknown'}
                  remainingTurns={cc.remaining_turns}
                  durationUnit={phase?.duration_unit ?? 'turns'}
                  turnsPerMinute={campaign.turns_per_minute}
                  phaseIndex={cc.current_phase}
                  phaseText={phase?.effect_text ?? ''}
                  effects={phase ? phaseEffects.filter(e => e.phase_id === phase.id) : []}
                  effectValues={cc.effect_values}
                  phaseTotalTurns={cc.phase_total_turns}
                  sourceNote={cc.source_note}
                  isMobile={isMobile}
                  onRemove={handleRemoveCondition}
                />
              )
            })
          )}
        </div>
      )}

      {showApply && character && (
        <ApplyConditionModal
          character={character}
          groups={groups}
          conditions={conditions}
          phases={phases}
          phaseEffects={phaseEffects}
          turnsPerMinute={campaign.turns_per_minute}
          onApply={handleApplyCondition}
          onClose={() => setShowApply(false)}
        />
      )}

      {/* Effect log for this character */}
      {effectLog.some(e => e.character_id === character.id) && (
        <div style={{ marginTop: '2rem' }}>
          <EffectLogPanel
            entries={effectLog}
            characters={data.characters}
            turnsPerMinute={campaign.turns_per_minute}
            characterId={character.id}
          />
        </div>
      )}

      {/* Expired log */}
      {myExpired.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <button
            className="btn btn-ghost"
            onClick={() => setShowLog(v => !v)}
            style={{ fontSize: '0.8rem', width: '100%', padding: '0.5rem' }}
          >
            {showLog ? 'Hide' : 'Show'} Condition History ({myExpired.length})
          </button>
          {showLog && (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {myExpired.map(cc => {
                const condition = conditions.find(c => c.id === cc.condition_id)
                return (
                  <div key={cc.id} style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', opacity: 0.6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{condition?.name ?? 'Unknown'}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                        {cc.expired_turn != null ? formatTurnTimestamp(cc.expired_turn, campaign.turns_per_minute) : ''}
                      </span>
                    </div>
                    {cc.source_note && <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0.2rem 0 0', fontStyle: 'italic' }}>{cc.source_note}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function fmtEffectValue(v: number): string {
  return v > 0 ? `+${v}` : `${v}`
}

function PlayerConditionCard({ ccId, conditionName, remainingTurns, durationUnit, turnsPerMinute, phaseIndex, phaseText, effects, effectValues, phaseTotalTurns, sourceNote, isMobile, onRemove }: {
  ccId: string
  conditionName: string
  remainingTurns: number
  durationUnit: DurationUnit
  turnsPerMinute: number
  phaseIndex: number
  phaseText: string
  effects: PhaseEffect[]
  effectValues: Record<string, number>
  phaseTotalTurns: number
  sourceNote: string | null
  isMobile: boolean
  onRemove: (id: string) => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)
  const urgency = remainingUrgency(remainingTurns, durationUnit, turnsPerMinute)
  const borderColor = urgency === 'danger' ? 'var(--text-danger)' : urgency === 'warning' ? '#c8a900' : 'var(--border-color)'
  const displayRemaining = formatRemaining(remainingTurns, durationUnit, turnsPerMinute)
  const r = currentRound(phaseTotalTurns, remainingTurns)
  const firingNow: FiredEffect[] = effectsForRound(effects, effectValues, r, phaseTotalTurns)

  async function handleConfirm() {
    setRemoving(true)
    try { await onRemove(ccId) } finally { setRemoving(false); setConfirming(false) }
  }

  return (
    <div style={{ padding: isMobile ? '0.85rem 1rem' : '1rem 1.25rem', background: 'var(--bg-card)', border: `1px solid ${borderColor}`, borderRadius: 'var(--radius)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem', gap: '0.75rem' }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? '1rem' : '1.1rem', color: 'var(--text-primary)' }}>
            {conditionName}
          </span>
          {sourceNote && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: '0.4rem', fontStyle: 'italic' }}>
              — {sourceNote}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
          <span style={{ color: borderColor, fontSize: isMobile ? '1rem' : '1.1rem', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
            {displayRemaining}
          </span>
          {confirming ? (
            <>
              <button
                className="btn btn-ghost"
                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', color: 'var(--text-danger)' }}
                onClick={handleConfirm}
                disabled={removing}
              >
                {removing ? '…' : 'Yes, dismiss'}
              </button>
              <button
                className="btn btn-ghost"
                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', color: 'var(--text-muted)' }}
                onClick={() => setConfirming(false)}
                disabled={removing}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              className="btn btn-ghost"
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', color: 'var(--text-muted)' }}
              onClick={() => setConfirming(true)}
              title="Dismiss condition"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
      {phaseText && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
          {phaseText}
        </p>
      )}
      {firingNow.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', letterSpacing: '0.05em' }}>THIS ROUND:</span>
          {firingNow.map(f => (
            <span key={f.effectId} style={{
              fontSize: '0.85rem', padding: '0.1rem 0.55rem', borderRadius: 'var(--radius)',
              background: 'var(--accent-primary)', color: 'var(--bg-primary)', fontFamily: 'var(--font-body)',
            }}>
              {fmtEffectValue(f.value)} {f.target}
            </span>
          ))}
        </div>
      )}
      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '0.05em', marginTop: '0.35rem', display: 'block' }}>
        PHASE {phaseIndex + 1}
      </span>
    </div>
  )
}
