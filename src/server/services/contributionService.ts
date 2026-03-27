import { withClient } from "@/src/server/db";
import { JOB_TYPES } from "@/src/server/jobs/jobTypes";
import { enqueueJob } from "@/src/server/repo/jobs";
import { createContribution } from "@/src/server/repo/contributions";
import { maybeRunJob } from "@/src/server/services/jobService";

export async function createWebTextContribution(input: {
  workspaceId: string;
  userId: string;
  artifactId?: string | null;
  blockId?: string | null;
  text: string;
  sourceRef?: string | null;
}) {
  return withClient(async (client) => {
    await client.query("begin;");
    try {
      const contribution = await createContribution(client, {
        workspaceId: input.workspaceId,
        artifactId: input.artifactId ?? null,
        blockId: input.blockId ?? null,
        source: "web_text",
        textContent: input.text,
        sourceRef: input.sourceRef ?? null,
        createdBy: input.userId,
      });

      const job = await enqueueJob(client, {
        workspaceId: input.workspaceId,
        type: JOB_TYPES.CLASSIFY_CONTRIBUTION,
        payload: { contributionId: contribution.id },
      });

      await client.query("commit;");
      await maybeRunJob(job.id);
      return contribution;
    } catch (err) {
      await client.query("rollback;");
      throw err;
    }
  });
}

export async function createWebAudioContribution(input: {
  workspaceId: string;
  userId: string;
  artifactId?: string | null;
  blockId?: string | null;
  audioPath: string;
}) {
  return withClient(async (client) => {
    await client.query("begin;");
    try {
      const contribution = await createContribution(client, {
        workspaceId: input.workspaceId,
        artifactId: input.artifactId ?? null,
        blockId: input.blockId ?? null,
        source: "web_audio",
        audioPath: input.audioPath,
        createdBy: input.userId,
      });

      const job = await enqueueJob(client, {
        workspaceId: input.workspaceId,
        type: JOB_TYPES.TRANSCRIBE_CONTRIBUTION,
        payload: { contributionId: contribution.id },
      });

      await client.query("commit;");
      await maybeRunJob(job.id);
      return contribution;
    } catch (err) {
      await client.query("rollback;");
      throw err;
    }
  });
}

export async function createSlackMediaContribution(input: {
  workspaceId: string;
  userId: string;
  audioPath: string;
  sourceRef: string;
}) {
  return withClient(async (client) => {
    await client.query("begin;");
    try {
      const contribution = await createContribution(client, {
        workspaceId: input.workspaceId,
        source: "slack",
        audioPath: input.audioPath,
        sourceRef: input.sourceRef,
        createdBy: input.userId,
      });

      const job = await enqueueJob(client, {
        workspaceId: input.workspaceId,
        type: JOB_TYPES.TRANSCRIBE_CONTRIBUTION,
        payload: { contributionId: contribution.id },
      });

      await client.query("commit;");
      await maybeRunJob(job.id);
      return contribution;
    } catch (err) {
      await client.query("rollback;");
      throw err;
    }
  });
}

export async function createMeetingTextContribution(input: {
  workspaceId: string;
  artifactId?: string | null;
  blockId?: string | null;
  sourceRef: string;
  text: string;
}) {
  return withClient(async (client) => {
    await client.query("begin;");
    try {
      const contribution = await createContribution(client, {
        workspaceId: input.workspaceId,
        artifactId: input.artifactId ?? null,
        blockId: input.blockId ?? null,
        source: "meeting",
        sourceRef: input.sourceRef,
        textContent: input.text,
        createdBy: null,
      });

      const job = await enqueueJob(client, {
        workspaceId: input.workspaceId,
        type: JOB_TYPES.CLASSIFY_CONTRIBUTION,
        payload: { contributionId: contribution.id },
      });

      await client.query("commit;");
      await maybeRunJob(job.id);
      return contribution;
    } catch (err) {
      await client.query("rollback;");
      throw err;
    }
  });
}
