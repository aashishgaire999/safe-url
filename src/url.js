import { isPublicAddress, parseIPv4, parseIPv6 } from "./ip.js"

// Names that only mean something inside a network, never on the internet.
const LOCAL_SUFFIXES = [".localhost", ".local", ".internal", ".intranet", ".lan", ".home.arpa", ".corp", ".localdomain"]

/**
 * Checks a link a user gave you before your server stores or fetches it.
 * Returns the normalised URL (without its #fragment), or null if it's unsafe.
 *
 * Works in the browser and on the server, with no network access, so it can
 * only judge what the URL says. A normal-looking name can still point at a
 * private address; on the server, connect with `safeFetch` or `publicLookup`
 * from "./node.js" to check where it really goes.
 *
 * @param {unknown} value
 * @param {{ allowHttp?: boolean, allowAnyPort?: boolean, maxLength?: number }} [options]
 */
export function checkUrl(value, options = {}) {
  const { allowHttp = false, allowAnyPort = false, maxLength = 2048 } = options
  if (typeof value !== "string" || value.length > maxLength) return null
  let url
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }
  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) return null
  if (url.username || url.password) return null
  if (url.port && !allowAnyPort) return null
  if (!isPublicHostname(url.hostname)) return null
  url.hash = ""
  return url.toString()
}

/**
 * Whether a hostname (as in `new URL(...).hostname`) may be on the public
 * internet: a public IP literal, or a dotted name that isn't a local-only name.
 * IPv4 written in other forms (decimal, hex, octal) is already turned into
 * dotted form by the URL parser.
 */
export function isPublicHostname(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/\.$/, "")
  if (!host) return false
  if (parseIPv4(host) || host.startsWith("[") || host.includes(":")) {
    return parseIPv4(host) ? isPublicAddress(host) : parseIPv6(host) ? isPublicAddress(host) : false
  }
  // A name that ends in a number isn't a real domain (e.g. "1.2.3" or "127.1").
  if (/\.\d+$/.test(host) || /^\d+$/.test(host)) return false
  if (!host.includes(".")) return false // single-label names like "intranet" resolve inside networks
  if (host === "localhost" || LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) return false
  return true
}
