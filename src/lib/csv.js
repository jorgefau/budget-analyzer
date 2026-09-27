// Parse a CSV file of transactions into rows ready to insert.
// Accepts our own export format (date, amount, merchant, category, notes)
// and common bank export headers (Transaction Date, Description, Debit...).
import Papa from 'papaparse'
import { normalizeCategory } from './format'

// Possible header names for each field, checked in order (case-insensitive).
const HEADER_ALIASES = {
  date: ['date', 'transaction date', 'posted date', 'posting date', 'txn_date'],
  amount: ['amount', 'debit', 'amount (usd)', 'value'],
  merchant: ['merchant', 'description', 'payee', 'name', 'memo'],
  category: ['category'],
  notes: ['notes', 'note', 'details'],
}

function findColumn(headers, field) {
  const lower = headers.map((h) => h.trim().toLowerCase())
  for (const alias of HEADER_ALIASES[field]) {
    const i = lower.indexOf(alias)
    if (i !== -1) return headers[i]
  }
  return null
}

// Convert "09/14/2026", "2026-09-14" or "9/14/26" into "2026-09-14".
function toISODate(value) {
  const s = String(value ?? '').trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  }
  return null
}

// "$1,234.56" or "-45.10" or "(45.10)" -> 45.10 (expenses are stored as positive)
function toAmount(value) {
  const cleaned = String(value ?? '').replace(/[$,\s()]/g, '')
  const n = Math.abs(parseFloat(cleaned))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN
}

export function parseTransactionsCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta }) => {
        const headers = meta.fields ?? []
        const cols = Object.fromEntries(
          Object.keys(HEADER_ALIASES).map((f) => [f, findColumn(headers, f)])
        )
        if (!cols.date || !cols.amount || !cols.merchant) {
          reject(
            new Error(
              'CSV needs at least date, amount and merchant (or description) columns.'
            )
          )
          return
        }

        const rows = []
        let skipped = 0
        for (const r of data) {
          const txn_date = toISODate(r[cols.date])
          const amount = toAmount(r[cols.amount])
          const merchant = String(r[cols.merchant] ?? '').trim()
          if (!txn_date || !(amount > 0) || !merchant) {
            skipped++
            continue
          }
          rows.push({
            txn_date,
            amount,
            merchant,
            category: normalizeCategory(cols.category ? r[cols.category] : ''),
            notes: cols.notes ? String(r[cols.notes] ?? '').trim() || null : null,
          })
        }
        resolve({ rows, skipped })
      },
      error: reject,
    })
  })
}

// Download a list of transactions as a CSV file.
export function downloadTransactionsCsv(transactions, filename) {
  const csv = Papa.unparse(
    transactions.map((t) => ({
      date: t.txn_date,
      amount: Number(t.amount).toFixed(2),
      merchant: t.merchant,
      category: t.category,
      notes: t.notes ?? '',
    }))
  )
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
