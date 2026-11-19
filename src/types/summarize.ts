/** One finished webpage summary (Telegram history + HTTP endpoint). */
export interface ISummary {
  url: string
  host: string
  title: string
  summary: string
  /** How many 6000-char chunks the page text was split into. */
  chunks: number
  createdAt: string
}
