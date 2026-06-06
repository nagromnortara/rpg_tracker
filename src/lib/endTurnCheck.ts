import type { CharacterCondition, Condition, ConditionPhase, PendingDiceRoll } from './types'

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
