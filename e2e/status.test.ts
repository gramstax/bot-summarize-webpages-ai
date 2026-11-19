import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, resetEnv, startEnUser, statusUser} from "./setup"

const intent = `status`

beforeEach(async () => {
  e2e.clearCalls()
  await resetEnv()
})

describe(`E2E: StatusPage`, () => {
  it(`show 'Route not found' for unrecognized callback query`, async () => {
    await e2e.sendText(`/start`, statusUser)
    e2e.clearCalls()
    const responses = await e2e.sendCallbackQuery(`nonexistent-callback-data`, statusUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = responses[0]!
    expect(reply.method).toBe(`editMessageText`)
    expect(e2e.extractText(reply)).toBe(e2e.gmsg(intent, `nf`, {}, `id`))
  })

  it(`show 'Route not found' for an unknown command`, async () => {
    const responses = await e2e.sendText(`/does-not-exist`, statusUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.method).toBe(`sendMessage`)
    expect(e2e.extractText(responses[0]!)).toBe(e2e.gmsg(intent, `nf`, {}, `id`))
  })

  it(`show 'Route not found' for an unknown command (English default)`, async () => {
    const responses = await e2e.sendText(`/does-not-exist`, startEnUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.method).toBe(`sendMessage`)
    expect(e2e.extractText(responses[0]!)).toBe(e2e.gmsg(intent, `nf`, {}, `en`))
  })

  it(`unknown free text goes to Summarize, NOT to Route not found`, async () => {
    const responses = await e2e.sendText(`halo`, statusUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(reply).toBeDefined()
    expect(e2e.extractText(reply)).toContain(`Ringkas halaman web`)
    expect(e2e.extractText(reply)).not.toBe(e2e.gmsg(intent, `nf`, {}, `id`))
  })
})
