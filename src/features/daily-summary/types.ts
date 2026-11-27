export interface SummaryAnalysis {
  good: string[]
  bad: string[]
  positive_reviews: string[]
  negative_reviews: string[]
}

export interface DailySummary {
  id: string
  summary_date: string // YYYY-MM-DD
  content: string
  image_path: string | null
  analysis: SummaryAnalysis | null
}

export type SummaryListItem = Pick<DailySummary, 'id' | 'summary_date' | 'content'>
