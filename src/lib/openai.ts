/** Minimal chat client for any OpenAI-compatible API, via fetch directly (no extra SDK). */
export const OPENAI_DEFAULT_BASE_URL = `https://api.openai.com/v1`

export interface IChatTool {
  type: `function`
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface IChatMessage {
  role: `system` | `user` | `assistant` | `tool`
  content: string | null
  tool_calls?: {id: string; type: `function`; function: {name: string; arguments: string}}[]
  tool_call_id?: string
}

export interface IChatResult {
  message: IChatMessage
}

export interface IChatOptions {
  /** Sent as `reasoning_effort` only when non-empty (o1/o3/… style models). */
  reasoningEffort?: string
  /** Temperature; omitted for reasoning models (o1/o3/o4 reject it). */
  temperature?: number
}

export class OpenAIClient {
  static fetchFn: typeof fetch = fetch

  /** Chat-completions endpoint for a base URL (accepts the base or the full endpoint). */
  static chatCompletionsUrl(baseUrl: string): string {
    const base = baseUrl.trim().replace(/\/+$/, ``)
    if (base.endsWith(`/chat/completions`)) return base
    return `${base}/chat/completions`
  }

  /** Audio-transcriptions endpoint for a base URL (kept for a shared client shape; this bot has no transcription). */
  static audioTranscriptionsUrl(baseUrl: string): string {
    const base = baseUrl.trim().replace(/\/+$/, ``).replace(/\/chat\/completions$/, ``)
    return `${base}/audio/transcriptions`
  }

  /** Reasoning models (o1/o3/o4/…) do not accept a temperature parameter. */
  static isReasoningModel(model: string): boolean {
    return /^o[134]([-.]|$)/.test(model.trim().toLowerCase())
  }

  static async chat(
    apiKey: string,
    model: string,
    messages: IChatMessage[],
    tools: IChatTool[],
    baseUrl: string = OPENAI_DEFAULT_BASE_URL,
    options: IChatOptions = {},
  ): Promise<IChatResult> {
    const headers: Record<string, string> = {"Content-Type": `application/json`}
    // Free OpenAI-compatible providers need no key — only send one when set.
    if (apiKey.trim() !== ``) headers.Authorization = `Bearer ${apiKey}`
    const body: Record<string, unknown> = {
      model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? `auto` : undefined,
    }
    if (!OpenAIClient.isReasoningModel(model)) body.temperature = options.temperature ?? 0.7
    if (options.reasoningEffort !== undefined && options.reasoningEffort.trim() !== ``) {
      body.reasoning_effort = options.reasoningEffort.trim()
    }
    const res = await OpenAIClient.fetchFn(OpenAIClient.chatCompletionsUrl(baseUrl), {
      method: `POST`,
      headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const bodyText = await res.text().catch(() => ``)
      throw new Error(`AI chat ${res.status}: ${bodyText.slice(0, 200)}`)
    }
    const data = (await res.json()) as {choices?: {message?: IChatMessage}[]}
    const message = data.choices?.[0]?.message
    if (!message) throw new Error(`AI chat: empty response`)
    return {message}
  }
}
