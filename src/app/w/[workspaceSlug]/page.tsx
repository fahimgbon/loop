import Link from "next/link";
import { redirect } from "next/navigation";

import { AudioRecorder } from "@/src/components/contributions/AudioRecorder";
import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { listArtifacts } from "@/src/server/repo/artifacts";
import { listFolders } from "@/src/server/repo/folders";
import { listOpenReviewRequests } from "@/src/server/repo/reviewRequests";
import { getSlackInstallationForWorkspace } from "@/src/server/repo/slackInstallations";
import { getWorkspaceById } from "@/src/server/repo/workspaces";
import { listWorkspaceMembers } from "@/src/server/repo/workspaces";
import { SlackSettingsForm } from "@/src/components/integrations/SlackSettingsForm";
import { FolderCard } from "@/src/components/folders/FolderCard";
import { getGoogleInstallationForWorkspace } from "@/src/server/repo/googleInstallations";
import { GoogleSettingsForm } from "@/src/components/integrations/GoogleSettingsForm";
import { WorkspaceGuide } from "@/src/components/guide/WorkspaceGuide";
import { listAnnouncements } from "@/src/server/repo/announcements";
import { AnnouncementLog } from "@/src/components/announcements/AnnouncementLog";
import { AnywhereMeetingCapture } from "@/src/components/meetings/AnywhereMeetingCapture";
import { WorkspaceMembersPanel } from "@/src/components/workspace/WorkspaceMembersPanel";

export const dynamic = "force-dynamic";

export default async function WorkspacePage(props: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { workspaceSlug } = await props.params;
  if (workspaceSlug !== session.workspaceSlug) redirect(`/w/${session.workspaceSlug}`);

  const [artifacts, reviewRequests, folders] = await Promise.all([
    withClient((client) => listArtifacts(client, session.workspaceId)),
    withClient((client) => listOpenReviewRequests(client, session.workspaceId)),
    withClient((client) => listFolders(client, session.workspaceId)),
  ]);

  const [slack, google, workspace, announcements, members] = await Promise.all([
    withClient((client) => getSlackInstallationForWorkspace(client, session.workspaceId)),
    withClient((client) => getGoogleInstallationForWorkspace(client, session.workspaceId)),
    withClient((client) => getWorkspaceById(client, session.workspaceId)),
    withClient((client) => listAnnouncements(client, session.workspaceId, 25)),
    withClient((client) => listWorkspaceMembers(client, session.workspaceId)),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Workspace</h1>
          <p className="mt-1 text-sm text-muted">
            Artifacts are the system-of-record. Slack/Meet/Notion are the system-of-flow.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link className="rounded-md border border-white/60 bg-white/40 px-3 py-2 text-sm hover:bg-white/70" href={`/w/${workspaceSlug}/inbox`}>
            Inbox
          </Link>
          <Link className="rounded-md border border-white/60 bg-white/40 px-3 py-2 text-sm hover:bg-white/70" href={`/w/${workspaceSlug}/capture`}>
            Capture
          </Link>
          <Link className="rounded-md border border-white/60 bg-white/40 px-3 py-2 text-sm hover:bg-white/70" href={`/w/${workspaceSlug}/search`}>
            Search
          </Link>
          <Link className="rounded-md border border-white/60 bg-white/40 px-3 py-2 text-sm hover:bg-white/70" href={`/w/${workspaceSlug}/folders`}>
            Folders
          </Link>
          <Link
            className={[
              "rounded-md bg-accent px-3 py-2 text-sm font-medium text-white",
              artifacts.length === 0 ? "guide-ring" : "",
            ].join(" ")}
            href={`/w/${workspaceSlug}/artifacts/new`}
          >
            New artifact
          </Link>
        </div>
      </div>

      <section className="glass mt-6 rounded-xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Capture</h2>
        <p className="mt-1 text-sm text-muted">
          Record a quick note. It will land in the Inbox unless you attach it to an artifact later.
        </p>
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

      <section className="glass mt-6 rounded-xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Integrations</h2>
        <div className="mt-4 grid gap-4">
          <div className="rounded-xl border border-white/60 bg-white/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm">
                <div className="font-medium">Slack</div>
                <div className="text-xs text-muted">
                  {slack ? `Connected to ${slack.slack_team_name ?? slack.slack_team_id}` : "Not connected"}
                </div>
              </div>
              {slack ? (
                <a
                  className="rounded-md border border-white/60 bg-white/40 px-3 py-2 text-sm hover:bg-white/70"
                  href={`/api/slack/oauth/start?workspaceSlug=${encodeURIComponent(workspaceSlug)}`}
                >
                  Reconnect
                </a>
              ) : (
                <a
                  className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
                  href={`/api/slack/oauth/start?workspaceSlug=${encodeURIComponent(workspaceSlug)}`}
                >
                  Connect Slack
                </a>
              )}
            </div>
            <p className="mt-3 text-xs text-muted">
              After connecting, use Slack slash commands: <span className="font-mono">/loop note …</span> and{" "}
              <span className="font-mono">/loop request</span>.
            </p>
            <div className="mt-4">
              <SlackSettingsForm
                workspaceSlug={workspaceSlug}
                initialDefaultChannelId={workspace?.default_slack_channel_id ?? null}
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/60 bg-white/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm">
                <div className="font-medium">Google Workspace</div>
                <div className="text-xs text-muted">
                  {google ? `Connected to ${google.email ?? "Google account"}` : "Not connected"}
                </div>
              </div>
              {google ? (
                <a
                  className="rounded-md border border-white/60 bg-white/40 px-3 py-2 text-sm hover:bg-white/70"
                  href={`/api/google/oauth/start?workspaceSlug=${encodeURIComponent(workspaceSlug)}`}
                >
                  Reconnect
                </a>
              ) : (
                <a
                  className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
                  href={`/api/google/oauth/start?workspaceSlug=${encodeURIComponent(workspaceSlug)}`}
                >
                  Connect Google
                </a>
              )}
            </div>
            <p className="mt-3 text-xs text-muted">
              Loop can scan calendar events for attached Docs and turn them into structured updates.
            </p>
            <div className="mt-4">
              <GoogleSettingsForm
                workspaceSlug={workspaceSlug}
                initialCalendarId={workspace?.default_google_calendar_id ?? null}
                connected={!!google}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="glass mt-6 rounded-xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Announcements & logs</h2>
        <p className="mt-1 text-sm text-muted">
          Capture Google Classroom/Form updates, launch announcements, and async meeting summaries in one place.
        </p>
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

      <section className="glass mt-6 rounded-xl p-6">
        <WorkspaceMembersPanel
          workspaceSlug={workspaceSlug}
          initialMembers={members.map((member) => ({
            userId: member.user_id,
            role: member.role,
            name: member.name,
            email: member.email,
          }))}
          isAdmin={session.role === "admin"}
        />
      </section>

      <section className="mt-8 grid gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Open review requests</h2>
        {reviewRequests.length === 0 ? (
          <div className="glass rounded-xl p-6 text-sm text-muted">No open requests.</div>
        ) : (
          <div className="grid gap-2">
            {reviewRequests.map((r) => (
              <Link
                key={r.id}
                href={`/w/${workspaceSlug}/review-requests/${r.id}`}
                className="glass rounded-xl p-4 hover:bg-white/70"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-muted">{new Date(r.created_at).toLocaleString()}</div>
                </div>
                <div className="mt-1 text-xs text-muted">Artifact: {r.artifact_id}</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Folders</h2>
          <Link className="text-xs text-blue-500 hover:underline" href={`/w/${workspaceSlug}/folders/new`}>
            New folder
          </Link>
        </div>
        {folders.length === 0 ? (
          <div className="glass rounded-xl p-6 text-sm text-muted">
            No folders yet. Create one to enforce inherited structure across artifacts.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {folders.map((folder, idx) => (
              <Link key={folder.id} className="block" href={`/w/${workspaceSlug}/folders/${folder.id}`}>
                <FolderCard
                  name={folder.name}
                  subtitle={`Version ${folder.structure_version}`}
                  meta={new Date(folder.updated_at).toLocaleDateString()}
                  badge={idx === 0 ? "Most recent" : null}
                />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 grid gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Artifacts</h2>
        {artifacts.length === 0 ? (
          <div className="glass rounded-xl p-6 text-sm text-muted">
            No artifacts yet. Create one to start collecting async feedback.
          </div>
        ) : (
          <div className="grid gap-2">
            {artifacts.map((a) => (
              <Link
                key={a.id}
                className="glass flex items-center justify-between rounded-xl p-4 hover:bg-white/70"
                href={`/w/${workspaceSlug}/artifacts/${a.id}`}
              >
                <div>
                  <div className="font-medium">{a.title}</div>
                  <div className="text-xs text-muted">
                    Status: {a.status}
                    {a.folder_name ? ` · Folder: ${a.folder_name}` : ""}
                  </div>
                </div>
                <div className="text-xs text-muted">{new Date(a.updated_at).toLocaleString()}</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <WorkspaceGuide artifactsCount={artifacts.length} foldersCount={folders.length} />
    </main>
  );
}
