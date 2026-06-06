import type { Character, CharacterCondition, Condition, ConditionPhase, PendingDiceRoll } from './types'

export function computeExplorationPendingRolls(
  advTurns: number,
  charConditions: CharacterCondition[],
  characters: Character[],
  conditions: Condition[],
  phases: ConditionPhase[]
): PendingDiceRoll[] {
  const activeCharMap = new Map(characters.filter(c => c.is_active).map(c => [c.id, c.name]))
  return charConditions
    .filter(cc => activeCharMap.has(cc.character_id) && cc.is_active && (cc.remaining_turns - advTurns) <= 0)
    .flatMap(cc => {
      const nextPhase = phases.find(
        p => p.condition_id === cc.condition_id && p.phase_order === cc.current_phase + 1
      )
      if (!nextPhase || nextPhase.duration_type !== 'dice') return []
      const cond = conditions.find(c => c.id === cc.condition_id)
      return [{
        characterConditionId: cc.id,
        conditionName: cond?.name ?? 'Unknown',
        characterName: activeCharMap.get(cc.character_id),
        phaseOrder: nextPhase.phase_order,
        diceExpression: nextPhase.duration_expression,
        durationUnit: nextPhase.duration_unit,
      } satisfies PendingDiceRoll]
    })
}

export function computePendingDiceRolls(
  characterId: string,
  charConditions: CharacterCondition[],
  conditions: Condition[],
  phases: ConditionPhase[]
): PendingDiceRoll[] {
  return charConditions
    .filter(cc => cc.character_id === characterId && cc.is_active && cc.remaining_turns === 1)
    .flatMap(cc => {
      const nextPhase = phases.find(
        p => p.condition_id === cc.condition_id && p.phase_order === cc.current_phase + 1
      )
      if (!nextPhase || nextPhase.duration_type !== 'dice') return []
      const cond = conditions.find(c => c.id === cc.condition_id)
      return [{
        characterConditionId: cc.id,
        conditionName: cond?.name ?? 'Unknown',
        phaseOrder: nextPhase.phase_order,
        diceExpression: nextPhase.duration_expression,
        durationUnit: nextPhase.duration_unit,
      } satisfies PendingDiceRoll]
    })
}
