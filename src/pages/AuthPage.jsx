// Login + registration on one page, toggled by `mode`.
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AuthPage() {
  const { user, signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  // Already logged in? Go straight to the dashboard.
  if (user) return <Navigate to="/" replace />

  const isRegister = mode === 'register'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')

    if (isRegister && password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    const { data, error: authError } = isRegister
      ? await signUp(email, password)
      : await signIn(email, password)
    setBusy(false)

    if (authError) {
      setError(authError.message)
      return
    }
    // If email confirmation is turned on in Supabase, signUp returns no session.
    if (isRegister && !data.session) {
      setInfo('Account created! Check your email to confirm, then log in.')
      setMode('login')
    }
    // On success with a session, AuthContext updates and we redirect above.
  }

  function switchMode() {
    setMode(isRegister ? 'login' : 'register')
    setError('')
    setInfo('')
  }

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <h1>Budget Analyzer</h1>
        <p>Track your spending, set monthly budgets, and see exactly where your money goes.</p>
        <ul>
          <li>Log expenses by hand or import a bank CSV</li>
          <li>Set a budget for each spending category</li>
          <li>Dashboard with KPIs, trends and budget vs. actual</li>
        </ul>
      </section>

      <div className="auth-form-wrap">
        <form className="auth-form" onSubmit={handleSubmit}>
          <div>
            <h2>{isRegister ? 'Create your account' : 'Welcome back'}</h2>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              {isRegister ? 'Sign up with your email and a password.' : 'Log in to see your dashboard.'}
            </p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {info && <div className="alert alert-success">{info}</div>}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              minLength={6}
              required
            />
          </label>
          {isRegister && (
            <label>
              Confirm password
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </label>
          )}

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'}
          </button>

          <p className="auth-switch">
            {isRegister ? 'Already have an account? ' : "Don't have an account? "}
            <button type="button" className="link-btn" onClick={switchMode}>
              {isRegister ? 'Log in' : 'Sign up'}
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
