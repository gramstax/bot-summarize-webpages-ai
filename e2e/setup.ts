import {join} from "node:path"
import {TemplateManager} from "gramstax"
import {BotCore} from "../src/core/bot"

// E2E env — REQUIRED before `new BotCore` (BotCore's `db` field reads
// DB_PATH at construction). Mock AI is on so no live OpenAI calls happen.
process.env.DB_PATH = `./data-e2e`
process.env.SUMMARIZE_MOCK_AI = `1`
process.env.OPENAI_API_KEY = ``
process.env.SUMMARIZE_ALLOWED_IDS = ``

export type {IE2eApiCall, IE2eUpdateOptions} from "gramstax"

export const bot = new BotCore({
  deploy: `test`,
  token: `test`,
  log: false,
  autoRetry: true,
  templateManager: new TemplateManager({
    path: [join(import.meta.dir, `../src/pages`)],
  }),
})
export const e2e = bot.e2e!

// One UNIQUE user.id block per test file — the bot instance + session
// store live in module scope and are shared by every file in one run
// (skill e2e-setup). A fixture without a username deliberately tests
// the bot without a username guard.
export const startUser = {user: {id: 9001, username: `sumuser`, language_code: `id`}}
export const startEnUser = {user: {id: 9002, username: `sumen`, language_code: `en`}}
export const helpUser = {user: {id: 4601, username: `helpuser`, language_code: `id`}}
export const helpEnUser = {user: {id: 4602, username: `helpen`, language_code: `en`}}
export const summarizeUser = {user: {id: 4401, username: `summarizeuser`, language_code: `id`}}
export const latestUser = {user: {id: 4403, username: `latestuser`, language_code: `id`}}
export const summarizeEnUser = {user: {id: 4402, username: `summarizeen`, language_code: `en`}}
export const latestEnUser = {user: {id: 4404, username: `latesten`, language_code: `en`}}
export const forgetUser = {user: {id: 4901, username: `forgetuser`, language_code: `id`}}
export const languageUser = {user: {id: 4902, username: `languser`, language_code: `en`}}
export const languageDefaultUser = {user: {id: 4903, username: `langdefault`, language_code: `en`}}
export const statusUser = {user: {id: 4951, username: `statususer`, language_code: `id`}}
export const coverageUser = {user: {id: 4952, username: `coverageuser`, language_code: `id`}}
export const deniedUser = {user: {id: 4999, username: `denieduser`, language_code: `id`}}
export const noUsernameUser = {user: {id: 4202, language_code: `id`}}
export const dbUser = {user: {id: 4101, username: `dbuser`, language_code: `id`}}

const FIXTURE_IDS = [9001, 9002, 4601, 4602, 4401, 4402, 4403, 4404, 4901, 4902, 4903, 4951, 4952, 4999, 4202, 4101]

/** Clear persistent fixture state (recent summaries) per test. */
export async function resetEnv(): Promise<void> {
  for (const id of FIXTURE_IDS) {
    await bot.db.summaries.clear(id)
  }
}
