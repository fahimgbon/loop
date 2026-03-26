"use client";

import { useEffect, useState } from "react";

import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";
import { WorkspaceMemberProfileSheet } from "@/src/components/workspace/WorkspaceMemberProfileSheet";

type Member = {
  userId: string;
  role: "admin" | "member";
  name: string;
  email: string;
};

export function WorkspaceMembersPanel(props: {
  workspaceSlug: string;
  initialMembers: Member[];
  isAdmin: boolean;
}) {
  const [members, setMembers] = useState<Member[]>(props.initialMembers);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setMembers(props.initialMembers);
  }, [props.initialMembers]);

  const selectedMember = members.find((member) => member.userId === selectedMemberId) ?? null;

  async function addMember() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/workspaces/${props.workspaceSlug}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          password: password || undefined,
          role,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; created?: boolean; error?: string; user?: Member }
        | null;
      if (!res.ok || !data?.ok || !data.user) {
        setError(data?.error ?? "Could not add member");
        return;
      }
      const listRes = await fetch(`/api/workspaces/${props.workspaceSlug}/members`);
      const listData = (await listRes.json().catch(() => null)) as { members?: Member[] } | null;
      if (listRes.ok && listData?.members) setMembers(listData.members);

      setNotice(data.created ? "Created account and added to workspace." : "Added existing account to workspace.");
      setEmail("");
      setName("");
      setPassword("");
      setRole("member");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="workspace-members-panel" className="rounded-xl border border-slate-200/90 bg-white/96 p-4 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.14)]">
      <div className="text-sm font-medium text-slate-950">Workspace members</div>
      <div className="mt-1 text-xs text-muted">
        Open any teammate to view their profile. Add existing users by email.
      </div>

      <div className="mt-3 grid gap-2">
        {members.map((member) => (
          <button
            key={member.userId}
            type="button"
            onClick={() => setSelectedMemberId(member.userId)}
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/90 bg-white/98 px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-900">{member.name}</div>
              <div className="truncate text-xs text-muted">{member.email}</div>
            </div>
            <span className="rounded-full border border-slate-200/90 bg-slate-50 px-2 py-0.5 text-[11px] uppercase tracking-[0.16em] text-slate-700">
              {member.role}
            </span>
          </button>
        ))}
      </div>

      {props.isAdmin ? (
        <div className="mt-4 rounded-lg border border-slate-200/90 bg-slate-50/92 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Add account</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email@company.com"
            />
            <select
              className="rounded-md border border-slate-300/90 bg-white/98 px-3 py-2 text-sm outline-none focus:border-accent"
              value={role}
              onChange={(event) => setRole(event.target.value as "admin" | "member")}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name (required only for new account)"
            />
            <Input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password (new account only)"
              type="password"
            />
          </div>
          <div className="mt-2 text-[11px] text-muted">
            For existing users: email only. For new users: email + name + password.
          </div>
          <div className="mt-3 flex items-center justify-end">
            <Button type="button" onClick={addMember} disabled={busy || !email.trim()}>
              {busy ? "Adding…" : "Add to workspace"}
            </Button>
          </div>
          {error ? <div className="mt-2 text-xs text-red-500">{error}</div> : null}
          {notice ? <div className="mt-2 text-xs text-emerald-600">{notice}</div> : null}
        </div>
      ) : null}

      <WorkspaceMemberProfileSheet
        member={selectedMember}
        open={!!selectedMember}
        onClose={() => setSelectedMemberId(null)}
        workspaceSlug={props.workspaceSlug}
      />
    </div>
  );
}
