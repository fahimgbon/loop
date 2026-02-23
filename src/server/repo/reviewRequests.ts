import type pg from "pg";

export type DbReviewRequest = {
  id: string;
  workspace_id: string;
  artifact_id: string;
  title: string;
  questions: unknown;
  due_at: string | null;
  slack_channel_id: string | null;
  slack_message_ts: string | null;
  created_by: string | null;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
};

export async function createReviewRequest(
  client: pg.PoolClient,
  input: {
    workspaceId: string;
    artifactId: string;
    title: string;
    questions: string[];
    dueAt?: string | null;
    blockIds?: string[] | null;
    createdBy: string | null;
  },
): Promise<{ id: string }> {
  const res = await client.query<{ id: string }>(
    `insert into review_requests (
        workspace_id, artifact_id, title, questions, due_at, created_by
      ) values (
        $1, $2, $3, $4::jsonb, $5, $6
      ) returning id`,
    [
      input.workspaceId,
      input.artifactId,
      input.title,
      JSON.stringify(input.questions),
      input.dueAt ?? null,
      input.createdBy,
    ],
  );
  const id = res.rows[0].id;

  const blockIds = input.blockIds?.filter(Boolean) ?? [];
  for (const blockId of blockIds) {
    await client.query(
      `insert into review_request_targets (review_request_id, block_id) values ($1, $2)
       on conflict do nothing`,
      [id, blockId],
    );
  }

  return { id };
}

export async function listOpenReviewRequests(
  client: pg.PoolClient,
  workspaceId: string,
  artifactId?: string,
): Promise<Array<Pick<DbReviewRequest, "id" | "artifact_id" | "title" | "questions" | "due_at" | "created_at">>> {
  const res = await client.query<
    Pick<DbReviewRequest, "id" | "artifact_id" | "title" | "questions" | "due_at" | "created_at">
  >(
    `select id, artifact_id, title, questions, due_at, created_at
     from review_requests
     where workspace_id = $1 and status = 'open'
     ${artifactId ? "and artifact_id = $2" : ""}
     order by created_at desc
     limit 50`,
    artifactId ? [workspaceId, artifactId] : [workspaceId],
  );
  return res.rows;
}

export async function getReviewRequest(
  client: pg.PoolClient,
  workspaceId: string,
  reviewRequestId: string,
): Promise<DbReviewRequest | null> {
  const res = await client.query<DbReviewRequest>(
    `select *
     from review_requests
     where workspace_id = $1 and id = $2`,
    [workspaceId, reviewRequestId],
  );
  return res.rows[0] ?? null;
}

export async function listReviewRequestTargets(
  client: pg.PoolClient,
  reviewRequestId: string,
): Promise<string[]> {
  const res = await client.query<{ block_id: string }>(
    `select block_id from review_request_targets where review_request_id = $1`,
    [reviewRequestId],
  );
  return res.rows.map((r) => r.block_id);
}

export async function closeReviewRequest(
  client: pg.PoolClient,
  input: { workspaceId: string; reviewRequestId: string },
) {
  await client.query(
    `update review_requests set status = 'closed', updated_at = now()
     where workspace_id = $1 and id = $2`,
    [input.workspaceId, input.reviewRequestId],
  );
}

export async function setReviewRequestSlackLink(
  client: pg.PoolClient,
  input: { workspaceId: string; reviewRequestId: string; slackChannelId: string; slackMessageTs: string },
) {
  await client.query(
    `update review_requests
     set slack_channel_id = $1, slack_message_ts = $2, updated_at = now()
     where workspace_id = $3 and id = $4`,
    [input.slackChannelId, input.slackMessageTs, input.workspaceId, input.reviewRequestId],
  );
}
