"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AvatarStack } from "@/src/components/collaboration/AvatarStack";
import {
  CaptureIcon,
  GraphIcon,
  NewDocIcon,
  SearchIcon,
  UsersIcon,
} from "@/src/components/icons/LoopIcons";
import { WorkspaceMemberProfileSheet } from "@/src/components/workspace/WorkspaceMemberProfileSheet";
import type { WorkspaceProfileMember } from "@/src/components/workspace/memberProfiles";

export function WorkspaceTeamSurface(props: {
  members: WorkspaceProfileMember[];
  workspaceSlug: string;
  variant: "summary" | "grid";
}) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const selectedMember = useMemo(
    () => props.members.find((member) => member.userId === selectedMemberId) ?? null,
    [props.members, selectedMemberId],
  );

  if (props.variant === "summary") {
    return (
      <>
        <div className="grid gap-4 rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,255,0.92))] p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)] sm:min-w-[320px]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Team</div>
              <div className="mt-1 text-sm text-slate-600">Click a teammate to open their profile and jump into the right part of the workspace.</div>
            </div>
            <AvatarStack
              people={props.members.map((member) => ({
                id: member.userId,
                name: member.name,
                email: member.email,
              }))}
              max={5}
              onPersonClick={(person) => {
                const match = props.members.find((member) => member.userId === person.id);
                setSelectedMemberId(match?.userId ?? null);
              }}
            />
          </div>

          <div className="grid gap-2">
            {props.members.slice(0, 3).map((member) => (
              <button
                key={member.userId}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
                onClick={() => setSelectedMemberId(member.userId)}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900">{member.name}</div>
                  <div className="truncate text-xs text-slate-500">{member.role === "admin" ? "Admin" : "Contributor"}</div>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-600">
                  Profile
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/w/${props.workspaceSlug}/capture`}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              <CaptureIcon className="h-4 w-4" />
              Capture
            </Link>
            <Link
              href={`/w/${props.workspaceSlug}/search`}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              <SearchIcon className="h-4 w-4" />
              Browse
            </Link>
            <Link
              href={`/w/${props.workspaceSlug}/network`}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              <GraphIcon className="h-4 w-4" />
              Network
            </Link>
            <Link
              href={`/w/${props.workspaceSlug}/artifacts/new`}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-3.5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              <NewDocIcon className="h-4 w-4" />
              New artifact
            </Link>
          </div>
        </div>

        <WorkspaceMemberProfileSheet
          member={selectedMember}
          open={!!selectedMember}
          onClose={() => setSelectedMemberId(null)}
          workspaceSlug={props.workspaceSlug}
        />
      </>
    );
  }

  return (
    <>
      <section className="rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.3)]">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          <UsersIcon className="h-4 w-4" />
          Collaboration
        </div>
        <div className="mt-1 text-sm leading-6 text-slate-600">
          Everyone here is clickable. Open a profile to see where they usually work, what they are best pulled in for, and how to reach them fast.
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {props.members.slice(0, 6).map((member) => (
            <button
              key={member.userId}
              type="button"
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,255,0.92))] px-3 py-3 text-left transition hover:border-slate-300 hover:bg-white"
              onClick={() => setSelectedMemberId(member.userId)}
            >
              <div className="flex min-w-0 items-center gap-3">
                <AvatarStack
                  people={[{ id: member.userId, name: member.name, email: member.email }]}
                  max={1}
                  size="sm"
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900">{member.name}</div>
                  <div className="truncate text-xs text-slate-500">{member.email}</div>
                </div>
              </div>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-600">
                {member.role}
              </span>
            </button>
          ))}
        </div>
      </section>

      <WorkspaceMemberProfileSheet
        member={selectedMember}
        open={!!selectedMember}
        onClose={() => setSelectedMemberId(null)}
        workspaceSlug={props.workspaceSlug}
      />
    </>
  );
}
