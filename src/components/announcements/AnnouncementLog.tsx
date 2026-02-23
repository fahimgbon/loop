"use client";

import { useState } from "react";

import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";
import { Markdown } from "@/src/components/Markdown";
import { Textarea } from "@/src/components/Textarea";

type Announcement = {
  id: string;
  title: string;
  bodyMd: string;
  source: "manual" | "announcement" | "google_classroom" | "google_form" | "google_meet" | "slack";
  sourceRef: string | null;
  createdAt: string;
  createdByName: string | null;
  createdByEmail: string | null;
};

const SOURCES: Array<{ value: Announcement["source"]; label: string }> = [
  { value: "manual", label: "Manual" },
  { value: "announcement", label: "Announcement" },
  { value: "google_classroom", label: "Google Classroom" },
  { value: "google_form", label: "Google Form" },
  { value: "google_meet", label: "Google Meet" },
  { value: "slack", label: "Slack" },
];

export function AnnouncementLog(props: {
  workspaceSlug: string;
  initialAnnouncements: Announcement[];
}) {
  const [announcements, setAnnouncements] = useState<Announcement[]>(props.initialAnnouncements);
  const [title, setTitle] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [source, setSource] = useState<Announcement["source"]>("manual");
  const [sourceRef, setSourceRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createAnnouncementEntry() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${props.workspaceSlug}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          bodyMd,
          source,
          sourceRef: sourceRef.trim() ? sourceRef.trim() : undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Failed to create log");
        return;
      }

      const listRes = await fetch(`/api/workspaces/${props.workspaceSlug}/announcements`);
      const listData = (await listRes.json().catch(() => null)) as { announcements?: Announcement[] } | null;
      if (listRes.ok && listData?.announcements) setAnnouncements(listData.announcements);

      setTitle("");
      setBodyMd("");
      setSourceRef("");
      setSource("manual");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-white/70 bg-white/65 p-4 backdrop-blur-xl">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Log update</div>
        <div className="mt-3 grid gap-2">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title (e.g., Class feedback batch #4)"
          />
          <Textarea
            value={bodyMd}
            onChange={(event) => setBodyMd(event.target.value)}
            rows={4}
            placeholder="Notes, minutes, key updates, linked docs…"
          />
          <div className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
            <select
              className="rounded-md border border-white/70 bg-white/85 px-3 py-2 text-sm outline-none focus:border-accent"
              value={source}
              onChange={(event) => setSource(event.target.value as Announcement["source"])}
            >
              {SOURCES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <Input
              value={sourceRef}
              onChange={(event) => setSourceRef(event.target.value)}
              placeholder="Optional source ref (form ID, class post URL, message ID)"
            />
            <Button
              type="button"
              onClick={createAnnouncementEntry}
              disabled={busy || !title.trim()}
            >
              {busy ? "Logging…" : "Log"}
            </Button>
          </div>
        </div>
        {error ? <div className="mt-2 text-xs text-red-500">{error}</div> : null}
      </div>

      <div className="grid gap-3">
        {announcements.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/70 bg-white/45 p-4 text-sm text-muted">
            No logs yet. Add announcements, Google Classroom/Form notes, or meeting updates here.
          </div>
        ) : (
          announcements.map((announcement, idx) => (
            <div key={announcement.id} className="rounded-2xl border border-white/70 bg-white/72 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900">{announcement.title}</div>
                <div className="flex items-center gap-2 text-[11px] text-muted">
                  <span className="rounded-full border border-white/70 bg-white/70 px-2 py-0.5 uppercase tracking-[0.14em]">
                    {announcement.source.replace(/_/g, " ")}
                  </span>
                  {idx === 0 ? (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700">Most recent</span>
                  ) : null}
                </div>
              </div>
              {announcement.bodyMd.trim() ? (
                <div className="mt-3 rounded-xl border border-white/70 bg-white/70 p-3">
                  <Markdown markdown={announcement.bodyMd} />
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                <span>{new Date(announcement.createdAt).toLocaleString()}</span>
                {announcement.createdByName ? <span>· {announcement.createdByName}</span> : null}
                {announcement.sourceRef ? <span>· Ref: {announcement.sourceRef}</span> : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
