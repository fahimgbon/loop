"use client";

import { useMemo, useState } from "react";

import { AvatarStack } from "@/src/components/collaboration/AvatarStack";
import { UsersIcon } from "@/src/components/icons/LoopIcons";
import { WorkspaceMemberProfileSheet } from "@/src/components/workspace/WorkspaceMemberProfileSheet";
import { buildMemberProfile, type WorkspaceProfileMember } from "@/src/components/workspace/memberProfiles";

export function WorkspaceTeamSurface(props: {
  members: WorkspaceProfileMember[];
  workspaceSlug: string;
  variant: "summary" | "grid";
}) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const profiles = useMemo(() => props.members.map((member) => buildMemberProfile(member)), [props.members]);
  const selectedMember = useMemo(
    () => props.members.find((member) => member.userId === selectedMemberId) ?? null,
    [props.members, selectedMemberId],
  );

  if (props.variant === "summary") {
    return (
      <>
        <div className="grid gap-4 rounded-[26px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,255,0.95))] p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.16)] sm:min-w-[320px]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Team</div>
            </div>
            <AvatarStack
              people={profiles.map((member) => ({
                id: member.userId,
                name: member.name,
                email: member.email,
                avatarSrc: member.avatarSrc,
              }))}
              max={5}
              onPersonClick={(person) => {
                const match = props.members.find((member) => member.userId === person.id);
                setSelectedMemberId(match?.userId ?? null);
              }}
            />
          </div>

          <div className="grid gap-2">
            {profiles.slice(0, 3).map((member) => (
              <button
                key={member.userId}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white/98 px-3 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
                onClick={() => setSelectedMemberId(member.userId)}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <AvatarStack
                    people={[
                      {
                        id: member.userId,
                        name: member.name,
                        email: member.email,
                        avatarSrc: member.avatarSrc,
                      },
                    ]}
                    max={1}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">{member.name}</div>
                    <div className="truncate text-xs text-slate-600">
                      {member.role === "admin" ? "Admin" : "Contributor"}
                    </div>
                  </div>
                </div>
                <span className="rounded-full border border-slate-200/90 bg-slate-50 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-700">
                  Profile
                </span>
              </button>
            ))}
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
      <section className="rounded-[28px] border border-slate-200/90 bg-white/96 p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.22)]">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
          <UsersIcon className="h-4 w-4" />
          Collaboration
        </div>
        <div className="mt-4 grid gap-2">
          {profiles.slice(0, 6).map((member) => (
            <button
              key={member.userId}
              type="button"
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white px-3 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
              onClick={() => setSelectedMemberId(member.userId)}
            >
              <div className="flex min-w-0 items-center gap-3">
                <AvatarStack
                  people={[
                    {
                      id: member.userId,
                      name: member.name,
                      email: member.email,
                      avatarSrc: member.avatarSrc,
                    },
                  ]}
                  max={1}
                  size="sm"
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900">{member.name}</div>
                  <div className="truncate text-xs text-slate-600">
                    {member.role === "admin" ? "Admin" : "Contributor"}
                  </div>
                </div>
              </div>
              <span className="rounded-full border border-slate-200/90 bg-slate-50 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-700">
                Profile
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
