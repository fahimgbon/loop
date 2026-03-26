"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  ArrowUpRightIcon,
  FolderIcon,
  NewDocIcon,
  SearchIcon,
  SparkIcon,
} from "@/src/components/icons/LoopIcons";

type UnifiedArtifact = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  groupName: string;
  excerpt: string | null;
};

type UnifiedFolder = {
  key: string;
  id: string;
  slug: string;
  name: string;
  kind: "folder" | "smart";
  artifactCount: number;
  updatedAt: string | null;
};

type UnifiedInboxItem = {
  id: string;
  intent: string;
  createdAt: string;
  preview: string | null;
};

type UnifiedTab = "artifacts" | "folders" | "inbox";

export function UnifiedWorkspaceClient(props: {
  workspaceSlug: string;
  artifacts: UnifiedArtifact[];
  folders: UnifiedFolder[];
  inbox: UnifiedInboxItem[];
}) {
  const [tab, setTab] = useState<UnifiedTab>("artifacts");
  const [query, setQuery] = useState("");

  const counts = useMemo(
    () => ({
      artifacts: props.artifacts.length,
      folders: props.folders.length,
      inbox: props.inbox.length,
    }),
    [props.artifacts.length, props.folders.length, props.inbox.length],
  );

  function openAskAce() {
    const trimmed = query.trim();
    window.dispatchEvent(
      new CustomEvent("aceync:ask-open", {
        detail: trimmed ? { query: trimmed } : {},
      }),
    );
  }

  return (
    <main className="px-3 py-3 lg:px-5 lg:py-4">
      <section className="overflow-hidden rounded-[30px] border border-slate-300 bg-white shadow-[0_24px_80px_-56px_rgba(15,23,42,0.22)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 lg:px-6">
          <div>
            <h1 className="text-[2rem] font-semibold tracking-[-0.05em] text-slate-950">Unified</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/w/${props.workspaceSlug}/artifacts/new`}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <NewDocIcon className="h-4 w-4" />
              New artifact
            </Link>
            <Link
              href={`/w/${props.workspaceSlug}/folders/new`}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:border-slate-400 hover:bg-slate-50"
            >
              <FolderIcon className="h-4 w-4" />
              New folder
            </Link>
          </div>
        </div>

        <div className="border-b border-slate-200 px-5 py-4 lg:px-6">
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              openAskAce();
            }}
          >
            <label className="flex min-w-0 flex-1 items-center gap-3 rounded-[22px] border border-slate-300 bg-white px-4 py-3 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.16)]">
              <SearchIcon className="h-5 w-5 shrink-0 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ask Ace"
                className="w-full min-w-0 bg-transparent text-[15px] text-slate-950 outline-none placeholder:text-slate-500"
              />
            </label>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-[22px] bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <LoopAccent />
              Ask Ace
            </button>
          </form>
        </div>

        <div className="border-b border-slate-200 px-5 py-3 lg:px-6">
          <div className="inline-flex rounded-full border border-slate-300 bg-slate-50 p-1">
            <TabButton active={tab === "artifacts"} onClick={() => setTab("artifacts")}>
              Artifacts
              <span className="text-slate-500">{counts.artifacts}</span>
            </TabButton>
            <TabButton active={tab === "folders"} onClick={() => setTab("folders")}>
              Folders
              <span className="text-slate-500">{counts.folders}</span>
            </TabButton>
            <TabButton active={tab === "inbox"} onClick={() => setTab("inbox")}>
              Inbox
              <span className="text-slate-500">{counts.inbox}</span>
            </TabButton>
          </div>
        </div>

        <div className="px-3 py-3 lg:px-4 lg:py-4">
          {tab === "artifacts" ? (
            <div className="grid gap-2">
              {props.artifacts.slice(0, 10).map((artifact) => (
                <Link
                  key={artifact.id}
                  href={`/w/${props.workspaceSlug}/artifacts/${artifact.id}`}
                  className="group grid gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-400 hover:bg-slate-50/60 lg:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[15px] font-semibold text-slate-950">{artifact.title}</span>
                      <span className="shrink-0 rounded-full border border-slate-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                        {artifact.status}
                      </span>
                    </div>
                    <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-slate-600">
                      <span className="truncate">{artifact.groupName}</span>
                      <span className="text-slate-300">•</span>
                      <span className="shrink-0">{formatDate(artifact.updatedAt)}</span>
                    </div>
                    {artifact.excerpt ? (
                      <div className="mt-1 truncate text-sm text-slate-700">{artifact.excerpt}</div>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-end">
                    <ArrowUpRightIcon className="h-4 w-4 text-slate-400 transition group-hover:text-slate-900" />
                  </div>
                </Link>
              ))}
              {props.artifacts.length === 0 ? <EmptyState label="No artifacts yet." /> : null}
            </div>
          ) : null}

          {tab === "folders" ? (
            <div className="grid gap-2">
              {props.folders.map((folder) => (
                <Link
                  key={folder.key}
                  href={
                    folder.kind === "folder"
                      ? `/w/${props.workspaceSlug}/folders/${folder.id}`
                      : `/w/${props.workspaceSlug}/search?q=${encodeURIComponent(folder.name)}`
                  }
                  className="group grid gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-400 hover:bg-slate-50/60 lg:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={[
                        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
                        folder.kind === "folder"
                          ? "border-slate-300 bg-white text-slate-800"
                          : "border-sky-200 bg-sky-50 text-sky-700",
                      ].join(" ")}
                    >
                      {folder.kind === "folder" ? (
                        <FolderIcon className="h-4 w-4" />
                      ) : (
                        <SparkIcon className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold text-slate-950">{folder.name}</div>
                      <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-slate-600">
                        <span className="shrink-0 rounded-full border border-slate-300 px-2 py-0.5 font-medium text-slate-700">
                          {folder.kind === "folder" ? "Saved" : "Suggested"}
                        </span>
                        {folder.updatedAt ? (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="shrink-0">{formatDate(folder.updatedAt)}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                      {folder.artifactCount} doc{folder.artifactCount === 1 ? "" : "s"}
                    </span>
                    <ArrowUpRightIcon className="h-4 w-4 text-slate-400 transition group-hover:text-slate-900" />
                  </div>
                </Link>
              ))}
              {props.folders.length === 0 ? <EmptyState label="No folders yet." /> : null}
            </div>
          ) : null}

          {tab === "inbox" ? (
            <div className="grid gap-2">
              {props.inbox.slice(0, 10).map((item) => (
                <Link
                  key={item.id}
                  href={`/w/${props.workspaceSlug}/inbox#inbox-${item.id}`}
                  className="group grid gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-400 hover:bg-slate-50/60 lg:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 rounded-full border border-slate-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                        {item.intent}
                      </span>
                      <span className="truncate text-[15px] font-semibold text-slate-950">
                        {item.preview ?? "Untitled note"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">{formatDate(item.createdAt)}</div>
                  </div>
                  <div className="flex items-center justify-end">
                    <ArrowUpRightIcon className="h-4 w-4 text-slate-400 transition group-hover:text-slate-900" />
                  </div>
                </Link>
              ))}
              {props.inbox.length === 0 ? <EmptyState label="Inbox is clear." /> : null}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function TabButton(props: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition",
        props.active ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-900",
      ].join(" ")}
    >
      {props.children}
    </button>
  );
}

function EmptyState(props: { label: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600">
      {props.label}
    </div>
  );
}

function LoopAccent() {
  return <SearchIcon className="h-4 w-4 text-white" />;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
