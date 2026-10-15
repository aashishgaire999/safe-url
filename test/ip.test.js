import { test } from "node:test"
import assert from "node:assert/strict"
import { isPublicAddress, parseIPv6 } from "../src/index.js"

test("private, local and special IPv4 addresses are not public", () => {
  for (const ip of ["0.0.0.0", "10.1.2.3", "100.64.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.0.0.8", "192.0.2.1", "192.168.1.1", "198.18.0.1", "198.19.255.255", "198.51.100.7", "203.0.113.9", "224.0.0.1", "240.0.0.1", "255.255.255.255"]) {
    assert.equal(isPublicAddress(ip), false, ip)
  }
})

test("ordinary internet IPv4 addresses are public", () => {
  for (const ip of ["1.1.1.1", "8.8.8.8", "93.184.216.34", "172.15.255.255", "172.32.0.1", "100.63.255.255", "198.17.255.255"]) {
    assert.equal(isPublicAddress(ip), true, ip)
  }
})

test("IPv6: only global unicast is public, and wrapped IPv4 is judged by the IPv4 inside", () => {
  const blocked = ["::", "::1", "fe80::1", "fc00::1", "fd12:3456::1", "fec0::1", "ff02::1", "2001:db8::1", "2001::1", "2001:10::1", "3fff::1",
    "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:169.254.169.254", "64:ff9b::7f00:1", "64:ff9b::10.0.0.1", "64:ff9b:1::1", "2002:a00:1::", "2002:c0a8:101::1", "::127.0.0.1", "100::1"]
  for (const ip of blocked) assert.equal(isPublicAddress(ip), false, ip)
  const allowed = ["2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8", "64:ff9b::808:808", "2002:808:808::1", "[2606:4700::1]"]
  for (const ip of allowed) assert.equal(isPublicAddress(ip), true, ip)
})

test("not an address at all is never public", () => {
  for (const value of ["", "localhost", "example.com", "1.2.3", "256.1.1.1", "1.2.3.4.5", ":::", "1::2::3", "12345::", null, undefined]) {
    assert.equal(isPublicAddress(value), false, String(value))
  }
})

test("IPv6 parsing handles shortening and embedded IPv4", () => {
  assert.deepEqual(parseIPv6("2001:db8::1"), [0x2001, 0xdb8, 0, 0, 0, 0, 0, 1])
  assert.deepEqual(parseIPv6("::ffff:10.0.0.1"), [0, 0, 0, 0, 0, 0xffff, 0x0a00, 1])
  assert.deepEqual(parseIPv6("fe80::1%eth0"), [0xfe80, 0, 0, 0, 0, 0, 0, 1])
  assert.equal(parseIPv6("1:2:3:4:5:6:7:8:9"), null)
})
