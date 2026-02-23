"use client";

import { useState } from "react";

import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";

export function SlackSettingsForm(props: {
  workspaceSlug: string;
  initialDefaultChannelId: string | null;
}) {
  const [channelId, setChannelId] = useState(props.initialDefaultChannelId ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${props.workspaceSlug}/settings/slack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultChannelId: channelId.trim() ? channelId.trim() : null }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Save failed");
        return;
      }
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/60 bg-white/50 p-4 backdrop-blur-xl">
      <div className="text-sm font-medium">Default Slack channel (optional)</div>
      <p className="mt-1 text-xs text-muted">
        If set (e.g. <span className="font-mono">C123…</span>), Loop can post new review requests from the web UI.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input value={channelId} onChange={(e) => setChannelId(e.target.value)} placeholder="C1234567890" />
        <Button type="button" variant="secondary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      {saved ? <p className="mt-2 text-xs text-green-400">Saved.</p> : null}
      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
