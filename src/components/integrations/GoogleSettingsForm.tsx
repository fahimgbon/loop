"use client";

import { useState } from "react";

import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";

export function GoogleSettingsForm(props: {
  workspaceSlug: string;
  initialCalendarId: string | null;
  connected: boolean;
}) {
  const [calendarId, setCalendarId] = useState(props.initialCalendarId ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${props.workspaceSlug}/settings/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultCalendarId: calendarId.trim() ? calendarId.trim() : null }),
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

  async function syncNow() {
    setSyncing(true);
    setError(null);
    setSyncSummary(null);
    try {
      const res = await fetch(`/api/workspaces/${props.workspaceSlug}/google/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarId: calendarId.trim() ? calendarId.trim() : null }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            events?: number;
            attachments?: number;
            contributions?: number;
            signalUpdates?: number;
            error?: string;
          }
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Sync failed");
        return;
      }
      setSyncSummary(
        `Synced ${data?.events ?? 0} events, ${data?.attachments ?? 0} docs, ${data?.contributions ?? 0} contributions, ${data?.signalUpdates ?? 0} artifact updates.`,
      );
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/60 bg-white/50 p-4 backdrop-blur-xl">
      <div className="text-sm font-medium">Default Google Calendar (optional)</div>
      <p className="mt-1 text-xs text-muted">
        If set, Loop will scan this calendar for events with Docs attached (e.g.{" "}
        <span className="font-mono">primary</span> or a calendar ID).
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input value={calendarId} onChange={(e) => setCalendarId(e.target.value)} placeholder="primary" />
        <Button type="button" variant="secondary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" onClick={syncNow} disabled={syncing || !props.connected}>
          {syncing ? "Syncing…" : "Sync now"}
        </Button>
      </div>
      {!props.connected ? (
        <p className="mt-2 text-xs text-muted">Connect Google Workspace first to sync calendar events.</p>
      ) : null}
      {saved ? <p className="mt-2 text-xs text-green-400">Saved.</p> : null}
      {syncSummary ? <p className="mt-2 text-xs text-emerald-600">{syncSummary}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
