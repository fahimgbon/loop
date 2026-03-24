"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import type { Session } from "@/src/server/auth";

import { LoopMark } from "./icons/LoopIcons";
import { LogoutButton } from "./logout/LogoutButton";

export function TopNavClient(props: { session: Session | null }) {
  const pathname = usePathname();
  const workspaceSlug = props.session?.workspaceSlug ?? null;
  const isLanding = pathname === "/";

  if (pathname?.startsWith("/w/")) return null;

  return (
    <header
      className={
        isLanding
          ? "sticky top-0 z-50 px-4 pt-4"
          : "border-b border-slate-200/70 bg-white/78 backdrop-blur-xl"
      }
    >
      <div
        className={
          isLanding
            ? "mx-auto flex max-w-7xl items-center justify-between rounded-full border border-white/70 bg-white/82 px-5 py-3 shadow-[0_20px_60px_-38px_rgba(15,23,42,0.26)] backdrop-blur-2xl"
            : "mx-auto flex max-w-6xl items-center justify-between px-6 py-4"
        }
      >
        <Link
          href={props.session ? `/w/${props.session.workspaceSlug}` : "/"}
          className="flex items-center gap-3 font-semibold tracking-tight text-slate-950"
        >
          <LoopMark className="h-8 w-8 text-slate-950" />
          <span>Loop</span>
        </Link>

        {workspaceSlug ? (
          <nav className="hidden items-center gap-1 md:flex">
            <NavLink href={`/w/${workspaceSlug}`}>Home</NavLink>
            <NavLink href={`/w/${workspaceSlug}/folders`}>Folders</NavLink>
            <NavLink href={`/w/${workspaceSlug}/capture`}>Capture</NavLink>
            <NavLink href={`/w/${workspaceSlug}/inbox`}>Inbox</NavLink>
            <NavLink href={`/w/${workspaceSlug}/search`}>Search</NavLink>
            <NavLink href={`/w/${workspaceSlug}/artifacts/new`}>New</NavLink>
          </nav>
        ) : isLanding ? (
          <nav className="hidden items-center gap-1 md:flex">
            <AnchorLink href="#product">Product</AnchorLink>
            <AnchorLink href="#teams">Teams</AnchorLink>
            <AnchorLink href="#network">Network</AnchorLink>
            <AnchorLink href="#footer-cta">Get started</AnchorLink>
          </nav>
        ) : null}

        <div className="flex items-center gap-2 text-sm">
          {props.session ? (
            <>
              <span className="text-muted">{props.session.workspaceSlug}</span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-800 shadow-sm hover:bg-slate-50" href="/login">
                Log in
              </Link>
              <Link
                className="rounded-xl bg-[linear-gradient(135deg,rgb(var(--accent)),rgb(var(--accent-2)))] px-4 py-2 text-white shadow-[0_14px_30px_-18px_rgba(101,149,255,0.55)] hover:brightness-[0.98]"
                href="/setup"
              >
                Set up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink(props: { href: string; children: ReactNode }) {
  return (
    <Link
      href={props.href}
      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
    >
      {props.children}
    </Link>
  );
}

function AnchorLink(props: { href: string; children: ReactNode }) {
  return (
    <a
      href={props.href}
      className="rounded-full border border-transparent px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-200 hover:bg-white hover:text-slate-900"
    >
      {props.children}
    </a>
  );
}
