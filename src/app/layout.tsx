import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Nav } from "@/components/Nav";
import { PointerFX } from "@/components/PointerFX";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });

export const metadata: Metadata = {
  title: "Find Your Client — AI lead intelligence for freelance developers",
  description:
    "Scan any neighbourhood, analyse every local business for revenue, visibility and digital gaps, and get a pitch they'll actually say yes to.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable}`}>
      <body className="noise min-h-screen">
        <PointerFX />
        <Nav />
        {children}
      </body>
    </html>
  );
}
