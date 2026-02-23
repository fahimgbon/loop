"use client";

import { useState } from "react";

import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";

export function ArtifactTitleEditor(props: { artifactId: string; initialTitle: string }) {
  const [title, setTitle] = useState(props.initialTitle);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/artifacts/${props.artifactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Input
        className="text-base font-semibold"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Artifact title"
      />
      <Button variant="secondary" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

