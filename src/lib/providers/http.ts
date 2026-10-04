import { PROVIDERS, type ProviderId } from "./catalog";

/** An error from a third-party provider, phrased so we can show it to the user. */
export class ProviderError extends Error {
  public status: number;

  constructor(
    public provider: ProviderId,
    status: number,
    detail: string,
  ) {
    // Some providers (e.g. Gemini) report a bad key as 400 with a message.
    const badKey = (status === 400 || status === 422) &&
      /api[ _-]?key (not valid|invalid)|invalid[ _-]?(api[ _-]?)?(key|token)|token[ _-]?(is )?invalid|unauthori[sz]ed|authentication/i.test(detail);
    const effective = badKey ? 401 : status;
    super(ProviderError.explain(provider, effective, detail));
    this.status = effective;
  }

  static explain(provider: ProviderId, status: number, detail: string) {
    const name = PROVIDERS[provider]?.name ?? provider;
    if (status === 401 || status === 403) return `${name} rejected your API key. Update it on your Profile page.`;
    if (status === 402) return `${name} says your account is out of credit.`;
    if (status === 429) return `${name} rate limit or quota reached. Try again later or raise your plan's limits.`;
    if (status === 404) return `${name} couldn't find that model or endpoint (${detail.slice(0, 160)}).`;
    if (status >= 500) return `${name} is having problems right now (HTTP ${status}).`;
    return `${name} error ${status || ""}: ${detail.slice(0, 240)}`.trim();
  }

  get isAuth() {
    return this.status === 401 || this.status === 403;
  }
}

/** Pull the most useful message out of the many error shapes providers use. */
function errorDetail(body: string): string {
  try {
    const j = JSON.parse(body);
    const found = j?.error?.message ?? j?.error?.detail ?? j?.message ?? j?.error?.description ?? j?.detail ?? j?.error ?? body;
    return typeof found === "string" ? found : JSON.stringify(found);
  } catch {
    return body;
  }
}

/** fetch + JSON with timeouts and provider-aware errors. */
export async function requestJson<T>(provider: ProviderId, url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { timeoutMs = 120_000, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const timeout = e instanceof Error && e.name === "TimeoutError";
    throw new ProviderError(provider, 0, timeout ? "request timed out" : `couldn't connect (${e instanceof Error ? e.message : e})`);
  }
  const text = await res.text();
  if (!res.ok) throw new ProviderError(provider, res.status, errorDetail(text));
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ProviderError(provider, res.status, "response wasn't valid JSON");
  }
}
