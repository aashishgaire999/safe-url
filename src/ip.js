// Is an IP address safe for a server to connect to on a user's behalf?
// Allow-list thinking: an IPv4 address is public unless it's in a special
// range; an IPv6 address is public only if it's global unicast (2000::/3) and
// not one of the special blocks inside it. Addresses that wrap an IPv4
// address (mapped, NAT64, 6to4) are judged by the IPv4 address inside.

// [first address, prefix length] — RFC 6890 and friends.
const BLOCKED_V4 = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, including cloud metadata 169.254.169.254
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // old 6to4 relay
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, including broadcast 255.255.255.255
].map(([ip, bits]) => [toInt(parseIPv4(ip)), bits])

function toInt(parts) {
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

/** "192.168.1.1" → [192, 168, 1, 1], or null. Strict dotted-decimal only. */
export function parseIPv4(text) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text)
  if (!match) return null
  const parts = match.slice(1).map(Number)
  return parts.every((n) => n <= 255) ? parts : null
}

/** "2001:db8::1" or "[::ffff:10.0.0.1]" → eight 16-bit numbers, or null. */
export function parseIPv6(text) {
  let s = String(text).replace(/^\[|\]$/g, "").split("%")[0].toLowerCase()
  if (!s.includes(":")) return null
  // A trailing dotted IPv4 address becomes the last two groups.
  const dotted = /^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s)
  if (dotted) {
    const v4 = parseIPv4(dotted[2])
    if (!v4) return null
    s = `${dotted[1]}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`
  }
  const halves = s.split("::")
  if (halves.length > 2) return null
  const read = (part) => (part ? part.split(":") : [])
  const head = read(halves[0])
  const tail = halves.length === 2 ? read(halves[1]) : []
  const missing = 8 - head.length - tail.length
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail]
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null
  return groups.map((g) => parseInt(g, 16))
}

function v4IsPublic(parts) {
  const ip = toInt(parts)
  return !BLOCKED_V4.some(([base, bits]) => ((ip ^ base) >>> (32 - bits)) === 0)
}

function embeddedV4(h, from) {
  return [h[from] >> 8, h[from] & 0xff, h[from + 1] >> 8, h[from + 1] & 0xff]
}

function v6IsPublic(h) {
  const zeros = (from, to) => h.slice(from, to).every((x) => x === 0)
  // IPv4-mapped ::ffff:a.b.c.d and IPv4-compatible ::a.b.c.d
  if (zeros(0, 5) && (h[5] === 0xffff || h[5] === 0) && (h[6] || h[7])) return v4IsPublic(embeddedV4(h, 6))
  // NAT64 64:ff9b::/96 carries an IPv4 address; 64:ff9b:1::/48 is local-use
  if (h[0] === 0x64 && h[1] === 0xff9b) return zeros(2, 6) ? v4IsPublic(embeddedV4(h, 6)) : false
  // 6to4 2002::/16 carries an IPv4 address in the next 32 bits
  if (h[0] === 0x2002) return v4IsPublic(embeddedV4(h, 1))
  // Only global unicast 2000::/3 is reachable on the internet ...
  if ((h[0] & 0xe000) !== 0x2000) return false
  // ... minus these blocks inside it.
  if (h[0] === 0x2001) {
    if (h[1] === 0x0db8) return false // documentation
    if (h[1] < 0x0200) return false // Teredo 2001::/32, benchmarking, ORCHID and other IETF use (2001::/23)
  }
  if (h[0] === 0x3fff && h[1] < 0x1000) return false // documentation 3fff::/20
  return true
}

/**
 * True only for an IP address on the public internet. Anything that isn't a
 * valid IPv4 or IPv6 address is not public.
 */
export function isPublicAddress(address) {
  const text = String(address || "").trim()
  const v4 = parseIPv4(text)
  if (v4) return v4IsPublic(v4)
  const v6 = parseIPv6(text)
  return v6 ? v6IsPublic(v6) : false
}
