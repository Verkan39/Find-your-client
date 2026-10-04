"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck, Bot, Check, ExternalLink, Globe, KeyRound, Lock, LockOpen, MapPinned, Search, ShieldCheck, Sparkles, Trash2,
} from "lucide-react";
import clsx from "clsx";
import { Field, Notice, PasswordField, SubmitButton } from "@/components/auth/AuthShell";
import { Pill, Spinner } from "@/components/ui";
import { api } from "@/lib/fetcher";
import {
  LLM_PROVIDERS, PLACES_PROVIDERS, PROVIDERS, SEARCH_PROVIDERS,
  type IntegrationsView, type ProviderId, type ProviderInfo, type SearchChoice,
} from "@/lib/providers/catalog";

type VaultState = "checking" | "locked" | "unlocked";

async function call<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string; locked?: boolean }> {
  const res = await api(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: body.error ?? `Request failed (${res.status})`, locked: res.status === 403 && body.locked };
  return { ok: true, data: body as T };
}

/**
 * API keys & providers. Locked until the user re-enters their password; the
 * server then allows key management for 15 minutes via an httpOnly cookie.
 * Keys never come back from the server, only hints like "sk-…a1b2".
 */
export function KeyVault() {
  const [state, setState] = useState<VaultState>("checking");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [view, setView] = useState<IntegrationsView | null>(null);

  const load = useCallback(async () => {
    const r = await call<IntegrationsView>("/api/account/integrations");
    if (r.ok) setView(r.data);
    else if (r.locked) setState("locked");
  }, []);

  useEffect(() => {
    call<{ unlocked: boolean; expiresAt: number | null }>("/api/account/unlock").then((r) => {
      if (r.ok && r.data.unlocked) {
        setExpiresAt(r.data.expiresAt);
        setState("unlocked");
        load();
      } else setState("locked");
    });
  }, [load]);

  // Auto-lock in the UI when the server-side unlock expires.
  useEffect(() => {
    if (!expiresAt) return;
    const t = setTimeout(() => { setState("locked"); setView(null); }, Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(t);
  }, [expiresAt]);

  async function lock() {
    await call("/api/account/unlock", { method: "DELETE" });
    setState("locked");
    setView(null);
    setExpiresAt(null);
  }

  return (
    <section id="keys" className="glass scroll-mt-24 rounded-3xl p-6 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><KeyRound className="size-5 text-violet" /> API keys & providers</h2>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">
            Analyses run on your own accounts: pick the AI, business-data and search providers you prefer. Keys are encrypted at rest and never shown again after saving.
          </p>
        </div>
        {state === "unlocked" && (
          <div className="flex items-center gap-2">
            {expiresAt && <Countdown until={expiresAt} />}
            <button onClick={lock} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-fg-muted ring-1 ring-white/10 transition hover:text-fg">
              <Lock className="size-3.5" /> Lock
            </button>
          </div>
        )}
      </header>

      <div className="mt-6">
        {state === "checking" && <div className="grid h-40 place-items-center"><Spinner className="size-5" /></div>}
        {state === "locked" && <Unlock onUnlocked={(exp) => { setExpiresAt(exp); setState("unlocked"); load(); }} />}
        {state === "unlocked" && !view && <div className="grid h-40 place-items-center"><Spinner className="size-5" /></div>}
        {state === "unlocked" && view && <Providers view={view} setView={setView} onLocked={() => setState("locked")} />}
      </div>
    </section>
  );
}

function Countdown({ until }: { until: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.round((until - now) / 1000));
  return (
    <Pill tone="good"><LockOpen className="size-3" /> Unlocked · {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}</Pill>
  );
}

function Unlock({ onUnlocked }: { onUnlocked: (expiresAt: number) => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await call<{ expiresAt: number }>("/api/account/unlock", { method: "POST", body: JSON.stringify({ password }) });
    setBusy(false);
    if (r.ok) onUnlocked(r.data.expiresAt);
    else setError(r.error);
  }
  return (
    <div className="grid items-center gap-8 md:grid-cols-[1fr_minmax(0,380px)]">
      <ul className="space-y-3 text-sm text-fg-muted">
        {[
          [ShieldCheck, "Keys are encrypted (AES-256-GCM) before they're stored, and only decrypted on the server while your scans run."],
          [Lock, "Re-enter your password to view or change providers. Access re-locks automatically after 15 minutes."],
          [Sparkles, "Choose from Claude, OpenAI, Gemini, OpenRouter, Groq, Mistral, DeepSeek or any OpenAI-compatible API."],
        ].map(([Icon, text], i) => {
          const I = Icon as typeof Lock;
          return <li key={i} className="flex gap-3"><I className="mt-0.5 size-4 shrink-0 text-violet" />{text as string}</li>;
        })}
      </ul>
      <form onSubmit={submit} className="space-y-3 rounded-2xl bg-black/20 p-5 ring-1 ring-white/5">
        <PasswordField label="Confirm your password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your account password" />
        {error && <Notice tone="error">{error}</Notice>}
        <SubmitButton busy={busy}>{busy ? "Checking…" : "Unlock API keys"}</SubmitButton>
      </form>
    </div>
  );
}

/* ================================ providers ================================ */

function Providers({ view, setView, onLocked }: { view: IntegrationsView; setView: (v: IntegrationsView) => void; onLocked: () => void }) {
  const [open, setOpen] = useState<ProviderId | null>(null);
  const llm = view.settings.llmProvider ? PROVIDERS[view.settings.llmProvider] : null;
  const searchChoice: SearchChoice | null = view.settings.searchProvider ?? (llm?.nativeSearch ? "native" : SEARCH_PROVIDERS.find((p) => view.keys[p.id])?.id as SearchChoice | undefined) ?? null;

  async function saveSettings(patch: Record<string, unknown>) {
    const r = await call<IntegrationsView>("/api/account/settings", { method: "PATCH", body: JSON.stringify(patch) });
    if (r.ok) setView(r.data);
    else if (r.locked) onLocked();
    return r;
  }

  const editor = (p: ProviderInfo) => (
    <ProviderEditor key={p.id} p={p} view={view} setView={setView} onLocked={onLocked} saveSettings={saveSettings} />
  );

  return (
    <div className="space-y-10">
      <Group icon={<Bot className="size-4" />} title="AI model" desc="Writes the research notes and the client brief. Required for AI analysis.">
        <Cards list={LLM_PROVIDERS} view={view} open={open} setOpen={setOpen} activeId={view.settings.llmProvider} editor={editor} />
      </Group>

      <Group icon={<MapPinned className="size-4" />} title="Business data" desc="Ratings, review counts, price level and review text. Optional, but it makes estimates sharper.">
        <Cards list={PLACES_PROVIDERS} view={view} open={open} setOpen={setOpen} activeId={view.settings.placesProvider} editor={editor} />
      </Group>

      <Group icon={<Search className="size-4" />} title="Web research" desc="Deep research searches the web for each business. Claude, Gemini and OpenAI can search by themselves; other providers need a search key.">
        <div className="mb-3 flex flex-wrap gap-2">
          {llm?.nativeSearch && (
            <ChoiceChip on={searchChoice === "native"} onClick={() => saveSettings({ searchProvider: "native" })}>
              <Globe className="size-3.5" /> Built-in · {llm.name}
            </ChoiceChip>
          )}
          {SEARCH_PROVIDERS.filter((p) => view.keys[p.id]).map((p) => (
            <ChoiceChip key={p.id} on={searchChoice === p.id} onClick={() => saveSettings({ searchProvider: p.id })}>
              <Search className="size-3.5" /> {p.name}
            </ChoiceChip>
          ))}
          {!llm?.nativeSearch && !SEARCH_PROVIDERS.some((p) => view.keys[p.id]) && (
            <p className="text-xs text-amber">{llm ? `${llm.name} can't search the web by itself. Add a search key below to enable deep research.` : "Pick an AI model first."}</p>
          )}
        </div>
        <Cards list={SEARCH_PROVIDERS} view={view} open={open} setOpen={setOpen} activeId={searchChoice === "native" ? null : searchChoice} editor={editor} />
      </Group>
    </div>
  );
}

function Group({ icon, title, desc, children }: { icon: ReactNode; title: string; desc: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 font-medium"><span className="text-violet">{icon}</span>{title}</h3>
      <p className="mt-1 mb-4 text-sm text-fg-muted">{desc}</p>
      {children}
    </div>
  );
}

function ChoiceChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={clsx("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ring-1 transition", on ? "bg-violet/20 text-fg ring-violet/50" : "text-fg-muted ring-white/10 hover:text-fg")}>
      {on && <Check className="size-3.5" />}{children}
    </button>
  );
}

function Cards({ list, view, open, setOpen, activeId, editor }: {
  list: ProviderInfo[]; view: IntegrationsView; open: ProviderId | null; setOpen: (id: ProviderId | null) => void;
  activeId: string | null; editor: (p: ProviderInfo) => ReactNode;
}) {
  const openInList = list.find((p) => p.id === open);
  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((p) => {
          const saved = view.keys[p.id];
          const active = activeId === p.id;
          return (
            <button key={p.id} onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id}
              className={clsx("relative rounded-2xl p-4 text-left ring-1 transition",
                open === p.id ? "bg-violet/[0.12] ring-violet/60" : active ? "bg-lime/[0.05] ring-lime/30 hover:ring-lime/50" : "bg-white/[0.02] ring-white/10 hover:bg-white/[0.04]")}>
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{p.name}</span>
                {active ? <Pill tone="good"><BadgeCheck className="size-3" /> Active</Pill> : saved ? <Pill tone="info">Saved</Pill> : null}
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs text-fg-muted">{p.tagline}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {p.recommended && <Pill tone="good">Recommended</Pill>}
                {p.nativeSearch && <Pill tone="info">Built-in search</Pill>}
                {saved && <span className="font-mono text-[11px] text-fg-faint">{saved.hint}</span>}
              </div>
            </button>
          );
        })}
      </div>
      <AnimatePresence initial={false}>
        {openInList && (
          <motion.div key={openInList.id} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-3">{editor(openInList)}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProviderEditor({ p, view, setView, onLocked, saveSettings }: {
  p: ProviderInfo; view: IntegrationsView; setView: (v: IntegrationsView) => void; onLocked: () => void;
  saveSettings: (patch: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
}) {
  const saved = view.keys[p.id];
  const [key, setKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(saved?.baseUrl ?? "");
  const [busy, setBusy] = useState<"save" | "delete" | "use" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [models, setModels] = useState<string[] | null>(null);
  const isActiveLlm = view.settings.llmProvider === p.id;
  const [model, setModel] = useState(isActiveLlm ? view.settings.llmModel ?? "" : "");

  // Load the model list for a saved AI key.
  useEffect(() => {
    if (p.kind !== "llm" || !saved || models) return;
    call<{ models: string[] }>(`/api/account/models?provider=${p.id}`).then((r) => {
      if (r.ok) {
        setModels(r.data.models);
        setModel((m) => m || r.data.models[0] || "");
      } else if (r.locked) onLocked();
      else setError(r.error);
    });
  }, [p, saved, models, onLocked]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setError(null);
    setOkMsg(null);
    const r = await call<{ models: string[]; integrations: IntegrationsView }>(`/api/account/keys/${p.id}`, {
      method: "PUT",
      body: JSON.stringify({ key, ...(p.needsBaseUrl ? { baseUrl } : {}) }),
    });
    setBusy(null);
    if (!r.ok) {
      if (r.locked) return onLocked();
      return setError(r.error);
    }
    setKey("");
    setView(r.data.integrations);
    if (p.kind === "llm") {
      setModels(r.data.models);
      setModel(r.data.integrations.settings.llmProvider === p.id ? r.data.integrations.settings.llmModel ?? r.data.models[0] ?? "" : r.data.models[0] ?? "");
    }
    setOkMsg(p.kind === "llm" ? `Key works. ${r.data.models.length ? `${r.data.models.length} models available.` : "Enter the model name to use."}` : "Key works and is saved.");
  }

  async function remove() {
    if (!confirm(`Remove your ${p.name} key?`)) return;
    setBusy("delete");
    const r = await call<{ integrations: IntegrationsView }>(`/api/account/keys/${p.id}`, { method: "DELETE" });
    setBusy(null);
    if (r.ok) {
      setView(r.data.integrations);
      setModels(null);
      setOkMsg(null);
    } else if (r.locked) onLocked();
    else setError(r.error);
  }

  async function use(patch: Record<string, unknown>, msg: string) {
    setBusy("use");
    setError(null);
    const r = await saveSettings(patch);
    setBusy(null);
    if (r.ok) setOkMsg(msg);
    else if (r.error) setError(r.error);
  }

  return (
    <div className="grid gap-6 rounded-2xl bg-black/25 p-5 ring-1 ring-white/10 md:grid-cols-[1fr_minmax(0,0.9fr)]">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-display text-lg font-semibold">{p.name}</h4>
          <a href={p.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-violet hover:text-fg">Get a key <ExternalLink className="size-3" /></a>
        </div>
        <p className="mt-1 text-sm text-fg-muted">{p.tagline}</p>
        {p.notes && <p className="mt-2 text-xs text-fg-faint">{p.notes}</p>}
        {saved && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm ring-1 ring-white/5">
            <ShieldCheck className="size-4 text-lime" />
            <span>Saved key <span className="font-mono text-fg-muted">{saved.hint}</span></span>
            {saved.baseUrl && <span className="truncate text-xs text-fg-faint">· {saved.baseUrl}</span>}
            <button onClick={remove} disabled={busy !== null} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-fg-muted transition hover:bg-rose/10 hover:text-rose">
              {busy === "delete" ? <Spinner className="size-3" /> : <Trash2 className="size-3.5" />} Remove
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <form onSubmit={save} className="space-y-3" autoComplete="off">
          {p.needsBaseUrl && (
            <Field label="Base URL" type="url" required value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" />
          )}
          <PasswordField label={saved ? "Replace key" : "API key"} autoComplete="off" required={!saved || Boolean(key)} value={key}
            onChange={(e) => setKey(e.target.value)} placeholder={p.keyPlaceholder} spellCheck={false} />
          {(key || !saved) && <SubmitButton busy={busy === "save"}>{busy === "save" ? "Testing key…" : "Test & save key"}</SubmitButton>}
        </form>

        {saved && p.kind === "llm" && (
          <div className="space-y-2">
            <label className="block">
              <span className="mb-1.5 flex items-baseline justify-between text-sm">
                <span className="text-fg-muted">Model</span>
                {models === null && <Spinner className="size-3" />}
              </span>
              <input list={`models-${p.id}`} value={model} onChange={(e) => setModel(e.target.value)} placeholder="Choose or type a model id"
                className="h-12 w-full rounded-xl bg-ink-900/70 px-3.5 font-mono text-sm ring-1 ring-white/10 outline-none focus:ring-violet/60" />
              <datalist id={`models-${p.id}`}>{(models ?? []).slice(0, 300).map((m) => <option key={m} value={m} />)}</datalist>
            </label>
            <button disabled={!model || busy !== null || (isActiveLlm && model === view.settings.llmModel)}
              onClick={() => use({ llmProvider: p.id, llmModel: model }, `${p.name} · ${model} is now active.`)}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-fg text-sm font-medium text-ink-950 transition hover:bg-white disabled:opacity-40">
              {busy === "use" ? <Spinner className="border-ink-950/20 border-t-ink-950" /> : <Check className="size-4" />}
              {isActiveLlm ? (model === view.settings.llmModel ? "Active" : "Switch model") : `Use ${p.name}`}
            </button>
          </div>
        )}

        {saved && p.kind === "places" && (
          <button disabled={busy !== null} onClick={() => view.settings.placesProvider === p.id
              ? use({ placesProvider: null }, "Business data turned off.")
              : use({ placesProvider: p.id }, `${p.name} is now your business-data source.`)}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-fg text-sm font-medium text-ink-950 transition hover:bg-white disabled:opacity-40">
            {view.settings.placesProvider === p.id ? "Stop using" : `Use ${p.name}`}
          </button>
        )}

        {saved && p.kind === "search" && view.settings.searchProvider !== p.id && (
          <button disabled={busy !== null} onClick={() => use({ searchProvider: p.id }, `${p.name} will be used for research.`)}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-fg text-sm font-medium text-ink-950 transition hover:bg-white disabled:opacity-40">
            Use {p.name} for research
          </button>
        )}

        {error && <Notice tone="error">{error}</Notice>}
        {okMsg && !error && <Notice tone="success">{okMsg}</Notice>}
      </div>
    </div>
  );
}
