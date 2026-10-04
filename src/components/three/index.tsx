"use client";

import dynamic from "next/dynamic";

const Fallback = () => (
  <div className="grid size-full place-items-center">
    <div className="skeleton size-40 rounded-full opacity-60" />
  </div>
);

export const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false, loading: () => null });
export const Constellation = dynamic(() => import("./Constellation"), { ssr: false, loading: Fallback });
export const ScoreOrb = dynamic(() => import("./ScoreOrb"), {
  ssr: false,
  loading: () => <div className="grid size-full place-items-center"><div className="skeleton size-[62%] rounded-full" /></div>,
});
export type { StarPoint } from "./Constellation";
