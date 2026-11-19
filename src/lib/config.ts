import {OPENAI_DEFAULT_BASE_URL} from "./openai"

/** Runtime config — all secrets come from env, never hardcoded. */
export interface AppConfigData {
  openaiApiKey: string
  openaiBaseUrl: string
  openaiModel: string
  /** Reasoning effort for reasoning models (o1/o3/…). Empty = not sent. */
  openaiReasoningEffort: string
  mockAi: boolean
  allowedIds: Set<number>
  dbPath: string
  /** HTTP endpoint port for POST /summarize (src/server.ts). */
  summarizePort: number
}

export class AppConfig {
  private static current: AppConfigData = AppConfig.load()

  static load(env: NodeJS.ProcessEnv = process.env): AppConfigData {
    return {
      openaiApiKey: env.OPENAI_API_KEY ?? ``,
      openaiBaseUrl: AppConfig.normalizeBaseUrl(env.OPENAI_BASE_URL ?? ``),
      openaiModel: (env.OPENAI_MODEL ?? ``).trim() || `gpt-4o-mini`,
      openaiReasoningEffort: (env.OPENAI_REASONING_EFFORT ?? ``).trim(),
      mockAi: env.SUMMARIZE_MOCK_AI === `1` || env.SUMMARIZE_MOCK_AI === `true`,
      allowedIds: AppConfig.parseIds(env.SUMMARIZE_ALLOWED_IDS ?? ``),
      dbPath: env.DB_PATH ?? `./data`,
      summarizePort: AppConfig.parsePort(env.SUMMARIZE_PORT ?? ``, 3003),
    }
  }

  static get(): AppConfigData {
    return AppConfig.current
  }

  static set(next: AppConfigData): void {
    AppConfig.current = next
  }

  /** Telegram ids that may use the bot; empty = everyone allowed (dev mode). */
  static allowedIds(env: NodeJS.ProcessEnv = process.env): Set<number> {
    // When AppConfig.load already ran with the current env, use the cache;
    // when env changed after load (tests), read it again from env.
    const fromEnv = AppConfig.parseIds(env.SUMMARIZE_ALLOWED_IDS ?? ``)
    if (fromEnv.size > 0) return fromEnv
    return AppConfig.current.allowedIds
  }

  static parseIds(raw: string): Set<number> {
    const out = new Set<number>()
    for (const part of raw.split(`,`)) {
      const n = Number(part.trim())
      if (Number.isFinite(n) && n > 0) out.add(Math.floor(n))
    }
    return out
  }

  static parsePort(raw: string, fallback: number): number {
    const n = Number(raw.trim())
    return Number.isFinite(n) && n > 0 && n < 65536 ? Math.floor(n) : fallback
  }

  /** Trim + strip trailing slashes; empty falls back to the OpenAI default. */
  static normalizeBaseUrl(raw: string): string {
    const trimmed = raw.trim().replace(/\/+$/, ``)
    return trimmed === `` ? OPENAI_DEFAULT_BASE_URL : trimmed
  }

  /** True when the configured base URL points at a non-default provider. */
  static isCustomBaseUrl(env: NodeJS.ProcessEnv = process.env): boolean {
    return AppConfig.normalizeBaseUrl(env.OPENAI_BASE_URL ?? ``) !== OPENAI_DEFAULT_BASE_URL
  }

  /**
   * Mock is active when SUMMARIZE_MOCK_AI=1 OR there is no OPENAI_API_KEY
   * AND the base URL is still the default. No key + a custom base URL
   * (e.g. the free Pollinations provider) = LIVE without a key, not mock.
   * Reads env DIRECTLY (not the load-time cache): e2e setup sets env
   * after the module is imported, so a cache would go stale.
   */
  static isMock(env: NodeJS.ProcessEnv = process.env): boolean {
    if (env.SUMMARIZE_MOCK_AI === `1` || env.SUMMARIZE_MOCK_AI === `true`) return true
    if ((env.OPENAI_API_KEY ?? ``).trim() !== ``) return false
    return !AppConfig.isCustomBaseUrl(env)
  }
}
