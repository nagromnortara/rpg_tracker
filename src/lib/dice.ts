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
