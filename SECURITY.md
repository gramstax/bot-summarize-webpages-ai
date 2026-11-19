# Security Policy

## Supported versions

Only the latest release on the `main` branch is supported with
security fixes. If you run an older checkout, please update first and
check whether the issue still reproduces.

## Reporting a vulnerability

**Do not open a public issue for a security vulnerability.**

Report it privately to the maintainer on Telegram at
[@damartripamungkas](https://t.me/damartripamungkas). Include:

- A description of the vulnerability and its impact
- Steps to reproduce, or a minimal proof of concept
- The commit or version you tested against, if you know it

You will get an acknowledgement, and the maintainer will work with
you on a fix and a disclosure timeline. Please give the project a
reasonable time to fix the issue before disclosing it publicly.

## Scope notes

- This bot handles Telegram messages and the demo dataset stored in
  LMDB. Reports about token handling, the AllowList
  (`DBCHAT_ALLOWED_IDS`), user-data storage (LMDB), or the structured
  query executor are in scope.
- The bot never sends data anywhere except the Telegram Bot API and the
  OpenAI API. A report that shows data leaving to any other destination
  is a serious finding.
- Never include real tokens, API keys, or other users' personal data
  in a report. Redact them before sending.
