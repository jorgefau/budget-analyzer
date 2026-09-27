// Dashboard: KPIs, charts and auto-generated insights for one month.
// All aggregation happens in the database via two SQL views:
//   monthly_category_spending  -> spend per category per month
//   budget_vs_actual           -> budgets joined to actual spend
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { BudgetProgress, StatusBadge } from '../components/BudgetStatus'
import {
  currentMonthKey,
  formatMoney,
  formatMoneyShort,
  formatPercent,
  monthLabel,
  monthStart,
  shiftMonth,
} from '../lib/format'

const TREND_MONTHS = 6

// Consistent tooltip for both charts
function ChartTooltip({ active, payload, label, suffix }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      <span className="num">{formatMoney(payload[0].value)}</span>
      {suffix && <span> {suffix(payload[0].payload)}</span>}
    </div>
  )
}

const axisTick = { fill: 'var(--muted)', fontSize: 12 }

export default function DashboardPage() {
  const [month, setMonth] = useState(null) // chosen after we look for data
  const [spending, setSpending] = useState([]) // monthly_category_spending rows
  const [budgets, setBudgets] = useState([]) // budget_vs_actual rows
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hasAnyData, setHasAnyData] = useState(true)

  // Pick the starting month: this month, or the latest month that has data.
  useEffect(() => {
    async function pickMonth() {
      const { data, error: err } = await supabase
        .from('transactions')
        .select('txn_date')
        .order('txn_date', { ascending: false })
        .limit(1)
      if (err) {
        setError(err.message)
        setMonth(currentMonthKey())
        return
      }
      if (!data.length) {
        setHasAnyData(false)
        setMonth(currentMonthKey())
        return
      }
      const latest = data[0].txn_date.slice(0, 7)
      setMonth(latest < currentMonthKey() ? latest : currentMonthKey())
    }
    pickMonth()
  }, [])

  // Load the view data whenever the month changes.
  useEffect(() => {
    if (!month) return
    async function load() {
      setLoading(true)
      const from = monthStart(shiftMonth(month, -(TREND_MONTHS - 1)))
      const [spend, bva] = await Promise.all([
        supabase
          .from('monthly_category_spending')
          .select('month, category, total_spent, txn_count')
          .gte('month', from)
          .lte('month', monthStart(month)),
        supabase
          .from('budget_vs_actual')
          .select('*')
          .eq('month', monthStart(month))
          .order('pct_used', { ascending: false }),
      ])
      const err = spend.error || bva.error
      if (err) setError(err.message)
      else {
        setSpending(spend.data)
        setBudgets(bva.data)
      }
      setLoading(false)
    }
    load()
  }, [month])

  // ---- Derive the metrics the dashboard shows ----
  const stats = useMemo(() => {
    if (!month) return null
    const key = monthStart(month)
    const prevKey = monthStart(shiftMonth(month, -1))

    const thisMonth = spending.filter((r) => r.month === key)
    const total = thisMonth.reduce((s, r) => s + Number(r.total_spent), 0)
    const txnCount = thisMonth.reduce((s, r) => s + Number(r.txn_count), 0)
    const prevTotal = spending
      .filter((r) => r.month === prevKey)
      .reduce((s, r) => s + Number(r.total_spent), 0)
    const momChange = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null

    const byCategory = thisMonth
      .map((r) => ({
        category: r.category,
        total: Number(r.total_spent),
        share: total ? (Number(r.total_spent) / total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)

    const trend = Array.from({ length: TREND_MONTHS }, (_, i) => {
      const k = shiftMonth(month, i - (TREND_MONTHS - 1))
      const monthTotal = spending
        .filter((r) => r.month === monthStart(k))
        .reduce((s, r) => s + Number(r.total_spent), 0)
      return { key: k, label: monthLabel(k, true), total: monthTotal }
    })
    const priorMonths = trend.slice(0, -1).filter((t) => t.total > 0)
    const avgPrior = priorMonths.length
      ? priorMonths.reduce((s, t) => s + t.total, 0) / priorMonths.length
      : null

    const budgeted = budgets.reduce((s, b) => s + Number(b.budgeted), 0)
    const budgetActual = budgets.reduce((s, b) => s + Number(b.actual), 0)
    const overBudget = budgets.filter((b) => Number(b.pct_used) > 100)

    return {
      total,
      txnCount,
      prevTotal,
      momChange,
      byCategory,
      trend,
      avgPrior,
      budgeted,
      budgetRemaining: budgeted - budgetActual,
      overBudget,
    }
  }, [spending, budgets, month])

  // Plain-English findings, the way an analyst would summarize the month.
  const insights = useMemo(() => {
    if (!stats || stats.total === 0) return []
    const list = []
    const top = stats.byCategory[0]
    list.push(
      `${top.category} was your largest category at ${formatMoney(top.total)} (${top.share.toFixed(0)}% of spending).`
    )
    if (stats.momChange !== null) {
      list.push(
        `Total spending is ${stats.momChange >= 0 ? 'up' : 'down'} ${Math.abs(stats.momChange).toFixed(1)}% vs. ${monthLabel(shiftMonth(month, -1), true)} (${formatMoney(stats.prevTotal)}).`
      )
    }
    if (stats.avgPrior) {
      const diff = ((stats.total - stats.avgPrior) / stats.avgPrior) * 100
      list.push(
        `That is ${Math.abs(diff).toFixed(0)}% ${diff >= 0 ? 'above' : 'below'} your average of ${formatMoney(stats.avgPrior)} over the previous months.`
      )
    }
    for (const b of stats.overBudget) {
      list.push(
        `${b.category} is over budget by ${formatMoney(-b.remaining)} (${b.pct_used}% of its ${formatMoney(b.budgeted)} limit).`
      )
    }
    if (stats.budgeted > 0 && stats.overBudget.length === 0) {
      list.push('Every budgeted category is within its limit this month. Nice work.')
    }
    return list
  }, [stats, month])

  if (!month) return <div className="loading-screen">Loading…</div>

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Spending overview for {monthLabel(month)}.</p>
        </div>
        <div className="toolbar">
          <button className="btn btn-secondary" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
            ←
          </button>
          <label>
            Month
            <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          </label>
          <button className="btn btn-secondary" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
            →
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {!hasAnyData && (
        <div className="alert alert-info">
          Welcome! You don't have any transactions yet.{' '}
          <Link to="/transactions">Add some or import the sample CSV</Link> to fill this dashboard.
        </div>
      )}

      {/* KPI tiles */}
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">Total spent</div>
          <div className="kpi-value">{formatMoney(stats.total)}</div>
          <div className="kpi-sub">
            {stats.momChange === null ? (
              'No prior month to compare'
            ) : (
              <>
                <span className={stats.momChange > 0 ? 'delta-up' : 'delta-down'}>
                  {stats.momChange > 0 ? '▲' : '▼'} {formatPercent(stats.momChange)}
                </span>{' '}
                vs. last month
              </>
            )}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Budget remaining</div>
          <div className="kpi-value" style={{ color: stats.budgetRemaining < 0 ? 'var(--bad)' : undefined }}>
            {stats.budgeted ? formatMoney(stats.budgetRemaining) : '—'}
          </div>
          <div className="kpi-sub">
            {stats.budgeted ? `of ${formatMoney(stats.budgeted)} budgeted` : <Link to="/budgets">Set budgets</Link>}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Top category</div>
          <div className="kpi-value">{stats.byCategory[0]?.category ?? '—'}</div>
          <div className="kpi-sub">
            {stats.byCategory[0]
              ? `${formatMoney(stats.byCategory[0].total)} · ${stats.byCategory[0].share.toFixed(0)}% of total`
              : 'No spending yet'}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Transactions</div>
          <div className="kpi-value">{stats.txnCount}</div>
          <div className="kpi-sub">
            {stats.txnCount ? `Avg ${formatMoney(stats.total / stats.txnCount)} each` : 'This month'}
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Spending by category */}
        <section className="card">
          <div className="card-header">
            <div>
              <h2>Spending by category</h2>
              <p>{monthLabel(month)}</p>
            </div>
          </div>
          {loading ? (
            <div className="empty">Loading…</div>
          ) : stats.byCategory.length === 0 ? (
            <div className="empty">No spending recorded this month.</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, stats.byCategory.length * 36)}>
              <BarChart data={stats.byCategory} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid horizontal={false} stroke="var(--grid)" />
                <XAxis type="number" tick={axisTick} tickFormatter={formatMoneyShort} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="category" tick={axisTick} width={100} axisLine={{ stroke: 'var(--axis)' }} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'var(--surface-2)' }}
                  content={<ChartTooltip suffix={(p) => `· ${p.share.toFixed(0)}% of total`} />}
                />
                <Bar dataKey="total" fill="var(--series-1)" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        {/* Monthly trend */}
        <section className="card">
          <div className="card-header">
            <div>
              <h2>Monthly trend</h2>
              <p>Total spending, last {TREND_MONTHS} months</p>
            </div>
          </div>
          {loading ? (
            <div className="empty">Loading…</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: 'var(--axis)' }} tickLine={false} />
                <YAxis tick={axisTick} tickFormatter={formatMoneyShort} axisLine={false} tickLine={false} width={64} />
                <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTooltip />} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]} barSize={32}>
                  {/* Emphasize the selected month; earlier months are context */}
                  {stats.trend.map((t) => (
                    <Cell key={t.key} fill="var(--series-1)" fillOpacity={t.key === month ? 1 : 0.4} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>

      <div className="grid-2 wide-left">
        {/* Budget vs actual */}
        <section className="card">
          <div className="card-header">
            <div>
              <h2>Budget vs. actual</h2>
              <p>Sorted by % of budget used</p>
            </div>
            <Link to="/budgets" className="small">Manage budgets</Link>
          </div>
          {budgets.length === 0 ? (
            <div className="empty">
              No budgets for this month. <Link to="/budgets">Set some</Link> to track variance.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="right">Spent / Budget</th>
                    <th style={{ width: '30%' }}>Used</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {budgets.map((b) => (
                    <tr key={b.category}>
                      <td>{b.category}</td>
                      <td className="right num">
                        {formatMoneyShort(b.actual)} / {formatMoneyShort(b.budgeted)}
                      </td>
                      <td>
                        <BudgetProgress pctUsed={b.pct_used} />
                        <div className="muted small num">{b.pct_used ?? 0}%</div>
                      </td>
                      <td>
                        <StatusBadge pctUsed={b.pct_used} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Insights */}
        <section className="card">
          <div className="card-header">
            <div>
              <h2>Insights</h2>
              <p>Generated from this month's numbers</p>
            </div>
          </div>
          {insights.length === 0 ? (
            <div className="empty">Insights appear once there is spending this month.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 10 }}>
              {insights.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
