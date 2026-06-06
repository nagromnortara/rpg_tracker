import type { DurationUnit } from './types'

export function parseDiceExpression(expr: string): { count: number; sides: number } | null {
  const diceMatch = expr.match(/^(\d+)d(\d+)$/i)
  if (diceMatch) return { count: parseInt(diceMatch[1]), sides: parseInt(diceMatch[2]) }
  const fixedMatch = expr.match(/^(\d+)$/)
  if (fixedMatch) return { count: parseInt(fixedMatch[1]), sides: 1 }
  return null
}

const UNIT_SINGULAR: Record<DurationUnit, string> = {
  turns: 'turn', minutes: 'minute', hours: 'hour', days: 'day',
}
const UNIT_PLURAL: Record<DurationUnit, string> = {
  turns: 'turns', minutes: 'minutes', hours: 'hours', days: 'days',
}

export function unitAbbr(unit: DurationUnit): string {
  switch (unit) {
    case 'turns':   return 't'
    case 'minutes': return 'min'
    case 'hours':   return 'h'
    case 'days':    return 'd'
  }
}

// Format the configured duration for display in Settings
export function formatDiceExpression(expr: string, unit: DurationUnit = 'turns'): string {
  const parsed = parseDiceExpression(expr)
  if (!parsed) return expr
  if (parsed.sides === 1) {
    const label = parsed.count === 1 ? UNIT_SINGULAR[unit] : UNIT_PLURAL[unit]
    return `${parsed.count} ${label}`
  }
  return `Roll ${expr} ${UNIT_PLURAL[unit]}`
}

export function isDiceExpression(expr: string): boolean {
  return /^\d+d\d+$/i.test(expr)
}

// Convert a value in the given unit to turns
export function toTurns(value: number, unit: DurationUnit, tpm: number): number {
  switch (unit) {
    case 'turns':   return value
    case 'minutes': return value * tpm
    case 'hours':   return value * tpm * 60
    case 'days':    return value * tpm * 60 * 24
  }
}

// Format remaining turns for display, using smart unit thresholds
// - 'turns' unit: always show turns
// - time units: show hours if >= 1h, minutes if >= 1min, turns if < 1min
export function formatRemaining(remaining: number, unit: DurationUnit, tpm: number): string {
  if (unit === 'turns') return `${remaining}t`
  const minutes = remaining / tpm
  if (minutes < 1) return `${remaining}t`
  const roundedMin = Math.round(minutes)
  if (roundedMin < 60) return `${roundedMin}min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

// Urgency for condition badge colouring
// - turns: danger <= 1, warning <= 3
// - time-based: danger < 1min, warning < 1h
export function remainingUrgency(remaining: number, unit: DurationUnit, tpm: number): 'danger' | 'warning' | 'normal' {
  if (unit === 'turns') return remaining <= 1 ? 'danger' : remaining <= 3 ? 'warning' : 'normal'
  const minutes = remaining / tpm
  if (minutes < 1) return 'danger'
  if (minutes < 60) return 'warning'
  return 'normal'
}
