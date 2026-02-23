import type pg from "pg";

export type DbReviewResponse = {
  id: string;
  review_request_id: string;
  contribution_id: string;
  user_id: string | null;
  created_at: string;
};

export async function createReviewResponse(
  client: pg.PoolClient,
  input: { reviewRequestId: string; contributionId: string; userId: string | null },
): Promise<{ id: string }> {
  const res = await client.query<{ id: string }>(
    `insert into review_responses (review_request_id, contribution_id, user_id)
     values ($1, $2, $3)
     returning id`,
    [input.reviewRequestId, input.contributionId, input.userId],
  );
  return res.rows[0];
}

export async function listResponsesForRequest(
  client: pg.PoolClient,
  workspaceId: string,
  reviewRequestId: string,
): Promise<
  Array<{
    id: string;
    created_at: string;
    contribution_id: string;
    source: string;
    text_content: string | null;
    transcript: string | null;
    intent: string;
    intent_confidence: number | null;
    audio_path: string | null;
  }>
> {
  const res = await client.query<{
    id: string;
    created_at: string;
    contribution_id: string;
    source: string;
    text_content: string | null;
    transcript: string | null;
    intent: string;
    intent_confidence: number | null;
    audio_path: string | null;
  }>(
    `select
       rr.id,
       rr.created_at,
       rr.contribution_id,
       c.source,
       c.text_content,
       c.transcript,
       c.intent,
       c.intent_confidence,
       c.audio_path
     from review_responses rr
     join contributions c on c.id = rr.contribution_id
     join review_requests r on r.id = rr.review_request_id
     where r.workspace_id = $1 and rr.review_request_id = $2
     order by rr.created_at desc`,
    [workspaceId, reviewRequestId],
  );
  return res.rows;
}

export async function getReviewResponseByContributionId(
  client: pg.PoolClient,
  input: { workspaceId: string; contributionId: string },
): Promise<
  | {
      id: string;
      review_request_id: string;
      contribution_id: string;
      user_id: string | null;
    }
  | null
> {
  const res = await client.query<{
    id: string;
    review_request_id: string;
    contribution_id: string;
    user_id: string | null;
  }>(
    `select rr.id, rr.review_request_id, rr.contribution_id, rr.user_id
     from review_responses rr
     join review_requests r on r.id = rr.review_request_id
     where r.workspace_id = $1 and rr.contribution_id = $2
     limit 1`,
    [input.workspaceId, input.contributionId],
  );
  return res.rows[0] ?? null;
}
