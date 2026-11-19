import {beforeEach, describe, expect, it} from "bun:test"
import {bot, e2e, languageDefaultUser, languageUser, resetEnv} from "./setup"

const intent = `language`

beforeEach(async () => {
  e2e.clearCalls()
  await resetEnv()
  // Each test starts from English: the stored preference is per-user and
  // persists across tests in one run, so reset it explicitly.
  await bot.db.user.setBotLang(languageUser.user.id, `en`, {
    username: languageUser.user.username,
    firstName: `Lang`,
    languageCode: `en`,
  })
})

describe(`E2E: LanguagePage`, () => {
  it(`show renders the language picker (English default, id variant)`, async () => {
    const responses = await e2e.sendText(`/language`, languageUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(reply).toBeDefined()
    expect(e2e.extractText(reply)).toBe(e2e.gmsg(intent, `default`, {}, `en`))
    expect(e2e.extractButtonLabels(reply)).toEqual([`🇬🇧 English`, `🇮🇩 Indonesia`, `⬅️ Back`])
  })

  it(`show renders the Indonesian variant for an id user (no stored choice)`, async () => {
    // A fresh Telegram user with language_code 'id' and no stored botLang:
    // the hook leaves language_code alone, so the lang="id" variant renders.
    const freshIdUser = {user: {id: 4904, username: `langid`, language_code: `id`}}
    const responses = await e2e.sendText(`/language`, freshIdUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(reply).toBeDefined()
    expect(e2e.extractText(reply)).toBe(e2e.gmsg(intent, `default`, {}, `id`))
    // The picker keyboard comes from the single KeyboardGBlock.languagePicker()
    // definition — the ID variant shows the Indonesian Back label.
    expect(e2e.extractButtonLabels(reply)).toEqual([`🇬🇧 English`, `🇮🇩 Indonesia`, `⬅️ Kembali`])
    expect(e2e.extractButtonLabels(reply)).toEqual(e2e.gkb(intent, `default`, `inline`, {}, `id`))
  })

  it(`shows the same picker from the Language button (callback)`, async () => {
    const responses = await e2e.sendCallbackQuery(`language`, languageUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`editMessageText`)!
    expect(reply).toBeDefined()
    expect(e2e.extractText(reply)).toBe(e2e.gmsg(intent, `default`, {}, `en`))
  })

  it(`callback lang-id stores Indonesian and switches /start to Indonesian`, async () => {
    await e2e.sendText(`/language`, languageUser)
    e2e.clearCalls()
    const responses = await e2e.sendCallbackQuery(`language:lang-id:0`, languageUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`editMessageText`)!
    expect(reply).toBeDefined()
    expect(e2e.extractText(reply)).toBe(e2e.gmsg(intent, `done`, {lang: `Indonesia`}, `id`))
    e2e.clearCalls()
    const start = await e2e.sendText(`/start`, languageUser)
    expect(start.length).toBeGreaterThan(0)
    expect(e2e.extractText(e2e.lastCall(`sendMessage`)!)).toContain(`aku Page Summary`)
  })

  it(`callback lang-en switches back to English`, async () => {
    await e2e.sendText(`/language`, languageUser)
    await e2e.sendCallbackQuery(`language:lang-id:0`, languageUser)
    e2e.clearCalls()
    const responses = await e2e.sendCallbackQuery(`language:lang-en:0`, languageUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(e2e.extractText(e2e.lastCall(`editMessageText`)!)).toBe(e2e.gmsg(intent, `done`, {lang: `English`}, `en`))
    e2e.clearCalls()
    const start = await e2e.sendText(`/start`, languageUser)
    expect(e2e.extractText(e2e.lastCall(`sendMessage`)!)).toContain(`I'm Page Summary`)
  })

  it(`Indonesian stays after a switch — the summary renders in Indonesian`, async () => {
    await e2e.sendText(`/language`, languageUser)
    await e2e.sendCallbackQuery(`language:lang-id:0`, languageUser)
    e2e.clearCalls()
    const responses = await e2e.sendText(`/summarize https://example.com/`, languageUser)
    expect(responses.length).toBeGreaterThan(0)
    const sends = e2e.calls.filter((c) => c.method === `sendMessage`)
    expect(e2e.extractText(sends[0]!)).toContain(`📝 Ringkasan`)
  })

  it(`English default — the summary renders in English (fresh user, no stored choice)`, async () => {
    const responses = await e2e.sendText(`/summarize https://example.com/`, languageDefaultUser)
    expect(responses.length).toBeGreaterThan(0)
    const sends = e2e.calls.filter((c) => c.method === `sendMessage`)
    expect(e2e.extractText(sends[0]!)).toContain(`📝 Summary`)
  })
})
