import type pg from "pg";

import { getContributionForWorkspace } from "@/src/server/repo/contributions";
import {
  createFeedbackItem,
  getFeedbackItem,
  listFeedbackForContribution,
  listFeedbackForArtifact,
  setFeedbackStatus,
} from "@/src/server/repo/feedbackItems";
import { getBlockWithContent, listBlocks, updateBlockContent } from "@/src/server/repo/artifacts";
import { getReviewRequest, listReviewRequestTargets } from "@/src/server/repo/reviewRequests";
import { getReviewResponseByContributionId } from "@/src/server/repo/reviewResponses";

export type SuggestionPayload = {
  kind: "suggestion" | "question";
  reviewRequestId: string;
  contributionId: string;
  originalText: string;
  suggestedText: string;
  applyMode: "replace" | "append";
};

export function encodeSuggestionPayload(payload: SuggestionPayload) {
  return JSON.stringify(payload);
}

export function decodeSuggestionPayload(detailMd: string): SuggestionPayload | null {
  const text = (detailMd ?? "").trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as Partial<SuggestionPayload>;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.kind !== "suggestion" && parsed.kind !== "question") return null;
    if (typeof parsed.reviewRequestId !== "string" || !parsed.reviewRequestId) return null;
    if (typeof parsed.contributionId !== "string" || !parsed.contributionId) return null;
    if (typeof parsed.originalText !== "string") return null;
    if (typeof parsed.suggestedText !== "string") return null;
    if (parsed.applyMode !== "replace" && parsed.applyMode !== "append") return null;
    return {
      kind: parsed.kind,
      reviewRequestId: parsed.reviewRequestId,
      contributionId: parsed.contributionId,
      originalText: parsed.originalText,
      suggestedText: parsed.suggestedText,
      applyMode: parsed.applyMode,
    };
  } catch {
    return null;
  }
}

export async function maybeCreateSuggestionsFromContribution(
  client: pg.PoolClient,
  input: { workspaceId: string; contributionId: string },
): Promise<{ created: number }> {
  const existing = await listFeedbackForContribution(client, {
    workspaceId: input.workspaceId,
    contributionId: input.contributionId,
  });
  if (existing.length > 0) return { created: 0 };

  const response = await getReviewResponseByContributionId(client, {
    workspaceId: input.workspaceId,
    contributionId: input.contributionId,
  });
  if (!response) return { created: 0 };

  const reviewRequest = await getReviewRequest(client, input.workspaceId, response.review_request_id);
  if (!reviewRequest) return { created: 0 };

  const contribution = await getContributionForWorkspace(client, input.workspaceId, input.contributionId);
  if (!contribution) return { created: 0 };

  const sourceText = (contribution.transcript ?? contribution.text_content ?? "").trim();
  if (!sourceText) return { created: 0 };

  const allBlocks = await listBlocks(client, reviewRequest.artifact_id);
  if (allBlocks.length === 0) return { created: 0 };
  const targets = await listReviewRequestTargets(client, reviewRequest.id);
  const targetBlocks =
    targets.length > 0 ? allBlocks.filter((block) => targets.includes(block.id)) : [allBlocks[0]];

  let created = 0;
  const kind = contribution.intent === "question" ? "question" : "suggestion";

  for (const block of targetBlocks.slice(0, 4)) {
    const originalText = excerptOriginal(block.content_md);
    const suggestedText = excerptSuggestion(sourceText);
    const payload: SuggestionPayload = {
      kind,
      reviewRequestId: reviewRequest.id,
      contributionId: contribution.id,
      originalText,
      suggestedText,
      applyMode: originalText ? "replace" : "append",
    };

    await createFeedbackItem(client, {
      workspaceId: input.workspaceId,
      artifactId: reviewRequest.artifact_id,
      blockId: block.id,
      type: kind === "question" ? "question" : "suggestion",
      severity: "low",
      summary:
        kind === "question"
          ? `Question on ${block.title ?? block.type}`
          : `Suggested change for ${block.title ?? block.type}`,
      detailMd: encodeSuggestionPayload(payload),
      createdBy: contribution.created_by,
      createdFromContributionId: contribution.id,
    });
    created += 1;
  }

  return { created };
}

export async function listArtifactSuggestions(
  client: pg.PoolClient,
  input: { workspaceId: string; artifactId: string; includeClosed?: boolean },
) {
  const rows = await listFeedbackForArtifact(client, input);
  return rows.map((row) => {
    const payload = decodeSuggestionPayload(row.detail_md);
    return {
      id: row.id,
      artifactId: row.artifact_id,
      blockId: row.block_id,
      blockTitle: row.block_title,
      type: row.type,
      status: row.status,
      summary: row.summary,
      severity: row.severity,
      createdAt: row.created_at,
      createdByName: row.created_by_name,
      payload,
    };
  });
}

export async function applySuggestionDecision(
  client: pg.PoolClient,
  input: {
    workspaceId: string;
    artifactId: string;
    feedbackItemId: string;
    action: "accept" | "decline";
    userId: string;
  },
): Promise<{ ok: boolean; updatedBlockId: string | null }> {
  const item = await getFeedbackItem(client, {
    workspaceId: input.workspaceId,
    artifactId: input.artifactId,
    feedbackItemId: input.feedbackItemId,
  });
  if (!item) return { ok: false, updatedBlockId: null };
  if (item.status !== "open") return { ok: true, updatedBlockId: null };

  if (input.action === "decline") {
    await setFeedbackStatus(client, {
      workspaceId: input.workspaceId,
      artifactId: input.artifactId,
      feedbackItemId: input.feedbackItemId,
      status: "rejected",
      resolvedBy: input.userId,
      resolutionNoteMd: "Declined",
    });
    return { ok: true, updatedBlockId: null };
  }

  const payload = decodeSuggestionPayload(item.detail_md);
  let updatedBlockId: string | null = null;

  if (item.type === "suggestion" && item.block_id && payload?.suggestedText?.trim()) {
    const block = await getBlockWithContent(client, {
      workspaceId: input.workspaceId,
      artifactId: input.artifactId,
      blockId: item.block_id,
    });
    if (block) {
      const nextContent = applySuggestionToText(
        block.content_md,
        payload.originalText,
        payload.suggestedText,
        payload.applyMode,
      );
      if (nextContent !== block.content_md) {
        await updateBlockContent(client, {
          workspaceId: input.workspaceId,
          blockId: block.id,
          contentMd: nextContent,
          userId: input.userId,
        });
        updatedBlockId = block.id;
      }
    }
  }

  await setFeedbackStatus(client, {
    workspaceId: input.workspaceId,
    artifactId: input.artifactId,
    feedbackItemId: input.feedbackItemId,
    status: "accepted",
    resolvedBy: input.userId,
    resolutionNoteMd: "Accepted",
  });
  return { ok: true, updatedBlockId };
}

function excerptOriginal(content: string) {
  const text = content.trim();
  if (!text) return "";
  const firstParagraph = text.split(/\n\s*\n/)[0]?.trim() ?? "";
  return firstParagraph.slice(0, 260);
}

function excerptSuggestion(source: string) {
  const text = source.trim();
  if (!text) return "";
  return text.slice(0, 420);
}

function applySuggestionToText(
  current: string,
  originalText: string,
  suggestedText: string,
  mode: "replace" | "append",
) {
  const original = originalText.trim();
  const suggested = suggestedText.trim();
  if (!suggested) return current;

  if (mode === "replace" && original && current.includes(original)) {
    return current.replace(original, suggested);
  }

  const section = [
    "#### Accepted suggestion",
    original ? `~~${original}~~` : null,
    suggested,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!current.trim()) return section;
  return `${current.trimEnd()}\n\n${section}`;
}
