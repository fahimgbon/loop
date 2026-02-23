import { withClient } from "@/src/server/db";
import { createReviewRequest } from "@/src/server/repo/reviewRequests";

export async function createReviewRequestForArtifact(input: {
  workspaceId: string;
  artifactId: string;
  title: string;
  questions: string[];
  dueAt?: string | null;
  blockIds?: string[] | null;
  createdBy: string | null;
}) {
  return withClient(async (client) => {
    return createReviewRequest(client, {
      workspaceId: input.workspaceId,
      artifactId: input.artifactId,
      title: input.title,
      questions: input.questions,
      dueAt: input.dueAt ?? null,
      blockIds: input.blockIds ?? null,
      createdBy: input.createdBy,
    });
  });
}

