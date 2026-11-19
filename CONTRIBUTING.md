# Contributing

Thanks for considering a contribution to DB Chat — a Telegram bot that lets you chat with a database using AI, built with Gramstax, TypeScript, and Bun.

## How to contribute

1. Fork the repository and create a branch from `main` for your change.
2. Follow the conventions below and in `AGENTS.md`.
3. Run the full verification before opening a pull request:
   ```bash
   bun run typecheck
   bun run test:all
   bun run build:gramstax
   ```
4. Open a pull request against `main` with a clear description of what
   changed and why. Keep the change focused; one concern per pull
   request.

## Conventions

- **Commits use Conventional Commits with a scope**, for example
  `feat(pages): add a schema command` or `fix(language): render the
  Indonesian variant after a switch`. Never commit a bare message.
- **English only** in code, comments, commit messages, and
  documentation. User-facing bot messages are bilingual (English
  default + Indonesian) and live in page templates — see below.
- **Bun only.** Do not add a Node runtime, Jest, or Vitest. Use the
  scripts in `package.json`.
- **TypeScript strict.** Prefer precise types over `any`; the project
  enables `noUncheckedIndexedAccess`.
- **Never commit secrets.** `.env`, tokens, runtime data (`data/`),
  logs, and build output (`.gramstax/`) are gitignored.

## Localization

Every user-facing message lives in a page's `static template` block
(`<g-message>`, `<g-switch>`, `<g-map>`, `<g-ifelse>` — English
default plus a `<g-message lang="id">` variant). There is no string
dictionary in code: helpers and services only compute data and pass it
as template variables. Do not add hardcoded user-facing strings in
`src/lib/` or page logic; add the sentence to the template in both
languages instead. Keyboards are defined once in
`src/blocks/g-keyboard.ts`; command descriptions live in each page's
own `<g-description>` block (English + Indonesian) in its default
`<g-base>`.

## Pages and tests

- A page file name is its route: `src/pages/tasks.ts` is `/tasks`.
  Bilingual command spellings are declared with
  `intentCommandText: {default: "tasks", id: "tugas"}` on the same page
  — never a second file.
- Every page has a mirror test under `e2e/` (same relative path) and a
  row for every handler in `e2e/COVERAGE.md`. Run
  `bun run test:e2e:check` after adding, renaming, or removing a page
  or handler; the check fails on a missing mirror or ledger row.
- Unit tests live in `test/`; e2e tests drive the real bot in-process
  (`deploy: test`) with mock AI (`DBCHAT_MOCK_AI=1`).

## Reporting bugs

Open an issue with steps to reproduce, what you expected, and what
happened instead. Include the relevant log lines if you have them.
Security issues are NOT filed as public issues — see `SECURITY.md`.
