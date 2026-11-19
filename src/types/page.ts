import type {Gramstax} from "gramstax"

/** Data Gramstax passes to `hookErrorPage`. */
export type IErrorPageData = NonNullable<Parameters<NonNullable<Gramstax[`hookErrorPage`]>>[1]>
