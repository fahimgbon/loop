"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/src/components/Button";
import {
  FolderIcon,
  NewDocIcon,
  SearchIcon,
  SparkIcon,
} from "@/src/components/icons/LoopIcons";
import { Input } from "@/src/components/Input";

type BlockSummary = {
  title: string | null;
  type: string;
};

type ExplorerArtifact = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  folder_id: string | null;
  folder_name: string | null;
  browse_group_key: string;
  browse_group_name: string;
  browse_group_kind: "folder" | "smart";
  inferred_template_slug: string;
  summary_blocks: BlockSummary[];
};

type ExplorerFolder = {
  key: string;
  id: string;
  slug: string;
  name: string;
  kind: "folder" | "smart";
  templateSlug: string | null;
  artifactCount: number;
  updatedAt: string | null;
  artifacts: ExplorerArtifact[];
  suggestedBlocks: Array<{ key: string; type: string; title: string | null; contentMd: string }>;
};

type SearchResult = {
  artifacts: ExplorerArtifact[];
  blocks: Array<{
    block_id: string;
    block_title: string | null;
    block_type: string;
    artifact_id: string;
    artifact_title: string;
    browse_group_key: string;
    browse_group_name: string;
    browse_group_kind: "folder" | "smart";
  }>;
  folders: ExplorerFolder[];
  templates: Array<{ slug: string; name: string; group: string }>;
};

type FacetOption = {
  key: string;
  label: string;
  count: number;
};

const selectClassName =
  "rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5";

function getApiError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const error = (payload as Record<string, unknown>).error;
  return typeof error === "string" && error.trim().length ? error : null;
}

export function SearchWorkspaceClient(props: {
  workspaceSlug: string;
  initialResult: SearchResult;
}) {
  const router = useRouter();
  const workspaceSlug = props.workspaceSlug;
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult>(props.initialResult);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolderKey, setSelectedFolderKey] = useState("all");
  const [selectedFacetKey, setSelectedFacetKey] = useState<string | null>(null);
  const [composer, setComposer] = useState<"folder" | "artifact" | null>(null);
  const [folderName, setFolderName] = useState("");
  const [folderTemplateSlug, setFolderTemplateSlug] = useState("prd");
  const [artifactTitle, setArtifactTitle] = useState("");
  const [artifactTargetKey, setArtifactTargetKey] = useState("smart:prd");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const skippedInitialFetch = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    if (!skippedInitialFetch.current && q.trim().length === 0 && refreshTick === 0) {
      skippedInitialFetch.current = true;
      return () => controller.abort();
    }

    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/workspaces/${workspaceSlug}/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => null)) as SearchResult | { error?: string } | null;
        if (!res.ok) throw new Error(getApiError(data) ?? "Search failed");
        if (!cancelled) setResult(data as SearchResult);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (!cancelled) setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, q.trim().length === 0 ? 0 : 180);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [q, refreshTick, workspaceSlug]);

  useEffect(() => {
    const allowed = new Set(["all", ...result.folders.map((folder) => folder.key)]);
    if (!allowed.has(selectedFolderKey)) setSelectedFolderKey("all");
  }, [result, selectedFolderKey]);

  useEffect(() => {
    setSelectedFacetKey(null);
  }, [selectedFolderKey, q]);

  const actualFolders = useMemo(
    () => result.folders.filter((folder) => folder.kind === "folder"),
    [result],
  );
  const smartFolders = useMemo(
    () => result.folders.filter((folder) => folder.kind === "smart"),
    [result],
  );

  const allArtifacts = useMemo(() => {
    const deduped = new Map<string, ExplorerArtifact>();
    for (const folder of result.folders) {
      for (const artifact of folder.artifacts) deduped.set(artifact.id, artifact);
    }
    return Array.from(deduped.values()).sort(
      (left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
    );
  }, [result]);

  const selectedFolder =
    selectedFolderKey === "all"
      ? null
      : (result.folders.find((folder) => folder.key === selectedFolderKey) ?? null);

  const browseArtifacts = useMemo(() => {
    const base = selectedFolder ? selectedFolder.artifacts : allArtifacts;
    if (!selectedFacetKey) return base;
    return base.filter((artifact) => artifactMatchesFacet(artifact, selectedFacetKey));
  }, [allArtifacts, selectedFacetKey, selectedFolder]);

  const facetOptions = useMemo(
    () => buildFacetOptions(selectedFolder ? selectedFolder.artifacts : allArtifacts),
    [allArtifacts, selectedFolder],
  );

  const searchArtifacts = useMemo(() => {
    let matches = result.artifacts;
    if (selectedFolderKey !== "all") {
      matches = matches.filter((artifact) => artifact.browse_group_key === selectedFolderKey);
    }
    if (selectedFacetKey) {
      matches = matches.filter((artifact) => artifactMatchesFacet(artifact, selectedFacetKey));
    }
    return matches;
  }, [result, selectedFacetKey, selectedFolderKey]);

  const searchBlocks = useMemo(() => {
    let matches = result.blocks;
    if (selectedFolderKey !== "all") {
      matches = matches.filter((block) => block.browse_group_key === selectedFolderKey);
    }
    if (selectedFacetKey) {
      matches = matches.filter((block) => blockMatchesFacet(block, selectedFacetKey));
    }
    return matches;
  }, [result, selectedFacetKey, selectedFolderKey]);

  const artifactTargetOptions = useMemo(() => {
    const folderOptions = result.folders.map((folder) => ({
      key: folder.key,
      label: folder.kind === "folder" ? folder.name : `${folder.name} (smart)`,
      hint: folder.kind === "folder" ? "Create inside folder" : "Use inferred structure",
    }));
    if (folderOptions.length > 0) return folderOptions;
    return [{ key: "smart:prd", label: "PRD (smart)", hint: "Use inferred PRD structure" }];
  }, [result]);

  const artifactTarget =
    result.folders.find((folder) => folder.key === artifactTargetKey) ??
    smartFolders.find((folder) => folder.key === artifactTargetKey) ??
    null;

  function openFolderComposer() {
    setComposer("folder");
    setCreateError(null);
    setFolderName(selectedFolder?.kind === "smart" ? selectedFolder.name : "");
    setFolderTemplateSlug(selectedFolder?.templateSlug ?? "prd");
  }

  function openArtifactComposer() {
    setComposer("artifact");
    setCreateError(null);
    setArtifactTitle("");
    setArtifactTargetKey(
      selectedFolder?.key ?? artifactTargetOptions[0]?.key ?? "smart:prd",
    );
  }

  async function createFolder(event: React.FormEvent) {
    event.preventDefault();
    const name = folderName.trim();
    if (!name) return;

    setCreateBusy(true);
    setCreateError(null);
    try {
      const payload =
        selectedFolder?.kind === "smart" && selectedFolder.suggestedBlocks.length > 0
          ? { name, blocks: selectedFolder.suggestedBlocks }
          : { name, templateSlug: folderTemplateSlug };

      const res = await fetch(`/api/workspaces/${workspaceSlug}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; folderId?: string; error?: string }
        | null;
      if (!res.ok || !data?.ok || !data.folderId) throw new Error(data?.error ?? "Could not create folder");

      setComposer(null);
      setSelectedFolderKey(`folder:${data.folderId}`);
      setRefreshTick((value) => value + 1);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create folder");
    } finally {
      setCreateBusy(false);
    }
  }

  async function createArtifact(event: React.FormEvent) {
    event.preventDefault();
    const title = artifactTitle.trim();
    if (!title) return;

    setCreateBusy(true);
    setCreateError(null);
    try {
      const payload =
        artifactTarget?.kind === "folder"
          ? { title, folderId: artifactTarget.id }
          : { title, templateSlug: artifactTarget?.templateSlug ?? "prd" };

      const res = await fetch(`/api/workspaces/${workspaceSlug}/artifacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; artifactId?: string; error?: string }
        | null;
      if (!res.ok || !data?.ok || !data.artifactId) throw new Error(data?.error ?? "Could not create artifact");

      router.push(`/w/${workspaceSlug}/artifacts/${data.artifactId}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create artifact");
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <main className="px-3 py-3 lg:px-5 lg:py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm">
            <SearchIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">Search</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Browse artifacts like a quiet file browser, with smart buckets inferred from the blocks inside each doc.
            </p>
          </div>
        </div>
      </div>

      <section className="mt-5 overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/84 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.28)] backdrop-blur-2xl">
        <div className="border-b border-slate-200/80 px-5 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex-1">
              <Input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search artifacts, block titles, or phrases…"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={openFolderComposer}>
                <FolderIcon className="h-4 w-4" />
                New folder
              </Button>
              <Button type="button" onClick={openArtifactComposer}>
                <NewDocIcon className="h-4 w-4" />
                New artifact
              </Button>
              {q.trim() ? (
                <Button type="button" variant="secondary" onClick={() => setQ("")}>
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
          <div className="mt-3 text-xs font-medium text-slate-500">
            {loading
              ? "Refreshing search and folder view…"
              : q.trim()
                ? "Search stays scoped to the folder you have selected."
                : "Use the left rail to move between real folders and inferred buckets."}
          </div>
        </div>

        {composer ? (
          <div className="border-b border-slate-200/80 bg-slate-50/80 px-5 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {composer === "folder" ? "Create folder" : "Create artifact"}
                </div>
                <div className="mt-1 text-sm leading-6 text-slate-600">
                  {composer === "folder"
                    ? selectedFolder?.kind === "smart"
                      ? `This will use the inferred block structure from ${selectedFolder.name}.`
                      : "Create a new folder without leaving Search."
                    : selectedFolder?.kind === "folder"
                      ? `The new artifact will open inside ${selectedFolder.name}.`
                      : "Create a new artifact from the current folder or smart bucket context."}
                </div>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setComposer(null);
                  setCreateError(null);
                }}
              >
                Close
              </button>
            </div>

            {composer === "folder" ? (
              <form className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]" onSubmit={createFolder}>
                <label className="grid gap-1 text-sm">
                  <span className="text-muted">Folder name</span>
                  <Input
                    value={folderName}
                    onChange={(event) => setFolderName(event.target.value)}
                    placeholder="e.g., Discovery archive"
                    required
                  />
                </label>

                {selectedFolder?.kind === "smart" ? (
                  <div className="grid gap-1 text-sm">
                    <span className="text-muted">Source</span>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                      {selectedFolder.name} block pattern
                    </div>
                  </div>
                ) : (
                  <label className="grid gap-1 text-sm">
                    <span className="text-muted">Starter structure</span>
                    <select
                      className={selectClassName}
                      value={folderTemplateSlug}
                      onChange={(event) => setFolderTemplateSlug(event.target.value)}
                    >
                      {result.templates.map((template) => (
                        <option key={template.slug} value={template.slug}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div className="flex items-end justify-end">
                  <Button type="submit" disabled={createBusy || !folderName.trim()}>
                    {createBusy ? "Creating…" : "Create folder"}
                  </Button>
                </div>
              </form>
            ) : (
              <form className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_240px_auto]" onSubmit={createArtifact}>
                <label className="grid gap-1 text-sm">
                  <span className="text-muted">Artifact title</span>
                  <Input
                    value={artifactTitle}
                    onChange={(event) => setArtifactTitle(event.target.value)}
                    placeholder="e.g., Stakeholder alignment artifact"
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-muted">Location</span>
                  <select
                    className={selectClassName}
                    value={artifactTargetKey}
                    onChange={(event) => setArtifactTargetKey(event.target.value)}
                  >
                    {artifactTargetOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end justify-end">
                  <Button type="submit" disabled={createBusy || !artifactTitle.trim()}>
                    {createBusy ? "Creating…" : "Create artifact"}
                  </Button>
                </div>
              </form>
            )}

            {createError ? <div className="mt-3 text-sm text-red-500">{createError}</div> : null}
          </div>
        ) : null}

        <div className="grid lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="overflow-x-hidden border-b border-slate-200/80 bg-slate-50/70 p-4 lg:border-b-0 lg:border-r">
            <div className="grid gap-5">
              <nav className="grid gap-1.5">
                <FolderNavButton
                  label="All files"
                  meta={String(allArtifacts.length)}
                  icon={<SearchIcon className="h-4 w-4" />}
                  active={selectedFolderKey === "all"}
                  onClick={() => setSelectedFolderKey("all")}
                />
              </nav>

              <div className="grid gap-2">
                <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Folders</div>
                {actualFolders.length > 0 ? (
                  <div className="grid gap-1.5">
                    {actualFolders.map((folder) => (
                      <FolderNavButton
                        key={folder.key}
                        label={folder.name}
                        meta={`${folder.artifactCount}`}
                        icon={<FolderIcon className="h-4 w-4" />}
                        active={selectedFolderKey === folder.key}
                        onClick={() => setSelectedFolderKey(folder.key)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="px-2 text-sm text-slate-600">No saved folders yet.</div>
                )}
              </div>

              <div className="grid gap-2">
                <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Inferred from blocks
                </div>
                {smartFolders.length > 0 ? (
                  <div className="grid gap-1.5">
                    {smartFolders.map((folder) => (
                      <FolderNavButton
                        key={folder.key}
                        label={folder.name}
                        meta={`${folder.artifactCount}`}
                        icon={<SparkIcon className="h-4 w-4" />}
                        active={selectedFolderKey === folder.key}
                        onClick={() => setSelectedFolderKey(folder.key)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="px-2 text-sm text-slate-600">Unfiled artifacts will appear here automatically.</div>
                )}
              </div>
            </div>
          </aside>

          <section className="min-w-0 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {selectedFolder?.kind === "smart"
                    ? "Smart bucket"
                    : selectedFolder?.kind === "folder"
                      ? "Folder"
                      : "Workspace browser"}
                </div>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-950">
                  {selectedFolder?.name ?? "All files"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {selectedFolder
                    ? selectedFolder.kind === "smart"
                      ? "These artifacts are grouped here from the block structure inside each doc."
                      : "Drill down by block themes or open the folder to edit its structure."
                    : "Choose a folder on the left, or stay here for a workspace-wide view."}
                </p>
              </div>

              {selectedFolder?.kind === "folder" ? (
                <Link
                  href={`/w/${workspaceSlug}/folders/${selectedFolder.id}`}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <FolderIcon className="h-4 w-4" />
                  Open folder
                </Link>
              ) : null}
            </div>

            {!q.trim() && facetOptions.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                <FacetChip
                  label="All blocks"
                  count={selectedFolder ? selectedFolder.artifactCount : allArtifacts.length}
                  active={selectedFacetKey === null}
                  onClick={() => setSelectedFacetKey(null)}
                />
                {facetOptions.map((facet) => (
                  <FacetChip
                    key={facet.key}
                    label={facet.label}
                    count={facet.count}
                    active={selectedFacetKey === facet.key}
                    onClick={() =>
                      setSelectedFacetKey((current) => (current === facet.key ? null : facet.key))
                    }
                  />
                ))}
              </div>
            ) : null}

            {error ? <div className="mt-5 text-sm font-medium text-red-600">{error}</div> : null}

            {q.trim() ? (
              <div className="mt-6 grid gap-6">
                <ResultSection
                  title="Artifacts"
                  subtitle={`${searchArtifacts.length} match${searchArtifacts.length === 1 ? "" : "es"}`}
                >
                  {searchArtifacts.length > 0 ? (
                    <ul className="grid gap-2">
                      {searchArtifacts.map((artifact) => (
                        <ArtifactListItem
                          key={artifact.id}
                          workspaceSlug={workspaceSlug}
                          artifact={artifact}
                          showLocation={selectedFolderKey === "all"}
                        />
                      ))}
                    </ul>
                  ) : (
                    <EmptyPanel message="No artifact titles match here." />
                  )}
                </ResultSection>

                <ResultSection
                  title="Blocks"
                  subtitle={`${searchBlocks.length} match${searchBlocks.length === 1 ? "" : "es"}`}
                >
                  {searchBlocks.length > 0 ? (
                    <ul className="grid gap-2">
                      {searchBlocks.map((block) => (
                        <li
                          key={block.block_id}
                          className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3"
                        >
                          <Link
                            className="block truncate text-sm font-semibold text-slate-900 hover:text-blue-600"
                            href={`/w/${workspaceSlug}/artifacts/${block.artifact_id}`}
                            title={block.artifact_title}
                          >
                            {block.artifact_title}
                          </Link>
                          <div className="mt-1 text-xs leading-5 text-slate-600">
                            {block.block_title || defaultBlockLabel(block.block_type)} · {defaultBlockLabel(block.block_type)}
                            {selectedFolderKey === "all" ? ` · ${block.browse_group_name}` : ""}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyPanel message="No blocks match this query." />
                  )}
                </ResultSection>
              </div>
            ) : (
              <div className="mt-6">
                {browseArtifacts.length > 0 ? (
                  <ul className="grid gap-2">
                    {browseArtifacts.map((artifact) => (
                      <ArtifactListItem
                        key={artifact.id}
                        workspaceSlug={workspaceSlug}
                        artifact={artifact}
                        showLocation={selectedFolderKey === "all"}
                      />
                    ))}
                  </ul>
                ) : (
                  <EmptyPanel
                    message={
                      selectedFacetKey
                        ? "No artifacts match that block theme in this folder."
                        : "Nothing is in this view yet. Create a folder or artifact from the top bar."
                    }
                  />
                )}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function FolderNavButton(props: {
  label: string;
  meta: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      title={props.label}
      className={[
        "grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm transition",
        props.active
          ? "border-slate-300 bg-white text-slate-950 shadow-sm"
          : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-white/85",
      ].join(" ")}
    >
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
        {props.icon}
      </span>
      <span className="truncate font-medium">{props.label}</span>
      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{props.meta}</span>
    </button>
  );
}

function ResultSection(props: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-end justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-600">{props.title}</h3>
        <div className="text-xs font-medium text-slate-500">{props.subtitle}</div>
      </div>
      {props.children}
    </section>
  );
}

function ArtifactListItem(props: {
  workspaceSlug: string;
  artifact: ExplorerArtifact;
  showLocation?: boolean;
}) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white/92 px-4 py-4 transition hover:border-slate-300 hover:bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
            <NewDocIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <Link
              className="block truncate text-base font-semibold text-slate-900 hover:text-blue-600"
              href={`/w/${props.workspaceSlug}/artifacts/${props.artifact.id}`}
              title={props.artifact.title}
            >
              {props.artifact.title}
            </Link>
            <div className="mt-1 text-xs font-medium leading-5 text-slate-600">
              {props.artifact.status} · {new Date(props.artifact.updated_at).toLocaleString()}
              {props.showLocation ? ` · ${props.artifact.browse_group_name}` : ""}
            </div>
            {props.artifact.summary_blocks.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {props.artifact.summary_blocks.map((block, index) => (
                  <span
                    key={`${props.artifact.id}-${block.type}-${block.title ?? index}`}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600"
                  >
                    {block.title || defaultBlockLabel(block.type)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

function FacetChip(props: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        "rounded-full border px-3 py-2 text-xs font-medium transition",
        props.active
          ? "border-slate-300 bg-white text-slate-900 shadow-sm"
          : "border-slate-200 bg-white/85 text-slate-600 hover:bg-white",
      ].join(" ")}
    >
      {props.label} · {props.count}
    </button>
  );
}

function EmptyPanel(props: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-5 py-7 text-sm leading-6 text-slate-600">
      {props.message}
    </div>
  );
}

function buildFacetOptions(artifacts: ExplorerArtifact[]): FacetOption[] {
  const counts = new Map<string, FacetOption>();
  for (const artifact of artifacts) {
    for (const block of artifact.summary_blocks) {
      const rawLabel = block.title?.trim() || defaultBlockLabel(block.type);
      const kind = block.title?.trim() ? "title" : "type";
      const key = `${kind}:${normalizeLabel(rawLabel)}`;
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
        continue;
      }
      counts.set(key, {
        key,
        label: rawLabel,
        count: 1,
      });
    }
  }

  return Array.from(counts.values())
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 8);
}

function artifactMatchesFacet(artifact: ExplorerArtifact, facetKey: string) {
  const [, normalizedLabel] = facetKey.split(":");
  return artifact.summary_blocks.some((block) => {
    const label = block.title?.trim() || defaultBlockLabel(block.type);
    return normalizeLabel(label) === normalizedLabel;
  });
}

function blockMatchesFacet(
  block: {
    block_title: string | null;
    block_type: string;
  },
  facetKey: string,
) {
  const [, normalizedLabel] = facetKey.split(":");
  const label = block.block_title?.trim() || defaultBlockLabel(block.block_type);
  return normalizeLabel(label) === normalizedLabel;
}

function defaultBlockLabel(type: string) {
  if (type === "question") return "Open question";
  if (type === "risk") return "Risk";
  if (type === "decision") return "Decision";
  if (type === "metric") return "Success metric";
  if (type === "assumption") return "Assumption";
  if (type === "option") return "Option";
  if (type === "table") return "Table";
  return "Context";
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
