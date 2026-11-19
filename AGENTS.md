# AGENTS.md

## STRICT RECREATE RULES (Damar, 2026-11-19 — apply to this project AND every
## future recreate project, no exceptions)

1. **English only in repo content**: repo description + README.md in
   English; README follows the `create-gramstax` 6.1.0 template style
   (title + badges, Features, Quick Start, Scripts table, Project
   Structure, Configuration, Testing, Deployment, Tech Stack, License).
2. **Original-flow source lives in `references/`** (NEVER `assets/`).
   Do NOT name the original workflow tool in the repo description,
   `package.json` description, or main README.md — it is only a
   reference inside `references/` (its README + the JSON file name).
3. **README.md MUST contain a Mermaid flowchart** of this project's
   own code flow.
4. **Repo description MUST start with 1 emoji**, English. The bot is
   multilingual — NEVER "plain English" only: say "English or
   Indonesian", and the README intro + start/help templates must say
   the same.
5. **Bilingual, English by default**: every user-facing message is
   English by default AND Indonesian. Language is stored per user in
   LMDB (`UserSchema.botLang`), changed with `/language`; follow
   `gramstax-best-practices` and `lmdb-best-practices` (6.1.0).
6. **Commands are ENGLISH ONLY (Damar, 2026-11-19 ~15:22 WIB).** There
   is NO `intentCommandText` in any page's `buildData()`:
   `static data = this.buildData()` (or with a callback-args function
   where the page has one), and the command is the page name:
   `/summarize`, `/latest`, `/language`, `/forget` (+ `/start`,
   `/help`). Message CONTENT is still bilingual (rule 5/7) — an
   English command does NOT make the replies English-only.

   6a. **Localization is done ONLY with static template blocks**
   (`<g-message>`, `<g-message lang="id">`, `<g-switch>`,
   `<g-map>`, `<g-ifelse>`); user-facing messages live in the
   template, dynamic data is passed as template variables.
   **`src/lib/i18n.ts` is FORBIDDEN** (Damar, 2026-11-19 ~14:43 WIB)
   — it is useless. The only language helper allowed is
   `src/lib/lang.ts` (resolves the language code `en`|`id`, no
   messages). Documented exceptions, all non-user-facing: the LLM
   system prompts and model-facing tokens in `src/lib/summarizer.ts`
   (`CHUNK_SUMMARIZE_SYSTEM`, `COMBINE_SYSTEM`), and the HTTP
   endpoint's JSON error codes.
   6b. **`<g-description>` is PER PAGE** (confirmed by Damar
   2026-11-19 ~15:22 WIB): the sync reads
   `getGDescription("<page-name>", "default", lang, scope)`, so a
   description placed in `start/index.ts` would only ever sync
   `/start`. EVERY page with a command handler
   (`handleCommandText` / `handleCommandArgsText`) carries its own
   `<g-description>` block in its template's default `<g-base>`,
   in EN (default) + `lang="id"`. Pages without a command handler
   (`status.ts`) carry none. Command pages here: start, summarize,
   latest, help, language, forget — 6 commands, 2 languages each.
   6c. **Keyboard is written ONCE** in `src/blocks/g-keyboard.ts`
   (`KeyboardGBlock.mainMenu()`), with `{default, id}` labels;
   the framework `_build` emits both variants. Pages reuse it —
   never duplicate the keyboard per page.
   6d. **Mermaid in README: plain words only in node labels**
   (Damar, 2026-11-19 ~16:30 WIB — found in the DB Chat repo,
   verified on the live GitHub page). The local Mermaid parser v11
   can print PARSE OK while GitHub's renderer FAILS: the DB Chat
   diagram errored on GitHub with `Parse error ... Expecting 'SQE'
   ... got 'STR'` because a node contained `=` and nested quotes
   (`PAGES["... lang='id'"]`). NEVER put `=` or nested quotes
   inside a Mermaid node label — write plain words only (e.g.
   `template EN and ID`). Validate locally with
   `/tmp/mmd-parse/parse-both.ts` (must print PARSE OK), AND the
   final verification MUST be viewing the rendered diagram on the
   GitHub README page in the browser — local parse alone is NOT
   proof. Also recorded in `~/workspace/recreate-rules.md` §6d.
7. **No emoji in `##` README headings** (the "emoji on parent
   headings" rule was REVOKED by Damar 2026-11-19 ~14:40 WIB).
   Emoji is still fine in the repo DESCRIPTION (rule 4) and inside
   list items / body text.
8. **Repo name represents the project**, not the original flow's
   name (e.g. `bot-summarize-webpages-ai`). Get the name right at
   creation — do NOT rename a published repo (renaming breaks its
   URL). Repo is PUBLIC. Description has NO ecosystem version
   number. README is firm, human, and clear. Promo for the
   Telegram-bot creation service by a Gramstax engineer sits at the
   TOP of every README.md (under title + badges, before Features,
   English, linking Telegram @damartripamungkas).
9. **Conventional commits + scope** (e.g. `feat(pages): ...`,
   `fix(summarizer): ...`, `chore(repo): ...`). Every project MUST
   have `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`.
   Every repo MUST have topics for SEO.
10. **Page file names in English only** (e.g. `summarize.ts`,
    `latest.ts`, `forget.ts`, `language.ts` — never an Indonesian
    spelling).
11. **AI model + base URL via `.env`** (Damar, 2026-11-19 ~16:10
    WIB): `OPENAI_BASE_URL` (default `https://api.openai.com/v1`)
    + `OPENAI_MODEL` (default `gpt-4o-mini` here — the original
    flow used gpt-4o-mini). Never hardcode the model or URL in
    code. Free OpenAI-compatible provider verified working
    without a key: Pollinations `https://text.pollinations.ai/openai`,
    model `openai-fast` (the `openai` model often rate-limits 402
    FREE_LIMIT, 1 reply/45s/IP — use `openai-fast` for live tests).
    If a custom base URL is set, an empty key must NOT force mock
    mode; if the base URL is the OpenAI default and the key is empty
    → mock. Reasoning params (`reasoning_effort`) are sent ONLY to
    reasoning models (o1/o3/o4) and only when configured; `temperature`
    is omitted for reasoning models — never break generic
    OpenAI-compatible providers. **Rate-limit retry (added
    2026-11-19 for this bot):** `OpenAIClient.chat` retries 402/429
    up to 3 times, waiting the provider's "Retry after Ns" (default
    45 s, cap 60 s). Pollinations' anonymous tier allows ~1 reply
    per 45 s per IP even for `openai-fast`, and this bot makes
    several calls per page — without the retry a long page could
    never finish on the free tier (verified live 2026-11-19: calls
    4–6 of a 7-call run failed 402 FREE_LIMIT, then recovered after
    the wait). The retry is covered by unit tests in
    `test/openai.test.ts` (with "Retry after 0s" so the suite stays
    fast).
12. **ALWAYS check the Mermaid flow in README.md** (Damar,
    2026-11-19 ~16:13 WIB): render/validate until 0 errors before
    commit/push. See rule 6d for the GitHub-vs-local trap.
13. **No copy from the previous recreate in this repo** (correction
    2026-11-19 ~17:13 WIB): this bot SUMMARIZES webpages (workflow
    1951) — it does not do the 3100 bot's job. The 3100 bot's job
    words (its verb, its three-letter field, its "10 tips" phrase,
    and its page kind) must NOT appear anywhere in this repo except
    inside `references/` (the original JSON). Audit with a grep for
    those words outside `references/` = 0 before every push. The
    same rule applies to `package.json` description, `.env.example`,
    and every page template.

## Project notes — bot-summarize-webpages-ai (2026-11-19)

Recreate of the original workflow 1951 ("Scrape and summarize
webpages with AI", 16 nodes: Manual Trigger → Fetch Essay List →
Extract essay names → Split out → Limit to first 3 → Fetch essay
texts → Extract Text Only → Default Data Loader → Recursive
Character Text Splitter (chunkSize 6000) → Summarization Chain
(GPT-4o-mini, documentLoader mode) → Clean up → Merge). Original
JSON: `references/` (workflow id 1951, 16 nodes, validated — the
file name inside references/ is the only place the original tool's
name appears).

Mapping original → Gramstax:

- Manual Trigger + Fetch Essay List + Extract essay names + Split
  out + Limit to first 3 → Telegram `/latest` (plus `POST
  /summarize` for any single URL): fetch the articles list,
  extract the essay links (`table table a`, href), take the first 3.
- Fetch essay texts + Extract Text Only (body, skip img, nav) →
  `src/lib/scraper.ts`: `validateUrl` (http/https only, blocks
  localhost/private/link-local hosts + DNS-resolved private IPs —
  SSRF guard), 15 s timeout, 200 KB max, HTML→clean text (strips
  script/style/noscript/svg/nav/footer/img, decodes entities),
  30,000 chars budget; `extractEssayLinks` reads the nested-table
  essay links in order, de-duplicated.
- Default Data Loader + Recursive Character Text Splitter (chunkSize
  6000) → `Summarizer.splitRecursive` in `src/lib/summarizer.ts`:
  split on paragraph breaks, then line breaks, then sentence ends,
  then spaces — never mid-word, never over 6000 chars unless a
  single unbreakable run forces a hard cut.
- Summarization Chain (documentLoader mode, GPT-4o-mini) →
  `Summarizer.summarize`: one model call per chunk
  (`CHUNK_SUMMARIZE_SYSTEM`), then one combine call
  (`COMBINE_SYSTEM`) into a single summary. `Summarizer.latest`
  runs the same pipeline per essay. Deterministic mock (env
  `SUMMARIZE_MOCK_AI=1`) returns a mock summary / 3 mock essays
  for the host — used by all e2e tests.
- Clean up (title + summary + url) + Merge →
  `Summarizer.toSummary` + the `summary`/`essay` template bases:
  title + summary + source URL, split into 4000-char Telegram
  chunks on paragraph boundaries.
- OpenAI Chat Model gpt-4o-mini → `src/lib/openai.ts`
  (`IChatOptions`: `reasoningEffort`/`temperature`;
  `isReasoningModel` for o1/o3/o4; temperature omitted for
  reasoning models, `reasoning_effort` sent only when non-empty).
  Config in `src/lib/config.ts`
  (`OPENAI_BASE_URL`/`OPENAI_MODEL`/`OPENAI_REASONING_EFFORT`/`SUMMARIZE_PORT`,
  env prefix `SUMMARIZE_`).

LMDB (`@gramstax/lmdb` 6.1.0): `UserSchema` (per-user language
preference, `botLang`) + `SummarySchema` (one row per user, last 5
summaries as JSON, newest first). No long-term conversation memory —
the original flow has no memory node; `/forget` clears the summaries
only, not the language. `data/` is git-ignored; `src/db/index.ts`
exports `user` + `summaries` repos.

Pages (all EN commands, EN+ID content via static template):

- `start/index.ts` — welcome + mainMenu `[SummarizePage, LatestPage, LanguagePage, HelpPage]`
- `summarize.ts` — `handleCommandText` (prompt), `handleCommandArgsText`
  (summarize), `handleFreeText` (bare URL → summarize; other text →
  prompt), `handleCallbackQueryData` (prompt). Sends the summary in
  4000-char chunks via the `summary` `<g-base>` id.
  `sendChatAction` typing while working.
- `latest.ts` — `handleCommandText` / `handleCallbackQueryData`
  (both run the list). Sends one `essay` base per essay (title +
  summary chunks + URL), then a `partial` state when some essays
  failed.
- `help.ts`, `language.ts`, `forget.ts` (clears `db.summaries`),
  `status.ts` (Route Not Found, no `<g-description>`).

Verification commands: `bun run typecheck`, `bun run test:all`,
`bun run test:e2e:check`, `gramstax build`. Live test: run
`src/server.ts` with Pollinations (`OPENAI_BASE_URL=https://text.pollinations.ai/openai`,
`OPENAI_MODEL=openai-fast`, no key) and `curl POST /summarize` against
a real public page (e.g. a Paul Graham essay) — report the title +
summary length + chunk count, never the full summary.

Git: `gh` CLI (logged in as `damartripamungkas`), HTTPS via the `gh`
credential helper — SSH push FAILS (the VM key is only a Deploy Key
for `inkred-content-factory`). Repo: `gramstax/bot-summarize-webpages-ai`
(PUBLIC). Topics: telegram-bot, gramstax, typescript, bun,
ai-assistant, openai, summarizer, webscraper, nlp, chatbot.
