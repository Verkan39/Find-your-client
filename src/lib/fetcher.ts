"use client";

/** fetch() for our API routes: if the session has expired, send the user to log in. */
export async function api(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    const next = window.location.pathname + window.location.search;
    window.location.href = `/login?next=${encodeURIComponent(next)}`;
    throw new Error("Signed out");
  }
  return res;
}
