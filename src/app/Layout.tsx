import { Link, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { features } from './features'

export function Layout() {
  const { pathname } = useLocation()
  const current = features.find((f) => pathname.startsWith(`/${f.path}`))

  return (
    <div className="app">
      <header className="topbar">
        {current ? (
          <Link to="/" className="topbar-btn" aria-label="חזרה לתפריט">
            ›
          </Link>
        ) : (
          <span className="topbar-btn" />
        )}
        <h1>{current ? current.title : 'דיזל עכו'}</h1>
        <button className="topbar-btn text" onClick={() => supabase.auth.signOut()}>
          יציאה
        </button>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
