import type pg from "pg";

export type FeedbackType = "concern" | "support" | "question" | "risk" | "suggestion" | "note";
export type FeedbackStatus = "open" | "accepted" | "rejected" | "resolved";
export type FeedbackSeverity = "low" | "medium" | "high" | "critical";

export type DbFeedbackItem = {
  id: string;
  workspace_id: string;
  artifact_id: string;
  block_id: string | null;
  type: FeedbackType;
  severity: FeedbackSeverity;
  status: FeedbackStatus;
  summary: string;
  detail_md: string;
  created_by: string | null;
  created_from_contribution_id: string | null;
  resolved_by: string | null;
  resolution_note_md: string | null;
  created_at: string;
  resolved_at: string | null;
};

export async function createFeedbackItem(
  client: pg.PoolClient,
  input: {
    workspaceId: string;
    artifactId: string;
    blockId?: string | null;
    type: FeedbackType;
    severity?: FeedbackSeverity;
    summary: string;
    detailMd?: string;
    createdBy?: string | null;
    createdFromContributionId?: string | null;
  },
): Promise<{ id: string }> {
  const res = await client.query<{ id: string }>(
    `insert into feedback_items (
      workspace_id, artifact_id, block_id, type, severity, status,
      summary, detail_md, created_by, created_from_contribution_id
    ) values (
      $1, $2, $3, $4::feedback_type, $5::feedback_severity, 'open',
      $6, $7, $8, $9
    ) returning id`,
    [
      input.workspaceId,
      input.artifactId,
      input.blockId ?? null,
      input.type,
      input.severity ?? "low",
      input.summary,
      input.detailMd ?? "",
      input.createdBy ?? null,
      input.createdFromContributionId ?? null,
    ],
  );
  return res.rows[0];
}

export async function listFeedbackForArtifact(
  client: pg.PoolClient,
  input: { workspaceId: string; artifactId: string; includeClosed?: boolean },
): Promise<
  Array<
    Pick<
      DbFeedbackItem,
      | "id"
      | "artifact_id"
      | "block_id"
      | "type"
      | "severity"
      | "status"
      | "summary"
      | "detail_md"
      | "created_by"
      | "created_from_contribution_id"
      | "created_at"
      | "resolved_at"
    > & {
      block_title: string | null;
      created_by_name: string | null;
    }
  >
> {
  const includeClosed = input.includeClosed ?? false;
  const res = await client.query<
    Pick<
      DbFeedbackItem,
      | "id"
      | "artifact_id"
      | "block_id"
      | "type"
      | "severity"
      | "status"
      | "summary"
      | "detail_md"
      | "created_by"
      | "created_from_contribution_id"
      | "created_at"
      | "resolved_at"
    > & {
      block_title: string | null;
      created_by_name: string | null;
    }
  >(
    `select
       f.id,
       f.artifact_id,
       f.block_id,
       f.type,
       f.severity,
       f.status,
       f.summary,
       f.detail_md,
       f.created_by,
       f.created_from_contribution_id,
       f.created_at,
       f.resolved_at,
       b.title as block_title,
       u.name as created_by_name
     from feedback_items f
     left join artifact_blocks b on b.id = f.block_id
     left join users u on u.id = f.created_by
     where f.workspace_id = $1
       and f.artifact_id = $2
       and ($3::boolean = true or f.status = 'open')
     order by f.created_at desc`,
    [input.workspaceId, input.artifactId, includeClosed],
  );
  return res.rows;
}

export async function getFeedbackItem(
  client: pg.PoolClient,
  input: { workspaceId: string; artifactId: string; feedbackItemId: string },
): Promise<DbFeedbackItem | null> {
  const res = await client.query<DbFeedbackItem>(
    `select *
     from feedback_items
     where workspace_id = $1 and artifact_id = $2 and id = $3`,
    [input.workspaceId, input.artifactId, input.feedbackItemId],
  );
  return res.rows[0] ?? null;
}

export async function setFeedbackStatus(
  client: pg.PoolClient,
  input: {
    workspaceId: string;
    artifactId: string;
    feedbackItemId: string;
    status: FeedbackStatus;
    resolvedBy?: string | null;
    resolutionNoteMd?: string | null;
  },
) {
  const shouldResolve = input.status !== "open";
  await client.query(
    `update feedback_items
     set status = $1::feedback_status,
         resolved_by = case when $2::boolean then $3 else null end,
         resolved_at = case when $2::boolean then now() else null end,
         resolution_note_md = case when $2::boolean then $4 else null end
     where workspace_id = $5 and artifact_id = $6 and id = $7`,
    [
      input.status,
      shouldResolve,
      input.resolvedBy ?? null,
      input.resolutionNoteMd ?? null,
      input.workspaceId,
      input.artifactId,
      input.feedbackItemId,
    ],
  );
}

export async function listFeedbackForContribution(
  client: pg.PoolClient,
  input: { workspaceId: string; contributionId: string },
): Promise<Array<Pick<DbFeedbackItem, "id">>> {
  const res = await client.query<Pick<DbFeedbackItem, "id">>(
    `select id
     from feedback_items
     where workspace_id = $1 and created_from_contribution_id = $2`,
    [input.workspaceId, input.contributionId],
  );
  return res.rows;
}
