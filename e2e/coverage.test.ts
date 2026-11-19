import {beforeEach, describe, expect, it} from "bun:test"
import {bot, coverageUser, deniedUser, e2e, noUsernameUser, resetEnv} from "./setup"
import type {ISummary} from "../src/types/summarize"

beforeEach(async () => {
  e2e.clearCalls()
  await resetEnv()
  process.env.SUMMARIZE_ALLOWED_IDS = ``
})

describe(`coverage: AllowList guard (hookBeforeRoute)`, () => {
  it(`denies a user not on SUMMARIZE_ALLOWED_IDS and explains why`, async () => {
    process.env.SUMMARIZE_ALLOWED_IDS = `4952`
    try {
      const responses = await e2e.sendText(`/start`, deniedUser)
      expect(responses.length).toBeGreaterThan(0)
      expect(responses[0]!.method).toBe(`sendMessage`)
      expect(e2e.extractText(responses[0]!)).toContain(`hanya melayani pengguna yang diizinkan`)
      expect(e2e.extractText(responses[0]!)).not.toContain(`aku Page Summary`)
    } finally {
      process.env.SUMMARIZE_ALLOWED_IDS = ``
    }
  })

  it(`allows a user on SUMMARIZE_ALLOWED_IDS`, async () => {
    process.env.SUMMARIZE_ALLOWED_IDS = `4952`
    try {
      const responses = await e2e.sendText(`/start`, coverageUser)
      const reply = e2e.lastCall(`sendMessage`)!
      expect(reply).toBeDefined()
      expect(e2e.extractText(reply)).toContain(`aku Page Summary`)
    } finally {
      process.env.SUMMARIZE_ALLOWED_IDS = ``
    }
  })

  it(`allows a user without a Telegram username (no username guard)`, async () => {
    const responses = await e2e.sendText(`/start`, noUsernameUser)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(reply).toBeDefined()
    expect(e2e.extractText(reply)).toContain(`aku Page Summary`)
  })
})

describe(`coverage: summaries history cap`, () => {
  it(`history keeps only the newest 5 summaries`, async () => {
    for (let i = 1; i <= 6; i++) {
      const a: ISummary = {url: `https://example.com/${i}`, host: `example.com`, title: ``, summary: `s`, chunks: 1, createdAt: new Date().toISOString()}
      await bot.db.summaries.add(4952, a)
    }
    const list = bot.db.summaries.list(4952)
    expect(list.length).toBe(5)
    expect(list[0]!.url).toBe(`https://example.com/6`)
    expect(list[4]!.url).toBe(`https://example.com/2`)
  })
})
