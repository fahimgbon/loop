"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { useEffect, useState } from "react";

import {
  CaptureIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FolderIcon,
  GraphIcon,
  HomeIcon,
  InboxIcon,
  LoopMark,
  NewDocIcon,
  SearchIcon,
  SparkIcon,
} from "@/src/components/icons/LoopIcons";
import { LogoutButton } from "@/src/components/logout/LogoutButton";

type RecentArtifact = {
  id: string;
  title: string;
  updatedAt: string;
};

export function WorkspaceShellClient(props: {
  workspaceSlug: string;
  role: "admin" | "member";
  recentArtifacts: RecentArtifact[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

  useEffect(() => {
    const saved = window.localStorage.getItem("loop.workspace.sidebar.collapsed");
    if (saved === "true") {
      setCollapsed(true);
      return;
    }
    if (saved === "false") {
      setCollapsed(false);
      return;
    }
    setCollapsed(true);
  }, [pathname, props.workspaceSlug]);

  useEffect(() => {
    window.localStorage.setItem("loop.workspace.sidebar.collapsed", collapsed ? "true" : "false");
  }, [collapsed]);

  const navItems: Array<{ href: string; label: string; icon: IconComponent }> = [
    { href: `/w/${props.workspaceSlug}`, label: "Home", icon: HomeIcon },
    { href: `/w/${props.workspaceSlug}/unified`, label: "Unified", icon: SparkIcon },
    { href: `/w/${props.workspaceSlug}/capture`, label: "Capture", icon: CaptureIcon },
    { href: `/w/${props.workspaceSlug}/inbox`, label: "Inbox", icon: InboxIcon },
    { href: `/w/${props.workspaceSlug}/search`, label: "Search", icon: SearchIcon },
    { href: `/w/${props.workspaceSlug}/network`, label: "Network", icon: GraphIcon },
    { href: `/w/${props.workspaceSlug}/folders`, label: "Folders", icon: FolderIcon },
    { href: `/w/${props.workspaceSlug}/artifacts/new`, label: "New", icon: NewDocIcon },
  ];

  return (
    <div className="relative min-h-screen lg:flex">
      <div className="workspace-mobile-bar lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/w/${props.workspaceSlug}`}
            className="flex items-center gap-3 font-semibold tracking-tight text-slate-950"
          >
            <LoopMark className="h-8 w-8 text-slate-950" />
            <span>Aceync</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-900"
              onClick={() => window.dispatchEvent(new CustomEvent("aceync:ask-open"))}
              aria-label="Ask Ace"
            >
              <SearchIcon className="h-4 w-4 text-slate-950" />
            </button>
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-600">{props.workspaceSlug}</div>
            <LogoutButton compact />
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium whitespace-nowrap shadow-sm",
                pathname === item.href
                  ? "border-slate-300 bg-white text-slate-950"
                  : "border-slate-300 bg-white/96 text-slate-900",
              ].join(" ")}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <aside
        className={[
          "hidden shrink-0 overflow-hidden lg:block",
          collapsed ? "w-[74px]" : "w-[280px]",
        ].join(" ")}
      >
        {collapsed ? (
          <div className="workspace-sidebar relative z-20 flex min-h-screen w-[74px] flex-col items-center px-0 py-4">
            <Link
              href={`/w/${props.workspaceSlug}`}
              className="mt-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-950 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.18)]"
              title="Aceync workspace home"
            >
              <LoopMark className="h-9 w-9 shrink-0 text-slate-950" />
            </Link>

            <button
              type="button"
              className="absolute right-0.5 top-6 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-[0_8px_18px_-16px_rgba(15,23,42,0.12)] hover:border-slate-300 hover:bg-slate-50"
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
            >
              <ChevronRightIcon className="h-3 w-3" />
            </button>

            <div className="mt-6 flex w-full flex-1 flex-col items-center gap-4">
              <button
                type="button"
                className="inline-flex h-12 w-12 items-center justify-center rounded-[18px] border border-slate-300 bg-white text-slate-950 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.12)] hover:border-slate-400 hover:bg-slate-50"
                onClick={() => window.dispatchEvent(new CustomEvent("aceync:ask-open"))}
                title="Ask Ace"
                aria-label="Ask Ace"
              >
                <SearchIcon className="h-[18px] w-[18px]" />
              </button>

              <nav className="flex w-full flex-1 flex-col items-center gap-3">
                {navItems.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={[
                        "workspace-nav-compact-link",
                        active ? "workspace-nav-compact-link-active" : "",
                      ].join(" ")}
                      title={item.label}
                      aria-current={active ? "page" : undefined}
                    >
                      <item.icon className="h-[18px] w-[18px]" />
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="mt-auto pb-2">
              <LogoutButton compact />
            </div>
          </div>
        ) : (
          <div
            className={[
              "workspace-sidebar relative z-20 flex min-h-screen",
              "w-[280px]",
            ].join(" ")}
          >
            <div className="workspace-sidebar-top">
              <Link
                href={`/w/${props.workspaceSlug}`}
                className="flex min-w-0 items-center gap-3 font-semibold tracking-tight text-slate-950"
                title="Aceync workspace home"
              >
                <LoopMark className="h-9 w-9 shrink-0 text-slate-950" />
                <span className="truncate">Aceync</span>
              </Link>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-800 shadow-[0_10px_28px_-22px_rgba(4,12,27,0.24)] hover:border-slate-400 hover:bg-slate-50"
                onClick={() => {
                  setCollapsed(true);
                }}
                aria-label="Collapse sidebar"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="workspace-sidebar-section">
              <button
                type="button"
                className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-slate-300 bg-white px-3 py-3 text-left text-sm font-medium text-slate-950 transition hover:border-slate-400 hover:bg-slate-50"
                onClick={() => window.dispatchEvent(new CustomEvent("aceync:ask-open"))}
                title="Ask Ace"
              >
                <span className="workspace-nav-icon">
                  <SearchIcon className="h-[17px] w-[17px]" />
                </span>
                <>
                  <span className="truncate">Ask Ace</span>
                  <span className="ml-auto text-[11px] uppercase tracking-[0.16em] text-slate-500">⌘K</span>
                </>
              </button>
              <div className="workspace-sidebar-label">Workspace</div>
              <nav className="grid gap-1.5">
                {navItems.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={["workspace-nav-link", active ? "workspace-nav-link-active" : ""].join(" ")}
                      title={item.label}
                      aria-current={active ? "page" : undefined}
                    >
                      <span className="workspace-nav-icon">
                        <item.icon className="h-[17px] w-[17px]" />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="workspace-sidebar-section">
              <div className="workspace-sidebar-label">Recent artifacts</div>
              <div className="grid gap-1.5">
                {props.recentArtifacts.slice(0, 7).map((artifact) => {
                  const href = `/w/${props.workspaceSlug}/artifacts/${artifact.id}`;
                  const active = pathname === href;
                  return (
                    <Link
                      key={artifact.id}
                      href={href}
                      title={artifact.title}
                      className={[
                        "min-w-0 overflow-hidden rounded-2xl border px-3 py-2.5 text-sm transition",
                        active
                          ? "border-slate-900 bg-slate-950 text-white"
                          : "border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <div className="flex min-w-0 items-start gap-2">
                        <span
                          className={[
                            "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border",
                            active
                              ? "border-white/15 bg-white/10 text-white"
                              : "border-slate-300 bg-white text-slate-600",
                          ].join(" ")}
                        >
                          <NewDocIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium leading-5">{artifact.title}</div>
                          <div className="mt-0.5 text-[11px] text-slate-600">
                            {new Date(artifact.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="mt-auto border-t border-slate-300 px-3 py-4">
              <div className="mb-3 text-xs text-slate-600">
                {props.workspaceSlug} · {props.role}
              </div>
              <LogoutButton compact={false} />
            </div>
          </div>
        )}
      </aside>

      <div className="min-w-0 flex-1 lg:min-h-screen">{props.children}</div>
    </div>
  );
}
