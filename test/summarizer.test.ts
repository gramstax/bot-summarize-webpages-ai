import {afterEach, describe, expect, it} from "bun:test"
import {OpenAIClient} from "../src/lib/openai"
import {Scraper} from "../src/lib/scraper"
import {Summarizer} from "../src/lib/summarizer"

describe(`Summarizer.splitRecursive`, () => {
  it(`returns one chunk for short text`, () => {
    expect(Summarizer.splitRecursive(`hello world`)).toEqual([`hello world`])
    expect(Summarizer.splitRecursive(``)).toEqual([])
  })

  it(`splits long text into chunks of at most 6000 chars`, () => {
    const text = `word `.repeat(3000).trim() // ~15.000 chars
    const chunks = Summarizer.splitRecursive(text)
    expect(chunks.length).toBe(3)
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(6000)
    // Nothing is lost and no word is cut in half: rejoining (single spaces) reproduces the text.
    expect(chunks.join(` `)).toBe(text)
  })

  it(`prefers paragraph boundaries over the hard limit`, () => {
    const first = `a`.repeat(2700)
    const second = `b`.repeat(2700)
    const text = `${first}\n\n${second}\n\n${`c`.repeat(7000)}`
    const chunks = Summarizer.splitRecursive(text, 6000)
    expect(chunks[0]).toBe(`${first}\n\n${second}`)
    expect(chunks.length).toBe(3)
  })

  it(`never cuts a word in half when spaces are available`, () => {
    const text = Array.from({length: 2000}, (_, i) => `word${i}`).join(` `)
    const chunks = Summarizer.splitRecursive(text, 6000)
    for (const c of chunks) {
      expect(c).not.toMatch(/word\d+ $/)
      expect(c).not.toMatch(/^ \w/)
    }
  })

  it(`hard-cuts an unbreakable run longer than the limit`, () => {
    const text = `x`.repeat(13000)
    const chunks = Summarizer.splitRecursive(text)
    expect(chunks.length).toBe(3)
    expect(chunks[0]!.length).toBe(6000)
  })
})

describe(`Summarizer.splitText`, () => {
  it(`splits long summaries into Telegram-sized chunks`, () => {
    const text = `para `.repeat(2000).trim()
    const chunks = Summarizer.splitText(text)
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(4000)
    expect(chunks.join(` `)).toBe(text)
  })
})

describe(`Summarizer.cleanModelText`, () => {
  it(`strips markdown bold, headings, and code ticks`, () => {
    const out = Summarizer.cleanModelText(`## Title\n\nThis is **bold** and \`code\`.`)
    expect(out).toBe(`Title\n\nThis is bold and code.`)
  })
})

describe(`Summarizer.mockResult / mockLatest`, () => {
  it(`mockResult is deterministic and mentions the host`, () => {
    const r = Summarizer.mockResult(`https://example.com/page`, `example.com`)
    expect(r.kind).toBe(`ok`)
    expect(r.via).toBe(`mock`)
    expect(r.chunks).toBe(1)
    expect(r.summary).toContain(`example.com`)
  })

  it(`mockLatest returns exactly 3 Paul Graham essays`, () => {
    const r = Summarizer.mockLatest(`https://www.paulgraham.com/articles.html`)
    expect(r.kind).toBe(`ok`)
    expect(r.items.length).toBe(3)
    expect(r.failed).toBe(0)
    expect(r.items.map((i) => i.title)).toEqual([`Great Work`, `How to Make Wealth`, `Hackers and Painters`])
    for (const item of r.items) expect(item.url).toMatch(/^https:\/\/www\.paulgraham\.com\/[a-z0-9-]+\.html$/)
  })
})

describe(`Summarizer.summarize`, () => {
  const mockEnv = {SUMMARIZE_MOCK_AI: `1`} as NodeJS.ProcessEnv
  const liveEnv = {OPENAI_API_KEY: `key`} as NodeJS.ProcessEnv

  it(`mock mode returns a summary without fetching`, async () => {
    const r = await Summarizer.summarize(`https://example.com/`, mockEnv)
    expect(r.kind).toBe(`ok`)
    expect(r.via).toBe(`mock`)
    expect(r.title).toBe(`example.com`)
  })

  it(`an invalid URL is refused before any fetch`, async () => {
    const r = await Summarizer.summarize(`not a url`, mockEnv)
    expect(r.kind).toBe(`invalid`)
    expect(r.code).toBe(`invalid-url`)
  })

  it(`a localhost URL is refused by the SSRF guard`, async () => {
    const r = await Summarizer.summarize(`http://localhost:3000/admin`, mockEnv)
    expect(r.kind).toBe(`invalid`)
    expect(r.code).toBe(`blocked-host`)
  })

  it(`live path: one chunk means one model call`, async () => {
    const realFetch = Scraper.fetchFn
    const realLookup = Scraper.dnsLookup
    const realChat = OpenAIClient.chat
    let calls = 0
    try {
      Scraper.fetchFn = (async () =>
        new Response(`<html><head><title>Short</title></head><body><p>A short page.</p></body></html>`, {
          status: 200,
          headers: {"Content-Type": `text/html`},
        })) as unknown as typeof fetch
      Scraper.dnsLookup = async () => [{address: `93.184.216.34`}]
      OpenAIClient.chat = (async () => {
        calls += 1
        return {message: {role: `assistant`, content: `A short summary.`}}
      }) as unknown as typeof OpenAIClient.chat
      const r = await Summarizer.summarize(`https://example.com/`, liveEnv)
      expect(r.kind).toBe(`ok`)
      expect(r.summary).toBe(`A short summary.`)
      expect(r.chunks).toBe(1)
      expect(r.via).toBe(`openai`)
      expect(calls).toBe(1)
    } finally {
      Scraper.fetchFn = realFetch
      Scraper.dnsLookup = realLookup
      OpenAIClient.chat = realChat
    }
  })

  it(`live path: many chunks are summarized then combined`, async () => {
    const realFetch = Scraper.fetchFn
    const realLookup = Scraper.dnsLookup
    const realChat = OpenAIClient.chat
    const seen: string[] = []
    try {
      const para = `Lorem ipsum dolor sit amet. `.repeat(18).trim()
      const longText = Array.from({length: 26}, () => para).join(`\n\n`)
      Scraper.fetchFn = (async () =>
        new Response(`<html><head><title>Long</title></head><body><p>${longText}</p></body></html>`, {
          status: 200,
          headers: {"Content-Type": `text/html`},
        })) as unknown as typeof fetch
      Scraper.dnsLookup = async () => [{address: `93.184.216.34`}]
      OpenAIClient.chat = (async (_key: string, _model: string, messages: {content: string | null}[]) => {
        const user = messages.find((m) => m.content !== null && !m.content.startsWith(`You are`))
        const content = user?.content ?? ``
        seen.push(content.slice(0, 20))
        // The combine call's user message starts with "Section 1:".
        if (content.startsWith(`Section 1:`)) return {message: {role: `assistant`, content: `Combined summary of all chunks.`}}
        return {message: {role: `assistant`, content: `Chunk summary.`}}
      }) as unknown as typeof OpenAIClient.chat
      const r = await Summarizer.summarize(`https://example.com/long`, liveEnv)
      expect(r.kind).toBe(`ok`)
      expect(r.chunks).toBeGreaterThan(1)
      expect(r.summary).toBe(`Combined summary of all chunks.`)
      expect(seen.length).toBe(r.chunks + 1) // one call per chunk + 1 combine call
    } finally {
      Scraper.fetchFn = realFetch
      Scraper.dnsLookup = realLookup
      OpenAIClient.chat = realChat
    }
  })

  it(`live path: a fetch failure is an honest fetch-error, never a fake summary`, async () => {
    const realFetch = Scraper.fetchFn
    const realLookup = Scraper.dnsLookup
    try {
      Scraper.fetchFn = (async () => new Response(`nope`, {status: 404, headers: {"Content-Type": `text/html`}})) as unknown as typeof fetch
      Scraper.dnsLookup = async () => [{address: `93.184.216.34`}]
      const r = await Summarizer.summarize(`https://example.com/missing`, liveEnv)
      expect(r.kind).toBe(`fetch-error`)
      expect(r.summary).toBe(``)
    } finally {
      Scraper.fetchFn = realFetch
      Scraper.dnsLookup = realLookup
    }
  })
})

describe(`Summarizer.latest`, () => {
  it(`mock mode returns the 3 essays without fetching`, async () => {
    const r = await Summarizer.latest(undefined, {SUMMARIZE_MOCK_AI: `1`} as NodeJS.ProcessEnv)
    expect(r.kind).toBe(`ok`)
    expect(r.items.length).toBe(3)
    expect(r.via).toBe(`mock`)
  })

  it(`live path: extracts the first 3 essay links and summarizes each`, async () => {
    const realFetch = Scraper.fetchFn
    const realLookup = Scraper.dnsLookup
    const realChat = OpenAIClient.chat
    try {
      Scraper.fetchFn = (async (input: string | URL | Request) => {
        const u = String(input)
        if (u.includes(`articles.html`)) {
          return new Response(
            `<html><body><table><tr><td><table><tr><td><a href="greatwork.html">Great Work</a></td></tr><tr><td><a href="wealth.html">Wealth</a></td></tr><tr><td><a href="hp.html">HP</a></td></tr><tr><td><a href="extra.html">Extra</a></td></tr></table></td></tr></table></body></html>`,
            {status: 200, headers: {"Content-Type": `text/html`}},
          )
        }
        const slug = u.split(`/`).pop() ?? `essay`
        return new Response(`<html><head><title>${slug}</title></head><body><p>Essay body text.</p></body></html>`, {
          status: 200,
          headers: {"Content-Type": `text/html`},
        })
      }) as unknown as typeof fetch
      Scraper.dnsLookup = async () => [{address: `93.184.216.34`}]
      OpenAIClient.chat = (async () => ({message: {role: `assistant`, content: `Essay summary.`}})) as unknown as typeof OpenAIClient.chat
      const r = await Summarizer.latest(undefined, {OPENAI_API_KEY: `key`} as NodeJS.ProcessEnv)
      expect(r.kind).toBe(`ok`)
      expect(r.items.length).toBe(3) // limited to the first 3, "extra.html" is skipped
      expect(r.failed).toBe(0)
      expect(r.items[0]!.url).toBe(`https://www.paulgraham.com/greatwork.html`)
      expect(r.items.every((i) => i.summary === `Essay summary.`)).toBe(true)
    } finally {
      Scraper.fetchFn = realFetch
      Scraper.dnsLookup = realLookup
      OpenAIClient.chat = realChat
    }
  })

  it(`live path: a list page with no essay links is an honest error`, async () => {
    const realFetch = Scraper.fetchFn
    const realLookup = Scraper.dnsLookup
    try {
      Scraper.fetchFn = (async () =>
        new Response(`<html><body><p>No links here.</p></body></html>`, {status: 200, headers: {"Content-Type": `text/html`}})) as unknown as typeof fetch
      Scraper.dnsLookup = async () => [{address: `93.184.216.34`}]
      const r = await Summarizer.latest(undefined, {OPENAI_API_KEY: `key`} as NodeJS.ProcessEnv)
      expect(r.kind).toBe(`fetch-error`)
      expect(r.code).toBe(`no-essays`)
    } finally {
      Scraper.fetchFn = realFetch
      Scraper.dnsLookup = realLookup
    }
  })
})

describe(`Scraper.extractEssayLinks`, () => {
  it(`reads nested-table essay links in order, de-duplicated`, () => {
    const html = `<table><tr><td><table>
      <tr><td><a href="greatwork.html">Great Work</a></td></tr>
      <tr><td><a href="greatwork.html">Great Work</a></td></tr>
      <tr><td><a href="/wealth.html">Wealth</a></td></tr>
      <tr><td><a href="https://www.paulgraham.com/hp.html">HP</a></td></tr>
      <tr><td><a href="articles.html">Articles</a></td></tr>
      <tr><td><a href="https://news.ycombinator.com/">HN</a></td></tr>
      <tr><td><a href="rss.xml">RSS</a></td></tr>
    </table></td></tr></table>`
    const links = Scraper.extractEssayLinks(html, `https://www.paulgraham.com/articles.html`)
    expect(links).toEqual([
      `https://www.paulgraham.com/greatwork.html`,
      `https://www.paulgraham.com/wealth.html`,
      `https://www.paulgraham.com/hp.html`,
    ])
  })
})
