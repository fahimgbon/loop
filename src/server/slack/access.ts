import type { AnyBlock, LinkUnfurls, MessageAttachment } from "@slack/types";

import { getEnv } from "@/src/server/env";
import { withClient } from "@/src/server/db";
import { getArtifact, listArtifacts, listBlocks } from "@/src/server/repo/artifacts";
import { getReviewRequest, listOpenReviewRequests } from "@/src/server/repo/reviewRequests";
import { createSlackCaptureToken } from "@/src/server/slack/capture";
import { getWorkspaceSearchExplorer } from "@/src/server/services/searchExplorerService";

type SlackBlock = AnyBlock;

export type SlackMessage = {
  text: string;
  blocks?: SlackBlock[];
};

type LoopSharedUrl =
  | { kind: "artifact"; workspaceSlug: string; artifactId: string }
  | { kind: "review_request"; workspaceSlug: string; reviewRequestId: string };

export function parseSlackCommandText(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return { subcommand: "help", args: "" };
  const [cmd, ...rest] = trimmed.split(/\s+/);
  return {
    subcommand: (cmd || "help").toLowerCase(),
    args: rest.join(" ").trim(),
  };
}

export function stripSlackAppMentionTokens(input: string) {
  return input.replace(/<@[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function buildSlackAccessMessage(input: {
  workspaceId: string;
  workspaceSlug: string;
  commandText: string;
  slackTeamId?: string;
  channelId?: string;
  slackUserId?: string;
}): Promise<SlackMessage | null> {
  const parsed = parseSlackCommandText(input.commandText);

  if (parsed.subcommand === "help") {
    return buildHelpMessage(input.workspaceSlug);
  }

  if (["record", "capture", "upload", "video"].includes(parsed.subcommand)) {
    return buildCaptureMessage({
      workspaceId: input.workspaceId,
      workspaceSlug: input.workspaceSlug,
      slackTeamId: input.slackTeamId,
      channelId: input.channelId,
      slackUserId: input.slackUserId,
    });
  }

  if (parsed.subcommand === "recent" || parsed.subcommand === "browse") {
    return buildRecentMessage(input.workspaceId, input.workspaceSlug);
  }

  if (["search", "find", "open", "artifact"].includes(parsed.subcommand)) {
    if (!parsed.args) {
      return {
        text: "Usage: /aceync search <query>",
        blocks: [
          sectionBlock("*Search Aceync*\nUse `/aceync search <query>` or `@Aceync search <query>` to find artifacts and blocks."),
          contextBlock("Example: `/aceync search onboarding flow`"),
        ],
      };
    }
    return buildSearchMessage(input.workspaceId, input.workspaceSlug, parsed.args);
  }

  return null;
}

export async function buildSlackUnfurls(input: {
  workspaceId: string;
  workspaceSlug: string;
  urls: string[];
}): Promise<LinkUnfurls> {
  const entries = await Promise.all(
    input.urls.map(async (url) => {
      const parsed = parseLoopSharedUrl(url);
      if (!parsed || parsed.workspaceSlug !== input.workspaceSlug) return null;

      if (parsed.kind === "artifact") {
        const artifact = await withClient(async (client) => {
          const item = await getArtifact(client, input.workspaceId, parsed.artifactId);
          if (!item) return null;
          const blocks = await listBlocks(client, item.id);
          return { item, blocks };
        });
        if (!artifact) return null;
        return [
          url,
          buildArtifactUnfurl({
            url,
            title: artifact.item.title,
            status: artifact.item.status,
            updatedAt: artifact.item.updated_at,
            blocks: artifact.blocks,
          }),
        ] as const;
      }

      const reviewRequest = await withClient(async (client) => {
        const item = await getReviewRequest(client, input.workspaceId, parsed.reviewRequestId);
        if (!item) return null;
        const artifact = await getArtifact(client, input.workspaceId, item.artifact_id);
        return { item, artifactTitle: artifact?.title ?? "Artifact" };
      });
      if (!reviewRequest) return null;

      return [
        url,
        buildReviewRequestUnfurl({
          url,
          title: reviewRequest.item.title,
          artifactTitle: reviewRequest.artifactTitle,
          status: reviewRequest.item.status,
          dueAt: reviewRequest.item.due_at,
          questions: normalizeQuestions(reviewRequest.item.questions),
        }),
      ] as const;
    }),
  );

  return Object.fromEntries(
    entries.filter((entry): entry is readonly [string, MessageAttachment] => Boolean(entry)),
  );
}

async function buildRecentMessage(workspaceId: string, workspaceSlug: string): Promise<SlackMessage> {
  const [artifacts, reviewRequests] = await Promise.all([
    withClient((client) => listArtifacts(client, workspaceId, { limit: 8 })),
    withClient((client) => listOpenReviewRequests(client, workspaceId)),
  ]);

  const artifactTitleById = new Map(artifacts.map((artifact) => [artifact.id, artifact.title]));
  const recentArtifacts = artifacts.slice(0, 5);
  const openRequests = reviewRequests.slice(0, 5);

  const blocks: SlackBlock[] = [
    sectionBlock(
      `*Recent in Aceync*\nBrowse the latest artifacts and open review threads without leaving Slack.`,
    ),
  ];

  if (recentArtifacts.length > 0) {
    blocks.push(
      sectionBlock(
        `*Recent artifacts*\n${recentArtifacts
          .map((artifact) => {
            const url = buildArtifactUrl(workspaceSlug, artifact.id);
            const meta = [artifact.folder_name, `updated ${formatShortDate(artifact.updated_at)}`]
              .filter(Boolean)
              .join(" · ");
            return `• ${slackLink(url, artifact.title)}${meta ? ` · ${escapeSlackText(meta)}` : ""}`;
          })
          .join("\n")}`,
      ),
    );
  }

  if (openRequests.length > 0) {
    blocks.push(
      sectionBlock(
        `*Open review requests*\n${openRequests
          .map((request) => {
            const url = buildReviewRequestUrl(workspaceSlug, request.id);
            const meta = [artifactTitleById.get(request.artifact_id) ?? "Artifact"];
            if (request.due_at) meta.push(`due ${formatShortDate(request.due_at)}`);
            return `• ${slackLink(url, request.title)} · ${escapeSlackText(meta.join(" · "))}`;
          })
          .join("\n")}`,
      ),
    );
  }

  if (!recentArtifacts.length && !openRequests.length) {
    blocks.push(
      sectionBlock("Aceync is connected, but there is nothing recent to show yet. Try `/aceync note <text>` to send the first item in."),
    );
  }

  blocks.push(
    contextBlock(`Open the workspace: ${slackLink(buildWorkspaceUrl(workspaceSlug), "Aceync workspace")}`),
  );

  return {
    text: "Recent Aceync activity",
    blocks,
  };
}

async function buildSearchMessage(
  workspaceId: string,
  workspaceSlug: string,
  query: string,
): Promise<SlackMessage> {
  const result = await getWorkspaceSearchExplorer({ workspaceId, q: query });
  const artifactLines = result.artifacts.slice(0, 4).map((artifact) => {
    const url = buildArtifactUrl(workspaceSlug, artifact.id);
    const summary = artifact.summary_excerpt ? truncateText(cleanText(artifact.summary_excerpt), 120) : "Open in Aceync";
    const meta = [artifact.browse_group_name, `updated ${formatShortDate(artifact.updated_at)}`].join(" · ");
    return `• ${slackLink(url, artifact.title)} · ${escapeSlackText(meta)}\n${escapeSlackText(summary)}`;
  });
  const blockLines = result.blocks.slice(0, 4).map((block) => {
    const url = buildArtifactUrl(workspaceSlug, block.artifact_id);
    const blockLabel = block.block_title?.trim() || titleCase(block.block_type);
    const excerpt = truncateText(cleanText(block.content_excerpt), 120) || "Open block in Aceync";
    return `• ${slackLink(url, block.artifact_title)} → *${escapeSlackText(blockLabel)}*\n${escapeSlackText(excerpt)}`;
  });

  const blocks: SlackBlock[] = [sectionBlock(`*Search Aceync*\nResults for “${escapeSlackText(query)}”`)];

  if (artifactLines.length > 0) {
    blocks.push(sectionBlock(`*Artifacts*\n${artifactLines.join("\n")}`));
  }

  if (blockLines.length > 0) {
    blocks.push(sectionBlock(`*Matching blocks*\n${blockLines.join("\n")}`));
  }

  if (!artifactLines.length && !blockLines.length) {
    blocks.push(
      sectionBlock(
        "No matches yet. Try a shorter query, a block title, or `/aceync recent` to jump back into current work.",
      ),
    );
  }

  blocks.push(
    contextBlock(`Search from a mention too: \`@Aceync search ${query}\``),
  );

  return {
    text: `Aceync search results for "${query}"`,
    blocks,
  };
}

function buildHelpMessage(workspaceSlug: string): SlackMessage {
  return {
    text: "Aceync is available in Slack.",
    blocks: [
      sectionBlock(
        `*Aceync in Slack*\nAccess your workspace from the channel with search, recent activity, capture, and review tools.`,
      ),
      sectionBlock(
        [
          "• `/aceync search <query>` to find artifacts and blocks",
          "• `/aceync recent` to see the latest artifacts and open review requests",
          "• `/aceync record` to capture audio or upload a recording/video from Slack",
          "• `/aceync note <text>` to save a note into Aceync",
          "• `/aceync request` to open the review-request modal",
          "• `@Aceync search <query>` works from conversation too",
        ].join("\n"),
      ),
      contextBlock(
        `Share an Aceync artifact or review-request link in Slack to preview it automatically. ${slackLink(buildWorkspaceUrl(workspaceSlug), "Open workspace")}`,
      ),
    ],
  };
}

async function buildCaptureMessage(input: {
  workspaceId: string;
  workspaceSlug: string;
  slackTeamId?: string;
  channelId?: string;
  slackUserId?: string;
}): Promise<SlackMessage> {
  const workspaceUrl = buildWorkspaceUrl(input.workspaceSlug);
  const captureUrl =
    input.slackTeamId && input.channelId && input.slackUserId
      ? await buildSlackCaptureUrl({
          workspaceId: input.workspaceId,
          workspaceSlug: input.workspaceSlug,
          slackTeamId: input.slackTeamId,
          channelId: input.channelId,
          slackUserId: input.slackUserId,
        })
      : `${workspaceUrl}/capture`;

  return {
    text: "Open Aceync capture",
    blocks: [
      sectionBlock(
        "*Capture into Aceync*\nRecord a voice note right away, or upload an existing audio/video file from your device. It will land in this workspace and flow into the normal transcription pipeline.",
      ),
      actionsBlock([
        linkButton({
          text: "Open recorder",
          url: captureUrl,
          style: "primary",
        }),
        linkButton({
          text: "Open workspace",
          url: workspaceUrl,
        }),
      ]),
      contextBlock("Best for voice memos, meeting clips, and quick selfie-video updates with audio."),
    ],
  };
}

function buildArtifactUnfurl(input: {
  url: string;
  title: string;
  status: string;
  updatedAt: string;
  blocks: Array<{ title: string | null; type: string; content_md: string }>;
}): MessageAttachment {
  const highlights = input.blocks
    .filter((block) => block.title || cleanText(block.content_md))
    .slice(0, 3)
    .map((block) => {
      const label = block.title?.trim() || titleCase(block.type);
      const excerpt = truncateText(cleanText(block.content_md), 90);
      return `• *${escapeSlackText(label)}*${excerpt ? `: ${escapeSlackText(excerpt)}` : ""}`;
    });

  const blocks: SlackBlock[] = [
    sectionBlock(
      `*Artifact*\n${slackLink(input.url, input.title)}\n${escapeSlackText(
        `Status: ${input.status} · Updated ${formatShortDate(input.updatedAt)}`,
      )}`,
    ),
  ];

  if (highlights.length > 0) {
    blocks.push(sectionBlock(`*Highlights*\n${highlights.join("\n")}`));
  }

  return {
    fallback: `Artifact: ${input.title}`,
    text: `Artifact: ${input.title}`,
    blocks,
  };
}

function buildReviewRequestUnfurl(input: {
  url: string;
  title: string;
  artifactTitle: string;
  status: string;
  dueAt: string | null;
  questions: string[];
}): MessageAttachment {
  const blocks: SlackBlock[] = [
    sectionBlock(
      `*Review request*\n${slackLink(input.url, input.title)}\n${escapeSlackText(
        `Artifact: ${input.artifactTitle} · Status: ${input.status}${input.dueAt ? ` · Due ${formatShortDate(input.dueAt)}` : ""}`,
      )}`,
    ),
  ];

  if (input.questions.length > 0) {
    blocks.push(
      sectionBlock(
        `*Questions*\n${input.questions
          .slice(0, 3)
          .map((question) => `• ${escapeSlackText(question)}`)
          .join("\n")}`,
      ),
    );
  }

  return {
    fallback: `Review request: ${input.title}`,
    text: `Review request: ${input.title}`,
    blocks,
  };
}

function buildWorkspaceUrl(workspaceSlug: string) {
  return `${getEnv().APP_BASE_URL}/w/${workspaceSlug}`;
}

function buildArtifactUrl(workspaceSlug: string, artifactId: string) {
  return `${buildWorkspaceUrl(workspaceSlug)}/artifacts/${artifactId}`;
}

function buildReviewRequestUrl(workspaceSlug: string, reviewRequestId: string) {
  return `${buildWorkspaceUrl(workspaceSlug)}/review-requests/${reviewRequestId}`;
}

function parseLoopSharedUrl(input: string): LoopSharedUrl | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const artifactMatch = url.pathname.match(/^\/w\/([^/]+)\/artifacts\/([0-9a-f-]{36})\/?$/i);
  if (artifactMatch) {
    return { kind: "artifact", workspaceSlug: artifactMatch[1], artifactId: artifactMatch[2] };
  }

  const reviewRequestMatch = url.pathname.match(/^\/w\/([^/]+)\/review-requests\/([0-9a-f-]{36})\/?$/i);
  if (reviewRequestMatch) {
    return {
      kind: "review_request",
      workspaceSlug: reviewRequestMatch[1],
      reviewRequestId: reviewRequestMatch[2],
    };
  }

  return null;
}

function normalizeQuestions(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function cleanText(input: string) {
  return input
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_>#~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(input: string, max = 140) {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1).trimEnd()}…`;
}

function formatShortDate(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "recently";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function escapeSlackText(input: string) {
  return input.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function slackLink(url: string, label: string) {
  return `<${url}|${escapeSlackText(label)}>`;
}

function actionsBlock(elements: SlackBlock[]) {
  return {
    type: "actions",
    elements,
  } as SlackBlock;
}

function linkButton(input: { text: string; url: string; style?: "primary" | "danger" }) {
  return {
    type: "button",
    text: {
      type: "plain_text",
      text: input.text,
      emoji: true,
    },
    url: input.url,
    ...(input.style ? { style: input.style } : {}),
  } as SlackBlock;
}

function sectionBlock(text: string): SlackBlock {
  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text,
    },
  } as SlackBlock;
}

function contextBlock(text: string): SlackBlock {
  return {
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text,
      },
    ],
  } as SlackBlock;
}

function titleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

async function buildSlackCaptureUrl(input: {
  workspaceId: string;
  workspaceSlug: string;
  slackTeamId: string;
  channelId: string;
  slackUserId: string;
}) {
  const token = await createSlackCaptureToken(input);
  const url = new URL(`${buildWorkspaceUrl(input.workspaceSlug)}/capture`);
  url.searchParams.set("slackCapture", token);
  return url.toString();
}
