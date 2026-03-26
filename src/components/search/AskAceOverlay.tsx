"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  ArrowUpRightIcon,
  FolderIcon,
  InboxIcon,
  SearchIcon,
  SparkIcon,
} from "@/src/components/icons/LoopIcons";

type ExplorerArtifact = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  browse_group_key: string;
  browse_group_name: string;
  summary_excerpt: string | null;
  summary_blocks: Array<{ title: string | null; type: string }>;
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
};

type SearchResult = {
  artifacts: ExplorerArtifact[];
  blocks: SearchBlockMatch[];
};

type OverlayBrief = {
  headline: string;
  summary: string;
  sources: ExplorerArtifact[];
  blocks: SearchBlockMatch[];
  followUps: string[];
};

export function AskAceOverlay(props: { workspaceSlug: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!props.workspaceSlug) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };

    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ query?: string }>).detail;
      setQ(detail?.query ?? "");
      setOpen(true);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("aceync:ask-open", onOpen as EventListener);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("aceync:ask-open", onOpen as EventListener);
    };
  }, [props.workspaceSlug]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 20);
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !props.workspaceSlug) return;
    if (!q.trim()) {
      setLoading(false);
      setError(null);
      setResult(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/workspaces/${props.workspaceSlug}/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => null)) as SearchResult | { error?: string } | null;
        if (!res.ok) throw new Error(typeof data === "object" && data && "error" in data ? data.error ?? "Search failed" : "Search failed");
        if (!cancelled) setResult(data as SearchResult);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (!cancelled) setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 140);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [open, props.workspaceSlug, q]);

  const brief = useMemo(() => buildOverlayBrief(q, result), [q, result]);
  const prompts = brief?.followUps.length ? brief.followUps : STARTER_PROMPTS;

  function closeOverlay() {
    setOpen(false);
    setQ("");
    setError(null);
  }

  if (!props.workspaceSlug) return null;

  return open ? (
    <div className="fixed inset-0 z-[120]">
      <button
        type="button"
        aria-label="Close Ask Ace"
        className="absolute inset-0 bg-slate-950/20 backdrop-blur-[6px]"
        onClick={closeOverlay}
      />

      <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center px-4">
        <section
          role="dialog"
          aria-modal="true"
          aria-label="Ask Ace"
          className="pointer-events-auto w-full max-w-[860px] overflow-hidden rounded-[28px] border border-slate-300 bg-white shadow-[0_36px_100px_-44px_rgba(15,23,42,0.28)]"
        >
          <div className="border-b border-slate-200 bg-white px-5 py-4">
            <div className="flex items-center gap-3 rounded-[22px] border border-slate-300 bg-white px-4 py-3 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.18)]">
              <SearchIcon className="h-5 w-5 shrink-0 text-slate-500" />
              <input
                ref={inputRef}
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Ask Ace"
                className="w-full min-w-0 bg-transparent text-[15px] text-slate-950 outline-none placeholder:text-slate-500"
              />
              <Link
                href={`/w/${props.workspaceSlug}/search${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-50"
                onClick={closeOverlay}
              >
                Open search
                <ArrowUpRightIcon className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {prompts.slice(0, 4).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setQ(prompt)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[min(72vh,720px)] overflow-y-auto bg-white px-5 py-5">
            {!q.trim() ? (
              <div className="grid gap-4 md:grid-cols-3">
                <QuickLinkCard
                  href={`/w/${props.workspaceSlug}/unified`}
                  icon={<SparkIcon className="h-4 w-4" />}
                  label="Unified"
                />
                <QuickLinkCard
                  href={`/w/${props.workspaceSlug}/folders`}
                  icon={<FolderIcon className="h-4 w-4" />}
                  label="Folders"
                />
                <QuickLinkCard
                  href={`/w/${props.workspaceSlug}/inbox`}
                  icon={<InboxIcon className="h-4 w-4" />}
                  label="Inbox"
                />
              </div>
            ) : loading ? (
              <div className="grid gap-3">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            ) : error ? (
              <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{error}</div>
            ) : brief ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <section className="rounded-[24px] border border-slate-300 bg-white p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">Best answer</div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{brief.headline}</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-700">{brief.summary}</p>

                  <div className="mt-5 grid gap-2">
                    {brief.sources.map((artifact) => (
                  <Link
                    key={artifact.id}
                    href={`/w/${props.workspaceSlug}/artifacts/${artifact.id}`}
                    className="rounded-[20px] border border-slate-300 bg-slate-50/70 px-4 py-3 transition hover:border-slate-400 hover:bg-slate-50"
                    onClick={closeOverlay}
                  >
                        <div className="truncate text-sm font-semibold text-slate-950">{artifact.title}</div>
                        <div className="mt-1 truncate text-xs text-slate-600">
                          {artifact.browse_group_name} · {formatShortDateTime(artifact.updated_at)}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>

                <section className="grid gap-4">
                  <div className="rounded-[24px] border border-slate-300 bg-white p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">Blocks</div>
                    <div className="mt-3 grid gap-2">
                      {brief.blocks.length > 0 ? (
                        brief.blocks.map((block) => (
                          <Link
                            key={block.block_id}
                            href={`/w/${props.workspaceSlug}/artifacts/${block.artifact_id}`}
                            className="rounded-[20px] border border-slate-300 bg-white px-3 py-3 transition hover:border-slate-400 hover:bg-slate-50"
                            onClick={closeOverlay}
                          >
                            <div className="truncate text-sm font-medium text-slate-900">
                              {block.block_title?.trim() || defaultBlockLabel(block.block_type)}
                            </div>
                            <div className="mt-1 truncate text-xs text-slate-600">{block.artifact_title}</div>
                          </Link>
                        ))
                      ) : (
                        <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50/70 px-3 py-4 text-sm text-slate-600">
                          No block matches yet.
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            ) : (
              <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-5 text-sm text-slate-700">
                No direct matches.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  ) : null;
}

function QuickLinkCard(props: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={props.href}
      className="rounded-[24px] border border-slate-300 bg-white px-4 py-4 transition hover:border-slate-400 hover:bg-slate-50"
    >
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-300 bg-slate-50 text-slate-800">
        {props.icon}
      </div>
      <div className="mt-4 text-sm font-semibold text-slate-950">{props.label}</div>
    </Link>
  );
}

function SkeletonRow() {
  return <div className="h-20 rounded-[22px] border border-slate-200 bg-slate-100/80 shimmer" />;
}

function buildOverlayBrief(query: string, result: SearchResult | null): OverlayBrief | null {
  const q = query.trim();
  if (!q || !result) return null;

  const sourceMap = new Map<string, ExplorerArtifact>();
  for (const artifact of result.artifacts) {
    if (!sourceMap.has(artifact.id)) sourceMap.set(artifact.id, artifact);
  }
  for (const block of result.blocks) {
    const artifact =
      result.artifacts.find((candidate) => candidate.id === block.artifact_id) ??
      ({
        id: block.artifact_id,
        title: block.artifact_title,
        status: "active",
        updated_at: new Date().toISOString(),
        browse_group_key: block.browse_group_key,
        browse_group_name: block.browse_group_name,
        summary_excerpt: block.content_excerpt,
        summary_blocks: [],
      } satisfies ExplorerArtifact);
    if (!sourceMap.has(artifact.id)) sourceMap.set(artifact.id, artifact);
  }

  const sources = Array.from(sourceMap.values()).slice(0, 4);
  if (!sources.length && !result.blocks.length) return null;

  const folderCounts = new Map<string, number>();
  const themeCounts = new Map<string, number>();

  for (const artifact of result.artifacts) {
    folderCounts.set(artifact.browse_group_name, (folderCounts.get(artifact.browse_group_name) ?? 0) + 1);
    for (const block of artifact.summary_blocks) {
      const label = block.title?.trim() || defaultBlockLabel(block.type);
      themeCounts.set(label, (themeCounts.get(label) ?? 0) + 1);
    }
  }

  for (const block of result.blocks) {
    folderCounts.set(block.browse_group_name, (folderCounts.get(block.browse_group_name) ?? 0) + 1);
    const label = block.block_title?.trim() || defaultBlockLabel(block.block_type);
    themeCounts.set(label, (themeCounts.get(label) ?? 0) + 1);
  }

  const topFolder = Array.from(folderCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topThemes = Array.from(themeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label]) => label);

  return {
    headline: topFolder ?? `${sources.length} source${sources.length === 1 ? "" : "s"}`,
    summary:
      sources[0]
        ? `Start with ${sources[0].title}. ${result.artifacts.length} file${result.artifacts.length === 1 ? "" : "s"} and ${result.blocks.length} block${result.blocks.length === 1 ? "" : "s"} match.`
        : `${result.blocks.length} block${result.blocks.length === 1 ? "" : "s"} match.`,
    sources,
    blocks: result.blocks.slice(0, 4),
    followUps: [
      topFolder ? `What changed in ${topFolder}?` : `What changed around ${q}?`,
      topThemes[0] ? `Show only ${topThemes[0]}` : `Where does ${q} appear most?`,
      `What is unresolved about ${q}?`,
    ],
  };
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

function formatShortDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STARTER_PROMPTS = [
  "What is blocked right now?",
  "What should become a folder next?",
  "Where are the open questions?",
  "What changed most recently?",
];
