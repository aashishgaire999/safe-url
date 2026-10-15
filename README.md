# safe-url

**Stop your server from being tricked into fetching private addresses.** Zero dependencies.

If your app fetches links that users give it (link previews, screenshots, webhooks, "import from URL"), someone can submit a link that points *inside* your network: your database, your admin panel, or the cloud metadata service that hands out credentials. This is **server-side request forgery (SSRF)**, and it's in the [OWASP Top 10](https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/).

Checking the link's text isn't enough. `https://127.0.0.1.nip.io/` looks like an ordinary domain but points at your own server. `safe-url` checks the text **and** the address your server actually connects to.

```js
import { checkUrl } from "@codyza/safe-url"          // anywhere: browser, edge, Node
import { safeFetch } from "@codyza/safe-url/node"    // Node servers

checkUrl("https://example.com/page#top")   // "https://example.com/page"
checkUrl("https://169.254.169.254/")       // null (cloud metadata)
checkUrl("https://2130706433/")            // null (127.0.0.1 in disguise)

const res = await safeFetch("https://example.com/")  // { status, headers, body, text() }
await safeFetch("https://127.0.0.1.nip.io/")         // throws: EPRIVATEADDRESS
```

## What it blocks

| Trick | Example | Caught by |
|---|---|---|
| Private and local addresses | `10.0.0.1`, `192.168.1.1`, `127.0.0.1`, `[::1]` | `checkUrl` |
| Cloud metadata | `169.254.169.254` | `checkUrl` |
| IPv4 in disguise | `2130706433`, `0x7f.0.0.1`, `0177.0.0.1`, `127.1` | `checkUrl` |
| IPv4 wrapped in IPv6 | `[::ffff:127.0.0.1]`, NAT64 `[64:ff9b::7f00:1]`, 6to4 `[2002:a00:1::]` | `checkUrl` |
| Local-only names | `localhost`, `intranet`, `printer.local`, `db.internal`, `router.home.arpa` | `checkUrl` |
| Reserved ranges | carrier-grade NAT, benchmarking, documentation, multicast | `checkUrl` |
| A normal name that resolves to a private address | `127.0.0.1.nip.io` | `safeFetch` / `publicLookup` |
| A name that changes its answer between check and connect (DNS rebinding) | | `safeFetch` / `publicLookup` (checked at connect time) |
| Redirects to private addresses | `302 → http://10.0.0.1/` | `safeFetch` (every hop re-checked) |
| Huge or slow responses | | `safeFetch` (size and time caps) |
| Credentials in links, other schemes, odd ports | `https://user:pw@…`, `file://`, `:8080` | `checkUrl` (ports and http allowed by option) |

IPv6 uses an allow-list: only global unicast (`2000::/3`) counts as public.

## API

### `checkUrl(value, options?)` → `string | null`
The normalised URL (without `#fragment`) if it's a safe public `https` link, otherwise `null`. No network access, so it works in the browser too. Options: `allowHttp`, `allowAnyPort`, `maxLength` (default 2048).

### `isPublicAddress(ip)` → `boolean`
True only for an IPv4 or IPv6 address on the public internet.

### `safeFetch(url, options?)` → `Promise<{ status, url, headers, body, text() }>` (from `/node`)
A GET that checks the URL, connects only to public addresses, re-checks every redirect, and caps time (`timeoutMs`, default 5000), redirects (`maxRedirects`, 3) and size (`maxBytes`, 1 MB). Errors have a `code`: `EUNSAFEURL`, `EPRIVATEADDRESS`, `ETOOMANYREDIRECTS`, `ETOOLARGE`, `ETIMEDOUT`.

### `publicLookup` (from `/node`)
A `lookup` function for Node's `http`, `https`, `net` or any `Agent`, if you'd rather use your own client:

```js
import https from "node:https"
import { publicLookup } from "@codyza/safe-url/node"

https.get(url, { lookup: publicLookup }, (res) => { /* ... */ })
const agent = new https.Agent({ lookup: publicLookup })
```

## Limits, honestly
- `checkUrl` only reads the URL. On a server, always connect through `safeFetch` or `publicLookup`, which check the real address.
- A proxy changes where connections go. If your server sends traffic through one, the proxy has to enforce this instead.
- This protects the connection, not what you do with the response. Still treat fetched content as untrusted.

## Why it exists
We built this for [Codyza](https://www.codyza.com), a volunteer community where people ship real software. Members submit links to their projects, and our server fetches them to make previews. We open-sourced the guard so other small teams don't have to learn SSRF the hard way.

## Development
```sh
npm test                    # offline tests
NETWORK_TESTS=1 npm test    # also tests real DNS and fetching
```
Node 18 or newer. Pull requests welcome; please add a test with any new case.

MIT © Codyza
