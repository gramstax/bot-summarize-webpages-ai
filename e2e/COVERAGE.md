# Coverage ledger — bot-summarize-webpages-ai

Every page, handler, and template state in `src/` has a matching e2e
assertion here. The ledger is the contract: if a row has no test, the
feature is not covered.

## Conventions

- The e2e suite runs the bot in-process with `SUMMARIZE_MOCK_AI=1`: the
  summarizer never touches the network — the mock returns a deterministic
  summary for the host, and `/latest` returns deterministic mock
  summaries for 3 Paul Graham essays. Real scraping + real AI are
  verified by the live test (Pollinations) and by the unit tests in
  `test/scraper.test.ts` and `test/summarizer.test.ts`, which stub the
  fetch layer.
- `gmsg` in assertions means: the rendered message equals the template
  output for that base/state/language (exact match, including the
  dynamic variables). `gkb` means the keyboard labels equal the single
  `KeyboardGBlock.mainMenu()` definition for that language.
- User-facing text is bilingual (EN default + ID) via static template
  blocks only — there is no `i18n.ts` in this project. The only
  non-user-facing English strings are the LLM system prompts and the
  model-facing tokens in `src/lib/summarizer.ts` (not user-facing).
- Commands are ENGLISH ONLY (`/summarize`, `/latest`, `/language`,
  `/forget`, `/start`, `/help`). Content stays bilingual.

## Pages

| page | file | covered by | notes |
| --- | --- | --- | --- |
| start | `src/pages/start/index.ts` | `e2e/start/index.test.ts` | /start EN + ID, exact gmsg, exact keyboard labels, callback edit, navigation to Summarize |
| summarize | `src/pages/summarize.ts` | `e2e/summarize.test.ts` | /summarize <url> → title + summary (EN + ID), bare-URL free text, /summarize alone → prompt, non-URL text → prompt, invalid URL → honest error + no history, localhost → SSRF refusal + no history, typing indicator, history saved, Summarize button on /start |
| latest | `src/pages/latest.ts` | `e2e/latest.test.ts` | /latest → 3 essay summaries (EN + ID), history saved newest-first, Latest button on /start |
| help | `src/pages/help.ts` | `e2e/help.test.ts` | /help command EN + ID, /start → Help callback |
| language | `src/pages/language.ts` | `e2e/language.test.ts` | /language command, EN→ID and ID→EN switches, summary renders in the new language, fresh user defaults to EN |
| forget | `src/pages/forget.ts` | `e2e/forget.test.ts` | /forget clears summaries + confirms, next summary starts a fresh history |
| status | `src/pages/status.ts` | `e2e/status.test.ts` | unknown callback → Route not found, unknown command → Route not found (EN + ID), unknown free text goes to Summarize (prompt), NOT to Route not found |

## Hooks and guards

| hook | case | covered by | assertion |
| --- | --- | --- | --- |
| hookBeforeRoute (deny) | user not on SUMMARIZE_ALLOWED_IDS | `e2e/coverage.test.ts` | sendMessage penolakan ID, tanpa "aku Page Summary" |
| hookBeforeRoute (allow) | user on SUMMARIZE_ALLOWED_IDS | `e2e/coverage.test.ts` | /start tampil "aku Page Summary" |
| hookBeforeRoute (no username) | user without username | `e2e/coverage.test.ts` | /start tampil "aku Page Summary" |

## Stores

| store | covered by | assertion |
| --- | --- | --- |
| user | `e2e/db-lmdb.test.ts` | createIfNotExists idempotent |
| summaries | `e2e/db-lmdb.test.ts`, `e2e/coverage.test.ts` | add/list, cap at newest 5, clear, usage |

## Descriptions (BotFather sync)

| check | covered by | assertion |
| --- | --- | --- |
| `<g-description>` per command page | `e2e/descriptions.test.ts` | `executeSyncBlocksDescription` → exactly 2 `setMyCommands` calls (default + `id`), 6 commands each, once each, exact EN/ID texts |

## Unit tests (not e2e — listed here so the ledger is complete)

| area | file | covers |
| --- | --- | --- |
| URL validation + SSRF guard | `test/scraper.test.ts` | validateUrl, isPrivateIp, htmlToText, fetchPageText (stubbed fetch/DNS): clean page, private-IP refusal, non-200, non-HTML, invalid URL never fetches |
| Summarizer | `test/summarizer.test.ts` | splitRecursive (6000-char cap, paragraph/sentence/word boundaries, hard cut), splitText, cleanModelText, mockResult, mockLatest (3 essays), summarize() mock + live path (1 chunk = 1 call, multi-chunk = chunk calls + combine, fetch failure → fetch-error), latest() mock + live path (first 3 links, no-essays error), extractEssayLinks |
| OpenAI client | `test/openai.test.ts` | custom base URL, empty-key auth omission, tools/tool_choice, error paths, reasoning models: reasoning_effort sent + temperature omitted for o1/o3/o4, temperature sent for normal models, AppConfig defaults (gpt-4o-mini) |
| Config | `test/config.test.ts` | defaults (model gpt-4o-mini, port 3003), env overrides, isMock matrix |
| HTTP endpoint | `test/server.test.ts` | GET /health, GET /, POST /summarize mock success (summary + chunks), url-required, invalid-url, blocked-host, 404 |
| Keyboard | `test/keyboard.test.ts` | mainMenu labels EN + ID, single definition |

## Not covered (deliberate)

- Live Telegram delivery (needs `BOT_TOKEN` from Damar) — covered by
  the live test instead (Pollinations + real page, via the /tmp script
  route and via `curl POST /summarize`).
- The real Whisper/voice path — this bot has no voice input.
- Webhook deploy mode — polling is the default; webhook config is the
  standard Gramstax branch in `gramstax.config.ts`.

## Handlers

Machine-checked by `scripts/check-e2e-handlers.ts`: every `handle*`
method in `src/pages/` has a row here, and every `e2e/*.test.ts` file
is referenced by at least one row.

| Page | Handler / state | Trigger | Test | Asserts |
| --- | --- | --- | --- | --- |
| start | handleCommandText | `/start` | e2e/start/index.test.ts | sendMessage welcome + keyboard |
| start | handleCallbackQueryData | callback `start` | e2e/start/index.test.ts | editMessageText welcome + keyboard |
| summarize | handleCommandText | `/summarize` | e2e/summarize.test.ts | prompt state |
| summarize | handleCommandArgsText | `/summarize <url>` | e2e/summarize.test.ts | title + summary |
| summarize | handleFreeText | bare URL / other text | e2e/summarize.test.ts | summarize, or prompt for non-URL text |
| summarize | handleCallbackQueryData | callback `summarize` | e2e/summarize.test.ts | editMessageText prompt |
| latest | handleCommandText | `/latest` | e2e/latest.test.ts | 3 essay summaries |
| latest | handleCallbackQueryData | callback `latest` | e2e/latest.test.ts | 3 essay summaries |
| help | handleCommandText | `/help` | e2e/help.test.ts | help text |
| help | handleCallbackQueryData | callback `help` | e2e/help.test.ts | editMessageText help |
| language | handleCommandText | `/language` | e2e/language.test.ts | language picker |
| language | handleCallbackQueryData | callback `language` | e2e/language.test.ts | language picker |
| language | handleArgsCallbackQueryData | callback `language:lang-xx` | e2e/language.test.ts | switch + confirmation |
| forget | handleCommandText | `/forget` | e2e/forget.test.ts | clear history + confirmation |
| status | - | unknown command / callback | e2e/status.test.ts | Route not found |
| hook | - | AllowList guard | e2e/coverage.test.ts | deny / allow / no-username |
| store | - | LMDB user + summaries | e2e/db-lmdb.test.ts | idempotent user, cap 5, clear |
| descriptions | - | g-description sync | e2e/descriptions.test.ts | 6 commands x 2 languages |
