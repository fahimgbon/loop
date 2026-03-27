import { WebClient } from "@slack/web-api";

import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";
import { createContribution } from "@/src/server/repo/contributions";
import { enqueueJob } from "@/src/server/repo/jobs";
import { getSlackInstallationForTeam } from "@/src/server/repo/slackInstallations";
import { getWorkspaceById } from "@/src/server/repo/workspaces";
import { JOB_TYPES } from "@/src/server/jobs/jobTypes";
import {
  buildSlackAccessMessage,
  buildSlackUnfurls,
  parseSlackCommandText,
  stripSlackAppMentionTokens,
} from "@/src/server/slack/access";
import { verifySlackRequest } from "@/src/server/slack/verify";
import { maybeRunJob } from "@/src/server/services/jobService";

type SlackUrlVerification = { type: "url_verification"; challenge: string };
type SlackEventCallback = {
  type: "event_callback";
  team_id: string;
  event:
    | { type: "app_mention"; text?: string; user?: string; channel?: string; ts?: string }
    | { type: "link_shared"; channel?: string; message_ts?: string; links?: Array<{ url: string }> };
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

  const workspace = await withClient((client) => getWorkspaceById(client, installation.workspace_id));
  if (!workspace) return json({ ok: true });

  const event = body.event;
  if (event.type === "link_shared" && event.channel && event.message_ts && event.links?.length) {
    const unfurls = await buildSlackUnfurls({
      workspaceId: installation.workspace_id,
      workspaceSlug: workspace.slug,
      urls: event.links.map((link) => link.url),
    });

    if (Object.keys(unfurls).length > 0) {
      const slack = new WebClient(installation.bot_token);
      await slack.chat.unfurl({
        channel: event.channel,
        ts: event.message_ts,
        unfurls,
      });
    }
  }

  if (event.type === "app_mention" && event.channel && event.user) {
    const cleanedText = stripSlackAppMentionTokens(event.text ?? "");
    const accessMessage = await buildSlackAccessMessage({
      workspaceId: installation.workspace_id,
      workspaceSlug: workspace.slug,
      commandText: cleanedText,
      slackTeamId: body.team_id,
      channelId: event.channel,
      slackUserId: event.user,
    });
    const slack = new WebClient(installation.bot_token);

    if (accessMessage) {
      await slack.chat.postMessage({
        channel: event.channel,
        text: accessMessage.text,
        ...(accessMessage.blocks ? { blocks: accessMessage.blocks } : {}),
        thread_ts: event.ts,
      });
      return json({ ok: true });
    }

    const { subcommand, args } = parseSlackCommandText(cleanedText);
    if (subcommand === "request") {
      await slack.chat.postMessage({
        channel: event.channel,
        text: "Use `/aceync request` to open the review-request modal from Slack.",
        thread_ts: event.ts,
      });
      return json({ ok: true });
    }

    const noteText = subcommand === "note" ? args : cleanedText;
    if (!noteText.trim()) {
      const helpMessage = await buildSlackAccessMessage({
        workspaceId: installation.workspace_id,
        workspaceSlug: workspace.slug,
        commandText: "help",
      });
      await slack.chat.postMessage({
        channel: event.channel,
        text: helpMessage?.text ?? "Aceync is connected in Slack.",
        ...(helpMessage?.blocks ? { blocks: helpMessage.blocks } : {}),
        thread_ts: event.ts,
      });
      return json({ ok: true });
    }

    const jobId = await withClient(async (client) => {
      const contribution = await createContribution(client, {
        workspaceId: installation.workspace_id,
        source: "slack",
        sourceRef: JSON.stringify({
          teamId: body.team_id,
          channelId: event.channel,
          userId: event.user,
          kind: "app_mention",
          ts: event.ts,
        }),
        textContent: noteText,
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

    await slack.chat.postMessage({
      channel: event.channel,
      text: "Saved to Aceync. Try `@Aceync search <query>`, `@Aceync recent`, or `@Aceync record` to keep moving here.",
      thread_ts: event.ts,
    });
  }

  return json({ ok: true });
}
