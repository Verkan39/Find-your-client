"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Mail, UserRound } from "lucide-react";
import { Field, Notice, SubmitButton } from "@/components/auth/AuthShell";
import { Skel } from "@/components/skeletons";
import { api } from "@/lib/fetcher";
import type { Profile } from "@/lib/profile";
import { AboutFields, EMPTY_ABOUT, type AboutValue } from "./AboutFields";

/** Everything the user told us at signup, editable. */
export function ProfileForm() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [about, setAbout] = useState<AboutValue>(EMPTY_ABOUT);
  const [errors, setErrors] = useState<Partial<Record<keyof AboutValue, string>>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    api("/api/profile").then((r) => r.json()).then((p: Profile) => {
      setProfile(p);
      setName(p.fullName);
      const { email: _e, fullName: _n, ...rest } = p;
      setAbout({ ...EMPTY_ABOUT, ...rest });
    }).catch(() => {});
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await api("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: name, ...about }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      const fields = (body.fields ?? {}) as Record<string, string[]>;
      setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v[0]])) as typeof errors);
      setNotice({ tone: "error", text: body.error ?? "Couldn't save your profile." });
      return;
    }
    setErrors({});
    setProfile(body);
    setNotice({ tone: "success", text: "Profile saved." });
    router.refresh(); // nav shows the updated name
  }

  if (!profile) {
    return (
      <div className="glass space-y-4 rounded-3xl p-6 sm:p-8">
        <Skel className="h-6 w-40" />
        {[0, 1, 2, 3].map((i) => <Skel key={i} className="h-12 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="glass space-y-5 rounded-3xl p-6 sm:p-8">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><UserRound className="size-5 text-violet" /> About you</h2>
        <p className="mt-1 text-sm text-fg-muted">Shown only to you. It helps tailor suggestions as the app grows.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" icon={<UserRound className="size-4" />} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Login email" icon={<Mail className="size-4" />} value={profile.email} disabled readOnly className="opacity-60" />
      </div>
      <AboutFields value={about} onChange={setAbout} errors={errors} withBio />
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      <div className="sm:w-56"><SubmitButton busy={busy}>{busy ? "Saving…" : "Save profile"}</SubmitButton></div>
    </form>
  );
}
