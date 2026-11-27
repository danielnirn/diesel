import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('הכניסה נכשלה. בדוק אימייל וסיסמה.')
    setBusy(false)
  }

  return (
    <main className="center-screen">
      <form className="card login" onSubmit={onSubmit}>
        <img src="/icon.svg" alt="" className="login-logo" />
        <h1>דיזל עכו</h1>
        <label>
          אימייל
          <input
            type="email"
            dir="ltr"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          סיסמה
          <input
            type="password"
            dir="ltr"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'נכנס…' : 'כניסה'}
        </button>
      </form>
    </main>
  )
}
