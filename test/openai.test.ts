import {afterEach, describe, expect, it} from "bun:test"
import {AppConfig} from "../src/lib/config"
import {OPENAI_DEFAULT_BASE_URL, OpenAIClient, type IChatMessage, type IChatTool} from "../src/lib/openai"

const POLLINATIONS = `https://text.pollinations.ai/openai`

describe(`OpenAIClient.chatCompletionsUrl`, () => {
  it(`appends /chat/completions to the default base URL`, () => {
    expect(OpenAIClient.chatCompletionsUrl(OPENAI_DEFAULT_BASE_URL)).toBe(`https://api.openai.com/v1/chat/completions`)
  })

  it(`strips trailing slashes before appending`, () => {
    expect(OpenAIClient.chatCompletionsUrl(`https://api.openai.com/v1/`)).toBe(`https://api.openai.com/v1/chat/completions`)
    expect(OpenAIClient.chatCompletionsUrl(`${POLLINATIONS}///`)).toBe(`${POLLINATIONS}/chat/completions`)
  })

  it(`passes a full /chat/completions URL through unchanged`, () => {
    const full = `https://api.openai.com/v1/chat/completions`
    expect(OpenAIClient.chatCompletionsUrl(full)).toBe(full)
    expect(OpenAIClient.chatCompletionsUrl(`${full}/`)).toBe(full)
  })

  it(`appends /chat/completions to a custom base URL`, () => {
    expect(OpenAIClient.chatCompletionsUrl(POLLINATIONS)).toBe(`${POLLINATIONS}/chat/completions`)
  })
})

describe(`OpenAIClient.audioTranscriptionsUrl`, () => {
  it(`appends /audio/transcriptions to the default base URL`, () => {
    expect(OpenAIClient.audioTranscriptionsUrl(OPENAI_DEFAULT_BASE_URL)).toBe(`https://api.openai.com/v1/audio/transcriptions`)
  })

  it(`strips a trailing /chat/completions before appending`, () => {
    expect(OpenAIClient.audioTranscriptionsUrl(`https://api.openai.com/v1/chat/completions`)).toBe(
      `https://api.openai.com/v1/audio/transcriptions`,
    )
  })

  it(`appends /audio/transcriptions to a custom base URL`, () => {
    expect(OpenAIClient.audioTranscriptionsUrl(POLLINATIONS)).toBe(`${POLLINATIONS}/audio/transcriptions`)
  })
})

describe(`OpenAIClient.chat`, () => {
  afterEach(() => {
    OpenAIClient.fetchFn = fetch
  })

  const messages: IChatMessage[] = [{role: `user`, content: `hello`}]
  const tools: IChatTool[] = [
    {type: `function`, function: {name: `list_tables`, description: `List tables`, parameters: {type: `object`, properties: {}}}},
  ]

  function stubFetch(body: unknown, ok = true, status = 200) {
    const seen: {url: unknown; init: RequestInit | undefined} = {url: undefined, init: undefined}
    const stub = (async (url: string | URL | Request, init?: RequestInit) => {
      seen.url = url
      seen.init = init
      return {ok, status, text: async () => JSON.stringify(body), json: async () => body} as unknown as Response
    }) as typeof fetch
    OpenAIClient.fetchFn = stub
    return seen
  }

  it(`posts to the custom base URL and omits Authorization when the key is empty`, async () => {
    const seen = stubFetch({choices: [{message: {role: `assistant`, content: `hi`}}]})
    const {message} = await OpenAIClient.chat(``, `openai`, messages, tools, POLLINATIONS)
    expect(message.content).toBe(`hi`)
    expect(seen.url).toBe(`${POLLINATIONS}/chat/completions`)
    const headers = seen.init?.headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
    const body = JSON.parse(seen.init?.body as string) as Record<string, unknown>
    expect(body.model).toBe(`openai`)
    expect(body.tools).toEqual(tools)
    expect(body.tool_choice).toBe(`auto`)
  })

  it(`sends Authorization Bearer when a key is set`, async () => {
    const seen = stubFetch({choices: [{message: {role: `assistant`, content: `hi`}}]})
    await OpenAIClient.chat(`sk-test`, `gpt-4o-mini`, messages, tools)
    const headers = seen.init?.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer sk-test`)
    expect(seen.url).toBe(`https://api.openai.com/v1/chat/completions`)
  })

  it(`omits tools and tool_choice when the tool list is empty`, async () => {
    const seen = stubFetch({choices: [{message: {role: `assistant`, content: `hi`}}]})
    await OpenAIClient.chat(`sk-test`, `gpt-4o-mini`, messages, [])
    const body = JSON.parse(seen.init?.body as string) as Record<string, unknown>
    expect(body.tools).toBeUndefined()
    expect(body.tool_choice).toBeUndefined()
  })

  it(`throws an AI chat error on a non-ok response`, async () => {
    stubFetch({error: `nope`}, false, 401)
    await expect(OpenAIClient.chat(``, `openai`, messages, [], POLLINATIONS)).rejects.toThrow(`AI chat 401`)
  })

  it(`throws an AI chat error on an empty response`, async () => {
    stubFetch({choices: []})
    await expect(OpenAIClient.chat(``, `openai`, messages, [], POLLINATIONS)).rejects.toThrow(`AI chat: empty response`)
  })
})

describe(`AppConfig.normalizeBaseUrl`, () => {
  it(`falls back to the default for an empty value`, () => {
    expect(AppConfig.normalizeBaseUrl(``)).toBe(OPENAI_DEFAULT_BASE_URL)
    expect(AppConfig.normalizeBaseUrl(`   `)).toBe(OPENAI_DEFAULT_BASE_URL)
  })

  it(`trims whitespace and strips trailing slashes`, () => {
    expect(AppConfig.normalizeBaseUrl(`  ${POLLINATIONS}/  `)).toBe(POLLINATIONS)
  })

  it(`keeps a custom base URL as-is`, () => {
    expect(AppConfig.normalizeBaseUrl(POLLINATIONS)).toBe(POLLINATIONS)
  })
})

describe(`AppConfig.isCustomBaseUrl`, () => {
  it(`is false for the default and for an empty value`, () => {
    expect(AppConfig.isCustomBaseUrl({})).toBe(false)
    expect(AppConfig.isCustomBaseUrl({OPENAI_BASE_URL: OPENAI_DEFAULT_BASE_URL})).toBe(false)
    expect(AppConfig.isCustomBaseUrl({OPENAI_BASE_URL: `${OPENAI_DEFAULT_BASE_URL}/`})).toBe(false)
  })

  it(`is true for a custom base URL`, () => {
    expect(AppConfig.isCustomBaseUrl({OPENAI_BASE_URL: POLLINATIONS})).toBe(true)
  })
})

describe(`AppConfig.isMock`, () => {
  it(`is mock with no key and the default base URL`, () => {
    expect(AppConfig.isMock({})).toBe(true)
    expect(AppConfig.isMock({OPENAI_API_KEY: ``})).toBe(true)
  })

  it(`is NOT mock with no key and a custom base URL (free provider, live mode)`, () => {
    expect(AppConfig.isMock({OPENAI_BASE_URL: POLLINATIONS})).toBe(false)
  })

  it(`is mock when the mock flag is set, even with a key and a custom base URL`, () => {
    expect(AppConfig.isMock({SUMMARIZE_MOCK_AI: `1`, OPENAI_API_KEY: `sk-test`, OPENAI_BASE_URL: POLLINATIONS})).toBe(true)
    expect(AppConfig.isMock({SUMMARIZE_MOCK_AI: `true`, OPENAI_API_KEY: `sk-test`})).toBe(true)
  })

  it(`is NOT mock when a key is set`, () => {
    expect(AppConfig.isMock({OPENAI_API_KEY: `sk-test`})).toBe(false)
  })
})

describe(`AppConfig.load`, () => {
  it(`reads the base URL and model from env, with defaults`, () => {
    const cfg = AppConfig.load({})
    expect(cfg.openaiBaseUrl).toBe(OPENAI_DEFAULT_BASE_URL)
    expect(cfg.openaiModel).toBe(`gpt-4o-mini`)
    const custom = AppConfig.load({OPENAI_BASE_URL: `${POLLINATIONS}/`, OPENAI_MODEL: ` openai `})
    expect(custom.openaiBaseUrl).toBe(POLLINATIONS)
    expect(custom.openaiModel).toBe(`openai`)
  })
})

describe(`OpenAIClient reasoning models`, () => {
  const messages: {role: `user`; content: string}[] = [{role: `user`, content: `hi`}]
  const stub = (body: unknown, ok = true, status = 200) => {
    const seen: {url?: string; init?: RequestInit} = {}
    OpenAIClient.fetchFn = (async (url: string | URL, init?: RequestInit) => {
      seen.url = String(url)
      seen.init = init
      return new Response(JSON.stringify(body), {status, headers: {"Content-Type": `application/json`}})
    }) as typeof fetch
    return seen
  }
  afterEach(() => {
    OpenAIClient.fetchFn = fetch
  })

  it(`isReasoningModel matches o1/o3/o4 families`, () => {
    expect(OpenAIClient.isReasoningModel(`o1`)).toBe(true)
    expect(OpenAIClient.isReasoningModel(`o1-mini`)).toBe(true)
    expect(OpenAIClient.isReasoningModel(`o3`)).toBe(true)
    expect(OpenAIClient.isReasoningModel(`o4-mini`)).toBe(true)
    expect(OpenAIClient.isReasoningModel(`gpt-4o-mini`)).toBe(false)
    expect(OpenAIClient.isReasoningModel(`openai`)).toBe(false)
  })

  it(`sends reasoning_effort and omits temperature for a reasoning model`, async () => {
    const seen = stub({choices: [{message: {role: `assistant`, content: `ok`}}]})
    await OpenAIClient.chat(`sk-test`, `o1`, messages, [], undefined, {reasoningEffort: `high`})
    const body = JSON.parse(seen.init?.body as string) as Record<string, unknown>
    expect(body.reasoning_effort).toBe(`high`)
    expect(body.temperature).toBeUndefined()
  })

  it(`sends temperature and no reasoning_effort for a normal model`, async () => {
    const seen = stub({choices: [{message: {role: `assistant`, content: `ok`}}]})
    await OpenAIClient.chat(`sk-test`, `gpt-4o-mini`, messages, [], undefined, {temperature: 0.7})
    const body = JSON.parse(seen.init?.body as string) as Record<string, unknown>
    expect(body.temperature).toBe(0.7)
    expect(body.reasoning_effort).toBeUndefined()
  })

  it(`sends no reasoning_effort when none is configured`, async () => {
    const seen = stub({choices: [{message: {role: `assistant`, content: `ok`}}]})
    await OpenAIClient.chat(`sk-test`, `o1`, messages, [], undefined, {})
    const body = JSON.parse(seen.init?.body as string) as Record<string, unknown>
    expect(body.reasoning_effort).toBeUndefined()
    expect(body.temperature).toBeUndefined()
  })
})
