import { HashRouter, Route, Routes } from 'react-router-dom'
import { HomePage } from './app/HomePage'
import { Layout } from './app/Layout'
import { features } from './app/features'
import { AuthProvider } from './auth/AuthProvider'
import { LoginPage } from './auth/LoginPage'
import { useAuth } from './auth/useAuth'
import { isSupabaseConfigured } from './lib/supabase'

function Shell() {
  const { session, loading } = useAuth()

  if (loading) return <main className="center-screen">טוען…</main>
  if (!session) return <LoginPage />

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          {features.map(({ path, Component }) => (
            <Route key={path} path={`${path}/*`} element={<Component />} />
          ))}
          <Route path="*" element={<HomePage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <main className="center-screen">
        <div className="card">
          <h1>דיזל עכו</h1>
          <p>
            חסרות הגדרות Supabase. צור קובץ <code dir="ltr">.env.local</code> לפי{' '}
            <code dir="ltr">.env.example</code> והפעל מחדש.
          </p>
        </div>
      </main>
    )
  }

  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
