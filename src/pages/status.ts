import {PageBase} from "~/base/page"
import {LogHe} from "~/helpers/log"
import {StartPage} from "./start"

class Base {
  static error = `e`
  static notFound = `nf`
  static denied = `d`
}

export class StatusPage extends PageBase {
  static data = this.buildData()
  constructorName?: string

  constructor(p: ConstructorParameters<typeof PageBase>[0]) {
    super(p)
    this.constructorName = p?.constructor?.name
  }

  helper = {}
  gerror = {
    show: async (funcName: string, error: Error | unknown) => {
      LogHe.errorMake(error, this.constructorName, funcName)

      await this.clearSession()
      await this.renderText({AGBaseId: Base.error, keyboard: this.inlineKeyboardT([StartPage], `1`, Base.error)})
    },
    process: () => {}
  }
  gnotFound = {
    show: async () => {
      await this.renderText({AGBaseId: Base.notFound, keyboard: this.inlineKeyboardT([StartPage], `1`, Base.notFound)})
    },
    process: () => {}
  }
  /**
   * AllowList denial, rendered from the hook (BotCore.hookBeforeRoute).
   * The sentence lives in the template below (EN default + lang="id") —
   * the hook never holds a hardcoded denial string (strict rule, Damar
   * 2026-11-19 ~14:43 WIB: no string dictionary). No keyboard: a denied user
   * cannot open Start anyway.
   */
  gdenied = {
    show: async () => {
      await this.renderText({AGBaseId: Base.denied})
    },
    process: () => {}
  }

  static template = `
    <g-base id="${Base.error}">
      ${this.kbk.home()}
      <g-message>
        ❌ Something went wrong while processing your request. Please try again.
      </g-message>
      <g-message lang="id">
        ❌ Terjadi kesalahan saat memproses permintaan. Silakan coba lagi.
      </g-message>
    </g-base>
    
    <g-base id="${Base.notFound}">
      ${this.kbk.home()}
      <g-message>
        <b>🔎 Route Not Found</b>

        The requested route does not exist or is unavailable.
      </g-message>
      <g-message lang="id">
        <b>🔎 Rute Tidak Ditemukan</b>

        Rute yang diminta tidak tersedia atau tidak ada.
      </g-message>
    </g-base>

    <g-base id="${Base.denied}">
      <g-message>
        Sorry, this bot only serves allowed users.
      </g-message>
      <g-message lang="id">
        Maaf, bot ini hanya melayani pengguna yang diizinkan.
      </g-message>
    </g-base>
  `
}
