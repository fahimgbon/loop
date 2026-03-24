import { z } from "zod";

import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";
import { listOpenReviewRequests } from "@/src/server/repo/reviewRequests";
import { createReviewRequestForArtifact } from "@/src/server/services/reviewRequestService";
import { getSlackInstallationForWorkspace } from "@/src/server/repo/slackInstallations";
import { getWorkspaceById } from "@/src/server/repo/workspaces";
import { getArtifact } from "@/src/server/repo/artifacts";
import { getEnv } from "@/src/server/env";
import { WebClient } from "@slack/web-api";
import { setReviewRequestSlackLink } from "@/src/server/repo/reviewRequests";

export async function GET(_: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const reviewRequests = await withClient((client) => listOpenReviewRequests(client, session.workspaceId));
  return json({ reviewRequests });
}

const createSchema = z.object({
  artifactId: z.string().min(1),
  title: z.string().min(2),
  questions: z.array(z.string().min(1)).max(5).default([]),
  dueAt: z.string().datetime().nullable().optional(),
  blockIds: z.array(z.string().min(1)).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  const created = await createReviewRequestForArtifact({
    workspaceId: session.workspaceId,
    artifactId: parsed.data.artifactId,
    title: parsed.data.title,
    questions: parsed.data.questions ?? [],
    dueAt: parsed.data.dueAt ?? null,
    blockIds: parsed.data.blockIds ?? null,
    createdBy: session.userId,
  });

  const env = getEnv();
  const shareUrl = `${env.APP_BASE_URL}/w/${workspaceSlug}/review-requests/${created.id}`;
  let slackStatus: "posted" | "slack_not_connected" | "channel_not_configured" | "post_failed" =
    "slack_not_connected";
  let slackChannelId: string | null = null;
  let slackTeamName: string | null = null;

  // Best-effort Slack post if configured.
  try {
    const [installation, workspace, artifact] = await Promise.all([
      withClient((client) => getSlackInstallationForWorkspace(client, session.workspaceId)),
      withClient((client) => getWorkspaceById(client, session.workspaceId)),
      withClient((client) => getArtifact(client, session.workspaceId, parsed.data.artifactId)),
    ]);

    const channelId = workspace?.default_slack_channel_id ?? null;
    slackChannelId = channelId;
    slackTeamName = installation?.slack_team_name ?? null;
    if (installation && !channelId) slackStatus = "channel_not_configured";
    if (installation && channelId) {
      const slack = new WebClient(installation.bot_token);
      const posted = await slack.chat.postMessage({
        channel: channelId,
        text: `Review request: ${parsed.data.title}\nArtifact: ${(artifact?.title ?? parsed.data.artifactId)}\n${shareUrl}\nQuestions:\n• ${(parsed.data.questions ?? []).join("\n• ")}`,
      });
      const ts = typeof posted.ts === "string" ? posted.ts : null;
      if (ts) {
        await withClient((client) =>
          setReviewRequestSlackLink(client, {
            workspaceId: session.workspaceId,
            reviewRequestId: created.id,
            slackChannelId: channelId,
            slackMessageTs: ts,
          }),
        );
        slackStatus = "posted";
      } else {
        slackStatus = "post_failed";
      }
    }
  } catch {
    slackStatus = slackStatus === "channel_not_configured" ? slackStatus : "post_failed";
  }

  return json({
    ok: true,
    reviewRequestId: created.id,
    shareUrl,
    slackStatus,
    slackChannelId,
    slackTeamName,
  });
}
