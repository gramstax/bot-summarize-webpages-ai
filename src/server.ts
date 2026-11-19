import {AppConfig} from "./lib/config"
import {Summarizer} from "./lib/summarizer"
import {LogHe} from "./helpers/log"

/**
 * Standalone HTTP endpoint for the same summary the Telegram bot does.
 *
 * Gramstax's own status server (statusServerPort) is a fixed health
 * server with no custom routes, so the endpoint runs as a small Bun.serve
 * next to `gramstax start` — `bun run serve`. It shares Summarizer with
 * the bot, so bot and endpoint always summarize the same way.
 *
 *   POST /summarize {"url": "https://..."} -> {"url","host","title","summary","chunks","via":"openai"|"mock"}
 *   GET  /health    {"ok":true}
 *   GET  /          {"service": ...} (usage)
 *
 * The endpoint is unauthenticated by design: run it on localhost or
 * behind your own reverse proxy with auth. It stores nothing.
 */
const config = AppConfig.get()

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {status, headers: {"Content-Type": `application/json`}})
}

export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url)
  if (req.method === `GET` && url.pathname === `/health`) return json({ok: true})
  if (req.method === `GET` && url.pathname === `/`) {
    return json({service: `bot-summarize-webpages-ai`, endpoints: {summarize: `POST /summarize {"url": "https://..."}`, health: `GET /health`}})
  }
  if (req.method === `POST` && url.pathname === `/summarize`) {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return json({error: `invalid-json`}, 400)
    }
    const input = (body as {url?: unknown} | null)?.url
    if (typeof input !== `string` || input.trim() === ``) return json({error: `url-required`}, 400)
    const result = await Summarizer.summarize(input)
    if (result.kind !== `ok`) return json({error: result.code ?? result.kind, url: result.url}, result.kind === `invalid` ? 400 : 502)
    return json({url: result.url, host: result.host, title: result.title, summary: result.summary, chunks: result.chunks, via: result.via})
  }
  return json({error: `not-found`}, 404)
}

if (import.meta.main) {
  const port = config.summarizePort
  const server = Bun.serve({port, fetch: handleRequest})
  LogHe.info(`[summarize] HTTP endpoint listening on http://127.0.0.1:${server.port} (POST /summarize)`)
}
