"use client";

import dynamic from "next/dynamic";

const Fallback = () => <div className="size-full animate-pulse rounded-full bg-violet/5" />;

export const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false, loading: () => null });
export const Constellation = dynamic(() => import("./Constellation"), { ssr: false, loading: Fallback });
export const ScoreOrb = dynamic(() => import("./ScoreOrb"), { ssr: false, loading: () => null });
export type { StarPoint } from "./Constellation";
