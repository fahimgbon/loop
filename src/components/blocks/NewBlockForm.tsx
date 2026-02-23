"use client";

import { useState } from "react";

import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";

const COMMON_TYPES = ["text", "decision", "risk", "assumption", "question", "metric", "option", "table"];

export function NewBlockForm(props: {
  artifactId: string;
  compact?: boolean;
  insertPosition?: number;
  defaultType?: string;
  defaultTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(props.defaultType ?? "text");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(nextType?: string, nextTitle?: string) {
    setLoading(true);
    setError(null);
    try {
      const chosenType = nextType ?? type;
      const chosenTitle = nextTitle ?? (title || props.defaultTitle);
      const res = await fetch(`/api/artifacts/${props.artifactId}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: chosenType,
          title: chosenTitle || undefined,
          contentMd: "",
          insertPosition: props.insertPosition,
        }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Create failed");
        return;
      }
      window.location.reload();
    } finally {
      setLoading(false);
    }
  }

  if (props.compact && !open) {
    return (
      <div className="group relative py-2">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-0 transition group-hover:opacity-100" />
        <div className="flex justify-center">
          <button
            type="button"
            className="plus-rail-btn"
            aria-label="Insert block"
            onClick={() => setOpen(true)}
          >
            +
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={props.compact ? "block-insert-popover" : "rounded-xl border border-white/60 bg-white/50 p-4 backdrop-blur-xl"}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">Add block</div>
        <Button variant="secondary" type="button" onClick={() => setOpen((v) => !v)}>
          {open ? "Cancel" : "New"}
        </Button>
      </div>
      {open ? (
        <div className="mt-3 grid gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="point-chip"
              disabled={loading}
              onClick={() => create("question", "Pointed question")}
            >
              + Pointed question
            </button>
            <button
              type="button"
              className="point-chip"
              disabled={loading}
              onClick={() => create("text", "Addition")}
            >
              + Addition
            </button>
          </div>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Type</span>
            <select
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {COMMON_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Title (optional)</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Constraints" />
          </label>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div className="flex items-center justify-end">
            <Button type="button" onClick={() => create()} disabled={loading}>
              {loading ? "Creating…" : "Add"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
