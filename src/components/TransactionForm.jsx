// Form used for both adding a new transaction and editing an existing one.
import { useState } from 'react'
import { CATEGORIES, todayISO } from '../lib/format'

const EMPTY = { txn_date: '', amount: '', merchant: '', category: 'Groceries', notes: '' }

export default function TransactionForm({ initial, onSubmit, onCancel, busy }) {
  const [form, setForm] = useState(() =>
    initial
      ? { ...initial, amount: String(initial.amount), notes: initial.notes ?? '' }
      : { ...EMPTY, txn_date: todayISO() }
  )

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  async function handleSubmit(e) {
    e.preventDefault()
    const ok = await onSubmit({
      txn_date: form.txn_date,
      amount: Math.round(parseFloat(form.amount) * 100) / 100,
      merchant: form.merchant.trim(),
      category: form.category,
      notes: form.notes.trim() || null,
    })
    // Clear the form after a successful "add" so the next one can be typed
    if (ok && !initial) setForm({ ...EMPTY, txn_date: form.txn_date, category: form.category })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row">
        <label>
          Date
          <input type="date" value={form.txn_date} onChange={update('txn_date')} required />
        </label>
        <label>
          Amount ($)
          <input
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            value={form.amount}
            onChange={update('amount')}
            placeholder="0.00"
            required
          />
        </label>
        <label>
          Merchant
          <input
            type="text"
            value={form.merchant}
            onChange={update('merchant')}
            placeholder="e.g. Publix"
            maxLength={100}
            required
          />
        </label>
        <label>
          Category
          <select value={form.category} onChange={update('category')}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="notes">
          Notes (optional)
          <input type="text" value={form.notes} onChange={update('notes')} maxLength={200} />
        </label>
        <div className="form-actions">
          {onCancel && (
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {initial ? 'Save changes' : 'Add expense'}
          </button>
        </div>
      </div>
    </form>
  )
}
