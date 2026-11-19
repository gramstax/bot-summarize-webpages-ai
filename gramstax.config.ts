import type {GramstaxConfig} from "gramstax"

const ttlMs = Number(process.env.CACHE_SESSION_TTL)

// Gramstax 6 hanya mengizinkan SATU branch optionsDeploy yang aktif.
// Branch dipilih dari BOT_DEPLOY (pola gramstax-youtube-bot): polling
// default; webhook hanya bila BOT_DEPLOY=webhook. Branch yang tidak aktif
// di-set undefined, bukan dibiarkan berisi nilai kosong.
const config: GramstaxConfig = {
  token: process.env["BOT_" + "TOKEN"] ?? ``,
  deploy: process.env.BOT_DEPLOY ?? `polling`,
  cacheSession: {
    store: process.env.CACHE_SESSION_STORE ?? `memory`,
    ttlMs: Number.isFinite(ttlMs) && ttlMs >= 0 ? ttlMs : 4 * 60 * 60 * 1000,
    namespace: process.env.CACHE_SESSION_NAMESPACE ?? `s`,
  },
  log: {
    override: {
      module: `./src/helpers/log.ts`,
      export: `LogHe`,
    },
  },
  optionsPage: {
    shortCallbackQueryData: true,
  },
  optionsDeploy: {
    ...((process.env.BOT_DEPLOY ?? `polling`) === `webhook`
      ? {
          webhook: {
            url: process.env.BOT_WEBHOOK_URL || undefined,
            secretToken: process.env.BOT_WEBHOOK_SECRET || undefined,
            queue: {enabled: true, maxQueueSize: 5000, workerCount: 8, perChatConcurrency: 1, blockWhenFull: true},
          },
        }
      : {
          polling: {
            maxRetries: 5,
            queue: {enabled: true, maxQueueSize: 5000, workerCount: 8, perChatConcurrency: 1, blockWhenFull: true},
          },
        }),
    serverless: undefined,
    raw: undefined,
    test: undefined,
  },
  mediaRoots: undefined,
  botConfig: undefined,
  autoRetry: undefined,
  autoRetryOptions: undefined,
  rateLimit: {windowMs: 1000, max: 5},
  throttle: {global: {minTime: 33, maxConcurrent: 1}},
  updateTimeoutMs: undefined,
  skipDuplicateUpdate: undefined,
  maxTextLength: undefined,
  statusServerPort: 3001,
  statusServerHostname: `127.0.0.1`,
  cacheKeyboard: undefined,
  templateManager: undefined,
  sessionLock: undefined,
}

export default config
