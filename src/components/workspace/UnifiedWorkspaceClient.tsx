"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { FolderStructureForm } from "@/src/components/folders/FolderStructureForm";
import { FolderCard } from "@/src/components/folders/FolderCard";
import {
  ChevronDownIcon,
  ArrowUpRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
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

type UnifiedFolderArtifact = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  excerpt: string | null;
};

type UnifiedSuggestedBlock = {
  key: string;
  type: string;
  title: string | null;
  contentMd: string;
};

type UnifiedFolder = {
  key: string;
  id: string;
  slug: string;
  name: string;
  kind: "folder" | "smart";
  artifactCount: number;
  updatedAt: string | null;
  artifacts: UnifiedFolderArtifact[];
  suggestedBlocks: UnifiedSuggestedBlock[];
};

type UnifiedInboxItem = {
  id: string;
  intent: string;
  createdAt: string;
  preview: string | null;
};

type UnifiedTemplate = {
  slug: string;
  name: string;
  group: string;
};

type UnifiedTab = "artifacts" | "folders" | "inbox";
type FolderViewMode = "list" | "grid";

type FolderDetailResponse = {
  folder: {
    id: string;
    name: string;
    structureVersion: number;
    updatedAt: string;
    schema: {
      defaultBlocks: Array<{
        key?: string;
        type: string;
        title?: string | null;
        contentMd?: string;
      }>;
    };
  };
  artifacts: Array<{
    id: string;
    title: string;
    status: string;
    updated_at: string;
  }>;
};

export function UnifiedWorkspaceClient(props: {
  workspaceSlug: string;
  artifacts: UnifiedArtifact[];
  folders: UnifiedFolder[];
  inbox: UnifiedInboxItem[];
  templates: UnifiedTemplate[];
}) {
  const [tab, setTab] = useState<UnifiedTab>("artifacts");
  const [query, setQuery] = useState("");
  const [folderViewMode, setFolderViewMode] = useState<FolderViewMode>("list");
  const [selectedFolderKey, setSelectedFolderKey] = useState<string | null>(null);
  const [folderDetails, setFolderDetails] = useState<Record<string, FolderDetailResponse | null>>({});
  const [folderLoadingKey, setFolderLoadingKey] = useState<string | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [editingStructure, setEditingStructure] = useState(false);

  const counts = useMemo(
    () => ({
      artifacts: props.artifacts.length,
      folders: props.folders.length,
      inbox: props.inbox.length,
    }),
    [props.artifacts.length, props.folders.length, props.inbox.length],
  );

  const selectedFolder = props.folders.find((folder) => folder.key === selectedFolderKey) ?? null;
  const selectedFolderDetail = selectedFolder ? folderDetails[selectedFolder.key] ?? null : null;

  useEffect(() => {
    setEditingStructure(false);
  }, [selectedFolderKey]);

  useEffect(() => {
    if (!selectedFolder || selectedFolder.kind !== "folder" || folderDetails[selectedFolder.key]) return;

    let active = true;
    setFolderLoadingKey(selectedFolder.key);
    setFolderError(null);

    void fetch(`/api/workspaces/${props.workspaceSlug}/folders/${selectedFolder.id}`)
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as FolderDetailResponse | { error?: string } | null;
        if (
          !response.ok ||
          !data ||
          typeof data !== "object" ||
          !("folder" in data) ||
          !("artifacts" in data)
        ) {
          throw new Error(data && "error" in data ? data.error ?? "Could not load folder" : "Could not load folder");
        }
        if (!active) return;
        setFolderDetails((current) => ({ ...current, [selectedFolder.key]: data }));
      })
      .catch((error: unknown) => {
        if (!active) return;
        setFolderError(error instanceof Error ? error.message : "Could not load folder");
      })
      .finally(() => {
        if (active) setFolderLoadingKey(null);
      });

    return () => {
      active = false;
    };
  }, [folderDetails, props.workspaceSlug, selectedFolder]);

  function openAskAce() {
    const trimmed = query.trim();
    window.dispatchEvent(
      new CustomEvent("aceync:ask-open", {
        detail: trimmed ? { query: trimmed } : {},
      }),
    );
  }

  const activeArtifacts =
    selectedFolder?.kind === "folder" && selectedFolderDetail
      ? selectedFolderDetail.artifacts.map((artifact) => ({
          id: artifact.id,
          title: artifact.title,
          status: artifact.status,
          updatedAt: artifact.updated_at,
          excerpt: null,
        }))
      : selectedFolder?.artifacts ?? [];

  return (
    <main className="px-3 py-3 lg:px-5 lg:py-4">
      <section className="rounded-[30px] border border-slate-300 bg-white shadow-[0_24px_80px_-56px_rgba(15,23,42,0.22)]">
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
              <SparkIcon className="h-4 w-4" />
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

        <div className="px-4 py-4 lg:px-5 lg:py-5">
          {tab === "artifacts" ? (
            <ArtifactList workspaceSlug={props.workspaceSlug} artifacts={props.artifacts} />
          ) : null}

          {tab === "folders" ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                  {selectedFolder && folderViewMode === "grid" ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:border-slate-400 hover:bg-slate-50"
                      onClick={() => setSelectedFolderKey(null)}
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                      Back
                    </button>
                  ) : null}
                  <div className="text-sm font-medium text-slate-900">
                    {folderViewMode === "grid" && selectedFolder ? selectedFolder.name : "Folders"}
                  </div>
                </div>

                <div className="inline-flex rounded-full border border-slate-300 bg-slate-50 p-1">
                  <button
                    type="button"
                    className={[
                      "rounded-full px-3 py-1.5 text-xs font-medium transition",
                      folderViewMode === "list" ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-white",
                    ].join(" ")}
                    onClick={() => setFolderViewMode("list")}
                  >
                    List
                  </button>
                  <button
                    type="button"
                    className={[
                      "rounded-full px-3 py-1.5 text-xs font-medium transition",
                      folderViewMode === "grid" ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-white",
                    ].join(" ")}
                    onClick={() => setFolderViewMode("grid")}
                  >
                    Grid
                  </button>
                </div>
              </div>

              {folderViewMode === "list" ? (
                <InlineFolderBrowser
                  workspaceSlug={props.workspaceSlug}
                  folders={props.folders}
                  selectedFolderKey={selectedFolderKey}
                  selectedFolderDetail={selectedFolder?.kind === "folder" ? selectedFolderDetail : null}
                  folderLoadingKey={folderLoadingKey}
                  folderError={folderError}
                  templates={props.templates}
                  editingStructure={editingStructure}
                  onToggleFolder={(folderKey) =>
                    setSelectedFolderKey((current) => (current === folderKey ? null : folderKey))
                  }
                  onToggleStructureEdit={() => setEditingStructure((current) => !current)}
                />
              ) : !selectedFolder ? (
                <FolderBrowser
                  folders={props.folders}
                  viewMode={folderViewMode}
                  onOpenFolder={(folderKey) => setSelectedFolderKey(folderKey)}
                />
              ) : (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <section className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                      <div className="text-sm font-medium text-slate-900">
                        {activeArtifacts.length} item{activeArtifacts.length === 1 ? "" : "s"}
                      </div>
                      <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-700">
                        {selectedFolder.kind === "folder" ? "Saved folder" : "Suggested cluster"}
                      </span>
                    </div>

                    <div className="mt-4">
                      <FolderArtifactList
                        workspaceSlug={props.workspaceSlug}
                        artifacts={activeArtifacts}
                        viewMode={folderViewMode}
                      />
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                      <div className="text-sm font-medium text-slate-900">Structure</div>
                      {selectedFolder.kind === "folder" && selectedFolderDetail ? (
                        <button
                          type="button"
                          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                          onClick={() => setEditingStructure((current) => !current)}
                        >
                          {editingStructure ? "Hide editor" : "Edit"}
                        </button>
                      ) : null}
                    </div>

                    {selectedFolder.kind === "smart" ? (
                      <div className="mt-4 grid gap-2">
                        {selectedFolder.suggestedBlocks.length > 0 ? (
                          selectedFolder.suggestedBlocks.map((block) => (
                            <div
                              key={block.key}
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                            >
                              <div className="text-sm font-medium text-slate-900">
                                {block.title ?? humanizeType(block.type)}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">{humanizeType(block.type)}</div>
                            </div>
                          ))
                        ) : (
                          <EmptyState label="No structure inferred yet." />
                        )}
                      </div>
                    ) : folderLoadingKey === selectedFolder.key ? (
                      <EmptyState label="Loading folder…" />
                    ) : folderError ? (
                      <EmptyState label={folderError} />
                    ) : selectedFolderDetail ? (
                      <div className="mt-4 grid gap-4">
                        {!editingStructure ? (
                          <div className="grid gap-2">
                            {selectedFolderDetail.folder.schema.defaultBlocks.map((block, index) => (
                              <div
                                key={block.key ?? `${block.type}-${index}`}
                                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                              >
                                <div className="text-sm font-medium text-slate-900">
                                  {block.title ?? humanizeType(block.type)}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">{humanizeType(block.type)}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <FolderStructureForm
                            workspaceSlug={props.workspaceSlug}
                            mode="edit"
                            folderId={selectedFolderDetail.folder.id}
                            initialName={selectedFolderDetail.folder.name}
                            initialBlocks={selectedFolderDetail.folder.schema.defaultBlocks.map((block, index) => ({
                              key: block.key ?? `${block.type}-${index + 1}`,
                              type: block.type,
                              title: block.title ?? "",
                              contentMd: block.contentMd ?? "",
                            }))}
                            templates={props.templates}
                          />
                        )}
                      </div>
                    ) : (
                      <EmptyState label="Select a folder to inspect it." />
                    )}
                  </section>
                </div>
              )}
            </div>
          ) : null}

          {tab === "inbox" ? <InboxList workspaceSlug={props.workspaceSlug} inbox={props.inbox} /> : null}
        </div>
      </section>
    </main>
  );
}

function ArtifactList(props: { workspaceSlug: string; artifacts: UnifiedArtifact[] }) {
  return (
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
            {artifact.excerpt ? <div className="mt-1 truncate text-sm text-slate-700">{artifact.excerpt}</div> : null}
          </div>
          <div className="flex items-center justify-end">
            <ArrowUpRightIcon className="h-4 w-4 text-slate-400 transition group-hover:text-slate-900" />
          </div>
        </Link>
      ))}
      {props.artifacts.length === 0 ? <EmptyState label="No artifacts yet." /> : null}
    </div>
  );
}

function FolderBrowser(props: {
  folders: UnifiedFolder[];
  viewMode: FolderViewMode;
  onOpenFolder: (folderKey: string) => void;
}) {
  if (props.folders.length === 0) return <EmptyState label="No folders yet." />;

  if (props.viewMode === "grid") {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {props.folders.map((folder) => (
          <button key={folder.key} type="button" className="text-left" onClick={() => props.onOpenFolder(folder.key)}>
            <FolderCard
              name={folder.name}
              subtitle={folder.kind === "folder" ? "Saved folder" : "Suggested cluster"}
              meta={folder.updatedAt ? formatDate(folder.updatedAt) : null}
              count={folder.artifactCount}
              lead={folder.artifacts[0]?.excerpt ?? "Open to inspect artifacts and structure."}
              chips={folder.suggestedBlocks.slice(0, 2).map((block) => block.title ?? humanizeType(block.type))}
              kind={folder.kind}
            />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {props.folders.map((folder) => (
        <button
          key={folder.key}
          type="button"
          className="group flex items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-400 hover:bg-slate-50/60"
          onClick={() => props.onOpenFolder(folder.key)}
        >
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-slate-950">{folder.name}</div>
            <div className="mt-1 text-xs text-slate-600">
              {folder.kind === "folder" ? "Saved folder" : "Suggested cluster"}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700">
              {folder.artifactCount} doc{folder.artifactCount === 1 ? "" : "s"}
            </span>
            <ArrowUpRightIcon className="h-4 w-4 text-slate-400 transition group-hover:text-slate-900" />
          </div>
        </button>
      ))}
    </div>
  );
}

function InlineFolderBrowser(props: {
  workspaceSlug: string;
  folders: UnifiedFolder[];
  selectedFolderKey: string | null;
  selectedFolderDetail: FolderDetailResponse | null;
  folderLoadingKey: string | null;
  folderError: string | null;
  templates: UnifiedTemplate[];
  editingStructure: boolean;
  onToggleFolder: (folderKey: string) => void;
  onToggleStructureEdit: () => void;
}) {
  if (props.folders.length === 0) return <EmptyState label="No folders yet." />;

  return (
    <div className="grid gap-2">
      {props.folders.map((folder) => {
        const open = props.selectedFolderKey === folder.key;
        const detail = open && folder.kind === "folder" ? props.selectedFolderDetail : null;
        const activeArtifacts =
          folder.kind === "folder" && detail
            ? detail.artifacts.map((artifact) => ({
                id: artifact.id,
                title: artifact.title,
                status: artifact.status,
                updatedAt: artifact.updated_at,
                excerpt: null,
              }))
            : folder.artifacts;

        return (
          <div key={folder.key} className="rounded-[24px] border border-slate-200 bg-white">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50/70"
              onClick={() => props.onToggleFolder(folder.key)}
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="truncate text-[15px] font-semibold text-slate-950">{folder.name}</div>
                  <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    {folder.kind === "folder" ? "Saved" : "Suggested"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  {folder.artifactCount} item{folder.artifactCount === 1 ? "" : "s"}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                  {folder.artifactCount} doc{folder.artifactCount === 1 ? "" : "s"}
                </span>
                {open ? (
                  <ChevronDownIcon className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4 text-slate-500" />
                )}
              </div>
            </button>

            {open ? (
              <div className="border-t border-slate-200 px-4 py-4">
                <div className="grid gap-4">
                  <section className="grid gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Artifacts</div>
                      {folder.updatedAt ? (
                        <div className="text-xs text-slate-500">{formatDate(folder.updatedAt)}</div>
                      ) : null}
                    </div>
                    <FolderArtifactList
                      workspaceSlug={props.workspaceSlug}
                      artifacts={activeArtifacts}
                      viewMode="list"
                    />
                  </section>

                  <section className="grid gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Structure</div>
                      {folder.kind === "folder" && detail ? (
                        <button
                          type="button"
                          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                          onClick={props.onToggleStructureEdit}
                        >
                          {props.editingStructure ? "Done" : "Edit"}
                        </button>
                      ) : null}
                    </div>

                    {folder.kind === "smart" ? (
                      folder.suggestedBlocks.length > 0 ? (
                        <div className="grid gap-2">
                          {folder.suggestedBlocks.map((block) => (
                            <div
                              key={block.key}
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                            >
                              <div className="text-sm font-medium text-slate-900">
                                {block.title ?? humanizeType(block.type)}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">{humanizeType(block.type)}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState label="No structure inferred yet." />
                      )
                    ) : props.folderLoadingKey === folder.key ? (
                      <EmptyState label="Loading folder…" />
                    ) : props.folderError ? (
                      <EmptyState label={props.folderError} />
                    ) : detail ? (
                      props.editingStructure ? (
                        <FolderStructureForm
                          workspaceSlug={props.workspaceSlug}
                          mode="edit"
                          folderId={detail.folder.id}
                          initialName={detail.folder.name}
                          initialBlocks={detail.folder.schema.defaultBlocks.map((block, index) => ({
                            key: block.key ?? `${block.type}-${index + 1}`,
                            type: block.type,
                            title: block.title ?? "",
                            contentMd: block.contentMd ?? "",
                          }))}
                          templates={props.templates}
                        />
                      ) : (
                        <div className="grid gap-2">
                          {detail.folder.schema.defaultBlocks.map((block, index) => (
                            <div
                              key={block.key ?? `${block.type}-${index}`}
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                            >
                              <div className="text-sm font-medium text-slate-900">
                                {block.title ?? humanizeType(block.type)}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">{humanizeType(block.type)}</div>
                            </div>
                          ))}
                        </div>
                      )
                    ) : (
                      <EmptyState label="Open a folder to inspect it." />
                    )}
                  </section>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function FolderArtifactList(props: {
  workspaceSlug: string;
  artifacts: Array<{ id: string; title: string; status: string; updatedAt: string; excerpt: string | null }>;
  viewMode: FolderViewMode;
}) {
  if (props.artifacts.length === 0) return <EmptyState label="This folder is empty." />;

  if (props.viewMode === "grid") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {props.artifacts.map((artifact) => (
          <Link
            key={artifact.id}
            href={`/w/${props.workspaceSlug}/artifacts/${artifact.id}`}
            className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 transition hover:border-slate-400 hover:bg-slate-50/60"
          >
            <div className="truncate text-sm font-semibold text-slate-950">{artifact.title}</div>
            <div className="mt-1 text-xs text-slate-600">{formatDate(artifact.updatedAt)}</div>
            {artifact.excerpt ? (
              <div
                className="mt-2 text-sm text-slate-700"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {artifact.excerpt}
              </div>
            ) : null}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {props.artifacts.map((artifact) => (
        <Link
          key={artifact.id}
          href={`/w/${props.workspaceSlug}/artifacts/${artifact.id}`}
          className="group grid gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-400 hover:bg-slate-50/60 lg:grid-cols-[minmax(0,1fr)_auto]"
        >
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-slate-950">{artifact.title}</div>
            <div className="mt-1 text-xs text-slate-600">{formatDate(artifact.updatedAt)}</div>
            {artifact.excerpt ? <div className="mt-1 truncate text-sm text-slate-700">{artifact.excerpt}</div> : null}
          </div>
          <div className="flex items-center justify-end">
            <ArrowUpRightIcon className="h-4 w-4 text-slate-400 transition group-hover:text-slate-900" />
          </div>
        </Link>
      ))}
    </div>
  );
}

function InboxList(props: { workspaceSlug: string; inbox: UnifiedInboxItem[] }) {
  return (
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
  );
}

function TabButton(props: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={[
        "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition",
        props.active ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-white",
      ].join(" ")}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

function EmptyState(props: { label: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
      {props.label}
    </div>
  );
}

function humanizeType(type: string) {
  return type
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
