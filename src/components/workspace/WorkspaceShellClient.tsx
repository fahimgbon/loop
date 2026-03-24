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
  const expanded = !collapsed;

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
            <span>Loop</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{props.workspaceSlug}</div>
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
                  ? "border-slate-300 bg-white text-slate-900"
                  : "border-slate-200 bg-white/90 text-slate-700",
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
          collapsed ? "w-[76px]" : "w-[280px]",
        ].join(" ")}
      >
        <div
          className={[
            "workspace-sidebar relative z-20 flex min-h-screen",
            collapsed ? "w-[76px]" : "w-[280px]",
          ].join(" ")}
        >
          <div className="workspace-sidebar-top">
            <Link
              href={`/w/${props.workspaceSlug}`}
              className="flex min-w-0 items-center gap-3 font-semibold tracking-tight text-slate-950"
              title="Loop workspace home"
            >
              <LoopMark className="h-9 w-9 shrink-0 text-slate-950" />
              {expanded ? <span className="truncate">Loop</span> : null}
            </Link>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              onClick={() => {
                setCollapsed((value) => !value);
              }}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
            </button>
          </div>

          <div className="workspace-sidebar-section">
            <div className="workspace-sidebar-label">{expanded ? "Workspace" : "Go"}</div>
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
                    {expanded ? <span className="truncate">{item.label}</span> : null}
                  </Link>
                );
              })}
            </nav>
          </div>

          {expanded ? (
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
                        "min-w-0 overflow-hidden rounded-2xl px-3 py-2.5 text-sm transition",
                        active ? "bg-white text-slate-950 shadow-sm" : "text-slate-700 hover:bg-white",
                      ].join(" ")}
                    >
                      <div className="flex min-w-0 items-start gap-2">
                        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                          <NewDocIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium leading-5">{artifact.title}</div>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            {new Date(artifact.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-auto border-t border-slate-200/70 px-3 py-4">
            {expanded ? (
              <div className="mb-3 text-xs text-slate-400">
                {props.workspaceSlug} · {props.role}
              </div>
            ) : null}
            <LogoutButton compact={!expanded} />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:min-h-screen">{props.children}</div>
    </div>
  );
}
