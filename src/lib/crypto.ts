import crypto from "node:crypto";

/**
 * Encryption for user API keys (AES-256-GCM) and signing for the short-lived
 * "keys unlocked" cookie. Both derive from KEYS_ENCRYPTION_SECRET, which lives
 * only on the server. Losing or changing it makes saved keys unreadable, so
 * users would have to re-enter them.
 */

function secret(): string {
  const s = process.env.KEYS_ENCRYPTION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("KEYS_ENCRYPTION_SECRET must be set to a random string of 32+ characters (see .env.example).");
  }
  return s;
}

const derive = (purpose: string) => crypto.createHash("sha256").update(`${purpose}:${secret()}`).digest();

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", derive("api-keys"), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  if (!stored.startsWith("v1:")) throw new Error("Unknown key format");
  const raw = Buffer.from(stored.slice(3), "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", derive("api-keys"), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

/** "sk-ant-…a1b2": enough to recognise a key, useless to anyone else. */
export function keyHint(key: string): string {
  const k = key.trim();
  const prefix = k.match(/^[a-zA-Z]{2,5}[-_]/)?.[0] ?? "";
  return `${prefix}…${k.slice(-4)}`;
}

/* ------------------------------ unlock token ------------------------------ */

export const UNLOCK_COOKIE = "fyc_keys_unlock";
export const UNLOCK_TTL_SECONDS = 15 * 60;

const sign = (payload: string) => crypto.createHmac("sha256", derive("unlock")).update(payload).digest("base64url");

export function createUnlockToken(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + UNLOCK_TTL_SECONDS;
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/** True only for an unexpired token minted for this exact user. */
export function verifyUnlockToken(token: string | undefined, userId: string): boolean {
  if (!token) return false;
  const [uid, exp, mac] = token.split(".");
  if (!uid || !exp || !mac || uid !== userId) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  const expected = Buffer.from(sign(`${uid}.${exp}`));
  const given = Buffer.from(mac);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
