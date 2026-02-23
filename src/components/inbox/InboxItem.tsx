"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";

export function InboxItem(props: {
  workspaceSlug: string;
  item: {
    id: string;
    source: string;
    created_at: string;
    audio_path: string | null;
    text_content: string | null;
    transcript: string | null;
    intent: string;
    intent_confidence: number | null;
  };
  templates: Array<{ id: string; slug: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [templateSlug, setTemplateSlug] = useState(props.templates[0]?.slug ?? "prd");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    const text = (props.item.transcript ?? props.item.text_content ?? "").trim();
    return text.length > 280 ? `${text.slice(0, 280)}…` : text;
  }, [props.item.text_content, props.item.transcript]);

  async function convert() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${props.workspaceSlug}/inbox/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contributionId: props.item.id,
          title: title.trim() || "New artifact",
          templateSlug,
        }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; artifactId?: string; error?: string } | null;
      if (!res.ok || !data?.ok || !data.artifactId) {
        setError(data?.error ?? "Convert failed");
        return;
      }
      router.push(`/w/${props.workspaceSlug}/artifacts/${data.artifactId}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-muted">
            {new Date(props.item.created_at).toLocaleString()} · {props.item.source} · intent: {props.item.intent}
            {props.item.intent_confidence ? ` (${Math.round(props.item.intent_confidence * 100)}%)` : ""}
          </div>
          <div className="mt-3 whitespace-pre-wrap text-sm">{preview || <span className="text-muted">Empty.</span>}</div>
          {props.item.audio_path ? (
            <a className="mt-3 inline-block text-xs text-blue-400 hover:underline" href={`/api/contributions/${props.item.id}/audio`} target="_blank">
              audio
            </a>
          ) : null}
        </div>
        <Button variant="secondary" type="button" onClick={() => setOpen((v) => !v)}>
          {open ? "Cancel" : "Create artifact"}
        </Button>
      </div>

      {open ? (
        <div className="mt-4 grid gap-3 rounded-lg border border-white/60 bg-white/50 p-4 backdrop-blur-xl">
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Title</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Improve onboarding" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Template</span>
            <select
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
              value={templateSlug}
              onChange={(e) => setTemplateSlug(e.target.value)}
            >
              {props.templates.map((t) => (
                <option key={t.id} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <div className="flex items-center justify-end">
            <Button type="button" onClick={convert} disabled={loading}>
              {loading ? "Creating…" : "Create + link"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
