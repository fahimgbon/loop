import "./globals.css";

import type { Metadata } from "next";
import { Suspense } from "react";

import { TopNav } from "@/src/components/TopNav";

export const metadata: Metadata = {
  title: "Loop",
  description: "Audio-first decision and backlog orchestration",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <TopNav />
        <Suspense>{children}</Suspense>
      </body>
    </html>
  );
}
