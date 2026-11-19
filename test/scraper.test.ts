import {afterEach, describe, expect, it} from "bun:test"
import {Scraper, ScrapeError} from "../src/lib/scraper"

describe(`Scraper.validateUrl`, () => {
  it(`accepts a public https URL`, () => {
    const r = Scraper.validateUrl(`https://yuzuu.co/pricing`)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.url.hostname).toBe(`yuzuu.co`)
  })

  it(`accepts http too`, () => {
    expect(Scraper.validateUrl(`http://example.com`).ok).toBe(true)
  })

  it(`rejects empty and non-URL text`, () => {
    expect(Scraper.validateUrl(``)).toEqual({ok: false, code: `invalid-url`})
    expect(Scraper.validateUrl(`hello world`)).toEqual({ok: false, code: `invalid-url`})
    expect(Scraper.validateUrl(`ftp://example.com/file`)).toEqual({ok: false, code: `invalid-url`})
    expect(Scraper.validateUrl(`javascript:alert(1)`)).toEqual({ok: false, code: `invalid-url`})
  })

  it(`rejects private and localhost hosts`, () => {
    for (const u of [`http://localhost:3000/x`, `http://127.0.0.1/`, `http://10.0.0.5/`, `http://192.168.1.1/`, `http://172.17.0.1/`, `http://[::1]/`, `https://foo.local/`]) {
      expect(Scraper.validateUrl(u)).toEqual({ok: false, code: `blocked-host`})
    }
  })
})

describe(`Scraper.isPrivateIp`, () => {
  it(`flags private and loopback addresses`, () => {
    expect(Scraper.isPrivateIp(`10.1.2.3`)).toBe(true)
    expect(Scraper.isPrivateIp(`127.0.0.1`)).toBe(true)
    expect(Scraper.isPrivateIp(`192.168.0.1`)).toBe(true)
    expect(Scraper.isPrivateIp(`172.31.255.255`)).toBe(true)
    expect(Scraper.isPrivateIp(`::1`)).toBe(true)
    expect(Scraper.isPrivateIp(`8.8.8.8`)).toBe(false)
    expect(Scraper.isPrivateIp(`93.184.216.34`)).toBe(false)
  })
})

describe(`Scraper.htmlToText`, () => {
  it(`strips scripts/styles/tags and decodes entities`, () => {
    const {title, text} = Scraper.htmlToText(`<html><head><title>Acme &amp; Co</title><style>.x{color:red}</style></head><body><script>evil()</script><h1>Ship faster</h1><p>We help teams &lt;launch&gt; in days.</p></body></html>`)
    expect(title).toBe(`Acme & Co`)
    expect(text).toContain(`Ship faster`)
    expect(text).toContain(`We help teams <launch> in days.`)
    expect(text).not.toContain(`evil()`)
    expect(text).not.toContain(`color:red`)
  })

  it(`returns an empty title when there is none`, () => {
    const {title, text} = Scraper.htmlToText(`<p>hello</p>`)
    expect(title).toBe(``)
    expect(text).toBe(`hello`)
  })
})

describe(`Scraper.fetchPageText`, () => {
  const realFetch = Scraper.fetchFn
  const realLookup = Scraper.dnsLookup
  afterEach(() => {
    Scraper.fetchFn = realFetch
    Scraper.dnsLookup = realLookup
  })

  function stubFetch(html: string, contentType = `text/html; charset=utf-8`) {
    Scraper.fetchFn = (async () => {
      return new Response(html, {status: 200, headers: {"Content-Type": contentType}})
    }) as unknown as typeof fetch
    Scraper.dnsLookup = async () => [{address: `93.184.216.34`}]
  }

  it(`fetches and cleans a page`, async () => {
    stubFetch(`<html><head><title>Example</title></head><body><h1>Hi</h1><p>Welcome</p></body></html>`)
    const page = await Scraper.fetchPageText(`https://example.com/`)
    expect(page.host).toBe(`example.com`)
    expect(page.title).toBe(`Example`)
    expect(page.text).toContain(`Hi`)
    expect(page.text).toContain(`Welcome`)
  })

  it(`refuses a hostname that resolves to a private address`, async () => {
    Scraper.fetchFn = (async () => new Response(``, {status: 200})) as unknown as typeof fetch
    Scraper.dnsLookup = async () => [{address: `10.0.0.9`}]
    await expect(Scraper.fetchPageText(`https://evil.example/`)).rejects.toBeInstanceOf(ScrapeError)
    try {
      await Scraper.fetchPageText(`https://evil.example/`)
    } catch (err) {
      expect((err as ScrapeError).code).toBe(`blocked-host`)
    }
  })

  it(`throws fetch-error on a non-200 status`, async () => {
    Scraper.fetchFn = (async () => new Response(`nope`, {status: 404, headers: {"Content-Type": `text/html`}})) as unknown as typeof fetch
    Scraper.dnsLookup = async () => [{address: `93.184.216.34`}]
    try {
      await Scraper.fetchPageText(`https://example.com/missing`)
      expect.unreachable()
    } catch (err) {
      expect((err as ScrapeError).code).toBe(`fetch-error`)
    }
  })

  it(`throws not-html for a non-page content type`, async () => {
    stubFetch(`%PDF-1.4`, `application/pdf`)
    try {
      await Scraper.fetchPageText(`https://example.com/file.pdf`)
      expect.unreachable()
    } catch (err) {
      expect((err as ScrapeError).code).toBe(`not-html`)
    }
  })

  it(`throws invalid-url without fetching`, async () => {
    let called = false
    Scraper.fetchFn = (async () => {
      called = true
      return new Response(``, {status: 200})
    }) as unknown as typeof fetch
    try {
      await Scraper.fetchPageText(`not a url`)
      expect.unreachable()
    } catch (err) {
      expect((err as ScrapeError).code).toBe(`invalid-url`)
    }
    expect(called).toBe(false)
  })
})
