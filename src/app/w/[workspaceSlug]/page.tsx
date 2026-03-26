import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AnnouncementLog } from "@/src/components/announcements/AnnouncementLog";
import { AudioRecorder } from "@/src/components/contributions/AudioRecorder";
import { FolderCard } from "@/src/components/folders/FolderCard";
import { ArtifactGraph } from "@/src/components/graph/ArtifactGraph";
import { GoogleSettingsForm } from "@/src/components/integrations/GoogleSettingsForm";
import { SlackSettingsForm } from "@/src/components/integrations/SlackSettingsForm";
import { AnywhereMeetingCapture } from "@/src/components/meetings/AnywhereMeetingCapture";
import { WorkspaceMembersPanel } from "@/src/components/workspace/WorkspaceMembersPanel";
import { WorkspaceTeamSurface } from "@/src/components/workspace/WorkspaceTeamSurface";
import {
  CaptureIcon,
  CommentIcon,
  FolderIcon,
  GraphIcon,
  SparkIcon,
  UsersIcon,
} from "@/src/components/icons/LoopIcons";
import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { listAnnouncements } from "@/src/server/repo/announcements";
import { listArtifacts } from "@/src/server/repo/artifacts";
import { listFolders } from "@/src/server/repo/folders";
import { getGoogleInstallationForWorkspace } from "@/src/server/repo/googleInstallations";
import { listOpenReviewRequests } from "@/src/server/repo/reviewRequests";
import { getSlackInstallationForWorkspace } from "@/src/server/repo/slackInstallations";
import { getWorkspaceById, listWorkspaceMembers } from "@/src/server/repo/workspaces";
import { getArtifactGraphSnapshot } from "@/src/server/services/artifactGraphService";

export const dynamic = "force-dynamic";

export default async function WorkspacePage(props: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { workspaceSlug } = await props.params;
  if (workspaceSlug !== session.workspaceSlug) redirect(`/w/${session.workspaceSlug}`);

  const [artifacts, reviewRequests, folders, slack, google, workspace, announcements, members, graph] =
    await Promise.all([
      withClient((client) => listArtifacts(client, session.workspaceId)),
      withClient((client) => listOpenReviewRequests(client, session.workspaceId)),
      withClient((client) => listFolders(client, session.workspaceId)),
      withClient((client) => getSlackInstallationForWorkspace(client, session.workspaceId)),
      withClient((client) => getGoogleInstallationForWorkspace(client, session.workspaceId)),
      withClient((client) => getWorkspaceById(client, session.workspaceId)),
      withClient((client) => listAnnouncements(client, session.workspaceId, 25)),
      withClient((client) => listWorkspaceMembers(client, session.workspaceId)),
      getArtifactGraphSnapshot({ workspaceId: session.workspaceId }),
    ]);

  const artifactTitleById = new Map(artifacts.map((artifact) => [artifact.id, artifact.title]));
  const folderCollections = graph.collections.filter((collection) => collection.kind === "folder");
  const smartCollections = graph.collections.filter((collection) => collection.kind === "smart");
  const folderByKey = new Map(folderCollections.map((collection) => [collection.key, collection]));
  const enrichedFolders = folders.map((folder) => {
    const collection = folderByKey.get(`folder:${folder.id}`);
    return {
      id: folder.id,
      name: folder.name,
      updatedAt: folder.updated_at,
      structureVersion: folder.structure_version,
      artifactCount: collection?.artifactCount ?? artifacts.filter((artifact) => artifact.folder_id === folder.id).length,
      chips: collection?.sharedThemes ?? [],
      lead:
        collection?.sharedKeywords.length
          ? `Common signals: ${collection.sharedKeywords.slice(0, 3).join(", ")}`
          : "A shared structure for artifacts that belong together.",
    };
  });
  const memberSummaries = members.map((member) => ({
    userId: member.user_id,
    role: member.role,
    name: member.name,
    email: member.email,
  }));

  return (
    <main className="px-3 py-3 lg:px-5 lg:py-4">
      <section className="rounded-[30px] border border-slate-200/90 bg-white/96 p-6 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.22)]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              <SparkIcon className="h-4 w-4" />
              Workspace
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
              {workspace?.name ?? "Aceync"}
            </h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatPill icon={<GraphIcon className="h-4 w-4" />} label={`${artifacts.length} artifacts`} />
              <StatPill icon={<FolderIcon className="h-4 w-4" />} label={`${folders.length} folders`} />
              <StatPill icon={<CommentIcon className="h-4 w-4" />} label={`${reviewRequests.length} live threads`} />
              <StatPill icon={<UsersIcon className="h-4 w-4" />} label={`${members.length} collaborators`} />
            </div>
          </div>

          <WorkspaceTeamSurface members={memberSummaries} workspaceSlug={workspaceSlug} variant="summary" />
        </div>
      </section>

      <div className="mt-5">
        <ArtifactGraph
          workspaceSlug={workspaceSlug}
          graph={graph}
          mode="overview"
          title="Network"
          subtitle=""
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <WorkspaceTeamSurface members={memberSummaries} workspaceSlug={workspaceSlug} variant="grid" />

        <section className="rounded-[28px] border border-slate-200/90 bg-white/96 p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.22)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">Open threads</div>
            </div>
            <Link href={`/w/${workspaceSlug}/inbox`} className="text-xs font-medium text-slate-800 hover:text-slate-950">
              Open inbox
            </Link>
          </div>
          <div className="mt-3 grid gap-2">
            {reviewRequests.length > 0 ? (
              reviewRequests.slice(0, 5).map((request) => (
                <Link
                  key={request.id}
                  href={`/w/${workspaceSlug}/review-requests/${request.id}`}
                  className="rounded-2xl border border-slate-200/90 bg-slate-50/92 px-3 py-3 transition hover:border-slate-300 hover:bg-white"
                >
                  <div className="text-sm font-medium text-slate-900">{request.title}</div>
                  <div className="mt-1 text-xs text-slate-600">
                    {artifactTitleById.get(request.artifact_id) ?? "Artifact"}
                    {request.due_at ? ` · Due ${new Date(request.due_at).toLocaleDateString()}` : ""}
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/92 px-3 py-4 text-sm text-slate-700">
                No open threads right now. Create a review request from any artifact to make collaboration visible here.
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[28px] border border-slate-200/90 bg-white/96 p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.22)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">Shared folders</div>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-950">Folders</h2>
            </div>
            <Link
              href={`/w/${workspaceSlug}/folders`}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300/90 bg-white/98 px-3.5 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              <FolderIcon className="h-4 w-4" />
              Open folders
            </Link>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {enrichedFolders.length > 0 ? (
              enrichedFolders.map((folder, index) => (
                <Link key={folder.id} href={`/w/${workspaceSlug}/folders/${folder.id}`} className="block">
                  <FolderCard
                    name={folder.name}
                    subtitle={`Structure v${folder.structureVersion}`}
                    meta={new Date(folder.updatedAt).toLocaleDateString()}
                    badge={index === 0 ? "Most active" : null}
                    count={folder.artifactCount}
                    lead={folder.lead}
                    chips={folder.chips}
                  />
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/92 px-4 py-5 text-sm text-slate-700">
                No saved folders yet. The inferred clusters on the right can guide what should become a shared folder next.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200/90 bg-white/96 p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.22)]">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
            <SparkIcon className="h-4 w-4" />
            Suggested
          </div>
          <div className="mt-4 grid gap-3">
            {smartCollections.slice(0, 5).map((collection) => (
              <div key={collection.key} className="rounded-[24px] border border-slate-200/90 bg-slate-50/92 p-4">
                <FolderCard
                  name={collection.name}
                  subtitle="Inferred from current artifacts"
                  label="Smart"
                  kind="smart"
                  count={collection.artifactCount}
                  lead={
                    collection.sharedKeywords.length > 0
                      ? `Common transcript language: ${collection.sharedKeywords.slice(0, 3).join(", ")}`
                      : "Common structure is emerging across multiple artifacts."
                  }
                  chips={collection.sharedThemes}
                />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-[28px] border border-slate-200/90 bg-white/96 p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.22)]">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
            <CaptureIcon className="h-4 w-4" />
            Capture from anywhere
          </div>
          <div className="mt-1 text-sm leading-6 text-slate-700">
            Voice is still the lowest-friction input. Record directly into the workspace or turn a meeting into a structured artifact without leaving the flow.
          </div>
          <div className="mt-4">
            <AudioRecorder workspaceSlug={workspaceSlug} />
          </div>
          <div className="mt-4">
            <AnywhereMeetingCapture
              workspaceSlug={workspaceSlug}
              artifacts={artifacts.map((artifact) => ({ id: artifact.id, title: artifact.title }))}
            />
          </div>
        </section>

        <section className="grid gap-4">
          <div className="rounded-[28px] border border-slate-200/90 bg-white/96 p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.22)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">Slack</div>
            <div className="mt-1 text-sm text-slate-700">
              {slack ? `Connected to ${slack.slack_team_name ?? slack.slack_team_id}` : "Not connected yet"}
            </div>
            <div className="mt-4">
              <SlackSettingsForm
                workspaceSlug={workspaceSlug}
                initialDefaultChannelId={workspace?.default_slack_channel_id ?? null}
              />
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200/90 bg-white/96 p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.22)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">Google Workspace</div>
            <div className="mt-1 text-sm text-slate-700">
              {google ? `Connected to ${google.email ?? "Google account"}` : "Not connected yet"}
            </div>
            <div className="mt-4">
              <GoogleSettingsForm
                workspaceSlug={workspaceSlug}
                initialCalendarId={workspace?.default_google_calendar_id ?? null}
                connected={!!google}
              />
            </div>
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-[28px] border border-slate-200/90 bg-white/96 p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.22)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">Announcements and logs</div>
          <div className="mt-4">
            <AnnouncementLog
              workspaceSlug={workspaceSlug}
              initialAnnouncements={announcements.map((announcement) => ({
                id: announcement.id,
                title: announcement.title,
                bodyMd: announcement.body_md,
                source: announcement.source,
                sourceRef: announcement.source_ref,
                createdAt: announcement.created_at,
                createdByName: announcement.created_by_name,
                createdByEmail: announcement.created_by_email,
              }))}
            />
          </div>
        </section>

        <WorkspaceMembersPanel
          workspaceSlug={workspaceSlug}
          initialMembers={memberSummaries}
          isAdmin={session.role === "admin"}
        />
      </div>
    </main>
  );
}

function StatPill(props: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
      {props.icon}
      {props.label}
    </span>
  );
}
