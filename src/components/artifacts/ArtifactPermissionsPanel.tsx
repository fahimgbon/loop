"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/src/components/Button";

type Member = {
  userId: string;
  role: "admin" | "member";
  name: string;
  email: string;
};

type Permission = {
  userId: string;
  name: string;
  email: string;
  role: "viewer" | "editor";
  grantedByName: string | null;
  updatedAt: string;
};

export function ArtifactPermissionsPanel(props: { artifactId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"viewer" | "editor">("viewer");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingSet = useMemo(() => new Set(permissions.map((permission) => permission.userId)), [permissions]);
  const addableMembers = useMemo(
    () => members.filter((member) => !existingSet.has(member.userId)),
    [members, existingSet],
  );

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.artifactId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/artifacts/${props.artifactId}/permissions`);
      const data = (await res.json().catch(() => null)) as
        | { permissions?: Permission[]; members?: Member[]; error?: string }
        | null;
      if (!res.ok || !data?.permissions || !data?.members) {
        setError(data?.error ?? "Failed to load access settings");
        return;
      }
      setPermissions(data.permissions);
      setMembers(data.members);
      if (!selectedUserId && data.members.length > 0) {
        const first = data.members.find((member) => !data.permissions?.some((p) => p.userId === member.userId));
        if (first) setSelectedUserId(first.userId);
      }
    } finally {
      setLoading(false);
    }
  }

  async function savePermission(input: { userId: string; role: "viewer" | "editor" }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/artifacts/${props.artifactId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Could not update access");
        return;
      }
      setSelectedUserId("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function removePermission(userId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/artifacts/${props.artifactId}/permissions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Could not remove access");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/70 bg-white/60 p-4 text-sm text-muted">
        Loading permissions…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/70 bg-white/65 p-4 backdrop-blur-xl">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Permissions</div>
      <div className="mt-2 text-xs text-muted">
        Assign viewer/editor access so collaborators can review or co-edit imported decisions.
      </div>

      <div className="mt-3 grid gap-2">
        {permissions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/70 bg-white/45 p-3 text-xs text-muted">
            No explicit artifact permissions yet.
          </div>
        ) : (
          permissions.map((permission) => (
            <div
              key={permission.userId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/70 bg-white/75 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-900">{permission.name}</div>
                <div className="truncate text-xs text-muted">{permission.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="rounded-md border border-white/70 bg-white/80 px-2 py-1 text-xs outline-none focus:border-accent"
                  value={permission.role}
                  onChange={(event) =>
                    savePermission({
                      userId: permission.userId,
                      role: event.target.value as "viewer" | "editor",
                    })
                  }
                  disabled={busy}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button
                  type="button"
                  className="text-xs text-red-500 hover:underline disabled:opacity-50"
                  onClick={() => removePermission(permission.userId)}
                  disabled={busy}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 rounded-xl border border-white/70 bg-white/70 p-3">
        <div className="text-xs font-medium text-slate-900">Add collaborator</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_120px_auto]">
          <select
            className="rounded-md border border-white/70 bg-white/90 px-2 py-2 text-xs outline-none focus:border-accent"
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            disabled={busy || addableMembers.length === 0}
          >
            <option value="">{addableMembers.length > 0 ? "Select workspace member" : "No members left"}</option>
            {addableMembers.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name} · {member.email}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-white/70 bg-white/90 px-2 py-2 text-xs outline-none focus:border-accent"
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value as "viewer" | "editor")}
            disabled={busy}
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <Button
            type="button"
            onClick={() => {
              if (!selectedUserId) return;
              void savePermission({ userId: selectedUserId, role: selectedRole });
            }}
            disabled={busy || !selectedUserId}
          >
            {busy ? "Saving…" : "Add"}
          </Button>
        </div>
      </div>

      {error ? <div className="mt-3 text-xs text-red-500">{error}</div> : null}
    </div>
  );
}
