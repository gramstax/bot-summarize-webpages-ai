import {Gramstax} from "gramstax"
import {Db} from "~/db"
import {LogHe} from "~/helpers/log"
import {AppConfig} from "~/lib/config"
import {StatusPage} from "~/pages/status"
import type {IErrorPageData} from "~/types/page"
import {CtxCore} from "./ctx"

// BotCore:
// - Db is owned as an instance field (`bot.db`), injected into ctx.
// - hookBeforeRoute: best-effort user registration (NO username guard —
//   many Telegram users have no username and must still be served)
//   + AllowList SUMMARIZE_ALLOWED_IDS. When the env is empty, everyone is
//   allowed (dev mode) with a one-time log warning.
// - hookAfterStart: restart-safe nightly-report schedule (LmdbJobRun).
export class BotCore extends Gramstax {
  db = new Db(process.env.DB_PATH ?? `./data`)

  private _job: {stop: () => void} | undefined
  private _allowWarned = false

  createCtx(ct: Parameters<Gramstax[`createCtx`]>[0]) {
    return new CtxCore(this.buildCtxParams(ct, {db: this.db}))
  }

  async hookAfterStart() {
    const db = this.db
    const handle = db.jobRun.start(`nightly-report`, {
      pattern: `0 3 * * *`,
      timezone: `Asia/Jakarta`,
      task: async () => {
        const usage = db.usage()
        LogHe.info(`[job] nightly-report users=${db.user.count()} map=${usage.used}/${usage.total}`)
      },
      onError: (err) => LogHe.errorMake(err, `Db`, `nightly-report`),
    })
    this._job = handle as unknown as {stop: () => void}
  }

  async hookBeforeRoute(ctx: CtxCore) {
    const from = ctx.from
    if (!from?.id) return true
    const profile = {
      username: from.username ?? ``,
      firstName: from.first_name ?? ``,
      lastName: from.last_name,
      languageCode: from.language_code,
    }
    try {
      const {user} = await ctx.db.user.createIfNotExists(from.id, profile)
      // Language preference: a stored botLang overrides the Telegram
      // client's language_code before templates render, so every page
      // (EN default / lang="id" variant) follows the user's choice.
      // A non-string botLang means the row was written before the field
      // existed — rewrite it with the current schema (repair), then
      // fall back to the client's language.
      const stored = user.botLang
      if (stored !== undefined && stored !== `en` && stored !== `id`) {
        await ctx.db.user.rewriteProfile(from.id, profile)
      } else if (stored === `en` || stored === `id`) {
        from.language_code = stored
      }
    } catch {
      // Registration must never fail the user's route.
    }
    const allowed = AppConfig.allowedIds()
    if (allowed.size === 0) {
      if (!this._allowWarned) {
        this._allowWarned = true
        LogHe.warn(`[summarize] SUMMARIZE_ALLOWED_IDS is empty — all users are allowed (dev mode)`)
      }
      return true
    }
    if (!allowed.has(from.id)) {
      try {
        // The denial sentence lives in the StatusPage template (EN default
        // + lang="id"), rendered in the user's language — never a hardcoded
        // string in this hook (strict rule, Damar 2026-11-19 ~14:43 WIB).
        await new StatusPage(ctx).gdenied.show()
      } catch {
        // Sending the denial failed — still reject the update.
      }
      return false
    }
    return true
  }

  async hookErrorPage(ctx: CtxCore, data: IErrorPageData) {
    await new StatusPage(ctx).gerror.show(`${data.listenerName}:hookErrorPage`, data.error)
  }

  async hookNotFoundPage(ctx: CtxCore) {
    await new StatusPage(ctx).gnotFound.show()
  }

  async stop() {
    try {
      await super.stop()
    } finally {
      this._job?.stop()
      this._job = undefined
      await this.db.close()
    }
  }
}
