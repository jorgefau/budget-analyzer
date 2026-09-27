// Budgets: set a monthly spending limit per category and compare it to actual spending.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { BudgetProgress, StatusBadge } from '../components/BudgetStatus'
import {
  CATEGORIES,
  currentMonthKey,
  formatMoney,
  monthLabel,
  monthStart,
  shiftMonth,
} from '../lib/format'

export default function BudgetsPage() {
  const { user } = useAuth()
  const [month, setMonth] = useState(currentMonthKey())
  const [rows, setRows] = useState([]) // from the budget_vs_actual view
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // New-budget form
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')

  // Inline edit
  const [editingId, setEditingId] = useState(null)
  const [editAmount, setEditAmount] = useState('')

  // READ: budget vs actual for the selected month (joined + calculated in SQL)
  const load = useCallback(async () => {
    setLoading(true)
    const [bva, ids] = await Promise.all([
      supabase
        .from('budget_vs_actual')
        .select('*')
        .eq('month', monthStart(month))
        .order('category'),
      // The view has no id column, so fetch ids to support edit/delete
      supabase.from('budgets').select('id, category').eq('month', monthStart(month)),
    ])
    const err = bva.error || ids.error
    if (err) setError(err.message)
    else {
      const idByCategory = Object.fromEntries(ids.data.map((b) => [b.category, b.id]))
      setRows(bva.data.map((r) => ({ ...r, id: idByCategory[r.category] })))
    }
    setLoading(false)
  }, [month])

  useEffect(() => {
    load()
  }, [load])

  function flash(message) {
    setNotice(message)
    setError('')
    setTimeout(() => setNotice(''), 4000)
  }

  const unbudgeted = CATEGORIES.filter((c) => !rows.some((r) => r.category === c))

  // CREATE
  async function addBudget(e) {
    e.preventDefault()
    const cat = category || unbudgeted[0]
    setBusy(true)
    const { error: err } = await supabase.from('budgets').insert({
      category: cat,
      month: monthStart(month),
      amount: Math.round(parseFloat(amount) * 100) / 100,
    })
    setBusy(false)
    if (err) setError(err.message)
    else {
      setAmount('')
      setCategory('')
      flash(`Budget set for ${cat}.`)
      load()
    }
  }

  // UPDATE
  async function saveEdit(id) {
    const { error: err } = await supabase
      .from('budgets')
      .update({ amount: Math.round(parseFloat(editAmount) * 100) / 100 })
      .eq('id', id)
    if (err) setError(err.message)
    else {
      setEditingId(null)
      flash('Budget updated.')
      load()
    }
  }

  // DELETE
  async function remove(row) {
    if (!window.confirm(`Remove the ${row.category} budget for ${monthLabel(month)}?`)) return
    const { error: err } = await supabase.from('budgets').delete().eq('id', row.id)
    if (err) setError(err.message)
    else {
      flash('Budget removed.')
      load()
    }
  }

  // Copy every budget from the previous month into this one (upsert skips duplicates)
  async function copyPreviousMonth() {
    setBusy(true)
    const prev = shiftMonth(month, -1)
    const { data, error: err } = await supabase
      .from('budgets')
      .select('category, amount')
      .eq('month', monthStart(prev))
    if (err || !data.length) {
      setBusy(false)
      setError(err ? err.message : `No budgets found for ${monthLabel(prev)}.`)
      return
    }
    const { error: upsertErr } = await supabase.from('budgets').upsert(
      data.map((b) => ({ ...b, user_id: user.id, month: monthStart(month) })),
      { onConflict: 'user_id,category,month', ignoreDuplicates: true }
    )
    setBusy(false)
    if (upsertErr) setError(upsertErr.message)
    else {
      flash(`Copied ${data.length} budgets from ${monthLabel(prev)}.`)
      load()
    }
  }

  const totals = rows.reduce(
    (acc, r) => ({ budgeted: acc.budgeted + Number(r.budgeted), actual: acc.actual + Number(r.actual) }),
    { budgeted: 0, actual: 0 }
  )

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Budgets</h1>
          <p>Set a monthly limit for each category and track how much is left.</p>
        </div>
        <div className="toolbar">
          <label>
            Month
            <input
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              required
            />
          </label>
          <button className="btn btn-secondary" onClick={copyPreviousMonth} disabled={busy}>
            Copy last month's budgets
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      {unbudgeted.length > 0 && (
        <section className="card">
          <div className="card-header">
            <h2>Add a budget for {monthLabel(month)}</h2>
          </div>
          <form className="toolbar" onSubmit={addBudget}>
            <label>
              Category
              <select value={category || unbudgeted[0]} onChange={(e) => setCategory(e.target.value)}>
                {unbudgeted.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Monthly limit ($)
              <input
                type="number"
                min="0"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 400"
                required
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              Add budget
            </button>
          </form>
        </section>
      )}

      <section className="card">
        <div className="card-header">
          <div>
            <h2>Budget vs. actual — {monthLabel(month)}</h2>
            <p>Actual spending is calculated live from your transactions by a SQL view.</p>
          </div>
        </div>

        {loading ? (
          <div className="empty">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="empty">
            No budgets for {monthLabel(month)} yet. Add one above or copy last month's.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="right">Budget</th>
                  <th className="right">Spent</th>
                  <th className="right">Remaining</th>
                  <th style={{ width: '22%' }}>Used</th>
                  <th>Status</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.category}>
                    <td>{r.category}</td>
                    <td className="right num">
                      {editingId === r.id ? (
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          style={{ width: 100 }}
                          autoFocus
                        />
                      ) : (
                        formatMoney(r.budgeted)
                      )}
                    </td>
                    <td className="right num">{formatMoney(r.actual)}</td>
                    <td className="right num" style={{ color: r.remaining < 0 ? 'var(--bad)' : undefined }}>
                      {formatMoney(r.remaining)}
                    </td>
                    <td>
                      <BudgetProgress pctUsed={r.pct_used} />
                      <div className="muted small num">{r.pct_used ?? 0}%</div>
                    </td>
                    <td>
                      <StatusBadge pctUsed={r.pct_used} />
                    </td>
                    <td className="actions">
                      {editingId === r.id ? (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => saveEdit(r.id)}>
                            Save
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setEditingId(r.id)
                              setEditAmount(String(r.budgeted))
                            }}
                          >
                            Edit
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => remove(r)}>
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="right num">{formatMoney(totals.budgeted)}</td>
                  <td className="right num">{formatMoney(totals.actual)}</td>
                  <td className="right num">{formatMoney(totals.budgeted - totals.actual)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
