import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { blobToBase64, resizeImage } from './imageUtils'
import {
  analyzeSummary,
  getImageUrl,
  getSummary,
  listRecentSummaries,
  saveSummary,
  transcribeImage,
  uploadImage,
} from './summaryService'
import type { SummaryAnalysis, SummaryListItem } from './types'

type Busy = 'loading' | 'transcribing' | 'saving' | null

const ANALYSIS_SECTIONS: { key: keyof SummaryAnalysis; title: string; tone: 'good' | 'bad' }[] = [
  { key: 'good', title: 'מה היה טוב', tone: 'good' },
  { key: 'bad', title: 'מה היה רע', tone: 'bad' },
  { key: 'positive_reviews', title: 'ביקורות טובות', tone: 'good' },
  { key: 'negative_reviews', title: 'ביקורות לא טובות', tone: 'bad' },
]

function toIsoDate(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function shiftDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('he-IL', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  })
}

export function DailySummaryPage() {
  const [today] = useState(() => toIsoDate(new Date()))
  const [date, setDate] = useState(today)
  const [content, setContent] = useState('')
  const [analysis, setAnalysis] = useState<SummaryAnalysis | null>(null)
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [newImage, setNewImage] = useState<Blob | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [recent, setRecent] = useState<SummaryListItem[]>([])
  const [busy, setBusy] = useState<Busy>('loading')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false

    getSummary(date)
      .then(async (summary) => {
        if (cancelled) return
        setContent(summary?.content ?? '')
        setAnalysis(summary?.analysis ?? null)
        setImagePath(summary?.image_path ?? null)
        if (summary?.image_path) {
          const url = await getImageUrl(summary.image_path)
          if (!cancelled) setImageUrl(url)
        }
      })
      .catch(() => !cancelled && setMessage({ kind: 'error', text: 'טעינת הסיכום נכשלה.' }))
      .finally(() => !cancelled && setBusy(null))

    return () => {
      cancelled = true
    }
  }, [date])

  useEffect(() => {
    listRecentSummaries()
      .then(setRecent)
      .catch(() => {})
  }, [])

  function changeDate(next: string) {
    if (next === date) return
    setBusy('loading')
    setMessage(null)
    setNewImage(null)
    setImageUrl(null)
    setDate(next)
  }

  async function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setBusy('transcribing')
    setMessage(null)
    try {
      const image = await resizeImage(file)
      setNewImage(image)
      setImageUrl(URL.createObjectURL(image))
      const text = await transcribeImage(await blobToBase64(image))
      setContent((current) => (current.trim() ? `${current.trimEnd()}\n\n${text}` : text))
      setMessage({ kind: 'ok', text: 'הדף פוענח. בדוק ותקן את הטקסט לפני שמירה.' })
    } catch {
      setMessage({ kind: 'error', text: 'פענוח הדף נכשל. אפשר לנסות שוב או להקליד ידנית.' })
    } finally {
      setBusy(null)
    }
  }

  async function onSave() {
    setBusy('saving')
    setMessage(null)
    try {
      const path = newImage ? await uploadImage(newImage, date) : imagePath

      let nextAnalysis = analysis
      let analysisFailed = false
      try {
        nextAnalysis = await analyzeSummary(content)
      } catch {
        analysisFailed = true
      }

      const saved = await saveSummary({ date, content, imagePath: path, analysis: nextAnalysis })
      setAnalysis(saved.analysis)
      setImagePath(saved.image_path)
      setNewImage(null)
      setRecent(await listRecentSummaries())
      setMessage(
        analysisFailed
          ? { kind: 'error', text: 'הסיכום נשמר, אבל הניתוח נכשל. שמור שוב כדי לנסות שנית.' }
          : { kind: 'ok', text: 'הסיכום נשמר.' },
      )
    } catch {
      setMessage({ kind: 'error', text: 'השמירה נכשלה. הטקסט עדיין כאן, נסה שוב.' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="stack">
      <div className="card date-bar">
        <button className="btn icon" onClick={() => changeDate(shiftDate(date, -1))} aria-label="יום קודם">
          ›
        </button>
        <label className="date-field">
          <span>📅 {formatDate(date)}</span>
          <input
            type="date"
            aria-label="בחירת תאריך"
            value={date}
            max={today}
            onClick={(e) => e.currentTarget.showPicker?.()}
            onChange={(e) => e.target.value && changeDate(e.target.value)}
          />
        </label>
        <button
          className="btn icon"
          onClick={() => changeDate(shiftDate(date, 1))}
          disabled={date >= today}
          aria-label="יום הבא"
        >
          ‹
        </button>
      </div>

      <div className="card stack">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={busy === 'loading' ? 'טוען…' : 'מה היה היום במוסך?'}
          rows={10}
          disabled={busy !== null}
        />

        {imageUrl && (
          <a href={imageUrl} target="_blank" rel="noreferrer">
            <img src={imageUrl} alt="צילום הדף" className="page-photo" />
          </a>
        )}

        {message && <p className={message.kind === 'ok' ? 'notice' : 'error'}>{message.text}</p>}

        <input ref={fileInput} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
        <div className="actions">
          <button className="btn" onClick={() => fileInput.current?.click()} disabled={busy !== null}>
            {busy === 'transcribing' ? 'מפענח…' : '📷 צלם דף'}
          </button>
          <button className="btn primary" onClick={onSave} disabled={busy !== null || !content.trim()}>
            {busy === 'saving' ? 'שומר…' : 'שמור'}
          </button>
        </div>
      </div>

      {analysis &&
        ANALYSIS_SECTIONS.filter(({ key }) => analysis[key]?.length > 0).map(({ key, title, tone }) => (
          <section key={key} className={`card analysis ${tone}`}>
            <h2>{title}</h2>
            <ul>
              {analysis[key].map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>
        ))}

      {recent.length > 0 && (
        <section className="card">
          <h2>סיכומים אחרונים</h2>
          <ul className="recent">
            {recent.map((item) => (
              <li key={item.id}>
                <button
                  className={item.summary_date === date ? 'active' : ''}
                  onClick={() => {
                    changeDate(item.summary_date)
                    window.scrollTo({ top: 0 })
                  }}
                >
                  <strong>{formatDate(item.summary_date)}</strong>
                  <span>{item.content}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
