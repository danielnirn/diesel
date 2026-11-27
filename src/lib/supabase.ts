import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

// Placeholders keep the module loadable so the app can show a setup notice.
export const supabase = createClient(url || 'http://localhost', anonKey || 'missing')
