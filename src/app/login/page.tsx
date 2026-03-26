"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; workspaceSlug?: string; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Login failed");
        return;
      }
      router.push(`/w/${data.workspaceSlug}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
      <p className="mt-1 text-sm text-muted">Use your Aceync email/password.</p>

      <form className="glass mt-6 grid gap-3 rounded-xl p-6" onSubmit={onSubmit}>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Email</span>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Password</span>
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <div className="mt-2 flex items-center justify-between">
          <Button type="submit" disabled={loading}>
            {loading ? "Logging in…" : "Log in"}
          </Button>
          <a className="text-sm text-muted hover:underline" href="/setup">
            First time? Set up
          </a>
        </div>
      </form>
    </main>
  );
}
