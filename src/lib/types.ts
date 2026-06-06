export type CampaignMode = 'exploration' | 'tactical'
export type DurationType = 'fixed' | 'dice'
export type DurationUnit = 'turns' | 'minutes' | 'hours' | 'days'

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
}

export interface CampaignData {
  campaign: Campaign | null
  groups: ConditionGroup[]
  conditions: Condition[]
  phases: ConditionPhase[]
  characters: Character[]
  charConditions: CharacterCondition[]
}

export interface PendingDiceRoll {
  characterConditionId: string
  conditionName: string
  characterName?: string
  phaseOrder: number
  diceExpression: string
  durationUnit: DurationUnit
}
