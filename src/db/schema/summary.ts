import type {ValueOf} from "@gramstax/lmdb"
import {LmdbSchema, t} from "@gramstax/lmdb"

export type IVSummary = ValueOf<typeof SummarySchema>

/**
 * Recent summaries: one row per user holding the last 5 summaries
 * (url + title + summary) as JSON. The original flow has no memory
 * node — this is only a convenience history so /forget has something
 * real to erase and users can re-read a past summary.
 */
export class SummarySchema extends LmdbSchema {
  static db = `summaries`
  static key = t.number()
  static value = {
    summariesJson: t.string(),
    updatedAt: t.date().$defaultFn(() => new Date()),
  }
}
