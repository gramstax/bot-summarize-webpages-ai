import {BlockGKeyboard, LabelGKeyboard} from "gramstax"

/**
 * KeyboardGBlock — the ONE place multi-language keyboards are defined.
 *
 * Strict rule (Damar 2026-11-19 ~14:58 WIB): a keyboard's labels are
 * written ONCE here, as one `{default, id}` object per keyboard. The
 * framework's `_build` emits both `<g-keyboard>` variants (default EN +
 * `lang="id"`) from that single definition, so no page template ever
 * writes `<g-keyboard>` twice for the two languages.
 *
 * Pages use the builders inside their `static template`:
 *   `${this.kbk.mainMenu()}` / `${this.kbk.languagePicker()}`
 * The template supplies the LABELS per language; the page handler wires
 * each label position to its callback via `inlineKeyboardT(...)` /
 * `inlineKeyboard(...)` — labels and routing stay separate.
 */
export class KeyboardGBlock extends BlockGKeyboard {
  static label = class extends LabelGKeyboard {
    static home = {default: `🏠 Home`, id: `🏠 Beranda`}
    static back = {default: `⬅️ Back`, id: `⬅️ Kembali`}
    static cancel = {default: `✖️ Cancel`, id: `✖️ Batal`}
    static backHome = {
      default: `${this.back.default}, ${this.home.default}`,
      id: `${this.back.id}, ${this.home.id}`
    }
    static mainMenu = {
      default: `📝 Summarize, 📰 Latest, 🌐 Language, 🆘 Help`,
      id: `📝 Ringkas, 📰 Terbaru, 🌐 Bahasa, 🆘 Bantuan`
    }
    static languagePicker = {
      default: `🇬🇧 English, 🇮🇩 Indonesia, ⬅️ Back`,
      id: `🇬🇧 English, 🇮🇩 Indonesia, ⬅️ Kembali`
    }
  }
  static home = (lang?: string, type?: string) => this._build(`home`, lang, type)
  static back = (lang?: string, type?: string) => this._build(`back`, lang, type)
  static cancel = (lang?: string, type?: string) => this._build(`cancel`, lang, type)
  static backHome = (lang?: string, type?: string) => this._build(`backHome`, lang, type)
  static mainMenu = (lang?: string, type?: string) => this._build(`mainMenu`, lang, type)
  static languagePicker = (lang?: string, type?: string) => this._build(`languagePicker`, lang, type)
}
