export function parseDiceExpression(expr: string): { count: number; sides: number } | null {
  const diceMatch = expr.match(/^(\d+)d(\d+)$/i)
  if (diceMatch) return { count: parseInt(diceMatch[1]), sides: parseInt(diceMatch[2]) }
  const fixedMatch = expr.match(/^(\d+)$/)
  if (fixedMatch) return { count: parseInt(fixedMatch[1]), sides: 1 }
  return null
}

export function formatDiceExpression(expr: string): string {
  const parsed = parseDiceExpression(expr)
  if (!parsed) return expr
  if (parsed.sides === 1) return `${parsed.count} turn${parsed.count !== 1 ? 's' : ''}`
  return `Roll ${expr}`
}

export function isDiceExpression(expr: string): boolean {
  return /^\d+d\d+$/i.test(expr)
}
