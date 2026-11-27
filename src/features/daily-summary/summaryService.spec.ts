import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    upsert: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
  }
  const bucket = { upload: vi.fn(), createSignedUrl: vi.fn() }
  return {
    query,
    bucket,
    from: vi.fn(() => query),
    storageFrom: vi.fn(() => bucket),
    getSession: vi.fn(),
    invoke: vi.fn(),
  }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: mocks.from,
    storage: { from: mocks.storageFrom },
    auth: { getSession: mocks.getSession },
    functions: { invoke: mocks.invoke },
  },
}))

import {
  analyzeSummary,
  getImageUrl,
  getSummary,
  listRecentSummaries,
  saveSummary,
  transcribeImage,
  uploadImage,
} from './summaryService'

const analysis = { good: ['a'], bad: [], positive_reviews: [], negative_reviews: ['b'] }

beforeEach(() => {
  vi.clearAllMocks()
  for (const fn of [mocks.query.select, mocks.query.eq, mocks.query.order, mocks.query.upsert]) {
    fn.mockReturnValue(mocks.query)
  }
})

describe('summaryService', () => {
  it('getSummary returns the row for the date', async () => {
    const row = { id: '1', summary_date: '2026-11-27', content: 'x', image_path: null, analysis: null }
    mocks.query.maybeSingle.mockResolvedValue({ data: row, error: null })

    await expect(getSummary('2026-11-27')).resolves.toEqual(row)
    expect(mocks.from).toHaveBeenCalledWith('daily_summaries')
    expect(mocks.query.eq).toHaveBeenCalledWith('summary_date', '2026-11-27')
  })

  it('getSummary returns null when there is no row and throws on error', async () => {
    mocks.query.maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(getSummary('2026-11-27')).resolves.toBeNull()

    mocks.query.maybeSingle.mockResolvedValue({ data: null, error: new Error('boom') })
    await expect(getSummary('2026-11-27')).rejects.toThrow('boom')
  })

  it('listRecentSummaries orders newest first', async () => {
    mocks.query.limit.mockResolvedValue({ data: [{ id: '1' }], error: null })

    await expect(listRecentSummaries(5)).resolves.toEqual([{ id: '1' }])
    expect(mocks.query.order).toHaveBeenCalledWith('summary_date', { ascending: false })
    expect(mocks.query.limit).toHaveBeenCalledWith(5)
  })

  it('saveSummary upserts one row per user and date', async () => {
    mocks.query.single.mockResolvedValue({ data: { id: '1' }, error: null })

    await saveSummary({ date: '2026-11-27', content: 'text', imagePath: 'u/p.jpg', analysis })

    const [payload, options] = mocks.query.upsert.mock.calls[0]
    expect(payload).toMatchObject({
      summary_date: '2026-11-27',
      content: 'text',
      image_path: 'u/p.jpg',
      analysis,
    })
    expect(options).toEqual({ onConflict: 'user_id,summary_date' })
  })

  it('uploadImage stores the file under the user folder', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    mocks.bucket.upload.mockResolvedValue({ error: null })

    const path = await uploadImage(new Blob(['x']), '2026-11-27')

    expect(path).toMatch(/^user-1\/2026-11-27-\d+\.jpg$/)
    expect(mocks.storageFrom).toHaveBeenCalledWith('summary-images')
  })

  it('uploadImage rejects when signed out', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } })
    await expect(uploadImage(new Blob(['x']), '2026-11-27')).rejects.toThrow('Not signed in')
  })

  it('getImageUrl returns a signed url', async () => {
    mocks.bucket.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed' }, error: null })
    await expect(getImageUrl('u/p.jpg')).resolves.toBe('https://signed')
  })

  it('transcribeImage and analyzeSummary call the edge function', async () => {
    mocks.invoke.mockResolvedValueOnce({ data: { text: 'שלום' }, error: null })
    await expect(transcribeImage('BASE64')).resolves.toBe('שלום')
    expect(mocks.invoke).toHaveBeenCalledWith('daily-summary-ai', {
      body: { action: 'transcribe', image: 'BASE64' },
    })

    mocks.invoke.mockResolvedValueOnce({ data: { analysis }, error: null })
    await expect(analyzeSummary('text')).resolves.toEqual(analysis)

    mocks.invoke.mockResolvedValueOnce({ data: null, error: new Error('fn failed') })
    await expect(analyzeSummary('text')).rejects.toThrow('fn failed')
  })
})
