/**
 * Language resolution ONLY — this module carries NO user-facing strings.
 *
 * Strict rule (Damar 2026-11-19 ~14:43 WIB): a string dictionary file is FORBIDDEN.
 * Every user-facing message lives in a page's `static template` block
 * (`<g-message>` default EN + `<g-message lang="id">`, `<g-switch>`,
 * `<g-map>`, `<g-ifelse>` — skill gramstax-best-practices template
 * localization + logic rules; docs gramstax.mintlify.site; patterns copied
 * from `example/1-complex` in the gramstax repo). The template engine picks the
 * variant from the user's `language_code`; the stored `/language` choice
 * (`UserSchema.botLang`) is applied in `hookBeforeRoute` by overriding
 * `from.language_code` before templates render.
 *
 * The only thing that stays in code is this resolver: which of the two
 * supported languages (`en` | `id`) applies to this update. It returns a
 * language CODE, never a message.
 */
export type Lang = `en` | `id`

export function langOf(opts: {botLang?: unknown; telegramLang?: unknown}): Lang {
  // The typeof guard is REQUIRED, not paranoia: LMDB encoding is
  // positional, so a legacy row written before the botLang field existed
  // can read back as a non-string (e.g. a Date) — and calling
  // toLowerCase() on it throws a TypeError. A non-string value always
  // falls back to English and never crashes.
  const pick = (v?: unknown) => (typeof v === `string` && v.toLowerCase().startsWith(`id`) ? `id` : `en`)
  if (opts.botLang !== undefined) return pick(opts.botLang)
  return pick(opts.telegramLang)
}
