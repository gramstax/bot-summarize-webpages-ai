import {lookup as dnsLookup} from "node:dns/promises"

/**
 * Fetch a webpage and turn it into clean text for the AI.
 *
 * SSRF guard: only public http/https hosts are fetched. IP literals in
 * private/loopback ranges are rejected, and the hostname is resolved
 * first — a public name that resolves to a private address is rejected
 * too. The guard never fetches first and asks later.
 *
 * The original workflow extracted only the page body and skipped
 * images and navigation — htmlToText does the same (nav, footer, img,
 * script, style, noscript, svg are dropped before the text is read).
 */
export type ScrapeErrorCode = `invalid-url` | `blocked-host` | `fetch-error` | `not-html`

export class ScrapeError extends Error {
  readonly code: ScrapeErrorCode
  constructor(code: ScrapeErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

export interface IFetchedPage {
  url: string
  host: string
  title: string
  text: string
}

type DnsLookupFn = (host: string) => Promise<{address: string}[]>

export class Scraper {
  static fetchFn: typeof fetch = fetch
  static dnsLookup: DnsLookupFn = async (host) => dnsLookup(host, {all: true, verbatim: true})

  /**
   * Hard fetch budget: 15 s, 200 KB of HTML, 30.000 chars of clean text.
   * Long pages are summarized chunk by chunk (see Summarizer), so the
   * text budget is bigger than a single model call — it feeds the
   * recursive splitter, not one prompt.
   */
  static readonly TIMEOUT_MS = 15_000
  static readonly MAX_BYTES = 200_000
  static readonly MAX_TEXT_CHARS = 30_000

  /** Validate the raw input; returns the normalized URL or an error code. */
  static validateUrl(raw: string): {ok: true; url: URL} | {ok: false; code: ScrapeErrorCode} {
    const trimmed = raw.trim()
    if (trimmed === ``) return {ok: false, code: `invalid-url`}
    let url: URL
    try {
      url = new URL(trimmed)
    } catch {
      return {ok: false, code: `invalid-url`}
    }
    if (url.protocol !== `http:` && url.protocol !== `https:`) return {ok: false, code: `invalid-url`}
    if (Scraper.isBlockedHost(url.hostname)) return {ok: false, code: `blocked-host`}
    return {ok: true, url}
  }

  /** Hostnames / IP literals that are never fetched (SSRF guard). */
  static isBlockedHost(hostname: string): boolean {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, ``)
    if (host === `localhost` || host.endsWith(`.localhost`) || host.endsWith(`.local`) || host.endsWith(`.internal`)) return true
    if (host === `::1` || host === `0.0.0.0`) return true
    const v4 = host.split(`.`)
    if (v4.length === 4 && v4.every((p) => /^\d+$/.test(p))) {
      const [a, b] = v4.map(Number)
      if (a === 127 || a === 10) return true
      if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true
      if (a === 192 && b === 168) return true
      if (a === 169 && b === 254) return true
    }
    // IPv6 loopback / unique-local / link-local literals.
    if (host.startsWith(`fe8`) || host.startsWith(`fe9`) || host.startsWith(`fea`) || host.startsWith(`feb`) || host.startsWith(`fc`) || host.startsWith(`fd`)) return true
    return false
  }

  /** True when an IP address is private, loopback, or link-local. */
  static isPrivateIp(address: string): boolean {
    const clean = address.replace(/^\[|\]$/g, ``)
    if (clean.includes(`:`)) {
      const lower = clean.toLowerCase()
      return lower === `::1` || lower.startsWith(`fe8`) || lower.startsWith(`fe9`) || lower.startsWith(`fea`) || lower.startsWith(`feb`) || lower.startsWith(`fc`) || lower.startsWith(`fd`)
    }
    return Scraper.isBlockedHost(clean)
  }

  /** Fetch a page and return the raw HTML (for link extraction). Throws ScrapeError. */
  static async fetchRawHtml(raw: string): Promise<{url: string; host: string; title: string; html: string}> {
    const validated = Scraper.validateUrl(raw)
    if (!validated.ok) throw new ScrapeError(validated.code, `Invalid URL`)
    const {url} = validated
    // Resolve first: a public name pointing at a private address is blocked.
    try {
      const addresses = await Scraper.dnsLookup(url.hostname)
      if (addresses.some((a) => Scraper.isPrivateIp(a.address))) {
        throw new ScrapeError(`blocked-host`, `Host resolves to a private address`)
      }
    } catch (err) {
      if (err instanceof ScrapeError) throw err
      throw new ScrapeError(`fetch-error`, `Could not resolve ${url.hostname}`)
    }
    let res: Response
    try {
      res = await Scraper.fetchFn(url.toString(), {
        signal: AbortSignal.timeout(Scraper.TIMEOUT_MS),
        headers: {Accept: `text/html,application/xhtml+xml`, "User-Agent": `bot-summarize-webpages-ai/0.1`},
      })
    } catch {
      throw new ScrapeError(`fetch-error`, `Could not reach ${url.hostname}`)
    }
    if (!res.ok) throw new ScrapeError(`fetch-error`, `The page answered ${res.status}`)
    const contentType = res.headers.get(`content-type`) ?? ``
    if (contentType !== `` && !/^text\//.test(contentType) && !contentType.includes(`application/xhtml+xml`)) {
      throw new ScrapeError(`not-html`, `The URL does not return a web page`)
    }
    const html = await Scraper.readLimited(res)
    const {title} = Scraper.htmlToText(html)
    return {url: url.toString(), host: url.hostname, title, html}
  }

  /** Fetch + clean a page. Throws ScrapeError (never returns fake content). */
  static async fetchPageText(raw: string): Promise<IFetchedPage> {
    const fetched = await Scraper.fetchRawHtml(raw)
    const {title, text} = Scraper.htmlToText(fetched.html)
    return {url: fetched.url, host: fetched.host, title, text}
  }

  /** Read at most MAX_BYTES from the response body. */
  static async readLimited(res: Response): Promise<string> {
    if (!res.body) return ``
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    try {
      for (;;) {
        const {done, value} = await reader.read()
        if (done) break
        if (value === undefined) break
        total += value.byteLength
        if (total > Scraper.MAX_BYTES) {
          chunks.push(value.subarray(0, Math.max(0, Scraper.MAX_BYTES - (total - value.byteLength))))
          break
        }
        chunks.push(value)
      }
    } finally {
      try {
        await reader.cancel()
      } catch {
        // Already closed — nothing to cancel.
      }
    }
    const merged = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0))
    let offset = 0
    for (const c of chunks) {
      merged.set(c, offset)
      offset += c.byteLength
    }
    return new TextDecoder(`utf-8`).decode(merged)
  }

  /**
   * Extract the essay links from a Paul Graham articles list page.
   *
   * The original workflow did this with an HTML extractor
   * (cssSelector `table table a`, href, returnArray): the list page is
   * nested tables of links to essay pages. The same result is read here
   * with a plain regex — every relative `.html` link in document order,
   * de-duplicated, skipping the list page itself and non-essay files.
   * Absolute URLs to the same host are accepted too; anything else is
   * ignored.
   */
  static extractEssayLinks(html: string, baseUrl: string): string[] {
    const base = new URL(baseUrl)
    const seen = new Set<string>()
    const out: string[] = []
    const re = /<a\s[^>]*href=["']([^"']+)["']/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      const raw = (m[1] ?? ``).trim()
      if (raw === ``) continue
      let resolved: URL
      try {
        resolved = new URL(raw, base)
      } catch {
        continue
      }
      if (resolved.hostname !== base.hostname) continue
      if (resolved.protocol !== `http:` && resolved.protocol !== `https:`) continue
      const path = resolved.pathname.replace(/^\/+/, ``)
      // Essay pages are single-segment .html files (e.g. `greatwork.html`).
      if (!/^[a-z0-9][a-z0-9-]*\.html$/i.test(path)) continue
      if (path.toLowerCase() === `articles.html` || path.toLowerCase() === `index.html`) continue
      const url = `${resolved.protocol}//${resolved.host}${resolved.pathname}`
      if (seen.has(url)) continue
      seen.add(url)
      out.push(url)
    }
    return out
  }

  /** Strip markup to readable text: title + body, entities decoded. */
  static htmlToText(html: string): {title: string; text: string} {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const title = titleMatch?.[1] ? Scraper.cleanInline(titleMatch[1]) : ``
    const noScripts = html
      .replace(/<script[\s\S]*?<\/script>/gi, ` `)
      .replace(/<style[\s\S]*?<\/style>/gi, ` `)
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ` `)
      .replace(/<svg[\s\S]*?<\/svg>/gi, ` `)
      // The original workflow skipped img and nav when extracting text —
      // navigation and footer chrome is not page content.
      .replace(/<nav[\s\S]*?<\/nav>/gi, ` `)
      .replace(/<footer[\s\S]*?<\/footer>/gi, ` `)
      .replace(/<img[^>]*>/gi, ` `)
    const withBreaks = noScripts
      .replace(/<(p|div|section|article|header|footer|nav|li|h[1-6]|tr|br)[\s>]/gi, `\n$&`)
      .replace(/<[^>]+>/g, ` `)
    const text = Scraper.cleanInline(withBreaks).slice(0, Scraper.MAX_TEXT_CHARS)
    return {title, text}
  }

  /** Decode common entities and collapse whitespace to single spaces/newlines. */
  static cleanInline(raw: string): string {
    const decoded = raw
      .replace(/&nbsp;/gi, ` `)
      .replace(/&amp;/gi, `&`)
      .replace(/&lt;/gi, `<`)
      .replace(/&gt;/gi, `>`)
      .replace(/&quot;/gi, `"`)
      .replace(/&#39;|&apos;/gi, `'`)
      .replace(/&#(\d+);/g, (_m, code: string) => {
        const n = Number(code)
        return Number.isFinite(n) ? String.fromCodePoint(n) : ``
      })
      .replace(/&#x([0-9a-fA-F]+);/g, (_m, code: string) => {
        const n = Number.parseInt(code, 16)
        return Number.isFinite(n) ? String.fromCodePoint(n) : ``
      })
    return decoded
      .split(`\n`)
      .map((line) => line.replace(/[ \t\r]+/g, ` `).trim())
      .filter((line) => line !== ``)
      .join(`\n`)
  }
}
