import type { LookupFunction } from "node:net"
import type { IncomingHttpHeaders } from "node:http"
import type { CheckUrlOptions } from "./index.js"

/** A `lookup` for Node's http/https/net that refuses private addresses at connect time. */
export const publicLookup: LookupFunction

export type SafeFetchOptions = Pick<CheckUrlOptions, "allowHttp" | "allowAnyPort"> & {
  /** Total time for all redirects. Default 5000 ms. */
  timeoutMs?: number
  /** Default 3. */
  maxRedirects?: number
  /** Largest body read. Default 1,000,000 bytes. */
  maxBytes?: number
  headers?: Record<string, string>
}
export type SafeResponse = { status: number; url: string; headers: IncomingHttpHeaders; body: Buffer; text(): string }
/** GET a user-supplied URL from a server without reaching private networks. */
export function safeFetch(url: string, options?: SafeFetchOptions): Promise<SafeResponse>
