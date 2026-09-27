// Transactions: add / edit / delete expenses, filter them, and import/export CSV.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import TransactionForm from '../components/TransactionForm'
import { parseTransactionsCsv, downloadTransactionsCsv } from '../lib/csv'
import {
  CATEGORIES,
  currentMonthKey,
  formatDate,
  formatMoney,
  monthLabel,
  monthStart,
  nextMonthStart,
} from '../lib/format'

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(null) // transaction being edited

  // Filters
  const [month, setMonth] = useState(currentMonthKey()) // '' = all months
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')

  const fileInput = useRef(null)

  // READ: build a query from the active filters
  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('transactions')
      .select('*')
      .order('txn_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (month) query = query.gte('txn_date', monthStart(month)).lt('txn_date', nextMonthStart(month))
    if (category) query = query.eq('category', category)
    if (search.trim()) query = query.ilike('merchant', `%${search.trim()}%`)

    const { data, error: err } = await query
    if (err) setError(err.message)
    else setTransactions(data)
    setLoading(false)
  }, [month, category, search])

  useEffect(() => {
    // Small delay so typing in the search box doesn't fire a query per keystroke
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  function flash(message) {
    setNotice(message)
    setError('')
    setTimeout(() => setNotice(''), 4000)
  }

  // CREATE
  async function addTransaction(values) {
    setBusy(true)
    const { error: err } = await supabase.from('transactions').insert(values)
    setBusy(false)
    if (err) {
      setError(err.message)
      return false
    }
    flash(`Added ${formatMoney(values.amount)} at ${values.merchant}.`)
    load()
    return true
  }

  // UPDATE
  async function saveEdit(values) {
    setBusy(true)
    const { error: err } = await supabase.from('transactions').update(values).eq('id', editing.id)
    setBusy(false)
    if (err) {
      setError(err.message)
      return false
    }
    setEditing(null)
    flash('Transaction updated.')
    load()
    return true
  }

  // DELETE
  async function remove(t) {
    if (!window.confirm(`Delete ${formatMoney(t.amount)} at ${t.merchant}?`)) return
    const { error: err } = await supabase.from('transactions').delete().eq('id', t.id)
    if (err) setError(err.message)
    else {
      if (editing?.id === t.id) setEditing(null)
      flash('Transaction deleted.')
      load()
    }
  }

  // CSV IMPORT (bulk create)
  async function handleImport(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    setBusy(true)
    try {
      const { rows, skipped } = await parseTransactionsCsv(file)
      if (rows.length === 0) throw new Error('No valid rows found in that file.')
      // Insert in chunks to stay well under request size limits
      for (let i = 0; i < rows.length; i += 500) {
        const { error: err } = await supabase.from('transactions').insert(rows.slice(i, i + 500))
        if (err) throw err
      }
      flash(
        `Imported ${rows.length} transactions${skipped ? ` (skipped ${skipped} invalid rows)` : ''}.`
      )
      setMonth('') // show everything so the imported rows are visible
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // CSV EXPORT of whatever is currently filtered
  function handleExport() {
    const label = month || 'all'
    downloadTransactionsCsv(transactions, `transactions-${label}.csv`)
  }

  const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0)

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Transactions</h1>
          <p>Record expenses by hand or import them from a CSV file.</p>
        </div>
        <div className="toolbar">
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            onChange={handleImport}
            hidden
          />
          <button className="btn btn-secondary" onClick={() => fileInput.current.click()} disabled={busy}>
            Import CSV
          </button>
          <button className="btn btn-secondary" onClick={handleExport} disabled={!transactions.length}>
            Export CSV
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <section className="card">
        <div className="card-header">
          <h2>{editing ? 'Edit expense' : 'Add an expense'}</h2>
          {!editing && (
            <a className="small" href="/sample-transactions.csv" download>
              Download a sample CSV
            </a>
          )}
        </div>
        {editing ? (
          <TransactionForm
            key={editing.id}
            initial={editing}
            onSubmit={saveEdit}
            onCancel={() => setEditing(null)}
            busy={busy}
          />
        ) : (
          <TransactionForm onSubmit={addTransaction} busy={busy} />
        )}
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2>{month ? monthLabel(month) : 'All transactions'}</h2>
            <p>
              {transactions.length} transaction{transactions.length === 1 ? '' : 's'} ·{' '}
              <span className="num">{formatMoney(total)}</span> total
            </p>
          </div>
          <div className="toolbar">
            <label>
              Month
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </label>
            <label>
              Category
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Search merchant
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g. Amazon"
              />
            </label>
            {month && (
              <button className="btn btn-ghost" onClick={() => setMonth('')}>
                Show all months
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="empty">Loading…</div>
        ) : transactions.length === 0 ? (
          <div className="empty">
            No transactions here yet. Add one above, or import the sample CSV to try the app out.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Merchant</th>
                  <th>Category</th>
                  <th className="right">Amount</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="num">{formatDate(t.txn_date)}</td>
                    <td>
                      {t.merchant}
                      {t.notes && <div className="muted small">{t.notes}</div>}
                    </td>
                    <td>
                      <span className="pill">{t.category}</span>
                    </td>
                    <td className="right num">{formatMoney(t.amount)}</td>
                    <td className="actions">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setEditing(t)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                      >
                        Edit
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(t)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
