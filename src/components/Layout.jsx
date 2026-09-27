// App shell: top navigation bar + the current page.
import { NavLink, Outlet, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user, signOut } = useAuth()

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <img src="/favicon.svg" alt="" />
            Budget Analyzer
          </Link>
          <nav className="nav">
            <NavLink to="/" end>Dashboard</NavLink>
            <NavLink to="/transactions">Transactions</NavLink>
            <NavLink to="/budgets">Budgets</NavLink>
          </nav>
          <div className="user-area">
            <span className="user-email">{user?.email}</span>
            <button className="btn btn-secondary btn-sm" onClick={signOut}>
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  )
}
