import type {LmdbEnvSub} from "@gramstax/lmdb"
import type {ISummary} from "~/types/summarize"
import type {IVSummary, SummarySchema} from "../schema/summary"

/** Recent summaries: the last 5 per user, newest first. */
export const SUMMARIES_MAX = 5

export class SummaryRepository {
  constructor(private readonly _sub: LmdbEnvSub<typeof SummarySchema>) {}

  list(userId: number): ISummary[] {
    const row = this._sub.get(userId)
    if (!row) return []
    try {
      const parsed = JSON.parse(row.summariesJson) as ISummary[]
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  /** Add one summary, keep only the newest 5. Read-then-write in a transaction. */
  async add(userId: number, summary: ISummary): Promise<ISummary[]> {
    return this._sub.owner.transaction(() => {
      const kept = [summary, ...this.list(userId)].slice(0, SUMMARIES_MAX)
      this.saveSync(userId, kept)
      return kept
    })
  }

  async clear(userId: number): Promise<void> {
    await this._sub.owner.transaction(() => {
      this.saveSync(userId, [])
    })
  }

  private saveSync(userId: number, summaries: ISummary[]): void {
    const row = {summariesJson: JSON.stringify(summaries), updatedAt: new Date()} as IVSummary
    this._sub.putSync(userId, row)
  }
}
