"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/src/components/Button";
import { AvatarStack } from "@/src/components/collaboration/AvatarStack";
import { buildMemberProfile } from "@/src/components/workspace/memberProfiles";

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

export function ArtifactPermissionsPanel(props: {
  artifactId: string;
  compact?: boolean;
  onPersonClick?: (userId: string) => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"viewer" | "editor">("viewer");
  const [activePersonId, setActivePersonId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingSet = useMemo(() => new Set(permissions.map((permission) => permission.userId)), [permissions]);
  const addableMembers = useMemo(
    () => members.filter((member) => !existingSet.has(member.userId)),
    [members, existingSet],
  );
  const editors = useMemo(() => permissions.filter((permission) => permission.role === "editor"), [permissions]);
  const viewers = useMemo(() => permissions.filter((permission) => permission.role === "viewer"), [permissions]);
  const activePermission = permissions.find((permission) => permission.userId === activePersonId) ?? null;
  const activeMember =
    members.find((member) => member.userId === activePersonId) ??
    members.find((member) => member.userId === permissions[0]?.userId) ??
    members[0] ??
    null;

  function avatarFor(userId: string, name: string, email: string) {
    return buildMemberProfile({
      userId,
      name,
      email,
      role: members.find((member) => member.userId === userId)?.role ?? "member",
    }).avatarSrc;
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.artifactId]);

  useEffect(() => {
    const available = new Set([
      ...permissions.map((permission) => permission.userId),
      ...members.map((member) => member.userId),
    ]);
    if (!activePersonId || !available.has(activePersonId)) {
      setActivePersonId(permissions[0]?.userId ?? members[0]?.userId ?? "");
    }
  }, [activePersonId, members, permissions]);

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
      if (!activePersonId) {
        const firstActive = data.permissions[0]?.userId ?? data.members[0]?.userId ?? "";
        setActivePersonId(firstActive);
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
      <div
        className={[
          "text-sm text-muted",
          props.compact
            ? "rounded-xl border border-dashed border-slate-200 bg-white/60 p-3"
            : "rounded-2xl border border-white/70 bg-white/60 p-4",
        ].join(" ")}
      >
        Loading permissions…
      </div>
    );
  }

  if (props.compact) {
    return (
      <div className="grid gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Collaborators</div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
            {editors.length} editor{editors.length === 1 ? "" : "s"}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
            {viewers.length} viewer{viewers.length === 1 ? "" : "s"}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
            {members.length} teammate{members.length === 1 ? "" : "s"}
          </span>
        </div>

        {permissions.length > 0 ? (
          <div className="grid gap-2">
            {permissions.map((permission) => (
              <div
                key={permission.userId}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => {
                    setActivePersonId(permission.userId);
                    props.onPersonClick?.(permission.userId);
                  }}
                >
                  <AvatarStack
                    people={[
                      {
                        id: permission.userId,
                        name: permission.name,
                        email: permission.email,
                        avatarSrc: avatarFor(permission.userId, permission.name, permission.email),
                      },
                    ]}
                    max={1}
                    size="sm"
                    onPersonClick={(person) => {
                      setActivePersonId(permission.userId);
                      if (person.id) props.onPersonClick?.(person.id);
                    }}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">{permission.name}</div>
                    <div className="truncate text-xs text-slate-500">{permission.email}</div>
                  </div>
                </button>

                <div className="flex shrink-0 items-center gap-2">
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-slate-400"
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
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                    onClick={() => props.onPersonClick?.(permission.userId)}
                  >
                    Profile
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                    onClick={() => removePermission(permission.userId)}
                    disabled={busy}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            No explicit collaborators yet.
          </div>
        )}

        {addableMembers.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Teammates</div>
            <div className="mt-2 grid gap-2">
              {addableMembers.map((member) => (
                <div
                  key={member.userId}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => props.onPersonClick?.(member.userId)}
                  >
                    <AvatarStack
                      people={[
                        {
                          id: member.userId,
                          name: member.name,
                          email: member.email,
                          avatarSrc: avatarFor(member.userId, member.name, member.email),
                        },
                      ]}
                      max={1}
                      size="sm"
                      onPersonClick={(person) => {
                        if (person.id) props.onPersonClick?.(person.id);
                      }}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">{member.name}</div>
                      <div className="truncate text-xs text-slate-500">{member.email}</div>
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                      onClick={() => void savePermission({ userId: member.userId, role: "viewer" })}
                      disabled={busy}
                    >
                      Viewer
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-900 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
                      onClick={() => void savePermission({ userId: member.userId, role: "editor" })}
                      disabled={busy}
                    >
                      Editor
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <div className="text-xs text-red-500">{error}</div> : null}
      </div>
    );
  }

  return (
    <div
      className={[
        props.compact
          ? "grid gap-3"
          : "rounded-2xl border border-white/70 bg-white/65 p-4 backdrop-blur-xl",
      ].join(" ")}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Collaborators</div>

      <div className="grid gap-2 rounded-xl border border-slate-200 bg-white/80 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-slate-900">Shared editing</div>
            <div className="mt-1 text-[11px] text-slate-500">
              {permissions.length > 0
                ? `${editors.length} editor${editors.length === 1 ? "" : "s"} · ${viewers.length} viewer${viewers.length === 1 ? "" : "s"}`
                : `No explicit collaborators yet · ${members.length} teammate${members.length === 1 ? "" : "s"} in workspace`}
            </div>
          </div>
          <AvatarStack
            size="sm"
            people={(permissions.length > 0 ? permissions : members).map((person) => ({
              id: person.userId,
              name: person.name,
              email: person.email,
              avatarSrc: avatarFor(person.userId, person.name, person.email),
            }))}
            onPersonClick={(person) => {
              setActivePersonId(person.id ?? "");
              if (person.id) props.onPersonClick?.(person.id);
            }}
          />
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        {permissions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/70 bg-white/45 p-3 text-xs text-muted">
            No explicit collaborators yet. Add teammates below so suggestions and edits feel shared from the start.
          </div>
        ) : (
          permissions.map((permission) => (
            <div
              key={permission.userId}
              className={[
                "flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 transition",
                activePersonId === permission.userId
                  ? "border-slate-300 bg-slate-50"
                  : "border-white/70 bg-white/75 hover:border-slate-200 hover:bg-white",
              ].join(" ")}
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => {
                  setActivePersonId(permission.userId);
                  props.onPersonClick?.(permission.userId);
                }}
              >
                <div className="flex items-center gap-3">
                  <AvatarStack
                    people={[
                      {
                        id: permission.userId,
                        name: permission.name,
                        email: permission.email,
                        avatarSrc: avatarFor(permission.userId, permission.name, permission.email),
                      },
                    ]}
                    max={1}
                    size="sm"
                    onPersonClick={(person) => {
                      setActivePersonId(permission.userId);
                      if (person.id) props.onPersonClick?.(person.id);
                    }}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">{permission.name}</div>
                    <div className="truncate text-xs text-muted">{permission.email}</div>
                  </div>
                </div>
              </button>
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

      {activeMember ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <AvatarStack
                people={[
                  {
                    id: activeMember.userId,
                    name: activeMember.name,
                    email: activeMember.email,
                    avatarSrc: avatarFor(activeMember.userId, activeMember.name, activeMember.email),
                  },
                ]}
                max={1}
                size="sm"
                onPersonClick={(person) => {
                  if (person.id) props.onPersonClick?.(person.id);
                }}
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-900">{activeMember.name}</div>
                <div className="truncate text-xs text-slate-500">{activeMember.email}</div>
              </div>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-600">
              {activePermission?.role ?? activeMember.role}
            </span>
          </div>
          <div className="mt-3 grid gap-2">
            <a
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              href={`mailto:${activeMember.email}`}
            >
              Email
            </a>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              onClick={() => props.onPersonClick?.(activeMember.userId)}
            >
              Open profile
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              onClick={() => {
                if (!activePermission || activePermission.role === "editor") return;
                void savePermission({ userId: activeMember.userId, role: "editor" });
              }}
              disabled={busy || !activePermission || activePermission.role === "editor"}
            >
              Make editor
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              onClick={() => {
                if (activePermission) {
                  void removePermission(activeMember.userId);
                  return;
                }
                setSelectedUserId(activeMember.userId);
              }}
              disabled={busy}
            >
              {activePermission ? "Remove" : "Queue add"}
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={[
          "mt-4 rounded-xl p-3",
          props.compact ? "border border-slate-200 bg-white/80" : "border border-white/70 bg-white/70",
        ].join(" ")}
      >
        <div className="text-xs font-medium text-slate-900">Add teammate to this doc</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_120px_auto]">
          <select
            className="rounded-md border border-white/70 bg-white/90 px-2 py-2 text-xs outline-none focus:border-accent"
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            disabled={busy || addableMembers.length === 0}
          >
            <option value="">{addableMembers.length > 0 ? "Select teammate" : "Everyone is already added"}</option>
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
            {busy ? "Saving…" : "Add to doc"}
          </Button>
        </div>
      </div>

      {error ? <div className="mt-3 text-xs text-red-500">{error}</div> : null}
    </div>
  );
}
