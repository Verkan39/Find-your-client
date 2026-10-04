"use client";

import { AtSign, Briefcase, Globe, MapPin, Phone } from "lucide-react";
import clsx from "clsx";
import { Field } from "@/components/auth/AuthShell";
import { TagInput } from "@/components/TagInput";
import { EXPERIENCE_LEVELS, INTEREST_SUGGESTIONS, SKILL_SUGGESTIONS, type ProfileInput } from "@/lib/profile";

export type AboutValue = Omit<ProfileInput, "fullName">;

export const EMPTY_ABOUT: AboutValue = {
  phone: "", contactEmail: "", headline: "", location: "", experienceLevel: "", portfolioUrl: "", bio: "", skills: [], interests: [],
};

/** The optional "about you" fields, shared by signup step 2 and the profile page. */
export function AboutFields({ value, onChange, withBio = false, errors = {} }: {
  value: AboutValue;
  onChange: (v: AboutValue) => void;
  withBio?: boolean;
  errors?: Partial<Record<keyof AboutValue, string>>;
}) {
  const set = <K extends keyof AboutValue>(k: K, v: AboutValue[K]) => onChange({ ...value, [k]: v });
  const err = (k: keyof AboutValue) => errors[k] && <span className="text-xs text-rose">{errors[k]}</span>;

  return (
    <div className="space-y-4">
      <Field label="What do you do?" icon={<Briefcase className="size-4" />} maxLength={120} value={value.headline ?? ""}
        onChange={(e) => set("headline", e.target.value)} placeholder="e.g. Full-stack developer, WordPress freelancer" hint={err("headline")} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" icon={<Phone className="size-4" />} type="tel" autoComplete="tel" maxLength={40} value={value.phone ?? ""}
          onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" hint={err("phone")} />
        <Field label="Location" icon={<MapPin className="size-4" />} autoComplete="address-level2" maxLength={120} value={value.location ?? ""}
          onChange={(e) => set("location", e.target.value)} placeholder="City, country" hint={err("location")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact email" icon={<AtSign className="size-4" />} type="email" maxLength={200} value={value.contactEmail ?? ""}
          onChange={(e) => set("contactEmail", e.target.value)} placeholder="If different from login" hint={err("contactEmail")} />
        <Field label="Portfolio / website" icon={<Globe className="size-4" />} type="url" maxLength={300} value={value.portfolioUrl ?? ""}
          onChange={(e) => set("portfolioUrl", e.target.value)} placeholder="https://…" hint={err("portfolioUrl")} />
      </div>

      <div>
        <div className="mb-1.5 text-sm text-fg-muted">Experience</div>
        <div className="flex flex-wrap gap-1.5">
          {EXPERIENCE_LEVELS.map((l) => {
            const on = value.experienceLevel === l.value;
            return (
              <button type="button" key={l.value} onClick={() => set("experienceLevel", on ? "" : l.value)}
                className={clsx("rounded-full px-3 py-1.5 text-xs ring-1 transition", on ? "bg-violet/20 text-fg ring-violet/50" : "bg-white/[0.03] text-fg-muted ring-white/10 hover:text-fg")}>
                {l.label}
              </button>
            );
          })}
        </div>
      </div>

      <TagInput label="Skills" value={value.skills ?? []} onChange={(v) => set("skills", v)} suggestions={SKILL_SUGGESTIONS} placeholder="Type a skill and press Enter" />
      <TagInput label="Industries you'd like to work with" value={value.interests ?? []} onChange={(v) => set("interests", v)} suggestions={INTEREST_SUGGESTIONS} placeholder="Type and press Enter" />

      {withBio && (
        <label className="block">
          <span className="mb-1.5 flex items-baseline justify-between text-sm"><span className="text-fg-muted">Short bio</span>{err("bio")}</span>
          <textarea value={value.bio ?? ""} onChange={(e) => set("bio", e.target.value)} maxLength={1000} rows={4}
            placeholder="A few lines about you and the work you like to do."
            className="w-full resize-y rounded-xl bg-ink-900/70 px-3.5 py-3 text-[15px] ring-1 ring-white/10 outline-none transition placeholder:text-fg-faint focus:ring-violet/60" />
        </label>
      )}
    </div>
  );
}
