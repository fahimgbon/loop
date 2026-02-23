"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/src/components/Button";

type FolderSyncPreview = {
  hasFolder: boolean;
  folderName: string | null;
  folderStructureVersion: number | null;
  artifactStructureVersion: number | null;
  outdated: boolean;
  additions: Array<{ key: string; type: string; title: string | null }>;
  deletions: Array<{ blockId: string; key: string; type: string; title: string | null }>;
};

export function FolderSyncPrompt(props: { artifactId: string }) {
  const [preview, setPreview] = useState<FolderSyncPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/artifacts/${props.artifactId}/folder-sync`);
    const data = (await res.json().catch(() => null)) as { preview?: FolderSyncPreview; error?: string } | null;
    if (!res.ok || !data?.preview) {
      setPreview(null);
      return;
    }
    setPreview(data.preview);
  }, [props.artifactId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function applyChanges(input: { applyAdditions: boolean; applyDeletions: boolean }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/artifacts/${props.artifactId}/folder-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Could not apply folder changes");
        return;
      }
      await load();
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  if (!preview?.hasFolder || !preview.outdated) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
      <div className="font-medium">
        Folder structure update available
        {preview.folderName ? ` · ${preview.folderName}` : ""}
      </div>
      <p className="mt-1 text-xs text-amber-700">
        Artifact version {preview.artifactStructureVersion ?? 0} is behind folder version{" "}
        {preview.folderStructureVersion ?? 0}.
      </p>

      <div className="mt-2 grid gap-1 text-xs">
        {preview.additions.length > 0 ? (
          <div>
            Add: {preview.additions.map((block) => block.title ?? block.type).join(", ")}
          </div>
        ) : null}
        {preview.deletions.length > 0 ? (
          <div>
            Remove: {preview.deletions.map((block) => block.title ?? block.type).join(", ")}
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {preview.additions.length > 0 ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void applyChanges({ applyAdditions: true, applyDeletions: false })}
          >
            Add missing blocks
          </Button>
        ) : null}
        {preview.deletions.length > 0 ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void applyChanges({ applyAdditions: false, applyDeletions: true })}
          >
            Delete extra blocks
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={busy}
          onClick={() =>
            void applyChanges({
              applyAdditions: preview.additions.length > 0,
              applyDeletions: preview.deletions.length > 0,
            })
          }
        >
          {busy ? "Applying…" : "Apply all changes"}
        </Button>
      </div>
    </div>
  );
}
