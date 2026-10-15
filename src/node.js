import dns from "node:dns"
import http from "node:http"
import https from "node:https"
import { isPublicAddress } from "./ip.js"
import { checkUrl } from "./url.js"

/**
 * A drop-in `lookup` for Node's http, https and net (and any Agent) that only
 * lets a connection go to public addresses. The check happens at the moment
 * of connecting, on the address actually used, so a name can't pass a check
 * and then switch to a private address (DNS rebinding).
 *
 *   https.get(url, { lookup: publicLookup }, ...)
 *   new https.Agent({ lookup: publicLookup })
 */
export function publicLookup(hostname, options, callback) {
  if (typeof options === "function") [callback, options] = [options, {}]
  const opts = typeof options === "number" ? { family: options } : { ...options }
  dns.lookup(hostname, { ...opts, all: true }, (error, addresses) => {
    if (error) return callback(error)
    const blocked = addresses.find((entry) => !isPublicAddress(entry.address))
    if (blocked || !addresses.length) {
      const refused = new Error(`Refused to connect to ${hostname}: it points to a private address`)
      refused.code = "EPRIVATEADDRESS"
      return callback(refused)
    }
    if (opts.all) return callback(null, addresses)
    callback(null, addresses[0].address, addresses[0].family)
  })
}

/**
 * Fetches a user-supplied URL safely from a server: the URL is checked, every
 * connection goes through `publicLookup`, each redirect is checked again, and
 * time and size are capped. Resolves to { status, url, headers, body, text() }.
 *
 * @param {string} url
 * @param {{ timeoutMs?: number, maxRedirects?: number, maxBytes?: number, headers?: Record<string, string>, allowHttp?: boolean, allowAnyPort?: boolean }} [options]
 */
export async function safeFetch(url, options = {}) {
  const { timeoutMs = 5000, maxRedirects = 3, maxBytes = 1_000_000, headers = {}, allowHttp = false, allowAnyPort = false } = options
  const deadline = Date.now() + timeoutMs
  let current = checkUrl(url, { allowHttp, allowAnyPort })
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (!current) throw Object.assign(new Error("Refused: not a safe public URL"), { code: "EUNSAFEURL" })
    const response = await request(current, { headers, maxBytes, timeoutMs: Math.max(1, deadline - Date.now()) })
    const location = response.status >= 300 && response.status < 400 ? response.headers.location : undefined
    if (!location) return response
    current = checkUrl(new URL(String(location), current).toString(), { allowHttp, allowAnyPort })
  }
  throw Object.assign(new Error("Refused: too many redirects"), { code: "ETOOMANYREDIRECTS" })
}

function request(url, { headers, maxBytes, timeoutMs }) {
  const client = url.startsWith("http:") ? http : https
  return new Promise((resolve, reject) => {
    const req = client.get(url, { headers, lookup: publicLookup, timeout: timeoutMs }, (res) => {
      const chunks = []
      let size = 0
      res.on("data", (chunk) => {
        size += chunk.length
        if (size > maxBytes) {
          req.destroy(Object.assign(new Error("Refused: response too large"), { code: "ETOOLARGE" }))
          return
        }
        chunks.push(chunk)
      })
      res.on("end", () => {
        const body = Buffer.concat(chunks)
        resolve({ status: res.statusCode || 0, url, headers: res.headers, body, text: () => body.toString("utf8") })
      })
      res.on("error", reject)
    })
    const timer = setTimeout(() => req.destroy(Object.assign(new Error("Refused: timed out"), { code: "ETIMEDOUT" })), timeoutMs)
    req.on("timeout", () => req.destroy(Object.assign(new Error("Refused: timed out"), { code: "ETIMEDOUT" })))
    req.on("error", reject)
    req.on("close", () => clearTimeout(timer))
  })
}
