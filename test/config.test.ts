import {describe, expect, it} from "bun:test"
import {AppConfig} from "../src/lib/config"

describe(`AppConfig.load`, () => {
  it(`defaults to the gpt-4o-mini model and the OpenAI base URL`, () => {
    const c = AppConfig.load({} as NodeJS.ProcessEnv)
    expect(c.openaiModel).toBe(`gpt-4o-mini`)
    expect(c.openaiBaseUrl).toBe(`https://api.openai.com/v1`)
    expect(c.openaiReasoningEffort).toBe(``)
    expect(c.summarizePort).toBe(3003)
  })

  it(`reads model, base URL, reasoning effort, and port from env`, () => {
    const c = AppConfig.load({
      OPENAI_BASE_URL: `https://text.pollinations.ai/openai/`,
      OPENAI_MODEL: `openai-fast`,
      OPENAI_REASONING_EFFORT: `high`,
      SUMMARIZE_PORT: `4004`,
    } as NodeJS.ProcessEnv)
    expect(c.openaiBaseUrl).toBe(`https://text.pollinations.ai/openai`)
    expect(c.openaiModel).toBe(`openai-fast`)
    expect(c.openaiReasoningEffort).toBe(`high`)
    expect(c.summarizePort).toBe(4004)
  })

  it(`falls back to port 3003 for a bad SUMMARIZE_PORT`, () => {
    expect(AppConfig.load({SUMMARIZE_PORT: `abc`} as NodeJS.ProcessEnv).summarizePort).toBe(3003)
    expect(AppConfig.load({SUMMARIZE_PORT: `0`} as NodeJS.ProcessEnv).summarizePort).toBe(3003)
  })
})

describe(`AppConfig.isMock`, () => {
  it(`SUMMARIZE_MOCK_AI=1 always mocks`, () => {
    expect(AppConfig.isMock({SUMMARIZE_MOCK_AI: `1`, OPENAI_API_KEY: `key`} as NodeJS.ProcessEnv)).toBe(true)
  })

  it(`a key means live`, () => {
    expect(AppConfig.isMock({OPENAI_API_KEY: `key`} as NodeJS.ProcessEnv)).toBe(false)
  })

  it(`no key + default base URL means mock`, () => {
    expect(AppConfig.isMock({} as NodeJS.ProcessEnv)).toBe(true)
  })

  it(`no key + a custom base URL means live without a key`, () => {
    expect(AppConfig.isMock({OPENAI_BASE_URL: `https://text.pollinations.ai/openai`} as NodeJS.ProcessEnv)).toBe(false)
  })
})
