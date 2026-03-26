"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/src/components/Button";
import {
  ArrowUpRightIcon,
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
  summary_excerpt: string | null;
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

type SearchBlockMatch = {
  block_id: string;
  block_title: string | null;
  block_type: string;
  content_excerpt: string;
  artifact_id: string;
  artifact_title: string;
  browse_group_key: string;
  browse_group_name: string;
  browse_group_kind: "folder" | "smart";
};

type SearchResult = {
  artifacts: ExplorerArtifact[];
  blocks: SearchBlockMatch[];
  folders: ExplorerFolder[];
  templates: Array<{ slug: string; name: string; group: string }>;
};

type FacetOption = {
  key: string;
  label: string;
  count: number;
};

type SearchView = "answer" | "artifacts" | "blocks";

type SearchBrief = {
  status: "high" | "partial" | "low";
  headline: string;
  summary: string;
  bullets: string[];
  sources: ExplorerArtifact[];
  supportingBlocks: SearchBlockMatch[];
  followUps: string[];
  topFolderKey: string | null;
  topFolderName: string | null;
  topThemes: string[];
};

const selectClassName =
  "rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-950 shadow-[0_8px_20px_-18px_rgba(4,12,27,0.16)] outline-none focus:border-[rgb(var(--accent))] focus:ring-4 focus:ring-[rgb(var(--accent)_/_0.14)]";

const crispCardClass =
  "rounded-[22px] border border-slate-300 bg-white shadow-[0_14px_32px_-24px_rgba(4,12,27,0.12)]";

function getApiError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const error = (payload as Record<string, unknown>).error;
  return typeof error === "string" && error.trim().length ? error : null;
}

export function SearchWorkspaceClient(props: {
  workspaceSlug: string;
  initialResult: SearchResult;
  initialQuery: string;
}) {
  const router = useRouter();
  const workspaceSlug = props.workspaceSlug;
  const [q, setQ] = useState(props.initialQuery);
  const [result, setResult] = useState<SearchResult>(props.initialResult);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolderKey, setSelectedFolderKey] = useState("all");
  const [selectedFacetKey, setSelectedFacetKey] = useState<string | null>(null);
  const [queryView, setQueryView] = useState<SearchView>("answer");
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
    if (!skippedInitialFetch.current) {
      skippedInitialFetch.current = true;
      return () => controller.abort();
    }

    const timeout = window.setTimeout(async () => {
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

  useEffect(() => {
    if (q.trim()) setQueryView("answer");
  }, [q]);

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

  const starterPrompts = useMemo(
    () =>
      buildStarterPrompts({
        selectedFolder,
        actualFolders,
        smartFolders,
        facets: facetOptions,
      }),
    [actualFolders, facetOptions, selectedFolder, smartFolders],
  );

  const aiBrief = useMemo(
    () =>
      buildSearchBrief({
        query: q,
        artifacts: searchArtifacts,
        blocks: searchBlocks,
        allArtifacts,
        selectedFolder,
      }),
    [allArtifacts, q, searchArtifacts, searchBlocks, selectedFolder],
  );

  const aiPrompts = q.trim() ? aiBrief?.followUps ?? [] : starterPrompts;

  function applyPrompt(prompt: string) {
    setQ(prompt);
    setQueryView("answer");
  }

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
    setArtifactTargetKey(selectedFolder?.key ?? artifactTargetOptions[0]?.key ?? "smart:prd");
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-300 bg-white text-slate-900 shadow-[0_10px_28px_-20px_rgba(4,12,27,0.14)]">
            <SearchIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">Search</h1>
          </div>
        </div>
      </div>

      <section className="mt-5 overflow-hidden rounded-[28px] border border-slate-300 bg-white shadow-[0_22px_60px_-42px_rgba(4,12,27,0.12)]">
        <div className="border-b border-slate-300 px-5 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex-1">
              <Input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Ask Ace"
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

          {aiPrompts.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {aiPrompts.map((prompt) => (
                <PromptChip key={prompt} label={prompt} onClick={() => applyPrompt(prompt)} />
              ))}
            </div>
          ) : null}
        </div>

        {composer ? (
          <div className="border-b border-slate-300 bg-white px-5 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                  {composer === "folder" ? "Create folder" : "Create artifact"}
                </div>
                <div className="mt-1 text-sm leading-6 text-slate-700">
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
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-[0_8px_20px_-18px_rgba(4,12,27,0.12)] hover:border-slate-400 hover:bg-slate-50"
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
                  <span className="text-slate-700">Folder name</span>
                  <Input
                    value={folderName}
                    onChange={(event) => setFolderName(event.target.value)}
                    placeholder="e.g., Discovery archive"
                    required
                  />
                </label>

                {selectedFolder?.kind === "smart" ? (
                  <div className="grid gap-1 text-sm">
                    <span className="text-slate-700">Source</span>
                    <div className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-[0_8px_20px_-18px_rgba(4,12,27,0.12)]">
                      {selectedFolder.name} block pattern
                    </div>
                  </div>
                ) : (
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Starter structure</span>
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
                  <span className="text-slate-700">Artifact title</span>
                  <Input
                    value={artifactTitle}
                    onChange={(event) => setArtifactTitle(event.target.value)}
                    placeholder="e.g., Stakeholder alignment artifact"
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-700">Location</span>
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

            {createError ? <div className="mt-3 text-sm text-red-600">{createError}</div> : null}
          </div>
        ) : null}

        <div className="grid lg:grid-cols-[292px_minmax(0,1fr)]">
          <aside className="overflow-x-hidden border-b border-slate-300 bg-white p-4 lg:border-b-0 lg:border-r">
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
                <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                  Folders
                </div>
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
                <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                  Suggested
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

          <section className="min-w-0 bg-white p-6">
            {!q.trim() ? (
              <div className="grid gap-5">
                <div className={`${crispCardClass} overflow-hidden`}>
                  <div className="border-b border-slate-300 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                          Ask Ace
                        </div>
                        <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-950">
                          Start with a question
                        </h2>
                      </div>
                      <div className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-[0_8px_20px_-18px_rgba(4,12,27,0.12)]">
                        {allArtifacts.length} files indexed
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 px-5 py-5">
                    {starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-900 shadow-[0_10px_28px_-20px_rgba(4,12,27,0.1)] transition hover:border-slate-400 hover:bg-slate-50"
                        onClick={() => applyPrompt(prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-950">
                        {selectedFolder?.name ?? "All files"}
                      </h2>
                    </div>

                    {selectedFolder?.kind === "folder" ? (
                      <Link
                        href={`/w/${workspaceSlug}/folders/${selectedFolder.id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 shadow-[0_8px_20px_-18px_rgba(4,12,27,0.12)] hover:border-slate-400 hover:bg-slate-50"
                      >
                        Open folder
                        <ArrowUpRightIcon className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </div>

                  {facetOptions.length > 0 ? (
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

                  <div className="mt-6">
                    {browseArtifacts.length > 0 ? (
                      <ul className="grid gap-3">
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
                            ? "No files match that block theme in this view."
                            : "Nothing is in this view yet. Create a folder or artifact from the top bar."
                        }
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-950">
                      {q}
                    </h2>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <SearchModeButton
                      label="Answer"
                      meta={aiBrief ? `${aiBrief.sources.length} sources` : "0"}
                      active={queryView === "answer"}
                      onClick={() => setQueryView("answer")}
                    />
                    <SearchModeButton
                      label="Files"
                      meta={`${searchArtifacts.length}`}
                      active={queryView === "artifacts"}
                      onClick={() => setQueryView("artifacts")}
                    />
                    <SearchModeButton
                      label="Blocks"
                      meta={`${searchBlocks.length}`}
                      active={queryView === "blocks"}
                      onClick={() => setQueryView("blocks")}
                    />
                  </div>
                </div>

                {error ? <div className="text-sm font-medium text-red-600">{error}</div> : null}

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="min-w-0">
                    {queryView === "answer" ? (
                      aiBrief ? (
                        <AiAnswerPanel
                          brief={aiBrief}
                          onPromptClick={applyPrompt}
                          onOpenArtifacts={() => setQueryView("artifacts")}
                          onOpenBlocks={() => setQueryView("blocks")}
                        />
                      ) : (
                        <EmptyPanel message="Try a broader phrase." />
                      )
                    ) : null}

                    {queryView === "artifacts" ? (
                      <ResultSection
                        title="Matching files"
                        subtitle={`${searchArtifacts.length} file${searchArtifacts.length === 1 ? "" : "s"}`}
                      >
                        {searchArtifacts.length > 0 ? (
                          <ul className="grid gap-3">
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
                          <EmptyPanel message="No file titles match here." />
                        )}
                      </ResultSection>
                    ) : null}

                    {queryView === "blocks" ? (
                      <ResultSection
                        title="Supporting blocks"
                        subtitle={`${searchBlocks.length} block${searchBlocks.length === 1 ? "" : "s"}`}
                      >
                        {searchBlocks.length > 0 ? (
                          <ul className="grid gap-3">
                            {searchBlocks.map((block) => (
                              <BlockListItem key={block.block_id} workspaceSlug={workspaceSlug} block={block} />
                            ))}
                          </ul>
                        ) : (
                          <EmptyPanel message="No block content matches this query." />
                        )}
                      </ResultSection>
                    ) : null}
                  </div>

                  <aside className="grid gap-3">
                    <SearchSideCard
                      title="Best sources"
                      subtitle={aiBrief ? `${aiBrief.sources.length} source${aiBrief.sources.length === 1 ? "" : "s"}` : undefined}
                    >
                      {aiBrief && aiBrief.sources.length > 0 ? (
                        <div className="grid gap-2">
                          {aiBrief.sources.map((artifact) => (
                            <SourceArtifactCard
                              key={artifact.id}
                              artifact={artifact}
                              workspaceSlug={workspaceSlug}
                              onSelectFolder={() => setSelectedFolderKey(artifact.browse_group_key)}
                            />
                          ))}
                        </div>
                      ) : (
                        <EmptyInset message="Sources will appear once Loop has enough evidence to answer." />
                      )}
                    </SearchSideCard>

                    <SearchSideCard
                      title="Refine"
                    >
                      <div className="grid gap-3">
                        {aiBrief?.topFolderKey && aiBrief.topFolderName ? (
                          <button
                            type="button"
                            className="rounded-2xl border border-slate-300 bg-white px-3 py-3 text-left text-sm text-slate-900 shadow-[0_10px_24px_-20px_rgba(4,12,27,0.1)] hover:border-slate-400 hover:bg-slate-50"
                            onClick={() => setSelectedFolderKey(aiBrief.topFolderKey!)}
                          >
                            Focus {aiBrief.topFolderName}
                          </button>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          {aiBrief?.topThemes.map((theme) => (
                            <button
                              key={theme}
                              type="button"
                              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-[0_8px_18px_-18px_rgba(4,12,27,0.1)] hover:border-slate-400 hover:bg-slate-50"
                              onClick={() => setSelectedFacetKey(`title:${normalizeLabel(theme)}`)}
                            >
                              {theme}
                            </button>
                          ))}
                        </div>
                      </div>
                    </SearchSideCard>
                  </aside>
                </div>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function PromptChip(props: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-[0_8px_18px_-18px_rgba(4,12,27,0.1)] transition hover:border-slate-400 hover:bg-slate-50"
    >
      {props.label}
    </button>
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
          ? "border-slate-900 bg-slate-950 text-white shadow-[0_12px_28px_-24px_rgba(4,12,27,0.3)]"
          : "border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50",
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
          props.active
            ? "border-white/15 bg-white/10 text-white"
            : "border-slate-300 bg-white text-slate-700 shadow-[0_6px_16px_-16px_rgba(4,12,27,0.16)]",
        ].join(" ")}
      >
        {props.icon}
      </span>
      <span className="truncate font-medium">{props.label}</span>
      <span
        className={[
          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
          props.active ? "bg-white/12 text-white" : "border border-slate-300 bg-white text-slate-800",
        ].join(" ")}
      >
        {props.meta}
      </span>
    </button>
  );
}

function SearchModeButton(props: {
  label: string;
  meta: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition",
        props.active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50",
      ].join(" ")}
    >
      <span>{props.label}</span>
      <span className={props.active ? "text-white/70" : "text-slate-500"}>{props.meta}</span>
    </button>
  );
}

function SearchSideCard(props: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${crispCardClass} p-4`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
        {props.title}
      </div>
      {props.subtitle ? <div className="mt-1 text-sm leading-6 text-slate-700">{props.subtitle}</div> : null}
      <div className="mt-4">{props.children}</div>
    </div>
  );
}

function AiAnswerPanel(props: {
  brief: SearchBrief;
  onPromptClick: (prompt: string) => void;
  onOpenArtifacts: () => void;
  onOpenBlocks: () => void;
}) {
  const statusLabel =
    props.brief.status === "high"
      ? "High signal"
      : props.brief.status === "partial"
        ? "Partial signal"
        : "Low signal";

  return (
    <div className={`${crispCardClass} overflow-hidden`}>
      <div className="border-b border-slate-300 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-800 shadow-[0_8px_18px_-18px_rgba(4,12,27,0.1)]">
              <SparkIcon className="h-4 w-4" />
              {statusLabel}
            </div>
            <h3 className="mt-3 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
              {props.brief.headline}
            </h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700">{props.brief.summary}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={props.onOpenArtifacts}>
              Files
            </Button>
            <Button type="button" variant="secondary" onClick={props.onOpenBlocks}>
              Blocks
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 px-5 py-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
            Signal
          </div>
          <div className="mt-3 grid gap-2">
            {props.brief.bullets.map((bullet) => (
              <div
                key={bullet}
                className="rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm leading-6 text-slate-800 shadow-[0_8px_18px_-18px_rgba(4,12,27,0.1)]"
              >
                {bullet}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">Next</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {props.brief.followUps.map((prompt) => (
              <PromptChip key={prompt} label={prompt} onClick={() => props.onPromptClick(prompt)} />
            ))}
          </div>
          {props.brief.supportingBlocks.length > 0 ? (
            <div className="mt-5 grid gap-2">
              {props.brief.supportingBlocks.slice(0, 3).map((block) => (
                <div
                  key={block.block_id}
                  className="rounded-2xl border border-slate-300 bg-white px-3 py-3 shadow-[0_8px_18px_-18px_rgba(4,12,27,0.1)]"
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                    {block.block_title || defaultBlockLabel(block.block_type)}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-800">
                    {block.content_excerpt.trim() || "Matching language appears in this block."}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
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
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">{props.title}</h3>
        <div className="text-xs font-medium text-slate-600">{props.subtitle}</div>
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
    <li className="rounded-2xl border border-slate-300 bg-white px-4 py-4 shadow-[0_12px_28px_-22px_rgba(4,12,27,0.1)] transition hover:border-slate-400 hover:bg-slate-50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-300 bg-white text-slate-700 shadow-[0_8px_20px_-18px_rgba(4,12,27,0.12)]">
            <NewDocIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <Link
              className="block truncate text-base font-semibold text-slate-950 hover:text-[rgb(var(--accent))]"
              href={`/w/${props.workspaceSlug}/artifacts/${props.artifact.id}`}
              title={props.artifact.title}
            >
              {props.artifact.title}
            </Link>
            <div className="mt-1 text-xs font-medium leading-5 text-slate-700">
              {props.artifact.status} · {new Date(props.artifact.updated_at).toLocaleString()}
              {props.showLocation ? ` · ${props.artifact.browse_group_name}` : ""}
            </div>
            {props.artifact.summary_excerpt ? (
              <div className="mt-2 text-sm leading-6 text-slate-700">
                {props.artifact.summary_excerpt}
              </div>
            ) : null}
            {props.artifact.summary_blocks.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {props.artifact.summary_blocks.map((block, index) => (
                  <span
                    key={`${props.artifact.id}-${block.type}-${block.title ?? index}`}
                    className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-800"
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

function BlockListItem(props: {
  workspaceSlug: string;
  block: SearchBlockMatch;
}) {
  return (
    <li className="rounded-2xl border border-slate-300 bg-white px-4 py-4 shadow-[0_12px_28px_-22px_rgba(4,12,27,0.1)]">
      <Link
        className="block truncate text-base font-semibold text-slate-950 hover:text-[rgb(var(--accent))]"
        href={`/w/${props.workspaceSlug}/artifacts/${props.block.artifact_id}`}
        title={props.block.artifact_title}
      >
        {props.block.artifact_title}
      </Link>
      <div className="mt-1 text-xs font-medium leading-5 text-slate-700">
        {props.block.block_title || defaultBlockLabel(props.block.block_type)} ·{" "}
        {defaultBlockLabel(props.block.block_type)} · {props.block.browse_group_name}
      </div>
      <div className="mt-3 rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm leading-6 text-slate-800">
        {props.block.content_excerpt.trim() || "Matching language appears in this block."}
      </div>
    </li>
  );
}

function SourceArtifactCard(props: {
  workspaceSlug: string;
  artifact: ExplorerArtifact;
  onSelectFolder: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-white px-3 py-3 shadow-[0_10px_24px_-20px_rgba(4,12,27,0.1)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-950">{props.artifact.title}</div>
          <div className="mt-1 text-xs text-slate-600">{props.artifact.browse_group_name}</div>
        </div>
        <Link
          href={`/w/${props.workspaceSlug}/artifacts/${props.artifact.id}`}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
          aria-label={`Open ${props.artifact.title}`}
        >
          <ArrowUpRightIcon className="h-4 w-4" />
        </Link>
      </div>

      {props.artifact.summary_excerpt ? (
        <div className="mt-3 text-sm leading-6 text-slate-700">{props.artifact.summary_excerpt}</div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-800 hover:border-slate-400 hover:bg-slate-50"
          onClick={props.onSelectFolder}
        >
          Focus folder
        </button>
        {props.artifact.summary_blocks.slice(0, 2).map((block, index) => (
          <span
            key={`${props.artifact.id}-theme-${block.type}-${block.title ?? index}`}
            className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700"
          >
            {block.title || defaultBlockLabel(block.type)}
          </span>
        ))}
      </div>
    </div>
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
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50",
      ].join(" ")}
    >
      {props.label} · {props.count}
    </button>
  );
}

function EmptyPanel(props: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-7 text-sm leading-6 text-slate-700">
      {props.message}
    </div>
  );
}

function EmptyInset(props: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm leading-6 text-slate-700">
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

function buildStarterPrompts(input: {
  selectedFolder: ExplorerFolder | null;
  actualFolders: ExplorerFolder[];
  smartFolders: ExplorerFolder[];
  facets: FacetOption[];
}) {
  const prompts: string[] = [];
  if (input.selectedFolder) {
    prompts.push(`What changed inside ${input.selectedFolder.name}?`);
  } else if (input.actualFolders[0]) {
    prompts.push(`What changed across ${input.actualFolders[0].name}?`);
  }

  if (input.facets[0]) {
    prompts.push(`Which files mention ${input.facets[0].label}?`);
  }

  if (input.smartFolders[0]) {
    prompts.push(`What is still unresolved in ${input.smartFolders[0].name}?`);
  }

  if (input.actualFolders[1]) {
    prompts.push(`Compare ${input.actualFolders[0]?.name ?? "folders"} and ${input.actualFolders[1].name}`);
  }

  return prompts.filter(Boolean).slice(0, 4);
}

function buildSearchBrief(input: {
  query: string;
  artifacts: ExplorerArtifact[];
  blocks: SearchBlockMatch[];
  allArtifacts: ExplorerArtifact[];
  selectedFolder: ExplorerFolder | null;
}): SearchBrief | null {
  const query = input.query.trim();
  if (!query) return null;

  const sourceMap = new Map<string, ExplorerArtifact>();
  for (const artifact of input.artifacts) {
    sourceMap.set(artifact.id, artifact);
  }
  for (const block of input.blocks) {
    const artifact = input.allArtifacts.find((candidate) => candidate.id === block.artifact_id);
    if (artifact && !sourceMap.has(artifact.id)) sourceMap.set(artifact.id, artifact);
  }

  const sources = Array.from(sourceMap.values()).slice(0, 3);
  const folderCounts = new Map<string, { key: string; count: number }>();
  const themeCounts = new Map<string, number>();

  for (const artifact of input.artifacts) {
    folderCounts.set(artifact.browse_group_name, {
      key: artifact.browse_group_key,
      count: (folderCounts.get(artifact.browse_group_name)?.count ?? 0) + 1,
    });
    for (const block of artifact.summary_blocks) {
      const label = block.title?.trim() || defaultBlockLabel(block.type);
      themeCounts.set(label, (themeCounts.get(label) ?? 0) + 1);
    }
  }

  for (const block of input.blocks) {
    const label = block.block_title?.trim() || defaultBlockLabel(block.block_type);
    themeCounts.set(label, (themeCounts.get(label) ?? 0) + 1);
    folderCounts.set(block.browse_group_name, {
      key: block.browse_group_key,
      count: (folderCounts.get(block.browse_group_name)?.count ?? 0) + 1,
    });
  }

  const sortedThemes = Array.from(themeCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([label]) => label);

  const topFolder = Array.from(folderCounts.entries())
    .sort((left, right) => right[1].count - left[1].count || left[0].localeCompare(right[0]))[0];

  const artifactCount = input.artifacts.length;
  const blockCount = input.blocks.length;

  const status: SearchBrief["status"] =
    artifactCount >= 3 || blockCount >= 6 ? "high" : artifactCount > 0 || blockCount > 0 ? "partial" : "low";

  if (artifactCount === 0 && blockCount === 0) {
    return {
      status,
      headline: "Broaden the phrasing",
      summary:
        input.selectedFolder
          ? `No direct evidence surfaced inside ${input.selectedFolder.name}. Try a broader term, a teammate name, or a block theme.`
          : "No direct evidence surfaced yet. Try a broader term, a folder name, or a block theme.",
      bullets: [
        "Widen the phrasing beyond an exact product or project name.",
        "Try asking for a theme such as risks, dependencies, or rollout.",
        "Use the folder rail on the left to constrain the search before asking again.",
      ],
      sources: [],
      supportingBlocks: [],
      followUps: [
        `What mentions risks related to ${query}?`,
        `Which files are closest to ${query}?`,
        "Show me unresolved open questions",
      ],
      topFolderKey: null,
      topFolderName: null,
      topThemes: [],
    };
  }

  const sourceTitles = sources.slice(0, 2).map((source) => source.title);
  const summary =
    artifactCount > 0
      ? `Ace found ${artifactCount} file${artifactCount === 1 ? "" : "s"} and ${blockCount} supporting block${
          blockCount === 1 ? "" : "s"
        } related to “${query}”. The clearest signal appears in ${joinList(sourceTitles)}${
          topFolder ? `, with the strongest concentration in ${topFolder[0]}.` : "."
        }`
      : `Ace did not find direct file-title matches for “${query}”, but it did find ${blockCount} supporting block${
          blockCount === 1 ? "" : "s"
        } across ${sources.length} file${sources.length === 1 ? "" : "s"}. Start with ${joinList(sourceTitles)}.`;

  const bullets = [
    topFolder ? `Most of the evidence sits under ${topFolder[0]}.` : null,
    sortedThemes.length > 0 ? `Common sections in the evidence: ${joinList(sortedThemes)}.` : null,
    sources[0] ? `Most recent source: ${sources[0].title}, updated ${formatShortDateTime(sources[0].updated_at)}.` : null,
  ].filter((value): value is string => Boolean(value));

  const followUps = [
    topFolder ? `What changed in ${topFolder[0]}?` : null,
    sortedThemes[0] ? `Show only ${sortedThemes[0]}` : null,
    `What is still unresolved about ${query}?`,
    `Which files disagree on ${query}?`,
  ].filter((value): value is string => Boolean(value));

  return {
    status,
    headline:
      status === "high"
        ? "Strong signal"
        : status === "partial"
          ? "Partial signal"
          : "Weak signal",
    summary,
    bullets,
    sources,
    supportingBlocks: input.blocks.slice(0, 4),
    followUps: followUps.slice(0, 4),
    topFolderKey: topFolder?.[1].key ?? null,
    topFolderName: topFolder?.[0] ?? null,
    topThemes: sortedThemes,
  };
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

function joinList(values: string[]) {
  if (values.length === 0) return "matching files";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function formatShortDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
