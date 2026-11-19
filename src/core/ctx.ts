import {Ctx} from "gramstax"
import type {Db} from "~/db"

// Shared context untuk semua page — pola gramstax-youtube-bot: BotCore
// memiliki Db sebagai field instance (bukan singleton statis) dan
// menyuntikkannya ke setiap ctx lewat createCtx, sehingga page mengakses
// store lewat `this.db`.
export class CtxCore extends Ctx {
  db: Db

  constructor(params: ConstructorParameters<typeof Ctx>[0] & {db: Db}) {
    super({...params})
    this.db = params.db
  }
}
