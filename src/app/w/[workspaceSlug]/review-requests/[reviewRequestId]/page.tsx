import Link from "next/link";
import { redirect } from "next/navigation";

import { AutoRefresh } from "@/src/components/live/AutoRefresh";
import { ReviewResponseComposer } from "@/src/components/reviews/ReviewResponseComposer";
import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { getArtifact } from "@/src/server/repo/artifacts";
import { getReviewRequest, listReviewRequestTargets } from "@/src/server/repo/reviewRequests";
import { listResponsesForRequest } from "@/src/server/repo/reviewResponses";

export const dynamic = "force-dynamic";

export default async function ReviewRequestPage(props: {
  params: Promise<{ workspaceSlug: string; reviewRequestId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { workspaceSlug, reviewRequestId } = await props.params;
  if (workspaceSlug !== session.workspaceSlug) redirect(`/w/${session.workspaceSlug}`);

  const request = await withClient((client) => getReviewRequest(client, session.workspaceId, reviewRequestId));
  if (!request) redirect(`/w/${workspaceSlug}`);

  const [artifact, targets, responses] = await Promise.all([
    withClient((client) => getArtifact(client, session.workspaceId, request.artifact_id)),
    withClient((client) => listReviewRequestTargets(client, request.id)),
    withClient((client) => listResponsesForRequest(client, session.workspaceId, request.id)),
  ]);

  const questions = Array.isArray(request.questions) ? (request.questions as string[]) : [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <AutoRefresh intervalMs={3000} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{request.title}</h1>
          <div className="mt-2 text-sm text-muted">
            Artifact:{" "}
            <Link className="text-blue-400 hover:underline" href={`/w/${workspaceSlug}/artifacts/${request.artifact_id}`}>
              {artifact?.title ?? request.artifact_id}
            </Link>
          </div>
          <div className="mt-1 text-xs text-muted">
            Status: {request.status} · Created {new Date(request.created_at).toLocaleString()}
            {request.due_at ? ` · Due ${new Date(request.due_at).toLocaleString()}` : ""}
          </div>
        </div>
        <form action={`/api/workspaces/${workspaceSlug}/review-requests/${request.id}/close`} method="post">
          <button className="rounded-md border border-white/60 bg-white/40 px-3 py-2 text-sm hover:bg-white/70" type="submit">
            Close
          </button>
        </form>
      </div>

      <section className="glass mt-8 rounded-xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Questions</h2>
        {questions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No questions specified.</p>
        ) : (
          <ul className="mt-3 grid gap-2 text-sm">
            {questions.map((q, i) => (
              <li key={i} className="rounded-lg border p-3">
                {q}
              </li>
            ))}
          </ul>
        )}
        {targets.length ? (
          <p className="mt-4 text-xs text-muted">Targets: {targets.length} block(s)</p>
        ) : (
          <p className="mt-4 text-xs text-muted">Targets: whole artifact</p>
        )}
      </section>

      <section className="glass mt-6 rounded-xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Respond</h2>
        <p className="mt-1 text-sm text-muted">Add text or audio. Loop will transcribe/classify via the worker.</p>
        <div className="mt-4">
          <ReviewResponseComposer workspaceSlug={workspaceSlug} reviewRequestId={request.id} />
        </div>
      </section>

      <section className="glass mt-6 rounded-xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Responses</h2>
        {responses.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No responses yet.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {responses.map((r) => (
              <div key={r.id} className="rounded-xl border border-white/60 bg-white/50 p-4 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-muted">
                    {new Date(r.created_at).toLocaleString()} · {r.source} · intent: {r.intent}
                    {r.intent_confidence ? ` (${Math.round(r.intent_confidence * 100)}%)` : ""}
                  </div>
                  {r.audio_path ? (
                    <a className="text-xs text-blue-400 hover:underline" href={`/api/contributions/${r.contribution_id}/audio`} target="_blank">
                      audio
                    </a>
                  ) : null}
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm">
                  {(r.transcript ?? r.text_content ?? "").trim() || <span className="text-muted">Empty.</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
