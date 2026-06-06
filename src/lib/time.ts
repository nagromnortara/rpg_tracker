function turnsToGameTime(turns: number, tpm: number): { day: number; hour: number; minute: number } {
  const totalMinutes = Math.floor(turns / tpm)
  const day = Math.floor(totalMinutes / 1440)
  const minuteOfDay = totalMinutes % 1440
  return { day, hour: Math.floor(minuteOfDay / 60), minute: minuteOfDay % 60 }
}

export function formatTime(turns: number, tpm: number): string {
  const { hour, minute } = turnsToGameTime(turns, tpm)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function formatDay(turns: number, tpm: number): string {
  return `Day ${turnsToGameTime(turns, tpm).day}`
}

export function formatTurnTimestamp(turns: number, tpm: number): string {
  return `${formatDay(turns, tpm)} ${formatTime(turns, tpm)}`
}
