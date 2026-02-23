"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/src/components/Button";
import { Markdown } from "@/src/components/Markdown";
import { Textarea } from "@/src/components/Textarea";

export type BlockDto = {
  id: string;
  type: string;
  title: string | null;
  content_md: string;
  position: number;
};

export function BlockEditor(props: { artifactId: string; block: BlockDto; autoEdit?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(props.block.content_md);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pointMode, setPointMode] = useState<"addition" | "question" | null>(null);
  const [pointText, setPointText] = useState("");

  const lastSavedRef = useRef(props.block.content_md);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const badge = useMemo(() => blockBadge(props.block.type), [props.block.type]);

  useEffect(() => {
    if (editing) return;
    setContent(props.block.content_md);
    lastSavedRef.current = props.block.content_md;
  }, [props.block.content_md, editing]);

  useEffect(() => {
    if (!props.autoEdit) return;
    setPointMode(null);
    setEditing(true);
  }, [props.autoEdit]);

  useEffect(() => {
    if (!editing) return;
    const t = window.setTimeout(() => textareaRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [editing]);

  async function persist(next: string, close: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/artifacts/${props.artifactId}/blocks/${props.block.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentMd: next }),
      });
      if (!res.ok) throw new Error("Save failed");
      lastSavedRef.current = next;
      setSavedAt(Date.now());
      setContent(next);
      if (close) setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    await persist(content, true);
  }

  async function savePointed(kind: "addition" | "question") {
    const text = pointText.trim();
    if (!text) return;
    const prefix = kind === "question" ? "- -> Question: " : "- -> Addition: ";
    const base = lastSavedRef.current.trimEnd();
    const next = base.length ? `${base}\n${prefix}${text}` : `${prefix}${text}`;
    await persist(next, false);
    setPointText("");
    setPointMode(null);
  }

  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className={badge.className}>
              <span className="text-xs font-semibold">{badge.icon}</span>
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">{badge.label}</span>
            </div>
            {props.block.title ? (
              <div className="truncate text-sm font-semibold text-slate-900">{props.block.title}</div>
            ) : null}
          </div>
          <div className="mt-1 text-[11px] text-muted">
            {saving ? "Saving…" : savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : " "}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setContent(lastSavedRef.current);
                  setEditing(false);
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="button" onClick={save} disabled={saving}>
                Save
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setPointMode(null);
                setEditing(true);
              }}
            >
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3">
        {editing ? (
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={7}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void save();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setContent(lastSavedRef.current);
                setEditing(false);
              }
            }}
            onBlur={() => {
              if (content === lastSavedRef.current) {
                setEditing(false);
                return;
              }
              void persist(content, true);
            }}
          />
        ) : content.trim().length ? (
          <div
            className="cursor-text rounded-xl border border-white/60 bg-white/60 p-3 backdrop-blur-xl"
            onClick={() => {
              setPointMode(null);
              setEditing(true);
            }}
          >
            <Markdown markdown={content} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setPointMode(null);
              setEditing(true);
            }}
            className="w-full rounded-xl border border-dashed border-white/70 bg-white/50 p-4 text-left text-sm text-muted backdrop-blur-xl hover:bg-white/70"
          >
            Type markdown… <span className="text-slate-500">⌘</span>
            <span className="text-slate-500">⏎</span> to save
          </button>
        )}
      </div>

      {!editing ? (
        <div className="pointed-panel mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={pointMode === "addition" ? "point-chip ring-2 ring-sky-200" : "point-chip"}
              onClick={() => {
                setPointMode("addition");
                setPointText("");
              }}
              disabled={saving}
            >
              + Addition
            </button>
            <button
              type="button"
              className={pointMode === "question" ? "point-chip ring-2 ring-fuchsia-200" : "point-chip"}
              onClick={() => {
                setPointMode("question");
                setPointText("");
              }}
              disabled={saving}
            >
              + Pointed question
            </button>
          </div>

          {pointMode ? (
            <div className="mt-3 grid gap-2">
              <input
                value={pointText}
                onChange={(e) => setPointText(e.target.value)}
                placeholder={
                  pointMode === "question"
                    ? "What specific question should collaborators answer?"
                    : "What pointed addition should be captured?"
                }
                className="w-full rounded-lg border border-white/75 bg-white/85 px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setPointMode(null);
                    setPointText("");
                    return;
                  }
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void savePointed(pointMode);
                  }
                }}
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setPointMode(null);
                    setPointText("");
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={() => void savePointed(pointMode)} disabled={saving || !pointText.trim()}>
                  {saving ? "Saving…" : "Save pointed item"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-[11px] text-muted">Pointed notes are added as clear bullets in this block.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function blockBadge(type: string) {
  const t = type.toLowerCase();
  if (t === "risk") {
    return {
      icon: "⚠︎",
      label: "Risk",
      className:
        "inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700",
    };
  }
  if (t === "question") {
    return {
      icon: "?",
      label: "Question",
      className:
        "inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-fuchsia-700",
    };
  }
  if (t === "decision") {
    return {
      icon: "✓",
      label: "Decision",
      className:
        "inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700",
    };
  }
  if (t === "assumption") {
    return {
      icon: "△",
      label: "Assumption",
      className:
        "inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800",
    };
  }
  if (t === "metric") {
    return {
      icon: "◎",
      label: "Metric",
      className:
        "inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700",
    };
  }
  if (t === "table") {
    return {
      icon: "▦",
      label: "Table",
      className:
        "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700",
    };
  }
  if (t === "option") {
    return {
      icon: "⇄",
      label: "Option",
      className:
        "inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-indigo-700",
    };
  }
  return {
    icon: "Aa",
    label: type || "Text",
    className:
      "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/60 px-3 py-1 text-slate-800 backdrop-blur-xl",
  };
}
