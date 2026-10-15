import { test } from "node:test"
import assert from "node:assert/strict"
import http from "node:http"
import { publicLookup, safeFetch } from "../src/node.js"

test("publicLookup refuses a name that resolves to a private address", async () => {
  const error = await new Promise((resolve) => publicLookup("localhost", {}, (err) => resolve(err)))
  assert.equal(error?.code, "EPRIVATEADDRESS")
})

test("a real connection to a name pointing at this machine is refused at connect time", async (t) => {
  // A server on this machine that must never be reached.
  let reached = false
  const server = http.createServer((_, res) => { reached = true; res.end("secret") })
  t.after(() => server.close())
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const { port } = server.address()
  // Straight through Node's http with publicLookup: the name resolves to 127.0.0.1 and is refused.
  const error = await new Promise((resolve) => {
    const req = http.get({ host: "localhost", port, lookup: publicLookup }, () => resolve(null))
    req.on("error", resolve)
  })
  assert.equal(error?.code, "EPRIVATEADDRESS")
  // safeFetch refuses both the name and the raw address before connecting.
  await assert.rejects(safeFetch(`http://localhost:${port}/`, { allowHttp: true, allowAnyPort: true }), { code: "EUNSAFEURL" })
  await assert.rejects(safeFetch(`http://127.0.0.1:${port}/`, { allowHttp: true, allowAnyPort: true }), { code: "EUNSAFEURL" })
  assert.equal(reached, false)
})

test("unsafe URLs are refused before any connection", async () => {
  await assert.rejects(safeFetch("https://169.254.169.254/latest/meta-data"), { code: "EUNSAFEURL" })
  await assert.rejects(safeFetch("file:///etc/passwd"), { code: "EUNSAFEURL" })
})

// Needs the internet, so it runs in CI and when NETWORK_TESTS=1.
test("fetches a real public page", { skip: !process.env.NETWORK_TESTS && !process.env.CI }, async () => {
  const res = await safeFetch("https://example.com/")
  assert.equal(res.status, 200)
  assert.match(res.text(), /Example Domain/)
})

test("a public-looking name that resolves to a private address is refused (DNS check)", { skip: !process.env.NETWORK_TESTS && !process.env.CI }, async () => {
  // nip.io answers 127.0.0.1 for this name; 169.254.169.254 is cloud metadata.
  await assert.rejects(safeFetch("https://127.0.0.1.nip.io/"), { code: "EPRIVATEADDRESS" })
  await assert.rejects(safeFetch("https://169.254.169.254.nip.io/latest/meta-data"), { code: "EPRIVATEADDRESS" })
})
