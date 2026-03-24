"use client";

import { useEffect, useRef, useState } from "react";

import { Input } from "@/src/components/Input";

export function ArtifactTitleEditor(props: { artifactId: string; initialTitle: string }) {
  const [title, setTitle] = useState(props.initialTitle);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const lastSavedRef = useRef(props.initialTitle);

  useEffect(() => {
    setTitle(props.initialTitle);
    lastSavedRef.current = props.initialTitle;
  }, [props.initialTitle]);

  async function save(nextTitle?: string) {
    const value = (nextTitle ?? title).trim();
    if (!value || value === lastSavedRef.current.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/artifacts/${props.artifactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: value }),
      });
      lastSavedRef.current = value;
      setTitle(value);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-3">
      <Input
        className="h-auto rounded-none border-none bg-transparent px-0 text-3xl font-semibold tracking-[-0.04em] shadow-none placeholder:text-slate-400 focus:border-transparent focus:ring-0 sm:text-5xl"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Artifact title"
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void save();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setTitle(lastSavedRef.current);
          }
        }}
      />
      <div className="text-xs font-medium text-slate-500">
        {saving ? "Saving title..." : savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : " "}
      </div>
    </div>
  );
}
