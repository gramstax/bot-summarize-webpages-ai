import {describe, expect, it} from "bun:test"
import {langOf} from "../src/lib/lang"

describe(`langOf`, () => {
  it(`returns id only for Indonesian codes`, () => {
    expect(langOf({telegramLang: `id`})).toBe(`id`)
    expect(langOf({telegramLang: `id-ID`})).toBe(`id`)
    expect(langOf({telegramLang: `ID`})).toBe(`id`)
  })

  it(`defaults to English for anything else`, () => {
    expect(langOf({telegramLang: `en`})).toBe(`en`)
    expect(langOf({telegramLang: `en-US`})).toBe(`en`)
    expect(langOf({})).toBe(`en`)
    expect(langOf({telegramLang: undefined})).toBe(`en`)
  })

  it(`stored botLang wins over the Telegram client language`, () => {
    expect(langOf({botLang: `id`, telegramLang: `en`})).toBe(`id`)
    expect(langOf({botLang: `en`, telegramLang: `id`})).toBe(`en`)
  })

  it(`never crashes on non-string stored values (legacy LMDB rows)`, () => {
    expect(langOf({botLang: new Date()})).toBe(`en`)
    expect(langOf({botLang: 42})).toBe(`en`)
    expect(langOf({botLang: null})).toBe(`en`)
    expect(langOf({botLang: {}})).toBe(`en`)
  })
})
