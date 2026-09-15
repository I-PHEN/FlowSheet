import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flowsheet — AI-native process simulator",
  description:
    "Describe any chemical plant and watch AI engineer it live — architect, engineer, solver and critic build a flowsheet you can walk, operate and tour. Runs entirely in your browser.",
  keywords: [
    "process simulation",
    "flowsheet",
    "chemical engineering",
    "PFD",
    "distillation",
    "flash separation",
    "ammonia",
    "education",
  ],
  authors: [{ name: "Flowsheet" }],
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
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ background: 'var(--fs-canvas)', color: 'var(--fs-ink)' }}
      >
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
