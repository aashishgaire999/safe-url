/** True only for an IP address on the public internet. Anything else is false. */
export function isPublicAddress(address: string): boolean
/** "192.168.1.1" → [192, 168, 1, 1], or null. */
export function parseIPv4(text: string): number[] | null
/** "2001:db8::1" → eight 16-bit numbers, or null. */
export function parseIPv6(text: string): number[] | null

export type CheckUrlOptions = {
  /** Also accept http:// links. Default false (https only). */
  allowHttp?: boolean
  /** Accept links with an explicit port like :8080. Default false. */
  allowAnyPort?: boolean
  /** Longest link accepted. Default 2048. */
  maxLength?: number
}
/** The normalised URL (no #fragment) if it's a safe public link, otherwise null. */
export function checkUrl(value: unknown, options?: CheckUrlOptions): string | null
/** Whether a URL hostname may be on the public internet (by what it says, not where it resolves). */
export function isPublicHostname(hostname: string): boolean
