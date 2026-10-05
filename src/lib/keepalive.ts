/**
 * Keeps a Render free-plan service awake.
 *
 * Render spins free web services down after 15 minutes without *inbound HTTP
 * traffic*. Work inside the process doesn't count, so this sends a request to the
 * service's own public URL (which Render routes back in as normal traffic).
 *
 * On by default when running on Render (RENDER_EXTERNAL_URL is set by Render);
 * disable with KEEP_ALIVE=false. Paid plans never sleep, so it's harmless there.
 */
const g = globalThis as unknown as { __fycKeepAlive?: ReturnType<typeof setInterval> };

export function startKeepAlive() {
  const base = process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL;
  if (g.__fycKeepAlive || !base || process.env.KEEP_ALIVE === "false") return;

  // 10 minutes leaves a safe margin under Render's 15-minute idle cutoff.
  const minutes = Number(process.env.KEEP_ALIVE_INTERVAL_MIN) || 10;
  const url = `${base.replace(/\/+$/, "")}/api/health`;

  const ping = async () => {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "fyc-keepalive" }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) console.warn(`[keepalive] ${url} answered HTTP ${res.status}`);
    } catch (e) {
      console.warn(`[keepalive] ping failed: ${e instanceof Error ? e.message : e}`);
    }
  };

  g.__fycKeepAlive = setInterval(ping, minutes * 60_000);
  console.log(`[keepalive] pinging ${url} every ${minutes} min`);
}
