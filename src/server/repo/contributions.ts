import type pg from "pg";

export type ContributionIntent = "idea" | "feedback" | "risk" | "assumption" | "question" | "unknown";
export type ContributionSource = "web_audio" | "web_text" | "slack" | "meeting";

export type DbContribution = {
  id: string;
  workspace_id: string;
  artifact_id: string | null;
  block_id: string | null;
  source: ContributionSource;
  source_ref: string | null;
  audio_path: string | null;
  text_content: string | null;
  transcript: string | null;
  intent: ContributionIntent;
  intent_confidence: number | null;
  extracted_json: unknown | null;
  created_by: string | null;
  created_at: string;
};

export async function createContribution(
  client: pg.PoolClient,
  input: {
    workspaceId: string;
    artifactId?: string | null;
    blockId?: string | null;
    source: ContributionSource;
    sourceRef?: string | null;
    audioPath?: string | null;
    textContent?: string | null;
    transcript?: string | null;
    intent?: ContributionIntent;
    intentConfidence?: number | null;
    extractedJson?: unknown | null;
    createdBy?: string | null;
  },
): Promise<{ id: string }> {
  const res = await client.query<{ id: string }>(
    `insert into contributions (
        workspace_id, artifact_id, block_id, source, source_ref,
        audio_path, text_content, transcript,
        intent, intent_confidence, extracted_json, created_by
      ) values (
        $1, $2, $3, $4::contribution_source, $5,
        $6, $7, $8,
        $9::contribution_intent, $10, $11::jsonb, $12
      )
      returning id`,
    [
      input.workspaceId,
      input.artifactId ?? null,
      input.blockId ?? null,
      input.source,
      input.sourceRef ?? null,
      input.audioPath ?? null,
      input.textContent ?? null,
      input.transcript ?? null,
      input.intent ?? "unknown",
      input.intentConfidence ?? null,
      input.extractedJson ? JSON.stringify(input.extractedJson) : null,
      input.createdBy ?? null,
    ],
  );
  return res.rows[0];
}

export async function getContribution(
  client: pg.PoolClient,
  workspaceId: string,
  contributionId: string,
): Promise<DbContribution | null> {
  const res = await client.query<DbContribution>(
    `select *
     from contributions
     where workspace_id = $1 and id = $2`,
    [workspaceId, contributionId],
  );
  return res.rows[0] ?? null;
}

export async function updateContributionTranscript(
  client: pg.PoolClient,
  input: {
    workspaceId: string;
    contributionId: string;
    transcript: string;
    intent: ContributionIntent;
    intentConfidence: number | null;
    extractedJson: unknown | null;
  },
) {
  await client.query(
    `update contributions
     set transcript = $1,
         intent = $2::contribution_intent,
         intent_confidence = $3,
         extracted_json = $4::jsonb
     where workspace_id = $5 and id = $6`,
    [
      input.transcript,
      input.intent,
      input.intentConfidence,
      input.extractedJson ? JSON.stringify(input.extractedJson) : null,
      input.workspaceId,
      input.contributionId,
    ],
  );
}

export async function listInboxContributions(
  client: pg.PoolClient,
  workspaceId: string,
): Promise<
  Array<{
    id: string;
    source: string;
    created_at: string;
    audio_path: string | null;
    text_content: string | null;
    transcript: string | null;
    intent: ContributionIntent;
    intent_confidence: number | null;
  }>
> {
  const res = await client.query<{
    id: string;
    source: string;
    created_at: string;
    audio_path: string | null;
    text_content: string | null;
    transcript: string | null;
    intent: ContributionIntent;
    intent_confidence: number | null;
  }>(
    `select id, source, created_at, audio_path, text_content, transcript, intent, intent_confidence
     from contributions
     where workspace_id = $1 and artifact_id is null
     order by created_at desc
     limit 100`,
    [workspaceId],
  );
  return res.rows;
}

export async function linkContributionToArtifact(
  client: pg.PoolClient,
  input: { workspaceId: string; contributionId: string; artifactId: string },
) {
  await client.query(
    `update contributions
     set artifact_id = $1
     where workspace_id = $2 and id = $3`,
    [input.artifactId, input.workspaceId, input.contributionId],
  );
}

export async function getContributionForWorkspace(
  client: pg.PoolClient,
  workspaceId: string,
  contributionId: string,
): Promise<DbContribution | null> {
  const res = await client.query<DbContribution>(
    `select *
     from contributions
     where workspace_id = $1 and id = $2`,
    [workspaceId, contributionId],
  );
  return res.rows[0] ?? null;
}

export async function getContributionBySourceRef(
  client: pg.PoolClient,
  input: { workspaceId: string; sourceRef: string },
): Promise<DbContribution | null> {
  const res = await client.query<DbContribution>(
    `select *
     from contributions
     where workspace_id = $1 and source_ref = $2
     limit 1`,
    [input.workspaceId, input.sourceRef],
  );
  return res.rows[0] ?? null;
}
