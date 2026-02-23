"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";

type SearchResult = {
  artifacts: Array<{ id: string; title: string; status: string; updated_at: string }>;
  blocks: Array<{
    block_id: string;
    block_title: string | null;
    block_type: string;
    artifact_id: string;
    artifact_title: string;
  }>;
};

function getApiError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const error = (payload as Record<string, unknown>).error;
  return typeof error === "string" && error.trim().length ? error : null;
}

export default function SearchPage() {
  const params = useParams<{ workspaceSlug: string }>();
  const workspaceSlug = params.workspaceSlug;
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const url = useMemo(() => `/api/workspaces/${workspaceSlug}/search?q=${encodeURIComponent(q)}`, [q, workspaceSlug]);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length === 0) {
      setResult(null);
      setError(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(url);
        const data = (await res.json().catch(() => null)) as SearchResult | { error?: string } | null;
        if (!res.ok) throw new Error(getApiError(data) ?? "Search failed");
        if (!cancelled) setResult(data as SearchResult);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, url]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Search</h1>
          <p className="mt-1 text-sm text-muted">Query artifacts and blocks.</p>
        </div>
        <a className="rounded-md border border-white/60 bg-white/40 px-3 py-2 text-sm hover:bg-white/70" href={`/w/${workspaceSlug}`}>
          Back
        </a>
      </div>

      <div className="glass mt-6 rounded-xl p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title, topic, text…" />
          <Button type="button" variant="secondary" onClick={() => setQ("")}>
            Clear
          </Button>
        </div>
        <div className="mt-2 text-xs text-muted">{loading ? "Searching…" : q.trim() ? " " : "Type to search."}</div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      {result ? (
        <div className="mt-6 grid gap-6">
          <section className="glass rounded-xl p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Artifacts</h2>
            {result.artifacts.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No matches.</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {result.artifacts.map((a) => (
                  <li key={a.id}>
                    <a className="text-blue-400 hover:underline" href={`/w/${workspaceSlug}/artifacts/${a.id}`}>
                      {a.title}
                    </a>
                    <div className="text-xs text-muted">
                      {a.status} · {new Date(a.updated_at).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="glass rounded-xl p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Blocks</h2>
            {result.blocks.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No matches.</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {result.blocks.map((b) => (
                  <li key={b.block_id} className="text-sm">
                    <a className="text-blue-400 hover:underline" href={`/w/${workspaceSlug}/artifacts/${b.artifact_id}`}>
                      {b.artifact_title}
                    </a>
                    <div className="text-xs text-muted">
                      {b.block_type}
                      {b.block_title ? ` · ${b.block_title}` : ""} · {b.block_id}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}
