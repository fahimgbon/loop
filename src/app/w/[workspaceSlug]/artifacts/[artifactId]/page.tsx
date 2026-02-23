import { redirect } from "next/navigation";
import Link from "next/link";

import { ArtifactTitleEditor } from "@/src/components/artifacts/ArtifactTitleEditor";
import { ArtifactDoc } from "@/src/components/artifacts/ArtifactDoc";
import { ArtifactPermissionsPanel } from "@/src/components/artifacts/ArtifactPermissionsPanel";
import { AudioRecorder } from "@/src/components/contributions/AudioRecorder";
import { FolderSyncPrompt } from "@/src/components/folders/FolderSyncPrompt";
import { ReviewRequestForm } from "@/src/components/reviews/ReviewRequestForm";
import { InlineReviewPanel } from "@/src/components/reviews/InlineReviewPanel";
import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { getArtifact, listBlocks } from "@/src/server/repo/artifacts";
import { listOpenReviewRequests, listReviewRequestTargets } from "@/src/server/repo/reviewRequests";

export const dynamic = "force-dynamic";

export default async function ArtifactPage(props: {
  params: Promise<{ workspaceSlug: string; artifactId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { workspaceSlug, artifactId } = await props.params;
  if (workspaceSlug !== session.workspaceSlug) redirect(`/w/${session.workspaceSlug}`);

  const artifact = await withClient((client) => getArtifact(client, session.workspaceId, artifactId));
  if (!artifact) redirect(`/w/${workspaceSlug}`);

  const [blocks, openRequests] = await Promise.all([
    withClient((client) => listBlocks(client, artifactId)),
    withClient((client) => listOpenReviewRequests(client, session.workspaceId, artifactId)),
  ]);
  const requestDetails = await Promise.all(
    openRequests.map(async (request) => {
      const blockIds = await withClient((client) => listReviewRequestTargets(client, request.id));
      const questions = Array.isArray(request.questions) ? (request.questions as string[]) : [];
      return {
        id: request.id,
        title: request.title,
        dueAt: request.due_at,
        createdAt: request.created_at,
        questions,
        blockIds,
      };
    }),
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Link href={`/w/${workspaceSlug}`} className="rounded-full border border-white/60 bg-white/40 px-3 py-1 hover:bg-white/70">
            Workspace
          </Link>
          <span>/</span>
          <span className="rounded-full border border-white/60 bg-white/60 px-3 py-1 text-slate-800">
            Artifact
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a href="#capture" className="rounded-full border border-white/60 bg-white/40 px-3 py-1 text-xs hover:bg-white/70">
            Capture update
          </a>
          <a href="#feedback" className="rounded-full border border-white/60 bg-white/40 px-3 py-1 text-xs hover:bg-white/70">
            Ask questions
          </a>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <section className="flex-1" id="doc-canvas">
          <div className="glass rounded-xl p-6">
            <ArtifactTitleEditor artifactId={artifactId} initialTitle={artifact.title} />
            <p className="mt-1 text-sm text-muted">Status: {artifact.status}</p>
            <div className="mt-4">
              <FolderSyncPrompt artifactId={artifactId} />
            </div>
            <ArtifactDoc
              workspaceSlug={workspaceSlug}
              artifactId={artifactId}
              artifactTitle={artifact.title}
              initialBlocks={blocks}
            />
          </div>
        </section>

        <aside className="w-full max-w-xl shrink-0 space-y-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:w-[420px] lg:overflow-auto">
          <div className="glass rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Flow</h2>
            <div className="mt-3 grid gap-2 text-sm">
              <a href="#doc-canvas" className="flow-step">
                1. Structure the document
              </a>
              <a href="#capture" className="flow-step">
                2. Capture an update
              </a>
              <a href="#feedback" className="flow-step">
                3. Ask pointed questions
              </a>
              <a href="#requests" className="flow-step">
                4. Track open responses
              </a>
            </div>
          </div>

          <div className="glass rounded-xl p-5" id="capture">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Capture</h2>
            <p className="mt-1 text-sm text-muted">Record a quick note; Loop transcribes and classifies it automatically.</p>
            <div className="mt-4">
              <AudioRecorder workspaceSlug={workspaceSlug} artifactId={artifactId} />
            </div>
          </div>

          <div className="glass rounded-xl p-5" id="feedback">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Request async feedback</h2>
            <p className="mt-1 text-sm text-muted">Turn uncertainty into pointed questions with owners and due dates.</p>
            <div className="mt-4">
              <ReviewRequestForm workspaceSlug={workspaceSlug} artifactId={artifactId} />
            </div>
          </div>

          <div className="glass rounded-xl p-5" id="requests">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Open requests</h2>
            <div className="mt-3">
              <InlineReviewPanel
                workspaceSlug={workspaceSlug}
                artifactId={artifactId}
                requests={requestDetails}
                blockTitles={blocks.map((block) => ({ id: block.id, title: block.title, type: block.type }))}
              />
            </div>
            {openRequests.length > 0 ? (
              <ul className="mt-3 grid gap-2">
                {openRequests.map((r) => (
                  <li key={r.id} className="rounded-lg border p-3 text-sm">
                    <div className="font-medium">{r.title}</div>
                    <div className="mt-1 text-xs text-muted">
                      Created {new Date(r.created_at).toLocaleString()}
                      {r.due_at ? ` · Due ${new Date(r.due_at).toLocaleString()}` : ""}
                    </div>
                    <form action={`/api/workspaces/${workspaceSlug}/review-requests/${r.id}/close`} method="post">
                      <button className="mt-2 text-xs text-blue-400 hover:underline" type="submit">
                        Close request
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <ArtifactPermissionsPanel artifactId={artifactId} />
        </aside>
      </div>
    </main>
  );
}
