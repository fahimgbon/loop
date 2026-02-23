import { withClient } from "@/src/server/db";
import { JOB_TYPES } from "@/src/server/jobs/jobTypes";
import { createContribution } from "@/src/server/repo/contributions";
import { enqueueJob } from "@/src/server/repo/jobs";
import { getReviewRequest } from "@/src/server/repo/reviewRequests";
import { createReviewResponse } from "@/src/server/repo/reviewResponses";
import { maybeRunJob } from "@/src/server/services/jobService";
import { maybeCreateSuggestionsFromContribution } from "@/src/server/services/feedbackSuggestionService";

export async function addTextReviewResponse(input: {
  workspaceId: string;
  reviewRequestId: string;
  userId: string;
  text: string;
}) {
  return withClient(async (client) => {
    await client.query("begin;");
    try {
      const req = await getReviewRequest(client, input.workspaceId, input.reviewRequestId);
      if (!req) return null;

      const contribution = await createContribution(client, {
        workspaceId: input.workspaceId,
        artifactId: req.artifact_id,
        source: "web_text",
        textContent: input.text,
        createdBy: input.userId,
      });

      await createReviewResponse(client, {
        reviewRequestId: input.reviewRequestId,
        contributionId: contribution.id,
        userId: input.userId,
      });

      await maybeCreateSuggestionsFromContribution(client, {
        workspaceId: input.workspaceId,
        contributionId: contribution.id,
      });

      const job = await enqueueJob(client, {
        workspaceId: input.workspaceId,
        type: JOB_TYPES.CLASSIFY_CONTRIBUTION,
        payload: { contributionId: contribution.id },
      });

      await client.query("commit;");
      await maybeRunJob(job.id);
      return { contributionId: contribution.id };
    } catch (err) {
      await client.query("rollback;");
      throw err;
    }
  });
}

export async function addAudioReviewResponse(input: {
  workspaceId: string;
  reviewRequestId: string;
  userId: string;
  audioPath: string;
}) {
  return withClient(async (client) => {
    await client.query("begin;");
    try {
      const req = await getReviewRequest(client, input.workspaceId, input.reviewRequestId);
      if (!req) return null;

      const contribution = await createContribution(client, {
        workspaceId: input.workspaceId,
        artifactId: req.artifact_id,
        source: "web_audio",
        audioPath: input.audioPath,
        createdBy: input.userId,
      });

      await createReviewResponse(client, {
        reviewRequestId: input.reviewRequestId,
        contributionId: contribution.id,
        userId: input.userId,
      });

      const job = await enqueueJob(client, {
        workspaceId: input.workspaceId,
        type: JOB_TYPES.TRANSCRIBE_CONTRIBUTION,
        payload: { contributionId: contribution.id },
      });

      await client.query("commit;");
      await maybeRunJob(job.id);
      return { contributionId: contribution.id };
    } catch (err) {
      await client.query("rollback;");
      throw err;
    }
  });
}
