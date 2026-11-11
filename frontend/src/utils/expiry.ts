// Helpers for expiry dates stored as "YYYY-MM-DD" text.

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function isValidIsoDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value)
  if (!match) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

// Whole days from today until the date (negative = already expired).
export function daysUntil(isoDate: string, today: Date = new Date()): number {
  const [year, month, day] = isoDate.split('-').map(Number)
  const target = new Date(year, month - 1, day)
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((target.getTime() - start.getTime()) / 86_400_000)
}

// The date `days` days from today, as "YYYY-MM-DD".
export function dateInDays(days: number, today: Date = new Date()): string {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function expiryText(days: number): string {
  if (days < 0) return `expired ${-days} day${days === -1 ? '' : 's'} ago`
  if (days === 0) return 'expires today'
  return `${days} day${days === 1 ? '' : 's'} left`
}
