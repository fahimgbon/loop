"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { ArtifactDoc } from "@/src/components/artifacts/ArtifactDoc";
import { ArtifactPermissionsPanel } from "@/src/components/artifacts/ArtifactPermissionsPanel";
import { ArtifactTitleEditor } from "@/src/components/artifacts/ArtifactTitleEditor";
import { AvatarStack } from "@/src/components/collaboration/AvatarStack";
import {
  CaptureIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CommentIcon,
  LinkNodesIcon,
  PanelIcon,
  SparkIcon,
  UsersIcon,
} from "@/src/components/icons/LoopIcons";
import { AudioRecorder } from "@/src/components/contributions/AudioRecorder";
import { FolderSyncPrompt } from "@/src/components/folders/FolderSyncPrompt";
import { InlineReviewPanel } from "@/src/components/reviews/InlineReviewPanel";
import { ReviewRequestForm } from "@/src/components/reviews/ReviewRequestForm";
import type { BlockDto } from "@/src/components/blocks/BlockEditor";
import { WorkspaceMemberProfileSheet } from "@/src/components/workspace/WorkspaceMemberProfileSheet";
import type { WorkspaceProfileMember } from "@/src/components/workspace/memberProfiles";

type ReviewRequestDetail = {
  id: string;
  title: string;
  dueAt: string | null;
  createdAt: string;
  questions: string[];
  blockIds: string[];
};

type OpenRequestSummary = {
  id: string;
  title: string;
  createdAt: string;
  dueAt: string | null;
};

type CollaboratorSummary = {
  userId: string;
  name: string;
  email: string;
  role: "viewer" | "editor";
};

type WorkspaceMemberSummary = {
  userId: string;
  name: string;
  email: string;
  role: "admin" | "member";
};

type LinkedArtifactSummary = {
  id: string;
  title: string;
  collectionName: string;
  primaryReason: string;
  weight: number;
};

export function ArtifactWorkspace(props: {
  workspaceSlug: string;
  artifactId: string;
  artifactTitle: string;
  artifactStatus: string;
  initialBlocks: BlockDto[];
  requests: ReviewRequestDetail[];
  openRequestSummaries: OpenRequestSummary[];
  collaborators: CollaboratorSummary[];
  workspaceMembers: WorkspaceMemberSummary[];
  linkedArtifacts: LinkedArtifactSummary[];
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [sections, setSections] = useState({
    capture: false,
    feedback: true,
    requests: props.requests.length > 0,
    collaborators: true,
    links: props.linkedArtifacts.length > 0,
  });
  const editors = props.collaborators.filter((person) => person.role === "editor");
  const viewers = props.collaborators.filter((person) => person.role === "viewer");
  const profileMembers = useMemo(() => {
    const byId = new Map<string, WorkspaceProfileMember>();

    for (const member of props.workspaceMembers) {
      byId.set(member.userId, {
        userId: member.userId,
        name: member.name,
        email: member.email,
        role: member.role,
      });
    }

    for (const collaborator of props.collaborators) {
      if (!byId.has(collaborator.userId)) {
        byId.set(collaborator.userId, {
          userId: collaborator.userId,
          name: collaborator.name,
          email: collaborator.email,
          role: "member",
        });
      }
    }

    return Array.from(byId.values());
  }, [props.collaborators, props.workspaceMembers]);
  const selectedMember =
    profileMembers.find((member) => member.userId === selectedMemberId) ?? null;
  const headerPeople =
    props.collaborators.length > 0
      ? props.collaborators.map((person) => ({
          id: person.userId,
          name: person.name,
          email: person.email,
        }))
      : props.workspaceMembers.map((person) => ({
          id: person.userId,
          name: person.name,
          email: person.email,
        }));

  useEffect(() => {
    const savedCollapsed = window.localStorage.getItem("loop.artifact.sidebar.collapsed");
    if (savedCollapsed === "true") {
      setSidebarCollapsed(true);
      return;
    }
    if (savedCollapsed === "false") {
      setSidebarCollapsed(false);
      return;
    }
    setSidebarCollapsed(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "loop.artifact.sidebar.collapsed",
      sidebarCollapsed ? "true" : "false",
    );
  }, [sidebarCollapsed]);

  function toggleSection(section: keyof typeof sections) {
    setSections((current) => ({ ...current, [section]: !current[section] }));
  }

  function openSidebarSection(section: keyof typeof sections) {
    setSections((current) => ({ ...current, [section]: true }));
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
    }
  }

  return (
    <>
      <main className="px-3 py-3 lg:px-5 lg:py-4">
      <div
        className={[
          "relative grid gap-4 xl:items-start",
          sidebarCollapsed ? "xl:grid-cols-[minmax(0,1fr)]" : "xl:grid-cols-[minmax(0,1fr)_360px]",
        ].join(" ")}
      >
        <section className="min-w-0">
          <div className="rounded-[30px] border border-slate-300 bg-white shadow-[0_24px_72px_-54px_rgba(15,23,42,0.2)]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-300 px-5 py-4 lg:px-7">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                  <Link href={`/w/${props.workspaceSlug}`} className="hover:text-slate-950">
                    Workspace
                  </Link>
                  <span>/</span>
                  <span className="text-slate-800">Artifact</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-800 shadow-[0_8px_22px_-18px_rgba(4,12,27,0.2)]">
                    {props.artifactStatus}
                  </span>
                  <span className="text-xs text-slate-500">
                    {props.initialBlocks.length} block{props.initialBlocks.length === 1 ? "" : "s"}
                  </span>
                  <span className="text-xs text-slate-500">
                    {props.requests.length} open request{props.requests.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <AvatarStack
                    people={headerPeople}
                    onPersonClick={(person) => setSelectedMemberId(person.id ?? null)}
                  />
                  <span>
                    {props.collaborators.length > 0
                      ? `${editors.length} editor${editors.length === 1 ? "" : "s"} and ${viewers.length} viewer${viewers.length === 1 ? "" : "s"} in this doc`
                      : `${props.workspaceMembers.length} workspace teammate${props.workspaceMembers.length === 1 ? "" : "s"} available to collaborate`}
                  </span>
                  {props.linkedArtifacts.length > 0 ? (
                    <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700">
                      {props.linkedArtifacts.length} inferred link{props.linkedArtifacts.length === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 shadow-[0_8px_22px_-18px_rgba(4,12,27,0.2)] hover:border-slate-400 hover:bg-slate-50"
                  onClick={() => {
                    openSidebarSection("capture");
                    window.setTimeout(() => {
                      window.dispatchEvent(
                        new CustomEvent("aceync:start-audio-recording", {
                          detail: {
                            workspaceSlug: props.workspaceSlug,
                            artifactId: props.artifactId,
                          },
                        }),
                      );
                    }, 40);
                  }}
                >
                  <CaptureIcon className="h-4 w-4" />
                  Capture
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 shadow-[0_8px_22px_-18px_rgba(4,12,27,0.2)] hover:border-slate-400 hover:bg-slate-50"
                  onClick={() => openSidebarSection("feedback")}
                >
                  <CommentIcon className="h-4 w-4" />
                  Collaborate
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 shadow-[0_8px_22px_-18px_rgba(4,12,27,0.2)] hover:border-slate-400 hover:bg-slate-50"
                  onClick={() => openSidebarSection("collaborators")}
                >
                  <UsersIcon className="h-4 w-4" />
                  Teammates
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 shadow-[0_8px_22px_-18px_rgba(4,12,27,0.2)] hover:border-slate-400 hover:bg-slate-50"
                  onClick={() => setSidebarCollapsed((value) => !value)}
                  aria-pressed={!sidebarCollapsed}
                >
                  <PanelIcon className="h-4 w-4" />
                  {sidebarCollapsed ? "Properties" : "Hide properties"}
                </button>
              </div>
            </div>

            <div className="px-5 py-6 lg:px-8 lg:py-8">
              <div className={["mx-auto", sidebarCollapsed ? "max-w-[1280px]" : "max-w-[1080px]"].join(" ")}>
                <ArtifactTitleEditor artifactId={props.artifactId} initialTitle={props.artifactTitle} />
                <div className="mt-4">
                  <FolderSyncPrompt artifactId={props.artifactId} />
                </div>
                <ArtifactDoc
                  workspaceSlug={props.workspaceSlug}
                  artifactId={props.artifactId}
                  artifactTitle={props.artifactTitle}
                  initialBlocks={props.initialBlocks}
                />
              </div>
            </div>
          </div>
        </section>

        {!sidebarCollapsed ? (
          <aside className="min-w-0 xl:sticky xl:top-5 xl:max-h-[calc(100vh-1.5rem)] xl:overflow-hidden">
            <div className="h-full overflow-hidden rounded-[28px] border border-slate-300 bg-white p-3 shadow-[0_20px_52px_-44px_rgba(15,23,42,0.22)]">
              <div className="flex items-center justify-between gap-3 px-2 pb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <SparkIcon className="h-4 w-4" />
                    Properties
                  </div>
                </div>
              </div>

              <div className="grid max-h-[calc(100vh-8rem)] min-w-0 gap-3 overflow-y-auto overflow-x-hidden pr-1">
                <SidebarSection
                  id="capture-panel"
                  title="Capture"
                  note="Record into this doc."
                  icon={<CaptureIcon className="h-4 w-4" />}
                  open={sections.capture}
                  onToggle={() => toggleSection("capture")}
                >
                  <AudioRecorder workspaceSlug={props.workspaceSlug} artifactId={props.artifactId} />
                </SidebarSection>

                <SidebarSection
                  id="feedback-panel"
                  title="Collaboration prompts"
                  note="Ask for focused input."
                  icon={<CommentIcon className="h-4 w-4" />}
                  open={sections.feedback}
                  onToggle={() => toggleSection("feedback")}
                >
                  <ReviewRequestForm workspaceSlug={props.workspaceSlug} artifactId={props.artifactId} />
                </SidebarSection>

                <SidebarSection
                  id="requests-panel"
                  title="Open threads"
                  note="Track active requests."
                  badge={String(props.requests.length)}
                  icon={<SparkIcon className="h-4 w-4" />}
                  open={sections.requests}
                  onToggle={() => toggleSection("requests")}
                >
                  <InlineReviewPanel
                    compact
                    workspaceSlug={props.workspaceSlug}
                    artifactId={props.artifactId}
                    requests={props.requests}
                    blockTitles={props.initialBlocks.map((block) => ({
                      id: block.id,
                      title: block.title,
                      type: block.type,
                    }))}
                  />
                  {props.openRequestSummaries.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {props.openRequestSummaries.map((request) => (
                        <div key={request.id} className="rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-[0_10px_28px_-24px_rgba(4,12,27,0.16)]">
                          <div className="text-sm font-medium text-slate-800">{request.title}</div>
                          <div className="mt-1 text-[11px] text-slate-400">
                            {new Date(request.createdAt).toLocaleString()}
                            {request.dueAt ? ` · Due ${new Date(request.dueAt).toLocaleString()}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </SidebarSection>

                <SidebarSection
                  id="collaborators-panel"
                  title="Collaborators"
                  icon={<UsersIcon className="h-4 w-4" />}
                  open={sections.collaborators}
                  onToggle={() => toggleSection("collaborators")}
                >
                  <ArtifactPermissionsPanel
                    compact
                    artifactId={props.artifactId}
                    onPersonClick={(userId) => setSelectedMemberId(userId)}
                  />
                </SidebarSection>

                <SidebarSection
                  id="links-panel"
                  title="Connected artifacts"
                  note="Inferred neighbors."
                  icon={<LinkNodesIcon className="h-4 w-4" />}
                  open={sections.links}
                  onToggle={() => toggleSection("links")}
                >
                  {props.linkedArtifacts.length > 0 ? (
                    <div className="grid gap-2">
                      {props.linkedArtifacts.map((artifact) => (
                        <Link
                          key={artifact.id}
                          href={`/w/${props.workspaceSlug}/artifacts/${artifact.id}`}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-3 transition hover:border-slate-400"
                        >
                          <div className="text-sm font-medium text-slate-900">{artifact.title}</div>
                          <div className="mt-1 text-xs text-slate-500">{artifact.primaryReason}</div>
                          <div className="mt-1 text-[11px] text-slate-400">{artifact.collectionName}</div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white/90 px-3 py-4 text-sm text-slate-600">
                      As this artifact gains more content, Loop will infer its closest neighbors automatically.
                    </div>
                  )}
                </SidebarSection>
              </div>
            </div>
          </aside>
        ) : null}
      </div>
      </main>

      <WorkspaceMemberProfileSheet
        member={selectedMember}
        open={!!selectedMember}
        onClose={() => setSelectedMemberId(null)}
        workspaceSlug={props.workspaceSlug}
      />
    </>
  );
}

function SidebarSection(props: {
  id: string;
  title: string;
  note?: string;
  badge?: string;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section
      id={props.id}
      className="min-w-0 overflow-hidden rounded-[22px] border border-slate-300 bg-white/92 shadow-[0_12px_30px_-24px_rgba(4,12,27,0.12)]"
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
        onClick={props.onToggle}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-[linear-gradient(135deg,rgba(231,243,255,0.96),rgba(244,239,255,0.94))] text-slate-700 shadow-[0_8px_20px_-18px_rgba(4,12,27,0.14)]">
              {props.icon}
            </span>
            <div className="text-sm font-semibold text-slate-900">{props.title}</div>
            {props.badge ? (
              <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-800">
                {props.badge}
              </span>
            ) : null}
          </div>
          {props.note ? <div className="mt-2 pl-10 text-xs leading-5 text-slate-600">{props.note}</div> : null}
        </div>
        <div className="pt-1 text-slate-500">
          {props.open ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
        </div>
      </button>

      {props.open ? (
        <div className="overflow-x-hidden border-t border-slate-300 px-4 py-4">{props.children}</div>
      ) : null}
    </section>
  );
}
