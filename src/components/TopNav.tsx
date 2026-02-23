import Link from "next/link";
import type { ReactNode } from "react";

import { getSession } from "@/src/server/auth";

import { LogoutButton } from "./logout/LogoutButton";

export async function TopNav() {
  const session = await getSession();
  const workspaceSlug = session?.workspaceSlug ?? null;
  return (
    <header className="border-b border-white/50 bg-white/50 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href={session ? `/w/${session.workspaceSlug}` : "/"} className="font-semibold tracking-tight">
          Loop
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
        ) : null}

        <div className="flex items-center gap-2 text-sm">
          {session ? (
            <>
              <span className="text-muted">{session.workspaceSlug}</span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link className="rounded-md border border-white/60 bg-white/40 px-3 py-2 hover:bg-white/70" href="/login">
                Log in
              </Link>
              <Link className="rounded-md bg-accent px-3 py-2 text-white shadow-sm" href="/setup">
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
      className="rounded-full border border-white/60 bg-white/40 px-3 py-1 text-xs text-slate-700 hover:bg-white/70"
    >
      {props.children}
    </Link>
  );
}
