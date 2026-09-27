// Shared budget-status logic so the dashboard and budgets page agree.
// pct_used comes from the budget_vs_actual SQL view.
export function budgetStatus(pctUsed) {
  if (pctUsed === null || pctUsed === undefined) return null
  if (pctUsed > 100) return { key: 'bad', label: 'Over budget', icon: '▲' }
  if (pctUsed >= 80) return { key: 'warn', label: 'Near limit', icon: '●' }
  return { key: 'good', label: 'On track', icon: '✓' }
}

const BAR_COLORS = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)' }

export function BudgetProgress({ pctUsed }) {
  const status = budgetStatus(pctUsed)
  const width = Math.min(Number(pctUsed) || 0, 100)
  return (
    <div className="progress" role="img" aria-label={`${pctUsed ?? 0}% of budget used`}>
      <span style={{ width: `${width}%`, background: status ? BAR_COLORS[status.key] : 'var(--axis)' }} />
    </div>
  )
}

export function StatusBadge({ pctUsed }) {
  const status = budgetStatus(pctUsed)
  if (!status) return null
  return (
    <span className={`status status-${status.key}`}>
      <span aria-hidden="true">{status.icon}</span> {status.label}
    </span>
  )
}
