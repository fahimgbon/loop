"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";

export default function SetupPage() {
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState("Demo Workspace");
  const [workspaceSlug, setWorkspaceSlug] = useState("demo");
  const [name, setName] = useState("Admin");
  const [email, setEmail] = useState("admin@aceync.local");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceName, workspaceSlug, name, email, password }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; workspaceSlug?: string; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Setup failed");
        return;
      }
      router.push(`/w/${data.workspaceSlug}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Set up Aceync</h1>
      <p className="mt-1 text-sm text-muted">Create your first workspace and admin user.</p>

      <form className="glass mt-6 grid gap-4 rounded-xl p-6" onSubmit={onSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Workspace name</span>
            <Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} required />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Workspace slug</span>
            <Input value={workspaceSlug} onChange={(e) => setWorkspaceSlug(e.target.value)} required />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Your name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Email</span>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </label>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Password</span>
          <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </label>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <div className="mt-2 flex items-center justify-between">
          <Button type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create workspace"}
          </Button>
          <a className="text-sm text-muted hover:underline" href="/login">
            Already have an account?
          </a>
        </div>
      </form>
    </main>
  );
}
