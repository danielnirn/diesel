import type { ComponentType } from 'react'
import { DailySummaryPage } from '../features/daily-summary/DailySummaryPage'

export interface Feature {
  /** URL segment, e.g. "daily-summary" -> /#/daily-summary */
  path: string
  title: string
  description: string
  icon: string
  Component: ComponentType
}

// To add a capability: build it under src/features/<name>/ and register it here.
export const features: Feature[] = [
  {
    path: 'daily-summary',
    title: 'סיכום יום',
    description: 'הזנה ידנית או צילום דף, לפי תאריך',
    icon: '📝',
    Component: DailySummaryPage,
  },
]
