import path from "node:path";

import { getAiProvider } from "@/src/server/ai";
import { withClient } from "@/src/server/db";
import { JOB_TYPES } from "@/src/server/jobs/jobTypes";
import { getContribution, updateContributionTranscript } from "@/src/server/repo/contributions";
import { pathToMimeType } from "@/src/server/storage";
import { getJobById, markJobFailed, markJobRunning, markJobSucceeded } from "@/src/server/repo/jobs";
import type { DbJob } from "@/src/server/repo/jobs";
import { maybeCreateSuggestionsFromContribution } from "@/src/server/services/feedbackSuggestionService";

function getContributionId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const maybe = (payload as Record<string, unknown>).contributionId;
  return typeof maybe === "string" && maybe.length ? maybe : null;
}

export async function runJobById(jobId: string, options?: { allowRetry?: boolean }) {
  const job = await withClient((client) => getJobById(client, jobId));
  if (!job) return false;
  if (job.status !== "queued") return false;
  const running = await withClient((client) => markJobRunning(client, jobId));
  if (!running) return false;
  return processJob(running, options);
}

export async function processJob(job: DbJob, options?: { allowRetry?: boolean }) {
  try {
    if (job.type === JOB_TYPES.TRANSCRIBE_CONTRIBUTION) {
      const contributionId = getContributionId(job.payload_json);
      if (!contributionId) throw new Error("Missing contributionId");

      const ai = getAiProvider();
      const contribution = await withClient((client) => getContribution(client, job.workspace_id, contributionId));
      if (!contribution) throw new Error("Contribution not found");
      if (!contribution.audio_path) throw new Error("Contribution has no audio_path");

      const absolutePath = path.join(process.cwd(), contribution.audio_path);
      const transcription = await ai.transcribeAudio({
        absolutePath,
        mimeType: pathToMimeType(contribution.audio_path),
      });
      const classification = await ai.classifyText({ text: transcription.transcript });

      await withClient((client) =>
        updateContributionTranscript(client, {
          workspaceId: job.workspace_id,
          contributionId,
          transcript: transcription.transcript,
          intent: classification.intent,
          intentConfidence: classification.confidence,
          extractedJson: classification.extractedJson,
        }),
      );

      await withClient((client) =>
        maybeCreateSuggestionsFromContribution(client, {
          workspaceId: job.workspace_id,
          contributionId,
        }),
      );

      await withClient((client) => markJobSucceeded(client, job.id));
      return true;
    }

    if (job.type === JOB_TYPES.CLASSIFY_CONTRIBUTION) {
      const contributionId = getContributionId(job.payload_json);
      if (!contributionId) throw new Error("Missing contributionId");

      const ai = getAiProvider();
      const contribution = await withClient((client) => getContribution(client, job.workspace_id, contributionId));
      if (!contribution) throw new Error("Contribution not found");

      const text = (contribution.transcript ?? contribution.text_content ?? "").trim();
      const classification = await ai.classifyText({ text });

      await withClient((client) =>
        updateContributionTranscript(client, {
          workspaceId: job.workspace_id,
          contributionId,
          transcript: contribution.transcript ?? contribution.text_content ?? "",
          intent: classification.intent,
          intentConfidence: classification.confidence,
          extractedJson: classification.extractedJson,
        }),
      );

      await withClient((client) =>
        maybeCreateSuggestionsFromContribution(client, {
          workspaceId: job.workspace_id,
          contributionId,
        }),
      );

      await withClient((client) => markJobSucceeded(client, job.id));
      return true;
    }

    throw new Error(`Unknown job type: ${job.type}`);
  } catch (err) {
    const allowRetry = options?.allowRetry ?? false;
    const message = err instanceof Error ? err.message : "Job failed";
    const retrySeconds = Math.min(60, Math.pow(2, Math.min(job.attempts, 6)));
    const retryAt = allowRetry && job.attempts < 5 ? new Date(Date.now() + retrySeconds * 1000) : undefined;
    await withClient((client) =>
      markJobFailed(client, {
        jobId: job.id,
        error: message,
        retryAt,
      }),
    );
    return false;
  }
}
