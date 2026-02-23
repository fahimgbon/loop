import { WebClient } from "@slack/web-api";

import { getEnv } from "@/src/server/env";
import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";
import { createReviewRequest, setReviewRequestSlackLink } from "@/src/server/repo/reviewRequests";
import { getSlackInstallationForTeam } from "@/src/server/repo/slackInstallations";
import { getWorkspaceById } from "@/src/server/repo/workspaces";
import { verifySlackRequest } from "@/src/server/slack/verify";

type SlackViewSubmissionPayload = {
  type: "view_submission";
  team: { id: string };
  user: { id: string };
  view: {
    callback_id: string;
    private_metadata?: string;
    state: { values: Record<string, Record<string, { value?: string }>> };
  };
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const verified = verifySlackRequest({ rawBody, headers: request.headers });
  if (!verified.ok) return errorJson(401, verified.error);

  const params = new URLSearchParams(rawBody);
  const payloadRaw = params.get("payload");
  if (!payloadRaw) return errorJson(400, "Missing payload");

  const payload = JSON.parse(payloadRaw) as SlackViewSubmissionPayload;
  if (payload.type !== "view_submission") return json({ ok: true });
  if (payload.view.callback_id !== "loop_request_feedback") return json({ ok: true });

  const teamId = payload.team.id;
  const installation = await withClient((client) => getSlackInstallationForTeam(client, teamId));
  if (!installation) return errorJson(400, "Slack not installed");

  const meta = safeJson(payload.view.private_metadata) as
    | { workspaceId: string; channelId: string; slackTeamId: string; slackUserId: string }
    | null;
  if (!meta || meta.workspaceId !== installation.workspace_id) return errorJson(400, "Invalid metadata");

  const values = payload.view.state.values;
  const artifactRaw = values.artifact?.artifact?.value ?? "";
  const artifactId = extractArtifactId(artifactRaw);
  if (!artifactId) {
    return json({
      response_action: "errors",
      errors: { artifact: "Paste a Loop artifact URL or UUID." },
    });
  }
  const title = (values.title?.title?.value ?? "").trim();
  const q1 = (values.q1?.q1?.value ?? "").trim();
  const q2 = (values.q2?.q2?.value ?? "").trim();
  const q3 = (values.q3?.q3?.value ?? "").trim();
  const questions = [q1, q2, q3].filter(Boolean);

  if (!title || questions.length < 1) {
    return json({
      response_action: "errors",
      errors: { title: "Title and at least one question are required." },
    });
  }

  const env = getEnv();
  const created = await withClient((client) =>
    createReviewRequest(client, {
      workspaceId: installation.workspace_id,
      artifactId,
      title,
      questions,
      createdBy: null,
    }),
  );

  const workspace = await withClient((client) => getWorkspaceById(client, installation.workspace_id));
  const workspaceSlug = workspace?.slug ?? "demo";
  const link = `${env.APP_BASE_URL}/w/${workspaceSlug}/review-requests/${created.id}`;

  const slack = new WebClient(installation.bot_token);
  const posted = await slack.chat.postMessage({
    channel: meta.channelId,
    text: `Review request: ${title}\n${link}\nQuestions:\n• ${questions.join("\n• ")}`,
  });

  const ts = typeof posted.ts === "string" ? posted.ts : null;
  if (ts) {
    await withClient((client) =>
      setReviewRequestSlackLink(client, {
        workspaceId: installation.workspace_id,
        reviewRequestId: created.id,
        slackChannelId: meta.channelId,
        slackMessageTs: ts,
      }),
    );
  }

  return json({});
}

function safeJson(input?: string) {
  if (!input) return null;
  try {
    return JSON.parse(input) as unknown;
  } catch {
    return null;
  }
}

function extractArtifactId(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const uuidMatch = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuidMatch) return uuidMatch[0];
  const urlMatch = trimmed.match(/\/artifacts\/([0-9a-f-]{36})/i);
  if (urlMatch) return urlMatch[1];
  return null;
}
