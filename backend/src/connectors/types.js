/**
 * Source connector contract. Every provider (news, social, forum, filings,
 * derived) implements this so the ingestion pipeline treats them identically.
 * Adding a source never touches the pipeline or serving code.
 *
 * @typedef {Object} FetchContext
 * @property {import("../services/assetService").AssetConfig} asset  resolved asset config
 * @property {Date}   since   only return documents at or after this time
 * @property {number} limit   soft cap on documents to return
 *
 * @typedef {Object} ConnectorDoc  raw connector output, pre-normalization
 * @property {string}  text            required — headline / post body
 * @property {string} [title]
 * @property {string} [url]
 * @property {string} [external_id]
 * @property {Date|string} [published_at]
 * @property {string} [author_handle]
 * @property {number} [author_followers]
 * @property {Object} [engagement]     {likes, shares, comments, upvotes, views}
 * @property {Object} [provider_meta]
 *
 * @typedef {Object} SourceConnector
 * @property {string}  id               stable id, e.g. "newsapi"
 * @property {"news"|"social"|"forum"|"filing"|"derived"} sourceType
 * @property {number}  cadenceSeconds   how often the scheduler should poll
 * @property {boolean} enabled          resolved from env/config at load time
 * @property {(ctx: FetchContext) => Promise<ConnectorDoc[]>} fetch
 * @property {() => Promise<{ ok: boolean, detail?: string }>} healthcheck
 */

module.exports = {};
