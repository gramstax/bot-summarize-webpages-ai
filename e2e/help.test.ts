import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, helpEnUser, helpUser, resetEnv, startUser} from "./setup"

const intent = `help`

beforeEach(async () => {
  e2e.clearCalls()
  await resetEnv()
})

describe(`E2E: HelpPage`, () => {
  it(`show help text when navigating from /start -> Help`, async () => {
    await e2e.sendText(`/start`, startUser)
    e2e.clearCalls()
    const responses = await e2e.sendCallbackQuery(intent, helpUser)
    expect(responses.length).toBeGreaterThan(0)
    const edit = responses[0]!
    expect(edit.method).toBe(`editMessageText`)
    expect(e2e.extractText(edit)).toBe(e2e.gmsg(intent, `default`, {}, `id`))
    expect(e2e.extractButtonLabels(edit)).toEqual(e2e.gkb(intent, `default`, `inline`, {}, `id`))
  })

  it(`answers the /help command in English for an en user`, async () => {
    const responses = await e2e.sendText(`/help`, helpEnUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(reply).toBeDefined()
    expect(e2e.extractText(reply)).toBe(e2e.gmsg(intent, `default`, {}, `en`))
    expect(e2e.extractButtonLabels(reply)).toEqual(e2e.gkb(intent, `default`, `inline`, {}, `en`))
  })

  it(`answers the /help command`, async () => {
    const responses = await e2e.sendText(`/help`, helpUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(reply).toBeDefined()
    expect(e2e.extractText(reply)).toBe(e2e.gmsg(intent, `default`, {}, `id`))
    expect(e2e.extractButtonLabels(reply)).toEqual(e2e.gkb(intent, `default`, `inline`, {}, `id`))
  })
})
