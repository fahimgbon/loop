"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

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
  const [peekSidebar, setPeekSidebar] = useState(false);
  const [sections, setSections] = useState({
    capture: false,
    feedback: true,
    requests: props.requests.length > 0,
    collaborators: true,
    links: props.linkedArtifacts.length > 0,
  });
  const editors = props.collaborators.filter((person) => person.role === "editor");
  const viewers = props.collaborators.filter((person) => person.role === "viewer");
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

  function openSidebarSection(section: keyof typeof sections, panelId: string) {
    setSections((current) => ({ ...current, [section]: true }));
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
      setPeekSidebar(false);
      window.setTimeout(() => {
        document.getElementById(panelId)?.scrollIntoView({ block: "start", behavior: "smooth" });
      }, 180);
      return;
    }
    document.getElementById(panelId)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  return (
    <main className="px-3 py-3 lg:px-5 lg:py-4">
      <div
        className={[
          "relative grid gap-4 xl:items-start",
          sidebarCollapsed ? "xl:grid-cols-[minmax(0,1fr)]" : "xl:grid-cols-[minmax(0,1fr)_340px]",
        ].join(" ")}
      >
        <section className="min-w-0">
          <div className="rounded-[30px] border border-slate-200/80 bg-white/84 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.28)] backdrop-blur-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 px-5 py-4 lg:px-7">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                  <Link href={`/w/${props.workspaceSlug}`} className="hover:text-slate-800">
                    Workspace
                  </Link>
                  <span>/</span>
                  <span className="text-slate-700">Artifact</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-700">
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
                  <AvatarStack people={headerPeople} />
                  <span>
                    {props.collaborators.length > 0
                      ? `${editors.length} editor${editors.length === 1 ? "" : "s"} and ${viewers.length} viewer${viewers.length === 1 ? "" : "s"} in this doc`
                      : `${props.workspaceMembers.length} workspace teammate${props.workspaceMembers.length === 1 ? "" : "s"} available to collaborate`}
                  </span>
                  {props.linkedArtifacts.length > 0 ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                      {props.linkedArtifacts.length} inferred link{props.linkedArtifacts.length === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => openSidebarSection("capture", "capture-panel")}
                >
                  <CaptureIcon className="h-4 w-4" />
                  Capture
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => openSidebarSection("feedback", "feedback-panel")}
                >
                  <CommentIcon className="h-4 w-4" />
                  Collaborate
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => openSidebarSection("collaborators", "collaborators-panel")}
                >
                  <UsersIcon className="h-4 w-4" />
                  Teammates
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setSidebarCollapsed((value) => !value)}
                >
                  <PanelIcon className="h-4 w-4" />
                  {sidebarCollapsed ? "Show panel" : "Hide panel"}
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

        <aside
          className={[
            "min-w-0",
            sidebarCollapsed ? "pointer-events-none absolute right-0 top-0 z-20 hidden xl:block w-[72px]" : "xl:sticky xl:top-5",
          ].join(" ")}
        >
          {sidebarCollapsed ? (
            <div
              className={[
                "pointer-events-auto overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/90 p-2 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.34)] backdrop-blur-2xl transition-[width] duration-200",
                peekSidebar ? "w-[340px]" : "w-[72px]",
              ].join(" ")}
              onMouseEnter={() => setPeekSidebar(true)}
              onMouseLeave={() => setPeekSidebar(false)}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setSidebarCollapsed(false);
                    setPeekSidebar(false);
                  }}
                  aria-label="Expand properties panel"
                >
                  <PanelIcon className="h-4 w-4" />
                </button>
                {peekSidebar ? (
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Auto-hidden panel
                    </div>
                    <div className="truncate text-sm text-slate-700">
                      Hover to peek, click to pin open.
                    </div>
                  </div>
                ) : null}
              </div>
              {peekSidebar ? (
                <div className="mt-3 grid gap-2">
                  <button
                    type="button"
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 hover:bg-white"
                    onClick={() => {
                      setSidebarCollapsed(false);
                      setPeekSidebar(false);
                      setSections((current) => ({ ...current, collaborators: true }));
                    }}
                  >
                    Open collaborators
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 hover:bg-white"
                    onClick={() => {
                      setSidebarCollapsed(false);
                      setPeekSidebar(false);
                      setSections((current) => ({ ...current, links: true }));
                    }}
                  >
                    Open connected artifacts
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="max-h-[calc(100vh-1.5rem)] overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/88 p-3 backdrop-blur-2xl">
              <div className="flex items-center justify-between gap-3 px-2 pb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <SparkIcon className="h-4 w-4" />
                    Properties
                  </div>
                  <div className="mt-1 text-sm leading-6 text-slate-600">
                    Collapse sections you are not using so the document stays central.
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setSidebarCollapsed(true)}
                >
                  Hide
                </button>
              </div>

              <div className="grid max-h-[calc(100vh-8.5rem)] gap-3 overflow-y-auto pr-1">
                <SidebarSection
                  id="capture-panel"
                  title="Capture"
                  note="Record or upload an update directly into this artifact."
                  icon={<CaptureIcon className="h-4 w-4" />}
                  open={sections.capture}
                  onToggle={() => toggleSection("capture")}
                >
                  <AudioRecorder workspaceSlug={props.workspaceSlug} artifactId={props.artifactId} />
                </SidebarSection>

                <SidebarSection
                  id="feedback-panel"
                  title="Collaboration prompts"
                  note="Turn ambiguity into clear asks so multiple teammates can shape the artifact in parallel."
                  icon={<CommentIcon className="h-4 w-4" />}
                  open={sections.feedback}
                  onToggle={() => toggleSection("feedback")}
                >
                  <ReviewRequestForm workspaceSlug={props.workspaceSlug} artifactId={props.artifactId} />
                </SidebarSection>

                <SidebarSection
                  id="requests-panel"
                  title="Open threads"
                  note="Follow the active questions, suggestions, and due dates tied to this doc."
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
                        <div key={request.id} className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
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
                  note="Move this artifact from a single-point-of-contact doc into a shared workspace asset."
                  icon={<UsersIcon className="h-4 w-4" />}
                  open={sections.collaborators}
                  onToggle={() => toggleSection("collaborators")}
                >
                  <ArtifactPermissionsPanel compact artifactId={props.artifactId} />
                </SidebarSection>

                <SidebarSection
                  id="links-panel"
                  title="Connected artifacts"
                  note="These links are inferred from repeated block structure and transcription language."
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
                          className="rounded-xl border border-slate-200 bg-white/85 px-3 py-3 transition hover:border-slate-300 hover:bg-white"
                        >
                          <div className="text-sm font-medium text-slate-900">{artifact.title}</div>
                          <div className="mt-1 text-xs text-slate-500">{artifact.primaryReason}</div>
                          <div className="mt-1 text-[11px] text-slate-400">{artifact.collectionName}</div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 px-3 py-4 text-sm text-slate-500">
                      As this artifact gains more content, Loop will infer its closest neighbors automatically.
                    </div>
                  )}
                </SidebarSection>
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

function SidebarSection(props: {
  id: string;
  title: string;
  note: string;
  badge?: string;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section id={props.id} className="rounded-[22px] border border-slate-200 bg-slate-50/80">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
        onClick={props.onToggle}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
              {props.icon}
            </span>
            <div className="text-sm font-semibold text-slate-900">{props.title}</div>
            {props.badge ? (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                {props.badge}
              </span>
            ) : null}
          </div>
          <div className="mt-2 pl-10 text-xs leading-5 text-slate-600">{props.note}</div>
        </div>
        <div className="pt-1 text-slate-500">
          {props.open ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
        </div>
      </button>

      {props.open ? <div className="border-t border-slate-200 px-4 py-4">{props.children}</div> : null}
    </section>
  );
}
