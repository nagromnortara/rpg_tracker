import type {
  Character, CharacterCondition, Condition, ConditionPhase, PhaseEffect,
  PendingDiceRoll, PendingEffectRoll,
} from './types'

// Dice-valued effects of a phase that must be rolled when the phase is entered.
function diceEffectsOf(phaseId: string, phaseEffects: PhaseEffect[]): PendingEffectRoll[] {
  return phaseEffects
    .filter(e => e.phase_id === phaseId && e.value_type === 'dice')
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(e => ({ effectId: e.id, target: e.target, diceExpression: e.value_expression }))
}

// True when entering this phase requires the user to roll something — either a
// dice duration or one or more dice-valued effects.
function buildPendingRoll(
  cc: CharacterCondition,
  nextPhase: ConditionPhase,
  phaseEffects: PhaseEffect[],
  conditionName: string,
  characterName?: string
): PendingDiceRoll | null {
  const effects = diceEffectsOf(nextPhase.id, phaseEffects)
  const needsDuration = nextPhase.duration_type === 'dice'
  if (!needsDuration && effects.length === 0) return null
  return {
    characterConditionId: cc.id,
    conditionName,
    characterName,
    phaseOrder: nextPhase.phase_order,
    diceExpression: needsDuration ? nextPhase.duration_expression : '',
    durationUnit: nextPhase.duration_unit,
    effects,
  }
}

export function computeExplorationPendingRolls(
  advTurns: number,
  charConditions: CharacterCondition[],
  characters: Character[],
  conditions: Condition[],
  phases: ConditionPhase[],
  phaseEffects: PhaseEffect[]
): PendingDiceRoll[] {
  const activeCharMap = new Map(characters.filter(c => c.is_active).map(c => [c.id, c.name]))
  return charConditions
    .filter(cc => activeCharMap.has(cc.character_id) && cc.is_active && (cc.remaining_turns - advTurns) <= 0)
    .flatMap(cc => {
      const nextPhase = phases.find(
        p => p.condition_id === cc.condition_id && p.phase_order === cc.current_phase + 1
      )
      if (!nextPhase) return []
      const cond = conditions.find(c => c.id === cc.condition_id)
      const roll = buildPendingRoll(cc, nextPhase, phaseEffects, cond?.name ?? 'Unknown', activeCharMap.get(cc.character_id))
      return roll ? [roll] : []
    })
}

export function computePendingDiceRolls(
  characterId: string,
  charConditions: CharacterCondition[],
  conditions: Condition[],
  phases: ConditionPhase[],
  phaseEffects: PhaseEffect[]
): PendingDiceRoll[] {
  return charConditions
    .filter(cc => cc.character_id === characterId && cc.is_active && cc.remaining_turns === 1)
    .flatMap(cc => {
      const nextPhase = phases.find(
        p => p.condition_id === cc.condition_id && p.phase_order === cc.current_phase + 1
      )
      if (!nextPhase) return []
      const cond = conditions.find(c => c.id === cc.condition_id)
      const roll = buildPendingRoll(cc, nextPhase, phaseEffects, cond?.name ?? 'Unknown')
      return roll ? [roll] : []
    })
}
