import { GUEST_LIMITS } from "./api";
import { admin } from "./supabase/admin";

/**
 * Deletes guest accounts (and, by cascade, their scans) once they're older than
 * the retention window. Runs hourly inside the server; safe to run on several
 * servers at once because the delete is idempotent.
 */
const g = globalThis as unknown as { __fycCleanup?: ReturnType<typeof setInterval> };

async function cleanupGuests() {
  const hours = GUEST_LIMITS.retentionHours();
  const { data, error } = await admin().rpc("cleanup_guests", { max_age: `${hours} hours` });
  if (error) console.warn(`[guests] cleanup failed: ${error.message}`);
  else if (data) console.log(`[guests] removed ${data} expired guest account(s)`);
}

export function startMaintenance() {
  if (g.__fycCleanup) return;
  const run = () => cleanupGuests().catch((e) => console.warn(`[guests] cleanup failed: ${e instanceof Error ? e.message : e}`));
  setTimeout(run, 30_000); // shortly after boot
  g.__fycCleanup = setInterval(run, 60 * 60 * 1000);
}
