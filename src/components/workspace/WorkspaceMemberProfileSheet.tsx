"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect } from "react";
import type { ReactNode } from "react";

import {
  CommentIcon,
  GraphIcon,
  SearchIcon,
  SparkIcon,
  UsersIcon,
} from "@/src/components/icons/LoopIcons";
import { buildMemberProfile, type WorkspaceProfileMember } from "@/src/components/workspace/memberProfiles";

export function WorkspaceMemberProfileSheet(props: {
  member: WorkspaceProfileMember | null;
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
}) {
  const { member, open, onClose, workspaceSlug } = props;

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!member || !open) return null;

  const profile = buildMemberProfile(member);

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[70] bg-slate-950/28"
        onClick={props.onClose}
        aria-label="Close member profile"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-member-profile-title"
        className="sheet-card fixed right-4 top-4 z-[80] h-[calc(100vh-2rem)] w-[min(460px,calc(100vw-2rem))] overflow-y-auto rounded-[30px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.992),rgba(248,250,255,0.985))] p-6 shadow-[0_34px_110px_-42px_rgba(15,23,42,0.36)]"
      >
        <div
          className="absolute inset-x-0 top-0 h-40 rounded-t-[30px]"
          style={{
            background: `radial-gradient(circle at 20% 18%, rgb(${profile.tone.glow} / 0.92), transparent 55%), radial-gradient(circle at 82% 0%, rgb(${profile.tone.accent} / 0.16), transparent 42%), linear-gradient(180deg, rgb(${profile.tone.surface}), rgba(255,255,255,0))`,
          }}
          aria-hidden="true"
        />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div
                className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[22px] border border-slate-200/90 text-xl font-semibold shadow-[0_20px_40px_-30px_rgba(15,23,42,0.18)]"
                style={{
                  background: `linear-gradient(145deg, rgb(${profile.tone.glow}), rgb(${profile.tone.surface}))`,
                  color: `rgb(${profile.tone.ink})`,
                }}
              >
                {profile.avatarSrc ? (
                  <Image src={profile.avatarSrc} alt={profile.name} fill sizes="64px" className="object-cover" />
                ) : (
                  getInitials(profile.name)
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                    {profile.role}
                  </span>
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
                    style={{
                      background: `rgb(${profile.tone.accent} / 0.16)`,
                      border: `1px solid rgb(${profile.tone.accent} / 0.24)`,
                      color: `rgb(${profile.tone.ink})`,
                    }}
                  >
                    {profile.title}
                  </span>
                </div>
                <h2 id="workspace-member-profile-title" className="mt-3 truncate text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                  {profile.name}
                </h2>
                <div className="mt-1 truncate text-sm text-slate-700">{profile.email}</div>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-slate-300/90 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent)_/_0.22)] focus-visible:ring-offset-2"
              onClick={props.onClose}
              aria-label="Close profile"
            >
              Done
            </button>
          </div>

          <p className="mt-6 text-sm leading-7 text-slate-700">{profile.summary}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <StatTile label="Artifacts" value={String(profile.stats.artifacts)} icon={<SearchIcon className="h-4 w-4" />} />
            <StatTile label="Threads" value={String(profile.stats.threads)} icon={<CommentIcon className="h-4 w-4" />} />
            <StatTile label="Folders" value={String(profile.stats.folders)} icon={<GraphIcon className="h-4 w-4" />} />
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            <a
              href={`mailto:${profile.email}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 focus-visible:ring-offset-2"
            >
              <UsersIcon className="h-4 w-4" />
              Email
            </a>
            <Link
              href={`/w/${workspaceSlug}/network`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent)_/_0.18)] focus-visible:ring-offset-2"
            >
              <GraphIcon className="h-4 w-4" />
              View network
            </Link>
            <Link
              href={`/w/${workspaceSlug}/inbox`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent)_/_0.18)] focus-visible:ring-offset-2"
            >
              <CommentIcon className="h-4 w-4" />
              Open inbox
            </Link>
          </div>

          <section className="mt-6 rounded-[24px] border border-slate-200/90 bg-white p-4 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.12)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">Best for</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.strengths.map((strength) => (
                <span
                  key={strength}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
                >
                  {strength}
                </span>
              ))}
            </div>
            <div className="mt-4 text-sm leading-6 text-slate-700">{profile.availability}</div>
          </section>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <ProfileSection
              icon={<SparkIcon className="h-4 w-4" />}
              label="Working rhythm"
              items={profile.rituals}
            />
            <ProfileSection
              icon={<GraphIcon className="h-4 w-4" />}
              label="Usually found in"
              items={profile.favoriteSpaces}
            />
          </div>
        </div>
      </aside>
    </>
  );
}

function StatTile(props: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-slate-200/90 bg-white p-4 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.12)]">
      <div className="flex items-center justify-between gap-3 text-slate-600">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">{props.label}</span>
        {props.icon}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{props.value}</div>
    </div>
  );
}

function ProfileSection(props: {
  icon: ReactNode;
  label: string;
  items: string[];
}) {
  return (
    <section className="rounded-[22px] border border-slate-200/90 bg-white p-4 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.12)]">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
        {props.icon}
        {props.label}
      </div>
      <div className="mt-3 grid gap-2">
        {props.items.map((item) => (
          <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-6 text-slate-700">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
