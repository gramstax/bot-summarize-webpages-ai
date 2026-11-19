import {PageBase} from "~/base/page"
import {Summarizer, type ISummarizeResult} from "~/lib/summarizer"

/**
 * SummarizePage — /summarize <url> + free-text URL: scrape the webpage,
 * split its text into 6000-char chunks, summarize each chunk, combine
 * them into one final summary, and return the page title + summary.
 *
 * - handleCommandText: /summarize without an argument -> prompt state.
 * - handleCommandArgsText: /summarize <url> -> full summary.
 * - handleFreeText: a bare URL in chat -> full summary; anything else
 *   -> prompt state (this bot only understands URLs).
 * - handleCallbackQueryData: the Summarize button on /start -> prompt.
 *
 * All words live in `static template` (EN default + `lang="id"`
 * variant): one flat `<g-switch value="state">` for the non-ok states,
 * plus the `summary` base that sends the result in chunks (Telegram
 * caps a message at 4096 chars). The page only computes data (state,
 * code, chunks). Strict rule (Damar 2026-11-19 ~14:43 WIB): no string
 * dictionary.
 */
class Base {
  static summary = `summary`
}

export class SummarizePage extends PageBase {
  static data = this.buildData()

  async handleCommandText() {
    await this.gsummarize.showPrompt()
  }

  async handleCommandArgsText() {
    await this.gsummarize.process(this.msgTextCommandArgs.join(` `))
  }

  async handleFreeText() {
    const text = this.msg?.text ?? ``
    if (!text || text.startsWith(`/`)) return
    if (/^https?:\/\//i.test(text.trim())) {
      await this.gsummarize.process(text)
      return
    }
    await this.gsummarize.showPrompt()
  }

  async handleCallbackQueryData() {
    await this.gsummarize.showPrompt()
  }

  helper = {
    typing: async () => {
      try {
        const chatId = this.chat?.id ?? this.from?.id
        if (chatId !== undefined) await this.api.sendChatAction(chatId, `typing`)
      } catch {
        // The typing indicator is cosmetic — the answer still goes through without it.
      }
    },

    /** Send one finished summary: title + summary in chunks. */
    sendResult: async (result: ISummarizeResult) => {
      const userId = this.from?.id
      if (userId !== undefined && result.kind === `ok`) {
        await this.db.summaries.add(userId, Summarizer.toSummary(result))
      }
      const title = result.title !== `` ? result.title : result.host
      const chunks = Summarizer.splitText(result.summary)
      for (let i = 0; i < chunks.length; i++) {
        await this.renderText({
          AGBaseId: Base.summary,
          data: {
            heading: i === 0 ? title : ``,
            summary: chunks[i] ?? ``,
            url: i === chunks.length - 1 ? result.url : ``,
          },
        })
      }
    },

    /** Render a non-ok state (prompt / invalid / fetch-error / ai-error). */
    sendState: async (state: string, url: string, code: string) => {
      await this.renderText({data: {state, url, code}})
    },
  }

  gsummarize = {
    showPrompt: async () => {
      await this.helper.sendState(`prompt`, ``, ``)
    },

    process: async (rawUrl: string) => {
      const userId = this.from?.id
      if (userId === undefined) return
      await this.helper.typing()
      const result = await Summarizer.summarize(rawUrl)
      if (result.kind !== `ok`) {
        await this.helper.sendState(result.kind, result.url, result.code ?? ``)
        return
      }
      await this.helper.sendResult(result)
    },
  }

  static template = `
    <g-base>
      <g-description>Summarize a webpage URL</g-description>
      <g-description lang="id">Ringkas URL halaman web</g-description>
      <g-message>
        <g-switch value="state">
          <g-case is="prompt"><b>📝 Summarize a webpage</b>

Send me a webpage URL and I will read it and give you a clear summary.

Example: /summarize https://www.paulgraham.com/greatwork.html
Or just paste the URL here.</g-case>
          <g-case is="invalid">That does not look like a public web address. Send a full URL starting with https:// — for example /summarize https://example.com</g-case>
          <g-case is="fetch-error">I could not open that page ({{code}}). Check the URL and that the site is public, then try again.</g-case>
          <g-case is="ai-error">The AI could not finish the summary right now. Please try again in a moment.</g-case>
          <g-default>Sorry, something went wrong while I was processing your message. Please try again in a moment.</g-default>
        </g-switch>
      </g-message>
      <g-message lang="id">
        <g-switch value="state">
          <g-case is="prompt"><b>📝 Ringkas halaman web</b>

Kirim URL halaman web dan aku akan membacanya lalu memberi ringkasan yang jelas.

Contoh: /summarize https://www.paulgraham.com/greatwork.html
Atau tempel saja URL-nya di sini.</g-case>
          <g-case is="invalid">Itu bukan alamat web publik. Kirim URL lengkap yang diawali https:// — contoh: /summarize https://example.com</g-case>
          <g-case is="fetch-error">Aku tidak bisa membuka halaman itu ({{code}}). Periksa URL-nya dan pastikan situsnya publik, lalu coba lagi.</g-case>
          <g-case is="ai-error">AI tidak bisa menyelesaikan ringkasan sekarang. Silakan coba lagi sebentar lagi.</g-case>
          <g-default>Maaf, ada yang salah saat aku memproses pesanmu. Coba lagi sebentar lagi ya.</g-default>
        </g-switch>
      </g-message>
    </g-base>

    <g-base id="${Base.summary}">
      <g-message><g-ifelse>heading ? '📝 Summary — ' + heading + '\\n\\n' : ''</g-ifelse>{{summary}}<g-ifelse>url ? '\\n\\n' + url : ''</g-ifelse></g-message>
      <g-message lang="id"><g-ifelse>heading ? '📝 Ringkasan — ' + heading + '\\n\\n' : ''</g-ifelse>{{summary}}<g-ifelse>url ? '\\n\\n' + url : ''</g-ifelse></g-message>
    </g-base>
  `
}
