"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent, RefObject } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/src/components/Button";
import {
  BlockEditor,
  type BlockDto,
  type BlockSuggestionPreview,
} from "@/src/components/blocks/BlockEditor";
import { Input } from "@/src/components/Input";
import {
  ReviewRequestShareCard,
  type ReviewRequestShareState,
  type ReviewRequestSlackStatus,
} from "@/src/components/reviews/ReviewRequestShareCard";

type BlockTypeOption = {
  type: string;
  label: string;
  icon: string;
  hint: string;
};

type SuggestionDto = {
  id: string;
  artifactId: string;
  blockId: string | null;
  blockTitle: string | null;
  type: string;
  status: string;
  summary: string;
  severity: string;
  createdAt: string;
  createdByName: string | null;
  payload: {
    kind: "suggestion" | "question";
    reviewRequestId: string;
    contributionId: string;
    originalText: string;
    suggestedText: string;
    applyMode: "replace" | "append";
  } | null;
};

const BLOCK_TYPES: BlockTypeOption[] = [
  { type: "text", label: "Text", icon: "Aa", hint: "Freeform content" },
  { type: "decision", label: "Decision", icon: "✓", hint: "Outcome + rationale" },
  { type: "question", label: "Question", icon: "?", hint: "Pointed unknown to resolve" },
  { type: "risk", label: "Risk", icon: "⚠︎", hint: "What could go wrong" },
  { type: "assumption", label: "Assumption", icon: "△", hint: "Belief to validate" },
  { type: "metric", label: "Metric", icon: "◎", hint: "How we measure success" },
  { type: "option", label: "Option", icon: "⇄", hint: "Alternative to compare" },
  { type: "table", label: "Table", icon: "▦", hint: "Structured info" },
];

export function ArtifactDoc(props: {
  workspaceSlug: string;
  artifactId: string;
  artifactTitle: string;
  initialBlocks: BlockDto[];
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<BlockDto[]>(props.initialBlocks);
  const [autoEditBlockId, setAutoEditBlockId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addMenuFor, setAddMenuFor] = useState<string | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  const [askFor, setAskFor] = useState<string | null>(null);
  const [askTitle, setAskTitle] = useState("");
  const [askQuestion, setAskQuestion] = useState("");
  const [askBusy, setAskBusy] = useState(false);
  const [askCreated, setAskCreated] = useState<ReviewRequestShareState | null>(null);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dropTargetBlockId, setDropTargetBlockId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionDto[]>([]);
  const [highlightedBlockIds, setHighlightedBlockIds] = useState<string[]>([]);

  const byId = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);
  const firstInsertPosition = blocks.length ? blocks[0].position : 1;
  const endInsertPosition = blocks.length ? blocks[blocks.length - 1].position + 1 : 1;
  const interactionBusy = busy || reordering;

  useEffect(() => {
    const onDown = (evt: MouseEvent) => {
      if (addMenuRef.current && addMenuRef.current.contains(evt.target as Node)) return;
      setAddMenuFor(null);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    if (!lastAddedId) return;
    const t = window.setTimeout(() => setLastAddedId(null), 4000);
    return () => window.clearTimeout(t);
  }, [lastAddedId]);

  useEffect(() => {
    if (!askFor) return;
    const onKey = (evt: KeyboardEvent) => {
      if (evt.key !== "Escape") return;
      evt.preventDefault();
      setAskFor(null);
      setAskCreated(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [askFor]);

  useEffect(() => {
    if (!askFor) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [askFor]);

  useEffect(() => {
    const onHighlight = (event: Event) => {
      const detail = (event as CustomEvent<{ blockIds?: string[] }>).detail;
      const ids = Array.isArray(detail?.blockIds) ? detail.blockIds : [];
      setHighlightedBlockIds(ids);
    };
    window.addEventListener("loop:highlight-blocks", onHighlight as EventListener);
    return () => window.removeEventListener("loop:highlight-blocks", onHighlight as EventListener);
  }, []);

  useEffect(() => {
    if (draggingBlockId) return;
    setDropTargetBlockId(null);
  }, [draggingBlockId]);

  async function refreshBlocks() {
    const res = await fetch(`/api/artifacts/${props.artifactId}`);
    const data = (await res.json().catch(() => null)) as
      | { blocks?: BlockDto[]; error?: string }
      | null;
    if (!res.ok || !data?.blocks) throw new Error(data?.error ?? "Failed to refresh");
    setBlocks(data.blocks);
  }

  async function refreshSuggestions() {
    const res = await fetch(`/api/artifacts/${props.artifactId}/suggestions`);
    const data = (await res.json().catch(() => null)) as
      | { suggestions?: SuggestionDto[]; error?: string }
      | null;
    if (!res.ok || !data?.suggestions) throw new Error(data?.error ?? "Failed to load suggestions");
    setSuggestions(data.suggestions);
  }

  useEffect(() => {
    void refreshSuggestions().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.artifactId]);

  useEffect(() => {
    let timers: number[] = [];
    const onReviewResponse = () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers = [];
      void refreshSuggestions().catch(() => null);
      for (const delay of [1200, 3200, 6500]) {
        timers.push(
          window.setTimeout(() => {
            void refreshSuggestions().catch(() => null);
          }, delay),
        );
      }
    };

    window.addEventListener("loop:review-response-created", onReviewResponse);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("loop:review-response-created", onReviewResponse);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.artifactId]);

  async function decideSuggestion(suggestionId: string, action: "accept" | "decline") {
    setError(null);
    const endpoint =
      action === "accept"
        ? `/api/artifacts/${props.artifactId}/suggestions/${suggestionId}/accept`
        : `/api/artifacts/${props.artifactId}/suggestions/${suggestionId}/decline`;
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Could not update suggestion");
      await Promise.all([refreshSuggestions(), refreshBlocks()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update suggestion");
    }
  }

  async function addBlock(input: {
    afterBlockId?: string;
    insertPosition?: number;
    type: string;
    title?: string;
    contentMd?: string;
  }): Promise<string | null> {
    setBusy(true);
    setError(null);
    setAskCreated(null);
    try {
      const contentMd = input.contentMd ?? defaultContentForType(input.type);
      const res = await fetch(`/api/artifacts/${props.artifactId}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: input.type,
          title: input.title,
          contentMd,
          afterBlockId: input.afterBlockId,
          insertPosition: input.insertPosition,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; blockId?: string; error?: string }
        | null;
      if (!res.ok || !data?.ok || !data.blockId) throw new Error(data?.error ?? "Create failed");
      setAddMenuFor(null);
      await refreshBlocks();
      setLastAddedId(data.blockId);
      setAutoEditBlockId(data.blockId);
      return data.blockId;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function reorderBlocks(input: { draggedBlockId: string; targetBlockId?: string }) {
    if (reordering) return;
    const dragIdx = blocks.findIndex((block) => block.id === input.draggedBlockId);
    if (dragIdx < 0) return;

    const current = [...blocks];
    const [moved] = current.splice(dragIdx, 1);
    if (!moved) return;

    if (input.targetBlockId) {
      const targetIdx = current.findIndex((block) => block.id === input.targetBlockId);
      if (targetIdx < 0) current.push(moved);
      else current.splice(targetIdx, 0, moved);
    } else {
      current.push(moved);
    }

    const changed = current.some((block, index) => block.id !== blocks[index]?.id);
    if (!changed) return;

    const resequenced = current.map((block, index) => ({ ...block, position: index + 1 }));
    const previous = blocks;
    setBlocks(resequenced);
    setReordering(true);
    setError(null);
    try {
      const res = await fetch(`/api/artifacts/${props.artifactId}/blocks/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockIds: resequenced.map((block) => block.id) }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Reorder failed");
      await refreshBlocks();
    } catch (err) {
      setBlocks(previous);
      setError(err instanceof Error ? err.message : "Reorder failed");
    } finally {
      setReordering(false);
      setDraggingBlockId(null);
      setDropTargetBlockId(null);
    }
  }

  async function moveBlockByOffset(blockId: string, offset: -1 | 1) {
    const index = blocks.findIndex((block) => block.id === blockId);
    if (index < 0) return;
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= blocks.length) return;
    const moved = blocks[index];
    const target = blocks[nextIndex];
    if (!moved || !target) return;
    await reorderBlocks({
      draggedBlockId: moved.id,
      targetBlockId: offset < 0 ? target.id : blocks[nextIndex + 1]?.id,
    });
  }

  function onDragStart(event: DragEvent, blockId: string) {
    if (interactionBusy) return;
    setDraggingBlockId(blockId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", blockId);
  }

  function onDragOverBlock(event: DragEvent, blockId: string) {
    if (!draggingBlockId || draggingBlockId === blockId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropTargetBlockId !== blockId) setDropTargetBlockId(blockId);
  }

  function onDropBlock(event: DragEvent, blockId: string) {
    if (!draggingBlockId) return;
    event.preventDefault();
    void reorderBlocks({ draggedBlockId: draggingBlockId, targetBlockId: blockId });
  }

  function onDropEnd(event: DragEvent) {
    if (!draggingBlockId) return;
    event.preventDefault();
    void reorderBlocks({ draggedBlockId: draggingBlockId });
  }

  function openAsk(blockId: string, hint?: { type?: string; title?: string | null }) {
    const block = byId.get(blockId);
    const blockLabel = hint?.title ?? block?.title ?? hint?.type ?? block?.type ?? "block";
    const title = `Input: ${props.artifactTitle} — ${blockLabel}`;
    setAskFor(blockId);
    setAskTitle(title);
    setAskQuestion(defaultAskQuestion(hint?.type ?? block?.type ?? "text", (hint?.title ?? block?.title) ?? undefined));
    setAskCreated(null);
    setAddMenuFor(null);
  }

  async function createAsk() {
    if (!askFor) return;
    setAskBusy(true);
    setError(null);
    try {
      const q = askQuestion.trim();
      if (!q) throw new Error("Add a question.");
      const res = await fetch(`/api/workspaces/${props.workspaceSlug}/review-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifactId: props.artifactId,
          title: askTitle.trim() || "Async input",
          questions: [q],
          blockIds: [askFor],
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            reviewRequestId?: string;
            shareUrl?: string;
            slackStatus?: ReviewRequestSlackStatus;
            slackChannelId?: string | null;
            slackTeamName?: string | null;
            error?: string;
          }
        | null;
      if (!res.ok || !data?.ok || !data.reviewRequestId) {
        throw new Error(data?.error ?? "Request failed");
      }
      setAskCreated({
        reviewRequestId: data.reviewRequestId,
        shareUrl:
          data.shareUrl ?? `${window.location.origin}/w/${props.workspaceSlug}/review-requests/${data.reviewRequestId}`,
        slackStatus: data.slackStatus ?? "slack_not_connected",
        slackChannelId: data.slackChannelId ?? null,
        slackTeamName: data.slackTeamName ?? null,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setAskBusy(false);
    }
  }

  return (
    <div className="mt-4">
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-[28px] border border-white/70 bg-white/70 px-4 py-3 backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-2 pb-3">
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
              Document
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Insert blocks from the gutter or keep moving with quick actions.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="relative">
              <button
                type="button"
                className={["flow-step-mini", blocks.length === 0 ? "guide-ring" : ""].join(" ")}
                disabled={interactionBusy}
                onClick={() => setAddMenuFor("__quick__")}
              >
                Insert block
              </button>
              {addMenuFor === "__quick__" ? (
                <div ref={addMenuRef} className="absolute right-0 top-10 z-[130] w-[320px]">
                  <BlockTypeMenu onSelect={(type) => addBlock({ insertPosition: endInsertPosition, type })} />
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className={["flow-step-mini", blocks.length > 0 && !askFor ? "guide-ring" : ""].join(" ")}
              disabled={interactionBusy}
              onClick={() => {
                void (async () => {
                  const blockId = await addBlock({
                    insertPosition: endInsertPosition,
                    type: "question",
                    title: "Pointed question",
                  });
                  if (blockId) {
                    openAsk(blockId, { type: "question", title: "Pointed question" });
                  }
                })();
              }}
            >
              Ask question
            </button>
            <button
              type="button"
              className="flow-step-mini"
              disabled={interactionBusy}
              onClick={() =>
                addBlock({
                  insertPosition: endInsertPosition,
                  type: "text",
                  title: "Addition",
                })
              }
            >
              Add note
            </button>
          </div>
        </div>

        <div className="grid gap-2 pt-3">
          <InsertRail
            busy={interactionBusy}
            open={addMenuFor === "__start__"}
            onOpen={() => setAddMenuFor("__start__")}
            menuRef={addMenuRef}
            onAdd={(type) => addBlock({ insertPosition: firstInsertPosition, type })}
            highlight={blocks.length === 0}
          />

          {blocks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/70 bg-white/45 p-4 text-sm text-muted">
              Start with a first block, then use hidden plus gutters to keep ideas and questions flowing.
            </div>
          ) : null}

          {blocks.map((block, idx) => (
            <div key={block.id} className="grid gap-2">
              {(() => {
                const blockSuggestions = suggestions.filter(
                  (suggestion) => suggestion.blockId === block.id && suggestion.status === "open",
                );
                return (
              <BlockRow
                artifactId={props.artifactId}
                block={block}
                revealDelayMs={Math.min(idx * 35, 260)}
                busy={interactionBusy}
                autoEdit={autoEditBlockId === block.id}
                onAutoEditConsumed={() => setAutoEditBlockId(null)}
                onOpenAdd={() => setAddMenuFor(block.id)}
                onOpenAsk={() => openAsk(block.id)}
                addMenuOpen={addMenuFor === block.id}
                addMenuRef={addMenuRef}
                onAddBlock={(type) => addBlock({ afterBlockId: block.id, type })}
                justAdded={lastAddedId === block.id}
                dragging={draggingBlockId === block.id}
                dropActive={dropTargetBlockId === block.id}
                highlighted={highlightedBlockIds.includes(block.id)}
                onDragStart={onDragStart}
                onDragEnd={() => {
                  setDraggingBlockId(null);
                  setDropTargetBlockId(null);
                }}
                onDragOver={onDragOverBlock}
                onDrop={onDropBlock}
                canMoveUp={idx > 0}
                canMoveDown={idx < blocks.length - 1}
                onMoveUp={() => void moveBlockByOffset(block.id, -1)}
                onMoveDown={() => void moveBlockByOffset(block.id, 1)}
                suggestions={blockSuggestions}
                onAcceptSuggestion={(suggestionId) => void decideSuggestion(suggestionId, "accept")}
                onDeclineSuggestion={(suggestionId) => void decideSuggestion(suggestionId, "decline")}
              />
                );
              })()}

              <InsertRail
                busy={interactionBusy}
                open={addMenuFor === `insert-${block.id}`}
                onOpen={() => setAddMenuFor(`insert-${block.id}`)}
                menuRef={addMenuRef}
                onAdd={(type) => addBlock({ insertPosition: block.position + 1, type })}
              />
            </div>
          ))}

          {blocks.length > 1 ? (
            <div
              className={[
                "rounded-xl border border-dashed border-white/65 bg-white/45 px-4 py-3 text-center text-xs text-muted transition",
                draggingBlockId ? "opacity-100" : "opacity-65",
              ].join(" ")}
              onDragOver={(event) => {
                if (!draggingBlockId) return;
                event.preventDefault();
                setDropTargetBlockId(null);
              }}
              onDrop={onDropEnd}
            >
              Drop here to move block to end
            </div>
          ) : null}
        </div>

        {askFor ? (
          <AskSheet
            workspaceSlug={props.workspaceSlug}
            artifactTitle={props.artifactTitle}
            block={byId.get(askFor) ?? null}
            title={askTitle}
            question={askQuestion}
            busy={askBusy}
            created={askCreated}
            onClose={() => {
              setAskFor(null);
              setAskCreated(null);
            }}
            onTitleChange={setAskTitle}
            onQuestionChange={setAskQuestion}
            onPickQuick={(q) => setAskQuestion(q)}
            onCreate={createAsk}
          />
        ) : null}
      </div>
    </div>
  );
}

function BlockRow(props: {
  artifactId: string;
  block: BlockDto;
  revealDelayMs?: number;
  busy: boolean;
  autoEdit: boolean;
  onAutoEditConsumed: () => void;
  onOpenAdd: () => void;
  onOpenAsk: () => void;
  addMenuOpen: boolean;
  addMenuRef: RefObject<HTMLDivElement | null>;
  onAddBlock: (type: string) => void;
  justAdded?: boolean;
  dragging: boolean;
  dropActive: boolean;
  highlighted: boolean;
  onDragStart: (event: DragEvent, blockId: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent, blockId: string) => void;
  onDrop: (event: DragEvent, blockId: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  suggestions: SuggestionDto[];
  onAcceptSuggestion: (suggestionId: string) => void;
  onDeclineSuggestion: (suggestionId: string) => void;
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const { autoEdit, onAutoEditConsumed } = props;
  const suggestionPreview = useMemo(() => selectSuggestionPreview(props.suggestions), [props.suggestions]);

  useEffect(() => {
    if (!autoEdit) return;
    rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    onAutoEditConsumed();
  }, [autoEdit, onAutoEditConsumed]);

  return (
    <div
      ref={rowRef}
      className={[
        "doc-block-shell doc-block-reveal group relative flex gap-3 rounded-2xl border border-white/70 bg-white/50 p-4 backdrop-blur-xl overflow-visible",
        props.addMenuOpen ? "z-[120]" : "z-0",
        props.dropActive ? "ring-2 ring-sky-200" : "",
        props.highlighted ? "ring-2 ring-fuchsia-200 bg-fuchsia-50/50" : "",
        props.dragging ? "opacity-60" : "",
        props.justAdded ? "guide-ring" : "",
      ].join(" ")}
      style={props.revealDelayMs != null ? { animationDelay: `${props.revealDelayMs}ms` } : undefined}
      draggable={!props.busy}
      onDragStart={(event) => props.onDragStart(event, props.block.id)}
      onDragEnd={props.onDragEnd}
      onDragOver={(event) => props.onDragOver(event, props.block.id)}
      onDrop={(event) => props.onDrop(event, props.block.id)}
    >
      {props.justAdded ? (
        <span
          className="guide-badge"
          style={{
            "--folder-accent": "101 149 255",
            "--folder-surface": "232 239 255",
            "--folder-edge": "191 219 254",
            "--folder-ink": "30 64 175",
          } as CSSProperties}
        >
          Just added
        </span>
      ) : null}
      <div className="relative w-12 shrink-0 pt-1">
        <div className="pointer-events-none absolute left-4 top-2 h-[calc(100%-12px)] w-px bg-white/70 opacity-70" />
        <button
          type="button"
          disabled={props.busy}
          draggable={false}
          className="block-side-action absolute left-0 top-0 grid h-8 w-8 place-items-center rounded-full border border-white/70 bg-white/70 text-[11px] text-slate-700 opacity-0 shadow-sm transition hover:bg-white/95 group-hover:opacity-100 disabled:opacity-50"
          aria-label="Drag block"
          title="Drag block"
        >
          ⋮⋮
        </button>
        <button
          type="button"
          disabled={props.busy}
          onClick={props.onOpenAdd}
          className="block-side-action absolute left-0 top-9 grid h-8 w-8 place-items-center rounded-full border border-white/70 bg-white/70 text-sm text-slate-700 opacity-0 shadow-sm transition hover:bg-white/95 group-hover:opacity-100 disabled:opacity-50"
          aria-label="Add block"
          title="Add block"
        >
          +
        </button>
        <button
          type="button"
          disabled={props.busy}
          onClick={props.onOpenAsk}
          className="block-side-action absolute left-0 top-[72px] grid h-8 w-8 place-items-center rounded-full border border-white/70 bg-white/70 text-sm text-slate-700 opacity-0 shadow-sm transition hover:bg-white/95 group-hover:opacity-100 disabled:opacity-50"
          aria-label="Request input"
          title="Request input"
        >
          ?
        </button>

        {props.addMenuOpen ? (
          <div ref={props.addMenuRef} className="absolute left-10 top-1 z-[200] w-[320px]">
            <BlockTypeMenu onSelect={(type) => props.onAddBlock(type)} />
          </div>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center justify-end gap-1">
          <button
            type="button"
            className="rounded-full border border-white/70 bg-white/70 px-2 py-0.5 text-[11px] text-slate-700 hover:bg-white/95 disabled:opacity-40"
            onClick={props.onMoveUp}
            disabled={props.busy || !props.canMoveUp}
            title="Move up"
            aria-label="Move block up"
          >
            ↑
          </button>
          <button
            type="button"
            className="rounded-full border border-white/70 bg-white/70 px-2 py-0.5 text-[11px] text-slate-700 hover:bg-white/95 disabled:opacity-40"
            onClick={props.onMoveDown}
            disabled={props.busy || !props.canMoveDown}
            title="Move down"
            aria-label="Move block down"
          >
            ↓
          </button>
        </div>
        <div className={props.suggestions.length > 0 ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_17rem]" : undefined}>
          <div className="min-w-0">
            <BlockEditor
              artifactId={props.artifactId}
              block={props.block}
              autoEdit={props.autoEdit}
              suggestionPreview={suggestionPreview}
            />
          </div>

          {props.suggestions.length > 0 ? (
            <aside className="min-w-0 border-t border-slate-200/80 pt-4 xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
              <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                {props.suggestions.length} open comment{props.suggestions.length === 1 ? "" : "s"}
              </div>
              <div className="grid gap-3">
                {props.suggestions.map((suggestion) => (
                  <SuggestionCommentCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onAccept={() => props.onAcceptSuggestion(suggestion.id)}
                    onDecline={() => props.onDeclineSuggestion(suggestion.id)}
                  />
                ))}
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SuggestionCommentCard(props: {
  suggestion: SuggestionDto;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { suggestion } = props;
  const isEdit = suggestion.payload?.kind === "suggestion";
  const replacementCopy = suggestion.payload?.suggestedText?.trim() || suggestion.summary;
  const originalCopy = suggestion.payload?.originalText?.trim() ?? "";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3 text-sm text-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-800">
            {isEdit ? "Suggested edit" : "Inline comment"}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {suggestion.createdByName ? `${suggestion.createdByName} · ` : ""}
            {new Date(suggestion.createdAt).toLocaleString()}
          </div>
        </div>
        <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
          {suggestion.severity}
        </div>
      </div>

      {isEdit ? (
        <div className="mt-3 grid gap-3">
          {originalCopy ? (
            <div className="whitespace-pre-wrap text-sm leading-6 text-slate-400 line-through decoration-rose-300 decoration-2">
              {originalCopy}
            </div>
          ) : null}

          <div className="whitespace-pre-wrap text-sm leading-6 text-slate-900">
            {replacementCopy}
          </div>
        </div>
      ) : (
        <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{replacementCopy}</div>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        <Button type="button" variant="secondary" onClick={props.onDecline}>
          Decline
        </Button>
        <Button type="button" onClick={props.onAccept}>
          Accept
        </Button>
      </div>
    </div>
  );
}

function selectSuggestionPreview(suggestions: SuggestionDto[]): BlockSuggestionPreview | null {
  const editSuggestion = suggestions.find(
    (suggestion) =>
      suggestion.payload?.kind === "suggestion" && Boolean(suggestion.payload.suggestedText.trim()),
  );
  if (!editSuggestion?.payload) return null;
  return {
    originalText: editSuggestion.payload.originalText,
    suggestedText: editSuggestion.payload.suggestedText,
    applyMode: editSuggestion.payload.applyMode,
  };
}

function InsertRail(props: {
  busy: boolean;
  open: boolean;
  onOpen: () => void;
  menuRef: RefObject<HTMLDivElement | null>;
  onAdd: (type: string) => void;
  highlight?: boolean;
}) {
  return (
    <div
      className={[
        "group relative z-[20] flex gap-3 rounded-2xl px-4 py-2",
        props.open ? "z-[120]" : "",
      ].join(" ")}
    >
      <div className="relative w-12 shrink-0">
        <button
          type="button"
          disabled={props.busy}
          onClick={props.onOpen}
          className={["plus-rail-btn absolute left-0 top-0", props.highlight ? "guide-circle" : ""].join(" ")}
          aria-label="Insert block"
          title="Insert block"
        >
          +
        </button>
        {props.open ? (
          <div ref={props.menuRef} className="absolute left-10 top-0 z-[200] w-[320px]">
            <BlockTypeMenu onSelect={(type) => props.onAdd(type)} />
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none relative flex-1 pt-3">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/80 to-transparent opacity-0 transition group-hover:opacity-100" />
      </div>
    </div>
  );
}

function AskSheet(props: {
  workspaceSlug: string;
  artifactTitle: string;
  block: BlockDto | null;
  title: string;
  question: string;
  busy: boolean;
  created: ReviewRequestShareState | null;
  onClose: () => void;
  onTitleChange: (v: string) => void;
  onQuestionChange: (v: string) => void;
  onPickQuick: (q: string) => void;
  onCreate: () => void;
}) {
  const quick = askQuickPills(props.block?.type ?? "text");
  const blockLabel = props.block ? (props.block.title ?? props.block.type) : "Block";

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-slate-950/10 backdrop-blur-sm" />

      <div className="absolute inset-y-0 right-0 w-full max-w-[560px] p-4 sm:p-6">
        <div className="sheet-card glass-strong h-full overflow-hidden rounded-[26px] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">Request pointed input</div>
              <div className="mt-1 text-xs text-muted">
                Create a targeted review request (and post to Slack if configured).
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="rounded-full border border-white/60 bg-white/60 px-3 py-1 text-slate-800">
                  {props.artifactTitle}
                </span>
                <span className="rounded-full border border-white/60 bg-white/50 px-3 py-1">{blockLabel}</span>
              </div>
            </div>

            <button
              type="button"
              className="rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs text-slate-700 hover:bg-white/90"
              onClick={props.onClose}
            >
              Close
            </button>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="text-xs text-muted">Title</span>
              <Input value={props.title} onChange={(e) => props.onTitleChange(e.target.value)} />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-xs text-muted">Question</span>
              <textarea
                className="w-full resize-y rounded-xl border border-white/70 bg-white/75 px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
                rows={4}
                value={props.question}
                onChange={(e) => props.onQuestionChange(e.target.value)}
                placeholder="Ask one crisp, answerable question…"
              />
            </label>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Quick picks</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {quick.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="rounded-full border border-white/70 bg-white/65 px-3 py-1 text-xs text-slate-700 hover:bg-white/90"
                    onClick={() => props.onPickQuick(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {props.created ? <ReviewRequestShareCard share={props.created} /> : null}

            <div className="mt-auto flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={props.onClose} disabled={props.busy}>
                Cancel
              </Button>
              <Button type="button" onClick={props.onCreate} disabled={props.busy || !props.question.trim()}>
                {props.busy ? "Creating…" : "Create request"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BlockTypeMenu(props: { onSelect: (type: string) => void }) {
  return (
    <div className="block-insert-popover">
      <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
        Add block
      </div>
      <div className="grid gap-1">
        {BLOCK_TYPES.map((t) => (
          <button
            key={t.type}
            type="button"
            onClick={() => props.onSelect(t.type)}
            className="flex w-full items-start gap-3 rounded-xl border border-transparent px-3 py-2 text-left hover:border-white/70 hover:bg-white/70"
          >
            <div className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg border border-white/70 bg-white/60 text-xs font-semibold text-slate-800">
              {t.icon}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900">{t.label}</div>
              <div className="text-xs text-muted">{t.hint}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function defaultContentForType(type: string) {
  switch (type) {
    case "decision":
      return `**Decision:** \n\n**Rationale:** \n\n**Tradeoffs:** \n`;
    case "risk":
      return `**Risk:** \n\n**Impact:** \n\n**Mitigation:** \n`;
    case "assumption":
      return `**Assumption:** \n\n**How we’ll validate:** \n`;
    case "question":
      return `**Question:** \n\n**Why it matters:** \n\n**Reply with:** \n`;
    case "metric":
      return `**Metric:** \n\n**How we measure:** \n\n**Target:** \n`;
    case "option":
      return `**Option:** \n\n**Pros:** \n\n**Cons:** \n`;
    case "table":
      return JSON.stringify({
        version: 1,
        columns: ["Column 1", "Column 2"],
        rows: [["", ""]],
      });
    default:
      return "";
  }
}

function defaultAskQuestion(type: string, title?: string) {
  const t = (title ?? "").trim();
  if (type === "question") return t ? `Can you answer: ${t}?` : "Can you answer this question?";
  if (type === "risk") return "What’s the biggest risk here, and how would you mitigate it?";
  if (type === "decision") return "Do you agree with this decision? What would you change?";
  if (type === "metric") return "Are these success metrics correct? What would you measure instead?";
  return "What’s missing, unclear, or risky in this section?";
}

function askQuickPills(type: string) {
  if (type === "risk") {
    return [
      "What’s the biggest risk and mitigation?",
      "Any privacy/compliance issues?",
      "What could break at scale?",
    ];
  }
  if (type === "decision") {
    return ["Do you agree? Why/why not?", "What’s the best alternative?", "What tradeoff are we missing?"];
  }
  if (type === "metric") {
    return ["Are metrics measurable?", "What leading indicator would you use?", "What target is realistic?"];
  }
  if (type === "question") {
    return ["Answer with 2–3 bullets.", "What evidence supports the answer?", "What would change your mind?"];
  }
  return ["What’s missing/unclear?", "What would you change?", "Any dependencies or unknowns?"];
}
