import {beforeEach, describe, expect, it} from "bun:test"
import {bot, e2e, resetEnv, summarizeEnUser, summarizeUser} from "./setup"

const intent = `summarize`

function sendMessages() {
  return e2e.calls.filter((c) => c.method === `sendMessage`)
}

beforeEach(async () => {
  e2e.clearCalls()
  await resetEnv()
})

describe(`E2E: SummarizePage`, () => {
  it(`/summarize <url> returns a title + summary (Indonesian)`, async () => {
    const responses = await e2e.sendText(`/summarize https://example.com/`, summarizeUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(e2e.calls.some((c) => c.method === `sendChatAction`)).toBe(true)
    const sends = sendMessages()
    expect(sends.length).toBe(1)
    expect(e2e.extractText(sends[0]!)).toContain(`📝 Ringkasan — example.com`)
    expect(e2e.extractText(sends[0]!)).toContain(`mock summary`)
    expect(e2e.extractText(sends[0]!)).toContain(`https://example.com/`)
    // The summary is saved to the user's history.
    expect(bot.db.summaries.list(4401).length).toBe(1)
    expect(bot.db.summaries.list(4401)[0]!.url).toBe(`https://example.com/`)
  })

  it(`/summarize <url> renders the English header for an en user`, async () => {
    await e2e.sendText(`/summarize https://example.com/`, summarizeEnUser)
    const sends = sendMessages()
    expect(sends.length).toBe(1)
    expect(e2e.extractText(sends[0]!)).toContain(`📝 Summary — example.com`)
  })

  it(`a bare URL in free text is summarized`, async () => {
    await e2e.sendText(`https://example.com/`, summarizeUser)
    const sends = sendMessages()
    expect(sends.length).toBe(1)
    expect(e2e.extractText(sends[0]!)).toContain(`example.com`)
  })

  it(`/summarize without an argument shows the prompt`, async () => {
    const responses = await e2e.sendText(`/summarize`, summarizeUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(e2e.extractText(reply)).toBe(e2e.gmsg(intent, `default`, {state: `prompt`, url: ``, code: ``}, `id`))
  })

  it(`free text that is not a URL shows the prompt, not an error`, async () => {
    const responses = await e2e.sendText(`hello there`, summarizeUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(e2e.extractText(reply)).toContain(`Ringkas halaman web`)
  })

  it(`an invalid URL is refused honestly, with no fake summary`, async () => {
    const responses = await e2e.sendText(`/summarize not a url`, summarizeUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(e2e.extractText(reply)).toBe(e2e.gmsg(intent, `default`, {state: `invalid`, url: `not a url`, code: `invalid-url`}, `id`))
    expect(bot.db.summaries.list(4401).length).toBe(0)
  })

  it(`a localhost URL is refused by the SSRF guard`, async () => {
    const responses = await e2e.sendText(`/summarize http://localhost:3000/admin`, summarizeUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(e2e.extractText(reply)).toBe(e2e.gmsg(intent, `default`, {state: `invalid`, url: `http://localhost:3000/admin`, code: `blocked-host`}, `id`))
    expect(bot.db.summaries.list(4401).length).toBe(0)
  })

  it(`the Summarize button on /start opens the prompt`, async () => {
    await e2e.sendText(`/start`, summarizeUser)
    e2e.clearCalls()
    const responses = await e2e.sendCallbackQuery(`summarize`, summarizeUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]!
    expect(reply.method).toBe(`editMessageText`)
    expect(e2e.extractText(reply)).toContain(`Ringkas halaman web`)
  })
})
