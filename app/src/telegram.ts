export function telegramReminderTimestamp(
  date: string | null,
  startMin: number | null,
  leadMin: number | undefined,
): number | undefined {
  if (!date || startMin === null || leadMin === undefined) return undefined
  const start = new Date(date + 'T00:00:00')
  start.setMinutes(startMin)
  return start.getTime() - leadMin * 60_000
}
