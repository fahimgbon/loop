import { WebClient } from "@slack/web-api";

import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";
import { createContribution } from "@/src/server/repo/contributions";
import { enqueueJob } from "@/src/server/repo/jobs";
import { getSlackInstallationForTeam } from "@/src/server/repo/slackInstallations";
import { JOB_TYPES } from "@/src/server/jobs/jobTypes";
import { verifySlackRequest } from "@/src/server/slack/verify";
import { maybeRunJob } from "@/src/server/services/jobService";

type SlackUrlVerification = { type: "url_verification"; challenge: string };
type SlackEventCallback = {
  type: "event_callback";
  team_id: string;
  event: { type: string; text?: string; user?: string; channel?: string; ts?: string };
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const verified = verifySlackRequest({ rawBody, headers: request.headers });
  if (!verified.ok) return errorJson(401, verified.error);

  const body = JSON.parse(rawBody) as SlackUrlVerification | SlackEventCallback;

  if (body.type === "url_verification") {
    return json({ challenge: body.challenge });
  }

  if (body.type !== "event_callback") return json({ ok: true });

  const installation = await withClient((client) => getSlackInstallationForTeam(client, body.team_id));
  if (!installation) return json({ ok: true });

  const event = body.event;
  if (event.type === "app_mention" && event.text && event.channel && event.user) {
    const jobId = await withClient(async (client) => {
      const contribution = await createContribution(client, {
        workspaceId: installation.workspace_id,
        source: "slack",
        sourceRef: JSON.stringify({ teamId: body.team_id, channelId: event.channel, userId: event.user, kind: "app_mention", ts: event.ts }),
        textContent: event.text,
        createdBy: null,
      });
      const job = await enqueueJob(client, {
        workspaceId: installation.workspace_id,
        type: JOB_TYPES.CLASSIFY_CONTRIBUTION,
        payload: { contributionId: contribution.id },
      });
      return job.id;
    });

    void maybeRunJob(jobId);

    const slack = new WebClient(installation.bot_token);
    await slack.chat.postMessage({
      channel: event.channel,
      text: "Got it — saved to Loop.",
      thread_ts: event.ts,
    });
  }

  return json({ ok: true });
}
