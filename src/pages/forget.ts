import {PageBase} from "~/base/page"

/**
 * /forget — clear this user's recent summaries (max 5) from LMDB.
 *
 * The confirmation sentence lives in `static template` (EN default +
 * `lang="id"` variant). Strict rule (Damar 2026-11-19 ~14:43 WIB):
 * no string dictionary.
 */
export class ForgetPage extends PageBase {
  static data = this.buildData()

  async handleCommandText() {
    await this.gdefault.show()
  }

  helper = {}

  gdefault = {
    show: async () => {
      const userId = this.from?.id
      if (userId === undefined) return
      await this.db.summaries.clear(userId)
      await this.renderText({data: {}})
    },
    process: () => {},
  }

  static template = `
    <g-base>
      <g-description>Erase my recent summaries</g-description>
      <g-description lang="id">Hapus ringkasan terakhirmu</g-description>
      <g-message>Forgotten. Your recent summaries are erased — send a new URL whenever you are ready.</g-message>
      <g-message lang="id">Sudah dihapus. Ringkasan terakhirmu sudah terhapus — kirim URL baru kapan pun kamu siap.</g-message>
    </g-base>
  `
}
