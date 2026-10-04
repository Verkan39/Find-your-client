/** Only allow same-site relative redirect targets (blocks open redirects like //evil.com). */
export function safeNext(next: string | string[] | null | undefined, fallback = "/dashboard") {
  const v = Array.isArray(next) ? next[0] : next;
  return v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : fallback;
}
