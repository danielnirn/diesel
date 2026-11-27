import { supabase } from '../../lib/supabase'
import type { DailySummary, SummaryAnalysis, SummaryListItem } from './types'

const TABLE = 'daily_summaries'
const BUCKET = 'summary-images'
const AI_FUNCTION = 'daily-summary-ai'

export async function getSummary(date: string): Promise<DailySummary | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('summary_date', date).maybeSingle()
  if (error) throw error
  return data
}

export async function listRecentSummaries(limit = 30): Promise<SummaryListItem[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, summary_date, content')
    .order('summary_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function saveSummary(input: {
  date: string
  content: string
  imagePath: string | null
  analysis: SummaryAnalysis | null
}): Promise<DailySummary> {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        summary_date: input.date,
        content: input.content,
        image_path: input.imagePath,
        analysis: input.analysis,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,summary_date' },
    )
    .select()
    .single()
  if (error) throw error
  return data
}

export async function uploadImage(image: Blob, date: string): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id
  if (!userId) throw new Error('Not signed in')

  const path = `${userId}/${date}-${Date.now()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, image, { contentType: 'image/jpeg' })
  if (error) throw error
  return path
}

export async function getImageUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

export async function transcribeImage(imageBase64: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke(AI_FUNCTION, {
    body: { action: 'transcribe', image: imageBase64 },
  })
  if (error) throw error
  return data.text
}

export async function analyzeSummary(text: string): Promise<SummaryAnalysis> {
  const { data, error } = await supabase.functions.invoke(AI_FUNCTION, {
    body: { action: 'analyze', text },
  })
  if (error) throw error
  return data.analysis
}
