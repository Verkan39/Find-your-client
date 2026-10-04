"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import clsx from "clsx";

/** Chips + free-text entry + one-click suggestions. Enter or comma adds a tag. */
export function TagInput({ label, value, onChange, suggestions = [], max = 30, placeholder }: {
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  max?: number;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const has = (t: string) => value.some((v) => v.toLowerCase() === t.toLowerCase());
  const add = (raw: string) => {
    const t = raw.trim().slice(0, 40);
    if (!t || has(t) || value.length >= max) return;
    onChange([...value, t]);
  };
  const remove = (t: string) => onChange(value.filter((v) => v !== t));
  const open = suggestions.filter((s) => !has(s)).slice(0, 12);

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="text-fg-muted">{label}</span>
        <span className="text-xs text-fg-faint tabular-nums">{value.length}/{max}</span>
      </div>
      <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-xl bg-ink-900/70 px-2.5 py-2 ring-1 ring-white/10 transition focus-within:ring-violet/60">
        <AnimatePresence initial={false}>
          {value.map((t) => (
            <motion.span key={t} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              className="inline-flex items-center gap-1 rounded-full bg-violet/15 py-1 pr-1 pl-2.5 text-xs text-fg ring-1 ring-violet/30">
              {t}
              <button type="button" onClick={() => remove(t)} aria-label={`Remove ${t}`} className="grid size-4 place-items-center rounded-full text-fg-muted hover:bg-white/10 hover:text-fg">
                <X className="size-3" />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
              e.preventDefault();
              add(draft);
              setDraft("");
            } else if (e.key === "Backspace" && !draft && value.length) {
              remove(value[value.length - 1]);
            }
          }}
          onBlur={() => { if (draft.trim()) { add(draft); setDraft(""); } }}
          placeholder={value.length ? "" : placeholder}
          className="h-7 min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-fg-faint"
        />
      </div>
      {open.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {open.map((s) => (
            <button type="button" key={s} onClick={() => add(s)} disabled={value.length >= max}
              className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-fg-muted ring-1 ring-white/10 transition hover:bg-white/5 hover:text-fg disabled:opacity-40")}>
              <Plus className="size-3" />{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
