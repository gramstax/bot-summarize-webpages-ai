import {beforeEach, describe, expect, it} from "bun:test"
import {bot, e2e, latestEnUser, latestUser, resetEnv, summarizeUser} from "./setup"

function sendMessages() {
  return e2e.calls.filter((c) => c.method === `sendMessage`)
}

beforeEach(async () => {
  e2e.clearCalls()
  await resetEnv()
})

describe(`E2E: LatestPage`, () => {
  it(`/latest summarizes the latest 3 Paul Graham essays (Indonesian)`, async () => {
    const responses = await e2e.sendText(`/latest`, latestUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(e2e.calls.some((c) => c.method === `sendChatAction`)).toBe(true)
    const sends = sendMessages()
    expect(sends.length).toBe(3)
    expect(e2e.extractText(sends[0]!)).toContain(`📰 Great Work`)
    expect(e2e.extractText(sends[1]!)).toContain(`📰 How to Make Wealth`)
    expect(e2e.extractText(sends[2]!)).toContain(`📰 Hackers and Painters`)
    for (const send of sends) {
      expect(e2e.extractText(send)).toContain(`https://www.paulgraham.com/`)
    }
    // All three are saved to the user's history, newest first.
    const history = bot.db.summaries.list(4403)
    expect(history.length).toBe(3)
    expect(history[0]!.url).toBe(`https://www.paulgraham.com/hp.html`)
  })

  it(`/latest renders the English headers for an en user`, async () => {
    await e2e.sendText(`/latest`, latestEnUser)
    const sends = sendMessages()
    expect(sends.length).toBe(3)
    expect(e2e.extractText(sends[0]!)).toContain(`📰 Great Work`)
  })

  it(`the Latest button on /start runs the list`, async () => {
    await e2e.sendText(`/start`, summarizeUser)
    e2e.clearCalls()
    const responses = await e2e.sendCallbackQuery(`latest`, latestUser)
    expect(responses.length).toBeGreaterThan(0)
    // In callback context the first renders edit the originating message
    // instead of sending new ones — count both methods.
    const rendered = e2e.calls.filter((c) => c.method === `sendMessage` || c.method === `editMessageText`)
    expect(rendered.length).toBe(3)
    expect(e2e.extractText(rendered[0]!)).toContain(`Great Work`)
    expect(e2e.extractText(rendered[1]!)).toContain(`How to Make Wealth`)
    expect(e2e.extractText(rendered[2]!)).toContain(`Hackers and Painters`)
  })
})
