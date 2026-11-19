import type {LmdbEnvSub} from "@gramstax/lmdb"
import type {IUserProfile} from "~/types/user"
import type {UserSchema, IVUser} from "../schema/user"

export class UserRepository {
  constructor(private readonly _user: LmdbEnvSub<typeof UserSchema>) {}

  /**
   * Insert once, keyed by Telegram id.
   *
   * `putIfNotExists` reports whether *this* call won the write, so the loser
   * path reads the row back. Returning the object we just failed to write would
   * hand callers a row that was never stored.
   */
  async createIfNotExists(tgId: number, data: IUserProfile): Promise<{user: IVUser; created: boolean}> {
    const fresh = {...data, updatedAt: new Date()} as IVUser
    const created = await this._user.putIfNotExists(tgId, fresh)
    if (created) return {user: fresh, created}
    return {user: this._user.get(tgId) ?? fresh, created}
  }

  /**
   * Bump `updatedAt` on an existing row.
   *
   * Read-then-write, so it runs inside a transaction — without one a concurrent
   * writer can land between the read and the write and get silently clobbered.
   */
  async touch(tgId: number): Promise<boolean> {
    return this._user.owner.transaction(() => {
      const row = this._user.get(tgId)
      if (!row) return false
      this._user.putSync(tgId, {...row, updatedAt: new Date()})
      return true
    })
  }

  /** Sync read — LMDB point lookups are synchronous, no promise needed. */
  find(tgId: number): IVUser | undefined {
    return this._user.get(tgId)
  }

  /**
   * Rewrite a profile WITHOUT botLang — repair for legacy rows whose
   * positional fields shifted (botLang read back as a non-string because
   * the row was written before that field existed). The row is rewritten
   * with the current schema, so later reads are correct.
   */
  async rewriteProfile(tgId: number, profile: IUserProfile): Promise<void> {
    await this._user.put(tgId, {...profile, updatedAt: new Date()} as IVUser)
  }

  /**
   * Save the bot language preference ("en" | "id"); the row is created
   * when it does not exist yet.
   *
   * Read-then-write, so it runs inside a transaction like `touch` —
   * lmdb-best-practices (txn-transactions): get-then-put without a
   * transaction is a race, an interleaving writer can be silently
   * clobbered. The type narrows to the enum union, not a wide string.
   */
  async setBotLang(tgId: number, botLang: `en` | `id`, profile: IUserProfile): Promise<void> {
    // transaction() returns a Promise — it MUST be awaited, otherwise an
    // error (e.g. an enum rejection) becomes an unhandled rejection and
    // the caller believes the write committed when it did not.
    await this._user.owner.transaction(() => {
      const row = this._user.get(tgId)
      if (row) {
        this._user.putSync(tgId, {...row, botLang, updatedAt: new Date()})
        return
      }
      this._user.putSync(tgId, {...profile, botLang, updatedAt: new Date()} as IVUser)
    })
  }

  /** Total stored users — O(1) via `mdb_stat`, safe on a hot path. */
  count(): number {
    return this._user.count()
  }

  displayName(tgId: number): string {
    const row = this._user.get(tgId)
    if (!row) return `User#${tgId}`
    return row.firstName || row.username || `User#${tgId}`
  }
}
