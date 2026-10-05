#!/usr/bin/env node
/**
 * Verifies that .env.local points at a working, fully migrated Supabase project.
 * Run with: npm run check:setup
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const file of [".env", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

let failed = 0;
const pass = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m, fix) => { failed++; console.log(`  \x1b[31m✗\x1b[0m ${m}${fix ? `\n      → ${fix}` : ""}`); };
const warn = (m) => console.log(`  \x1b[33m!\x1b[0m ${m}`);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const pub = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

console.log("\nEnvironment");
url ? pass(`NEXT_PUBLIC_SUPABASE_URL = ${url}${/127\.0\.0\.1|localhost/.test(url) ? "  (LOCAL Docker stack)" : "  (hosted)"}`) : fail("NEXT_PUBLIC_SUPABASE_URL is missing", "Project Settings → API → Project URL");
pub ? pass("publishable key set") : fail("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing", "Project Settings → API Keys → Publishable key (sb_publishable_…)");
secret ? pass("secret key set") : fail("SUPABASE_SECRET_KEY is missing", "Project Settings → API Keys → Secret key (sb_secret_…)");
(env.KEYS_ENCRYPTION_SECRET ?? "").length >= 32
  ? pass("KEYS_ENCRYPTION_SECRET set")
  : fail("KEYS_ENCRYPTION_SECRET missing or shorter than 32 characters", `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`);
if (pub && secret && pub === secret) fail("publishable and secret keys are identical", "The secret key must be the sb_secret_… one");
if (!url || !pub || !secret) { console.log(`\n${failed} problem(s). Fix the above and re-run.\n`); process.exit(1); }

console.log("\nConnection & auth");
try {
  const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, { headers: { apikey: pub }, signal: AbortSignal.timeout(15000) });
  if (res.status === 401 || res.status === 403) fail("publishable key was rejected", "Copy it again from Project Settings → API Keys");
  else if (!res.ok) fail(`auth server answered HTTP ${res.status}`);
  else {
    const s = await res.json();
    pass("project reachable");
    s.external?.email ? pass("email + password sign-in enabled") : fail("email provider is disabled", "Authentication → Sign In / Providers → Email → enable");
    s.external?.anonymous_users
      ? pass("anonymous sign-ins enabled (guest mode)")
      : fail("anonymous sign-ins are disabled, so \"Try it free\" won't work", "Authentication → Sign In / Providers → turn on \"Allow anonymous sign-ins\"");
    if (s.mailer_autoconfirm) warn("email confirmation is OFF: new users are signed in immediately");
    else warn("email confirmation is ON: users must click the emailed link. Supabase's built-in mailer sends only a few emails/hour; set up custom SMTP before launch.");
  }
} catch (e) {
  fail(`can't reach ${url} (${e.message})`, "Check the URL and your internet connection");
}

const admin = createClient(url, secret, { auth: { persistSession: false } });
const anon = createClient(url, pub, { auth: { persistSession: false } });

// The Data API validates keys strictly, so use it as the real key check.
const probe = await anon.from("scans").select("id").limit(1);
// ("permission denied" just means signed-out visitors are correctly blocked.)
if (/invalid api key|no api key/i.test(probe.error?.message ?? "")) {
  fail("publishable key rejected by the Data API", "Copy the sb_publishable_… key again from Project Settings → API Keys");
}

console.log("\nDatabase schema (secret key)");
const tables = ["profiles", "scans", "businesses", "scan_events", "user_settings", "api_keys", "scan_overview"];
let missing = 0;
for (const t of tables) {
  const { error, status } = await admin.from(t).select("*").limit(1);
  if (!error) pass(`${t}`);
  else if (status === 401 || /invalid api key|jwt|unauthori/i.test(error.message)) {
    fail(`secret key rejected (${error.message || `HTTP ${status}`})`, "Copy the sb_secret_… key again from Project Settings → API Keys");
    break;
  } else { missing++; fail(`${t}: ${error.message || `HTTP ${status}`}`); }
}
if (failed === 0 || missing) {
  const { error: rpcErr } = await admin.rpc("email_registered", { p_email: "nobody@example.com" });
  rpcErr ? (missing++, fail(`email_registered(): ${rpcErr.message}`)) : pass("email_registered() function");
  // Harmless probe: nothing is 100 years old.
  const { error: gErr } = await admin.rpc("cleanup_guests", { max_age: "100 years" });
  gErr ? (missing++, fail(`cleanup_guests(): ${gErr.message}`)) : pass("guest cleanup + transfer functions");
}
if (missing) {
  console.log(`      → Apply the migrations in supabase/migrations/ (oldest first):
         npx supabase login
         npx supabase link --project-ref <your-project-ref>
         npm run db:push
        …or paste each .sql file, in filename order, into Dashboard → SQL Editor and run it.`);
}

console.log("\nSecurity (publishable key, signed out)");
const { data: anonRows, error: anonErr } = await anon.from("scans").select("id").limit(1);
anonErr || (anonRows ?? []).length === 0 ? pass("anonymous visitors can't read scans") : fail("anonymous visitors CAN read scans: RLS is not active", "Re-run the migrations");
const { data: keyRows, error: keyErr } = await anon.from("api_keys").select("id").limit(1);
keyErr || (keyRows ?? []).length === 0 ? pass("api_keys is not readable from the browser") : fail("api_keys is readable from the browser!", "Re-run the migrations");

console.log(failed ? `\n\x1b[31m${failed} problem(s) found.\x1b[0m Fix them and re-run \`npm run check:setup\`.\n` : `\n\x1b[32mAll good.\x1b[0m Restart \`npm run dev\` to use this project.\n`);
process.exit(failed ? 1 : 0);
