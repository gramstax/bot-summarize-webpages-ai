import {AppConfig} from "./config"
import {OpenAIClient, type IChatMessage} from "./openai"
import {ScrapeError, Scraper, type IFetchedPage} from "./scraper"
import type {ISummary} from "~/types/summarize"

/**
 * The summarizer: scrape a webpage, split its text into chunks, summarize
 * each chunk, then combine the chunk summaries into one final summary.
 *
 * This is the original workflow's Summarization Chain in documentLoader
 * mode (map-reduce): Default Data Loader → Recursive Character Text
 * Splitter (chunkSize 6000) → one model call per chunk → a combine call.
 * The prompts below are model-facing, not user-facing, so they live here
 * in code — the same documented exception as the LLM prompts in the
 * sister bots (strict rule, Damar 2026-11-19 ~14:43 WIB).
 */
export const CHUNK_SUMMARIZE_SYSTEM = `You are a careful summarizer. Summarize the text below in a few clear, faithful sentences. Keep only the main ideas and key facts, in the order they appear. Do not add anything that is not in the text.`

export const COMBINE_SYSTEM = `You are a careful summarizer. Combine the section summaries below into one coherent summary of the whole page. Keep the main ideas and key facts, in the order they appear. Do not add anything that is not in the summaries. Write it as plain paragraphs, no headings, no bullet list.`

export type SummarizeKind = `ok` | `invalid` | `fetch-error` | `ai-error`

export interface ISummarizeResult {
  kind: SummarizeKind
  /** Machine-readable error code (invalid/blocked/fetch/not-html/empty/ai). */
  code?: string
  url: string
  host: string
  title: string
  summary: string
  /** How many 6000-char chunks the page text was split into. */
  chunks: number
  /** `openai` = live model, `mock` = SUMMARIZE_MOCK_AI / no key. */
  via: `openai` | `mock`
}

export interface ILatestResult {
  kind: SummarizeKind
  code?: string
  listUrl: string
  items: ISummarizeResult[]
  /** Essays that could not be summarized (counted honestly, never hidden). */
  failed: number
  via: `openai` | `mock`
}

/** The Paul Graham articles list — the original workflow's demo input. */
export const PG_ARTICLES_URL = `https://www.paulgraham.com/articles.html`

export class Summarizer {
  /** Telegram's message limit is 4096 chars; chunks stay safely under it. */
  static readonly CHUNK_MAX = 4000
  /** The original splitter's chunkSize: 6000 characters. */
  static readonly SPLIT_CHUNK = 6000

  /**
   * Recursive character split (the original Recursive Character Text
   * Splitter): split on paragraph breaks first, then line breaks, then
   * sentence ends, then spaces — never mid-word, and never with a chunk
   * larger than `max` unless a single unbreakable run forces it.
   */
  static splitRecursive(text: string, max: number = Summarizer.SPLIT_CHUNK): string[] {
    const cleaned = text.trim()
    if (cleaned === ``) return []
    if (cleaned.length <= max) return [cleaned]
    const chunks: string[] = []
    let rest = cleaned
    while (rest.length > max) {
      let cut = rest.lastIndexOf(`\n\n`, max)
      if (cut < max / 2) cut = rest.lastIndexOf(`\n`, max)
      if (cut < max / 2) {
        // Sentence boundary: the last ". " (or "! "/"? ") before the limit.
        const m = rest.slice(0, max).match(/[.?!]\s+(?=[A-Z0-9"“])/g)
        if (m) {
          const last = rest.slice(0, max).lastIndexOf(m[m.length - 1]!)
          cut = last + m[m.length - 1]!.length
        }
      }
      if (cut < max / 2) cut = rest.lastIndexOf(` `, max)
      if (cut <= 0) cut = max
      chunks.push(rest.slice(0, cut).trim())
      rest = rest.slice(cut).trim()
    }
    if (rest !== ``) chunks.push(rest)
    return chunks
  }

  /** Split long text into Telegram-sized chunks on paragraph boundaries (never mid-word). */
  static splitText(text: string, max: number = Summarizer.CHUNK_MAX): string[] {
    if (text.length <= max) return [text]
    const chunks: string[] = []
    let rest = text
    while (rest.length > max) {
      let cut = rest.lastIndexOf(`\n\n`, max)
      if (cut < max / 2) cut = rest.lastIndexOf(`\n`, max)
      if (cut < max / 2) cut = rest.lastIndexOf(` `, max)
      if (cut <= 0) cut = max
      chunks.push(rest.slice(0, cut).trim())
      rest = rest.slice(cut).trim()
    }
    if (rest !== ``) chunks.push(rest)
    return chunks
  }

  /**
   * Clean model markdown for plain-text chat: strip bold/italic markers
   * and heading hashes (Telegram shows them literally — the template
   * escapes `{{...}}` variables, so no HTML is produced here).
   */
  static cleanModelText(text: string): string {
    return text
      .replace(/^#{1,4}\s+/gm, ``)
      .replace(/\*\*([^*]+)\*\*/g, `$1`)
      .replace(/(^|[\s(])\*([^*\n]+)\*/g, `$1$2`)
      .replace(/`([^`\n]+)`/g, `$1`)
      .replace(/\n\s*[-*]\s+/g, ` - `)
      .replace(/[ \t]+/g, ` `)
      .replace(/\n{3,}/g, `\n\n`)
      .trim()
  }

  /** One model call: summarize a single chunk of page text. */
  static async summarizeChunk(config: ReturnType<typeof AppConfig.load>, text: string): Promise<string> {
    const messages: IChatMessage[] = [
      {role: `system`, content: CHUNK_SUMMARIZE_SYSTEM},
      {role: `user`, content: text},
    ]
    const {message} = await OpenAIClient.chat(config.openaiApiKey, config.openaiModel, messages, [], config.openaiBaseUrl, {
      reasoningEffort: config.openaiReasoningEffort,
    })
    return Summarizer.cleanModelText(message.content ?? ``)
  }

  /** One model call: combine chunk summaries into the final summary. */
  static async combineSummaries(config: ReturnType<typeof AppConfig.load>, parts: string[]): Promise<string> {
    const joined = parts.map((p, i) => `Section ${i + 1}:\n${p}`).join(`\n\n`)
    const messages: IChatMessage[] = [
      {role: `system`, content: COMBINE_SYSTEM},
      {role: `user`, content: joined},
    ]
    const {message} = await OpenAIClient.chat(config.openaiApiKey, config.openaiModel, messages, [], config.openaiBaseUrl, {
      reasoningEffort: config.openaiReasoningEffort,
    })
    return Summarizer.cleanModelText(message.content ?? ``)
  }

  /** Full pipeline: validate → scrape → split → summarize chunks → combine. */
  static async summarize(rawUrl: string, env: NodeJS.ProcessEnv = process.env): Promise<ISummarizeResult> {
    const validated = Scraper.validateUrl(rawUrl)
    if (!validated.ok) {
      return {kind: `invalid`, code: validated.code, url: rawUrl.trim(), host: ``, title: ``, summary: ``, chunks: 0, via: `mock`}
    }
    const url = validated.url.toString()
    const host = validated.url.hostname
    if (AppConfig.isMock(env)) return Summarizer.mockResult(url, host)
    let page: IFetchedPage
    try {
      page = await Scraper.fetchPageText(rawUrl)
    } catch (err) {
      const code = err instanceof ScrapeError ? err.code : `fetch-error`
      return {kind: `fetch-error`, code, url, host, title: ``, summary: ``, chunks: 0, via: `mock`}
    }
    if (page.text.trim() === ``) {
      return {kind: `fetch-error`, code: `empty-page`, url, host, title: page.title, summary: ``, chunks: 0, via: `mock`}
    }
    const config = AppConfig.load(env)
    const chunks = Summarizer.splitRecursive(page.text)
    try {
      let summary: string
      if (chunks.length === 1) {
        summary = await Summarizer.summarizeChunk(config, chunks[0]!)
      } else {
        const parts: string[] = []
        for (const chunk of chunks) {
          const part = await Summarizer.summarizeChunk(config, chunk)
          if (part !== ``) parts.push(part)
        }
        if (parts.length === 0) {
          return {kind: `ai-error`, code: `ai-error`, url, host, title: page.title, summary: ``, chunks: chunks.length, via: `mock`}
        }
        summary = parts.length === 1 ? parts[0]! : await Summarizer.combineSummaries(config, parts)
      }
      if (summary.trim() === ``) {
        return {kind: `ai-error`, code: `ai-error`, url, host, title: page.title, summary: ``, chunks: chunks.length, via: `mock`}
      }
      return {kind: `ok`, url, host, title: page.title, summary, chunks: chunks.length, via: `openai`}
    } catch {
      return {kind: `ai-error`, code: `ai-error`, url, host, title: page.title, summary: ``, chunks: chunks.length, via: `mock`}
    }
  }

  /**
   * The original workflow's demo: fetch the Paul Graham articles list,
   * take the first 3 essays, summarize each one (title + summary + url).
   * Essays that fail are counted in `failed`, never hidden or faked.
   */
  static async latest(listUrl: string = PG_ARTICLES_URL, env: NodeJS.ProcessEnv = process.env): Promise<ILatestResult> {
    const validated = Scraper.validateUrl(listUrl)
    if (!validated.ok) {
      return {kind: `invalid`, code: validated.code, listUrl: listUrl.trim(), items: [], failed: 0, via: `mock`}
    }
    if (AppConfig.isMock(env)) return Summarizer.mockLatest(listUrl)
    let html: string
    try {
      const fetched = await Scraper.fetchRawHtml(listUrl)
      html = fetched.html
    } catch (err) {
      const code = err instanceof ScrapeError ? err.code : `fetch-error`
      return {kind: `fetch-error`, code, listUrl, items: [], failed: 0, via: `mock`}
    }
    const links = Scraper.extractEssayLinks(html, listUrl).slice(0, 3)
    if (links.length === 0) {
      return {kind: `fetch-error`, code: `no-essays`, listUrl, items: [], failed: 0, via: `mock`}
    }
    const items: ISummarizeResult[] = []
    let failed = 0
    for (const link of links) {
      const result = await Summarizer.summarize(link, env)
      if (result.kind === `ok`) items.push(result)
      else failed += 1
    }
    if (items.length === 0) {
      return {kind: `ai-error`, code: `ai-error`, listUrl, items: [], failed, via: `mock`}
    }
    return {kind: `ok`, listUrl, items, failed, via: `openai`}
  }

  /** Deterministic mock: a short summary for the host, one chunk. */
  static mockResult(url: string, host: string): ISummarizeResult {
    const title = host
    const summary =
      `This is a mock summary of the page at ${host}. The page explains its main topic in several sections: it opens with the core idea, then works through the supporting points with examples, and closes with what the reader should take away. The key facts are presented plainly, without jargon, so a reader who only has a minute still gets the gist.`
    return {kind: `ok`, url, host, title, summary, chunks: 1, via: `mock`}
  }

  /** Deterministic mock for /latest: three Paul Graham essays, mock summaries. */
  static mockLatest(listUrl: string): ILatestResult {
    const essays = [
      {slug: `greatwork.html`, title: `Great Work`},
      {slug: `wealth.html`, title: `How to Make Wealth`},
      {slug: `hp.html`, title: `Hackers and Painters`},
    ]
    const items = essays.map((e) => {
      const url = `https://www.paulgraham.com/${e.slug}`
      return {
        ...Summarizer.mockResult(url, `www.paulgraham.com`),
        title: e.title,
        summary: `This is a mock summary of "${e.title}" by Paul Graham. The essay argues its central idea through a series of observations and examples, then draws out what it means for how to work and think. Read the full essay at the link above for the complete argument.`,
      }
    })
    return {kind: `ok`, listUrl, items, failed: 0, via: `mock`}
  }

  /** Convert a finished summary to the stored history shape. */
  static toSummary(result: ISummarizeResult): ISummary {
    return {
      url: result.url,
      host: result.host,
      title: result.title,
      summary: result.summary,
      chunks: result.chunks,
      createdAt: new Date().toISOString(),
    }
  }
}
