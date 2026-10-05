import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Nav, type NavUser } from "@/components/Nav";
import { GuestBar } from "@/components/GuestBar";
import { PointerFX } from "@/components/PointerFX";
import { getUser } from "@/lib/supabase/server";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });

export const metadata: Metadata = {
  title: "Find Your Client — AI lead intelligence for freelance developers",
  description:
    "Scan any neighbourhood, analyse every local business for revenue, visibility and digital gaps, and get a pitch they'll actually say yes to.",
};

async function currentUser(): Promise<NavUser | null> {
  try {
    const { user } = await getUser();
    if (!user) return null;
    return {
      email: user.email ?? "",
      name: (user.user_metadata?.full_name as string | undefined) || null,
      isGuest: Boolean(user.is_anonymous),
    };
  } catch {
    return null; // Supabase not configured yet; render signed-out
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable}`}>
      <body className="noise min-h-screen">
        <PointerFX />
        <Nav user={user} />
        {children}
        {user?.isGuest && <GuestBar />}
      </body>
    </html>
  );
}
