import type { SearchProvider } from "./providers/catalog";
import { requestJson } from "./providers/http";

/** Web search through the user's chosen search API. */
export interface SearchConfig {
  provider: SearchProvider;
  key: string;
}

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

export async function webSearch(cfg: SearchConfig, query: string, count = 5): Promise<SearchHit[]> {
  switch (cfg.provider) {
    case "tavily": {
      const res = await requestJson<{ results?: { title: string; url: string; content?: string }[] }>("tavily", "https://api.tavily.com/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, max_results: count, search_depth: "basic" }),
        timeoutMs: 30_000,
      });
      return (res.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.content ?? "" }));
    }
    case "brave": {
      const q = new URLSearchParams({ q: query, count: String(count) });
      const res = await requestJson<{ web?: { results?: { title: string; url: string; description?: string }[] } }>(
        "brave", `https://api.search.brave.com/res/v1/web/search?${q}`,
        { headers: { "X-Subscription-Token": cfg.key, Accept: "application/json" }, timeoutMs: 30_000 },
      );
      return (res.web?.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: (r.description ?? "").replace(/<[^>]+>/g, "") }));
    }
    case "serper": {
      const res = await requestJson<{ organic?: { title: string; link: string; snippet?: string }[] }>("serper", "https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": cfg.key, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, num: count }),
        timeoutMs: 30_000,
      });
      return (res.organic ?? []).map((r) => ({ title: r.title, url: r.link, snippet: r.snippet ?? "" }));
    }
  }
}

export async function validateSearchKey(cfg: SearchConfig) {
  await webSearch(cfg, "coffee shop", 1);
}
