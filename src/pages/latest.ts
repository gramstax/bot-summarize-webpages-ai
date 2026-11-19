import {PageBase} from "~/base/page"
import {Summarizer, type ILatestResult, type ISummarizeResult} from "~/lib/summarizer"

/**
 * LatestPage — /latest: the original workflow's demo, kept as a command.
 * Fetch the Paul Graham articles list, take the first 3 essays, and
 * summarize each one (title + summary + URL). Essays that fail are
 * counted and reported honestly — never hidden, never faked.
 *
 * - handleCommandText: /latest -> run the list pipeline at once.
 * - handleCallbackQueryData: the Latest button on /start -> same run.
 *
 * All words live in `static template` (EN default + `lang="id"`
 * variant). The page only computes data (state, code, chunks, failed
 * count). Strict rule (Damar 2026-11-19 ~14:43 WIB): no string
 * dictionary.
 */
class Base {
  static essay = `essay`
}

export class LatestPage extends PageBase {
  static data = this.buildData()

  async handleCommandText() {
    await this.glatest.process()
  }

  async handleCallbackQueryData() {
    await this.glatest.process()
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

    /** Send one essay: title + summary in chunks, then the source URL. */
    sendEssay: async (result: ISummarizeResult) => {
      const userId = this.from?.id
      if (userId !== undefined && result.kind === `ok`) {
        await this.db.summaries.add(userId, Summarizer.toSummary(result))
      }
      const title = result.title !== `` ? result.title : result.host
      const chunks = Summarizer.splitText(result.summary)
      for (let i = 0; i < chunks.length; i++) {
        await this.renderText({
          AGBaseId: Base.essay,
          data: {
            heading: i === 0 ? title : ``,
            summary: chunks[i] ?? ``,
            url: i === chunks.length - 1 ? result.url : ``,
          },
        })
      }
    },

    /** Render a non-ok state (invalid / fetch-error / ai-error / partial). */
    sendState: async (state: string, code: string, failed: number) => {
      await this.renderText({data: {state, code, failed}})
    },
  }

  glatest = {
    process: async () => {
      const userId = this.from?.id
      if (userId === undefined) return
      await this.helper.typing()
      const result: ILatestResult = await Summarizer.latest()
      if (result.kind !== `ok`) {
        await this.helper.sendState(result.kind, result.code ?? ``, result.failed)
        return
      }
      for (const item of result.items) {
        await this.helper.sendEssay(item)
      }
      if (result.failed > 0) {
        await this.helper.sendState(`partial`, ``, result.failed)
      }
    },
  }

  static template = `
    <g-base>
      <g-description>Summarize the latest 3 Paul Graham essays</g-description>
      <g-description lang="id">Ringkas 3 esai terbaru Paul Graham</g-description>
      <g-message>
        <g-switch value="state">
          <g-case is="invalid">That does not look like a public web address. Try again in a moment.</g-case>
          <g-case is="fetch-error">I could not open the articles list ({{code}}). Please try again in a moment.</g-case>
          <g-case is="ai-error">The AI could not finish the summaries right now. Please try again in a moment.</g-case>
          <g-case is="partial">⚠️ {{failed}} essays could not be summarized, so this list is shorter than 3.</g-case>
          <g-default>Sorry, something went wrong while I was processing your message. Please try again in a moment.</g-default>
        </g-switch>
      </g-message>
      <g-message lang="id">
        <g-switch value="state">
          <g-case is="invalid">Itu bukan alamat web publik. Coba lagi sebentar lagi.</g-case>
          <g-case is="fetch-error">Aku tidak bisa membuka daftar artikel ({{code}}). Silakan coba lagi sebentar lagi.</g-case>
          <g-case is="ai-error">AI tidak bisa menyelesaikan ringkasan sekarang. Silakan coba lagi sebentar lagi.</g-case>
          <g-case is="partial">⚠️ {{failed}} esai tidak bisa diringkas, jadi daftar ini lebih pendek dari 3.</g-case>
          <g-default>Maaf, ada yang salah saat aku memproses pesanmu. Coba lagi sebentar lagi ya.</g-default>
        </g-switch>
      </g-message>
    </g-base>

    <g-base id="${Base.essay}">
      <g-message><g-ifelse>heading ? '📰 ' + heading + '\\n\\n' : ''</g-ifelse>{{summary}}<g-ifelse>url ? '\\n\\n' + url : ''</g-ifelse></g-message>
      <g-message lang="id"><g-ifelse>heading ? '📰 ' + heading + '\\n\\n' : ''</g-ifelse>{{summary}}<g-ifelse>url ? '\\n\\n' + url : ''</g-ifelse></g-message>
    </g-base>
  `
}
