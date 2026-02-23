"use client";

import { useState } from "react";

import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";

export function ReviewRequestForm(props: { workspaceSlug: string; artifactId: string }) {
  const [title, setTitle] = useState("Async review");
  const [q1, setQ1] = useState("What’s the biggest flaw or risk?");
  const [q2, setQ2] = useState("What would you change or clarify?");
  const [q3, setQ3] = useState("Any dependencies or unknowns?");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatedId(null);
    setLoading(true);
    try {
      const questions = [q1, q2, q3].map((q) => q.trim()).filter(Boolean);
      const res = await fetch(`/api/workspaces/${props.workspaceSlug}/review-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifactId: props.artifactId, title, questions }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; reviewRequestId?: string; error?: string }
        | null;
      if (!res.ok || !data?.ok || !data.reviewRequestId) {
        setError(data?.error ?? "Create failed");
        return;
      }
      setCreatedId(data.reviewRequestId);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Title</span>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Question 1</span>
        <Input value={q1} onChange={(e) => setQ1(e.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Question 2</span>
        <Input value={q2} onChange={(e) => setQ2(e.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Question 3</span>
        <Input value={q3} onChange={(e) => setQ3(e.target.value)} />
      </label>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {createdId ? <p className="text-sm text-green-400">Created: {createdId}</p> : null}
      <div className="flex items-center justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? "Creating…" : "Create request"}
        </Button>
      </div>
    </form>
  );
}

