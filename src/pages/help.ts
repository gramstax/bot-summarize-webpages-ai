import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class HelpPage extends PageBase {
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
      await this.renderText({mode: `auto`, keyboard: this.inlineKeyboardT([StartPage])})
    },
    process: () => {},
  }

  static template = `
    <g-base>
      <g-description>Full help and command list</g-description>
      <g-description lang="id">Bantuan lengkap dan daftar perintah</g-description>
      ${this.kbk.back()}
      <g-message>
        <b>🆘 Help — Page Summary</b>

        <b>How it works</b>
        Send a webpage URL — in English or Indonesian — and I will fetch
        the page, read it in 6000-character pieces, summarize each piece,
        and combine them into one clear summary. I only ever read public
        pages; I never change anything on them.

        <b>Examples</b>
        /summarize https://www.paulgraham.com/greatwork.html
        https://example.com
        /latest — the latest 3 Paul Graham essays, summarized one by one

        <b>Commands</b>
        All commands are in English. Replies are bilingual — English by
        default, Indonesian when you pick it with /language.
        /start — introduction &amp; main menu
        /summarize &lt;url&gt; — summarize a webpage
        /latest — summarize the latest 3 Paul Graham essays
        /language — switch language (English / Indonesia)
        /forget — erase my recent summaries
        /help — this page

        <b>HTTP endpoint</b>
        The same summary is available over HTTP — see README for the
        POST /summarize endpoint.

        <b>What to set up so every feature works</b>
        • OPENAI_API_KEY — for AI summaries (default model gpt-4o-mini).
          Without it I still run, but summaries come from simple mode.
          Any OpenAI-compatible API works — set OPENAI_BASE_URL and
          OPENAI_MODEL in .env (a free provider works too, see README).
        • Only public http/https pages can be summarized. Private,
        localhost, and internal addresses are refused on purpose.
      </g-message>
      <g-message lang="id">
        <b>🆘 Bantuan — Page Summary</b>

        <b>Cara kerja</b>
        Kirim URL halaman web — pakai bahasa Inggris atau Indonesia — dan
        aku akan mengambil halamannya, membacanya per bagian 6000 karakter,
        meringkas tiap bagian, lalu menggabungkannya menjadi satu ringkasan
        yang jelas. Aku hanya membaca halaman publik; aku tidak pernah
        mengubah apa pun di sana.

        <b>Contoh</b>
        /summarize https://www.paulgraham.com/greatwork.html
        https://example.com
        /latest — 3 esai terbaru Paul Graham, diringkas satu per satu

        <b>Perintah</b>
        Semua perintah memakai bahasa Inggris. Balasannya bilingual —
        bahasa Inggris sebagai default, bahasa Indonesia kalau kamu pilih
        lewat /language.
        /start — perkenalan &amp; menu utama
        /summarize &lt;url&gt; — ringkas sebuah halaman web
        /latest — ringkas 3 esai terbaru Paul Graham
        /language — ganti bahasa (English / Indonesia)
        /forget — hapus ringkasan terakhirmu
        /help — halaman ini

        <b>Endpoint HTTP</b>
        Ringkasan yang sama tersedia lewat HTTP — lihat README untuk
        endpoint POST /summarize.

        <b>Yang perlu disiapkan supaya semua fitur jalan</b>
        • OPENAI_API_KEY — untuk ringkasan AI (model default gpt-4o-mini).
          Tanpa ini aku tetap jalan, tapi ringkasannya dari mode sederhana.
          API apa pun yang kompatibel dengan OpenAI bisa dipakai — atur
          OPENAI_BASE_URL dan OPENAI_MODEL di .env (provider gratis pun
          bisa, lihat README).
        • Hanya halaman http/https publik yang bisa diringkas. Alamat
          privat, localhost, dan internal sengaja ditolak.
      </g-message>
    </g-base>
  `
}
