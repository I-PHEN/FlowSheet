import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ammonia Plant Builder — Flowsheet Workbench",
  description:
    "Deterministic steam-methane-reforming ammonia plant simulator: 19 unit operations, Peng-Robinson flash, Gillespie-Beattie equilibrium, live re-solve.",
  keywords: ["ammonia", "Haber-Bosch", "process simulation", "flowsheet", "chemical engineering"],
  authors: [{ name: "Ammonia Plant Builder" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0b0f13] text-[#dce5ec]`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
