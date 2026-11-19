import {PageBase} from "~/base/page"
import {HelpPage} from "../help"
import {LanguagePage} from "../language"
import {LatestPage} from "../latest"
import {SummarizePage} from "../summarize"

export class StartPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  async handleCommandText() {
    await this.gdefault.show()
  }

  helper = {}
  gdefault = {
    show: async () => {
      await this.clearSession()
      await this.renderText({
        mode: `auto`,
        keyboard: this.inlineKeyboardT([SummarizePage, LatestPage, LanguagePage, HelpPage], `2`),
        data: {userName: this.from?.username ?? this.from?.first_name ?? `you`},
      })
    },
    process: () => {},
  }

  static template = `
    <g-base>
      <g-description>Introduction and main menu</g-description>
      <g-description lang="id">Perkenalan dan menu utama</g-description>
      ${this.kbk.mainMenu()}
      <g-message>
        <b>👋 Hello {{userName}}, I'm Page Summary!</b>

        Send me any webpage URL and I will read it — in English or
        Indonesian — and give you a clear, faithful summary. Long pages
        are read in pieces and combined, so nothing important is skipped.

        <b>Try it:</b>
        /summarize https://www.paulgraham.com/greatwork.html
        Or just paste any webpage URL here.

        <b>Commands:</b>
        /summarize &lt;url&gt; — summarize a webpage
        /latest — summarize the latest 3 Paul Graham essays
        /language — switch language (English / Indonesia)
        /forget — erase my recent summaries
        /help — full help
      </g-message>
      <g-message lang="id">
        <b>👋 Halo {{userName}}, aku Page Summary!</b>

        Kirim URL halaman web apa pun dan aku akan membacanya — pakai
        bahasa Inggris atau Indonesia — lalu memberi ringkasan yang jelas
        dan setia pada isinya. Halaman panjang dibaca per bagian lalu
        digabung, jadi tidak ada hal penting yang terlewat.

        <b>Coba:</b>
        /summarize https://www.paulgraham.com/greatwork.html
        Atau tempel saja URL halaman web apa pun di sini.

        <b>Perintah:</b>
        /summarize &lt;url&gt; — ringkas sebuah halaman web
        /latest — ringkas 3 esai terbaru Paul Graham
        /language — ganti bahasa (English / Indonesia)
        /forget — hapus ringkasan terakhirmu
        /help — bantuan lengkap
      </g-message>
    </g-base>
  `
}
