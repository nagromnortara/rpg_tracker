import type { FiredEffect, PhaseEffect } from './types'

// Distribute a total over `duration` rounds, deterministically, so all clients
// agree. Round 1 and round `duration` are guaranteed >= 1 when total >= 2 (e.g.
// "recover 7 HP over 9 turns" → +1 on rounds 1,2,4,5,6,8,9).
export function distributeAmount(total: number, duration: number): number[] {
  const arr = new Array(Math.max(duration, 0)).fill(0)
  if (duration <= 0 || total <= 0) return arr
  if (duration === 1) { arr[0] = total; return arr }
  if (total === 1) { arr[0] = 1; return arr } // single unit lands on the first round
  for (let i = 0; i < total; i++) {
    const idx = Math.round((i * (duration - 1)) / (total - 1))
    arr[idx] += 1
  }
  return arr
}

// Resolve an effect's configured value to a concrete integer. Dice values are
// looked up from the resolved-per-phase-instance map; fixed values are parsed.
export function resolveEffectValue(
  effect: PhaseEffect,
  effectValues: Record<string, number>
): number {
  if (effect.value_type === 'dice') return effectValues[effect.id] ?? 0
  const n = parseInt(effect.value_expression, 10)
  return isNaN(n) ? 0 : n
}

const TIMING_LABEL: Record<string, string> = {
  first: 'first round',
  last: 'last round',
  every: 'every round',
  distributed: 'distributed',
}

// Which effects fire on round `r` (1-based) of a phase of length `duration`,
// with the concrete value applied this round.
export function effectsForRound(
  effects: PhaseEffect[],
  effectValues: Record<string, number>,
  r: number,
  duration: number
): FiredEffect[] {
  if (r < 1 || duration < 1) return []
  const fired: FiredEffect[] = []
  for (const e of effects) {
    const base = resolveEffectValue(e, effectValues)
    let value: number | null = null
    let detail = TIMING_LABEL[e.timing]
    switch (e.timing) {
      case 'first':
        if (r === 1) value = base
        break
      case 'last':
        if (r === duration) value = base
        break
      case 'every':
        value = base
        break
      case 'distributed': {
        const v = distributeAmount(base, duration)[r - 1] ?? 0
        if (v !== 0) { value = v; detail = `distributed (round ${r}/${duration})` }
        break
      }
    }
    if (value !== null && value !== 0) {
      fired.push({ effectId: e.id, target: e.target, value, timing: e.timing, detail })
    }
  }
  return fired
}

// The 1-based round index a condition is currently on within its phase.
export function currentRound(phaseTotalTurns: number, remainingTurns: number): number {
  return phaseTotalTurns - remainingTurns + 1
}

// Sum the effects that fire across a contiguous run of rounds [fromRound, toRound]
// within a single phase (used for exploration bulk time-skips), collapsed to one
// entry per target. `detail` notes the span.
export function aggregateRounds(
  effects: PhaseEffect[],
  effectValues: Record<string, number>,
  fromRound: number,
  toRound: number,
  duration: number
): FiredEffect[] {
  const totals = new Map<string, { value: number; timing: PhaseEffect['timing']; effectId: string }>()
  for (let r = Math.max(1, fromRound); r <= Math.min(duration, toRound); r++) {
    for (const f of effectsForRound(effects, effectValues, r, duration)) {
      const prev = totals.get(f.target)
      if (prev) prev.value += f.value
      else totals.set(f.target, { value: f.value, timing: f.timing, effectId: f.effectId })
    }
  }
  const span = Math.min(duration, toRound) - Math.max(1, fromRound) + 1
  return [...totals.entries()].map(([target, { value, timing, effectId }]) => ({
    effectId,
    target,
    value,
    timing,
    detail: `over ${span} turn${span === 1 ? '' : 's'}`,
  }))
}
