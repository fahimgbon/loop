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
      <body className="grain min-h-screen">
        <div className="fixed inset-0 -z-20 overflow-hidden">
          <div className="blob blob-1" />
          <div className="blob blob-2" />
          <div className="blob blob-3" />
        </div>
        <TopNav />
        <Suspense>{children}</Suspense>
      </body>
    </html>
  );
}
