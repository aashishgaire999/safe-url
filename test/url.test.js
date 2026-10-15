import { test } from "node:test"
import assert from "node:assert/strict"
import { checkUrl } from "../src/index.js"

test("blocks links that point inside a network", () => {
  for (const url of [
    "https://localhost/", "https://127.0.0.1/", "https://2130706433/", "https://0x7f.0.0.1/", "https://0177.0.0.1/", "https://127.1/",
    "https://169.254.169.254/latest/meta-data", "https://[::1]/", "https://[::ffff:127.0.0.1]/", "https://[64:ff9b::7f00:1]/",
    "https://[2002:a00:1::]/", "https://intranet/", "https://printer.local/", "https://db.internal/", "https://app.localhost/",
    "https://router.home.arpa/", "https://198.18.0.1/", "https://10.0.0.1./",
  ]) assert.equal(checkUrl(url), null, url)
})

test("blocks other schemes, credentials, ports and junk by default", () => {
  for (const url of ["http://example.com/", "file:///etc/passwd", "ftp://example.com/", "javascript:alert(1)", "https://user:pw@example.com/",
    "https://example.com:8080/", "not a url", "", 42, null, `https://example.com/${"a".repeat(3000)}`]) assert.equal(checkUrl(url), null, String(url))
})

test("allows normal public links and drops the #fragment", () => {
  assert.equal(checkUrl("https://example.com/page?x=1#top"), "https://example.com/page?x=1")
  assert.equal(checkUrl(" https://sub.example.co.uk/ "), "https://sub.example.co.uk/")
  assert.equal(checkUrl("https://1.1.1.1/"), "https://1.1.1.1/")
  assert.equal(checkUrl("https://[2606:4700:4700::1111]/"), "https://[2606:4700:4700::1111]/")
})

test("options: http and ports only when asked", () => {
  assert.equal(checkUrl("http://example.com/", { allowHttp: true }), "http://example.com/")
  assert.equal(checkUrl("https://example.com:8443/", { allowAnyPort: true }), "https://example.com:8443/")
  assert.equal(checkUrl("http://127.0.0.1/", { allowHttp: true }), null)
})
