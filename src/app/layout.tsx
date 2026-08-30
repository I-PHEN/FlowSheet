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
  title: "Ammonia Plant Lab",
  description:
    "Open, inspect and operate a live ammonia plant flowsheet — 19 unit operations, real thermodynamics, guided tours. Built for chemical engineering students and the curious.",
  keywords: ["ammonia", "Haber-Bosch", "process simulation", "flowsheet", "chemical engineering", "education"],
  authors: [{ name: "Ammonia Plant Lab" }],
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
