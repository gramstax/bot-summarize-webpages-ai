import {LmdbEnv, LmdbJobRun} from "@gramstax/lmdb"
import {LogHe} from "~/helpers/log"
import {SummaryRepository} from "./repositories/summary"
import {UserRepository} from "./repositories/user"
import {SummarySchema} from "./schema/summary"
import {UserSchema} from "./schema/user"

// Db is a plain class owned by BotCore as an instance field (`bot.db`),
// injected into ctx via createCtx. There is no static singleton
// (open/get/ensure/start/stop) — one BotCore = one env, and tests that
// build their own BotCore automatically get their own env without
// sharing global state.
export class Db extends LmdbEnv {
  /**
   * `maxDbs` is a slot budget, not a database count: every schema, every
   * `.unique()`/`.index()`, and the `__job_run` bookkeeping sub each take one.
   * The package reports through `onWarn` once fewer than 32 slots remain.
   */
  static readonly MAX_DBS = 32

  readonly user: UserRepository
  readonly summaries: SummaryRepository
  readonly jobRun: LmdbJobRun

  constructor(storePath: string) {
    super({
      path: storePath,
      maxDbs: Db.MAX_DBS,
      compression: true,
      encoding: `msgpack`,
      // @gramstax/lmdb writes nothing to console — it reports here instead, so
      // the application decides where diagnostics end up. With no listener
      // attached they are dropped, which is why a real app wires one up.
      onWarn: (message) => LogHe.warn(`[db] ${message}`),
    })
    this.user = new UserRepository(this.register(UserSchema))
    this.summaries = new SummaryRepository(this.register(SummarySchema))
    // Takes its `__job_run` slot eagerly, so construct it only because
    // something below actually schedules a job.
    this.jobRun = new LmdbJobRun(this)
  }

  /** Map pressure, for health checks and the status page. */
  usage() {
    return this.getMapSizeUsed()
  }
}
