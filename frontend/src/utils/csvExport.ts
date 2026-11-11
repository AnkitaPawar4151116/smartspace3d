// CSV files for reports (open in Excel). Pure functions, plus one small download helper.
export type CsvCell = string | number | null | undefined

// Quotes a cell. Text that starts with = + - @ is prefixed with ' so Excel never runs it as a formula.
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return ''
  let text = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '') : String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

// Saves the text as a file in the browser (with a byte-order mark so Excel reads accents correctly).
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export const todayStamp = () => new Date().toISOString().slice(0, 10)
