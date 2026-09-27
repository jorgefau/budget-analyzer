// Shared constants and small formatting / date helpers.

// Fixed category list keeps the data clean and the charts consistent.
export const CATEGORIES = [
  'Housing',
  'Groceries',
  'Dining',
  'Transportation',
  'Utilities',
  'Subscriptions',
  'Shopping',
  'Entertainment',
  'Health',
  'Other',
]

// Map any text (e.g. from a CSV) onto one of our categories, case-insensitively.
export function normalizeCategory(value) {
  const match = CATEGORIES.find(
    (c) => c.toLowerCase() === String(value ?? '').trim().toLowerCase()
  )
  return match ?? 'Other'
}

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const currencyRound = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export const formatMoney = (n) => currency.format(Number(n) || 0)
export const formatMoneyShort = (n) => currencyRound.format(Number(n) || 0)

export function formatPercent(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

// ---- Month helpers. A "month key" is a string like "2026-09". ----

export function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// "2026-09" -> "2026-09-01" (how months are stored in the database)
export const monthStart = (key) => `${key}-01`

// First day of the following month, used as an exclusive upper bound.
export function nextMonthStart(key) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// Shift a month key by n months (negative = back in time).
export function shiftMonth(key, n) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// "2026-09" -> "Sep 2026" / "Sep"
export function monthLabel(key, short = false) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleString('en-US', short ? { month: 'short' } : { month: 'long', year: 'numeric' })
}

// "2026-09-14" -> "Sep 14, 2026" without timezone shifting
export function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
