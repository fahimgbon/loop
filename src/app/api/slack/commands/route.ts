import { WebClient } from "@slack/web-api";
import type { ModalView } from "@slack/types";

import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";
import { createContribution } from "@/src/server/repo/contributions";
import { enqueueJob } from "@/src/server/repo/jobs";
import { getSlackInstallationForTeam } from "@/src/server/repo/slackInstallations";
import { JOB_TYPES } from "@/src/server/jobs/jobTypes";
import { verifySlackRequest } from "@/src/server/slack/verify";
import { maybeRunJob } from "@/src/server/services/jobService";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const verified = verifySlackRequest({ rawBody, headers: request.headers });
  if (!verified.ok) return errorJson(401, verified.error);

  const params = new URLSearchParams(rawBody);
  const teamId = params.get("team_id");
  const channelId = params.get("channel_id");
  const userId = params.get("user_id");
  const text = (params.get("text") ?? "").trim();
  const triggerId = params.get("trigger_id");

  if (!teamId || !channelId || !userId) return errorJson(400, "Invalid Slack payload");

  const installation = await withClient((client) => getSlackInstallationForTeam(client, teamId));
  if (!installation) {
    return json({
      response_type: "ephemeral",
      text: "Loop is not connected for this Slack workspace yet. Ask an admin to install it.",
    });
  }

  const [cmd, ...rest] = text.split(/\s+/);
  const subcommand = (cmd || "help").toLowerCase();

  if (subcommand === "request") {
    if (!triggerId) {
      return json({ response_type: "ephemeral", text: "Slack did not provide a trigger_id." });
    }
    const defaultTitle = rest.join(" ").trim() || "Async review";
    const slack = new WebClient(installation.bot_token);
    await slack.views.open({
      trigger_id: triggerId,
      view: buildRequestFeedbackModal({
        defaultTitle,
        privateMetadata: JSON.stringify({
          workspaceId: installation.workspace_id,
          slackTeamId: teamId,
          channelId,
          slackUserId: userId,
        }),
      }),
    });
    return json({ response_type: "ephemeral", text: "Opening request modal…" });
  }

  if (subcommand === "record") {
    return json({
      response_type: "ephemeral",
      text: "Record in Loop: open your workspace and use the Capture panel (audio upload from Slack is coming next).",
    });
  }

  const noteText = subcommand === "note" ? rest.join(" ") : text;
  if (!noteText.trim()) {
    return json({
      response_type: "ephemeral",
      text: "Usage: `/loop note <your note>` or `/loop request`",
    });
  }

  const jobId = await withClient(async (client) => {
    const contribution = await createContribution(client, {
      workspaceId: installation.workspace_id,
      source: "slack",
      sourceRef: JSON.stringify({ teamId, channelId, userId, kind: "slash_command" }),
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

  return json({ response_type: "ephemeral", text: "Saved to Loop." });
}

function buildRequestFeedbackModal(input: { defaultTitle: string; privateMetadata: string }): ModalView {
  return {
    type: "modal",
    callback_id: "loop_request_feedback",
    title: { type: "plain_text", text: "Request feedback" },
    submit: { type: "plain_text", text: "Create" },
    close: { type: "plain_text", text: "Cancel" },
    private_metadata: input.privateMetadata,
    blocks: [
      {
        type: "input",
        block_id: "artifact",
        label: { type: "plain_text", text: "Artifact link or ID" },
        element: {
          type: "plain_text_input",
          action_id: "artifact",
          placeholder: { type: "plain_text", text: "Paste Loop artifact URL or UUID" },
        },
      },
      {
        type: "input",
        block_id: "title",
        label: { type: "plain_text", text: "Title" },
        element: {
          type: "plain_text_input",
          action_id: "title",
          initial_value: input.defaultTitle,
        },
      },
      {
        type: "input",
        block_id: "q1",
        label: { type: "plain_text", text: "Question 1" },
        element: {
          type: "plain_text_input",
          action_id: "q1",
          initial_value: "What’s the biggest flaw or risk?",
        },
      },
      {
        type: "input",
        block_id: "q2",
        label: { type: "plain_text", text: "Question 2" },
        element: {
          type: "plain_text_input",
          action_id: "q2",
          initial_value: "What would you change or clarify?",
        },
      },
      {
        type: "input",
        block_id: "q3",
        optional: true,
        label: { type: "plain_text", text: "Question 3 (optional)" },
        element: {
          type: "plain_text_input",
          action_id: "q3",
          initial_value: "Any dependencies or unknowns?",
        },
      },
    ],
  } as ModalView;
}
