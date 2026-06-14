export type CampaignMode = 'exploration' | 'tactical'
export type DurationType = 'fixed' | 'dice'
export type DurationUnit = 'turns' | 'minutes' | 'hours' | 'days'
export type EffectTiming = 'first' | 'last' | 'every' | 'distributed'
export type EffectValueType = 'fixed' | 'dice'

export interface Campaign {
  id: string
  name: string
  admin_token: string
  turns_per_minute: number
  mode: CampaignMode
  current_turn: number
  current_initiative_index: number
  theme: string
  created_at: string
}

export interface ConditionGroup {
  id: string
  campaign_id: string
  name: string
  sort_order: number
}

export interface Condition {
  id: string
  campaign_id: string
  group_id: string
  name: string
  sort_order: number
}

export interface ConditionPhase {
  id: string
  condition_id: string
  phase_order: number
  duration_type: DurationType
  duration_unit: DurationUnit
  duration_expression: string
  effect_text: string
}

// A structured effect attached to a phase. Purely informational — surfaced to
// the GM/player at the round it fires; the app never mutates a numeric stat.
export interface PhaseEffect {
  id: string
  phase_id: string
  timing: EffectTiming
  target: string            // free-text label, e.g. 'HP', 'ST', 'AG'
  value_type: EffectValueType
  value_expression: string  // '2' (fixed) or '1d6' (dice)
  sort_order: number
}

// A persisted record of an effect that has fired, shown in the shared log.
export interface EffectLogEntry {
  id: string
  campaign_id: string
  character_id: string
  condition_id: string
  turn: number
  label: string             // condition name snapshot
  target: string
  value: number
  detail: string            // e.g. 'every-round', 'distributed 5/9', 'over 24 turns'
  created_at: string
}

export interface Character {
  id: string
  campaign_id: string
  name: string
  player_token: string
  is_npc: boolean
  initiative_order: number | null
  is_active: boolean
  created_at: string
}

export interface CharacterCondition {
  id: string
  character_id: string
  condition_id: string
  current_phase: number
  remaining_turns: number
  is_active: boolean
  source_note: string | null
  applied_turn: number
  expired_turn: number | null
  // Original resolved duration (in turns) of the current phase instance, so the
  // round index r = phase_total_turns - remaining_turns + 1 can be recovered.
  phase_total_turns: number
  // Resolved values for the current phase instance, keyed by phase_effect id.
  // Only dice-valued effects are stored (fixed values are derivable).
  effect_values: Record<string, number>
}

export interface CampaignData {
  campaign: Campaign | null
  groups: ConditionGroup[]
  conditions: Condition[]
  phases: ConditionPhase[]
  phaseEffects: PhaseEffect[]
  characters: Character[]
  charConditions: CharacterCondition[]
  effectLog: EffectLogEntry[]
}

// A dice-valued effect of the entering phase that must be rolled at the same
// time as the phase's duration dice.
export interface PendingEffectRoll {
  effectId: string
  target: string
  diceExpression: string
}

export interface PendingDiceRoll {
  characterConditionId: string
  conditionName: string
  characterName?: string
  phaseOrder: number
  diceExpression: string        // duration dice; '' when the phase duration is fixed
  durationUnit: DurationUnit
  effects: PendingEffectRoll[]   // dice-valued effects of the entering phase
}

// A single effect that fires on a given round, ready to display or log.
export interface FiredEffect {
  effectId: string
  target: string
  value: number
  timing: EffectTiming
  detail: string
}
