"use client";

import { useState } from "react";

import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";
import { Textarea } from "@/src/components/Textarea";

export function AnywhereMeetingCapture(props: {
  workspaceSlug: string;
  artifacts: Array<{ id: string; title: string }>;
}) {
  const [title, setTitle] = useState("");
  const [artifactId, setArtifactId] = useState("");
  const [notesMd, setNotesMd] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/workspaces/${props.workspaceSlug}/meetings/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          notesMd,
          artifactId: artifactId || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; contributionId?: string; error?: string }
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Could not log meeting");
        return;
      }
      setMessage("Meeting captured. Loop will classify and route it.");
      setNotesMd("");
      setTitle("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/70 bg-white/65 p-4 backdrop-blur-xl">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Anywhere meeting</div>
      <div className="mt-1 text-xs text-muted">
        Paste minutes from Zoom, phone notes, or hallway syncs. Attach to an artifact or inbox.
      </div>
      <div className="mt-3 grid gap-2">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Meeting title (optional)"
        />
        <select
          className="rounded-md border border-white/70 bg-white/85 px-3 py-2 text-sm outline-none focus:border-accent"
          value={artifactId}
          onChange={(event) => setArtifactId(event.target.value)}
        >
          <option value="">No artifact yet (send to inbox)</option>
          {props.artifacts.map((artifact) => (
            <option key={artifact.id} value={artifact.id}>
              {artifact.title}
            </option>
          ))}
        </select>
        <Textarea
          rows={5}
          value={notesMd}
          onChange={(event) => setNotesMd(event.target.value)}
          placeholder="Paste meeting notes here…"
        />
      </div>
      <div className="mt-3 flex items-center justify-end">
        <Button type="button" onClick={submit} disabled={busy || !notesMd.trim()}>
          {busy ? "Capturing…" : "Capture meeting"}
        </Button>
      </div>
      {message ? <div className="mt-2 text-xs text-emerald-600">{message}</div> : null}
      {error ? <div className="mt-2 text-xs text-red-500">{error}</div> : null}
    </div>
  );
}
