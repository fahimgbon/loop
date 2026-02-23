import type pg from "pg";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export type DbJob = {
  id: string;
  workspace_id: string;
  type: string;
  payload_json: unknown;
  status: JobStatus;
  run_at: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export async function getJobById(client: pg.PoolClient, jobId: string): Promise<DbJob | null> {
  const res = await client.query<DbJob>(`select * from jobs where id = $1`, [jobId]);
  return res.rows[0] ?? null;
}

export async function enqueueJob(
  client: pg.PoolClient,
  input: { workspaceId: string; type: string; payload: unknown; runAt?: Date },
): Promise<{ id: string }> {
  const res = await client.query<{ id: string }>(
    `insert into jobs (workspace_id, type, payload_json, run_at)
     values ($1, $2, $3::jsonb, $4)
     returning id`,
    [
      input.workspaceId,
      input.type,
      JSON.stringify(input.payload),
      input.runAt ? input.runAt.toISOString() : new Date().toISOString(),
    ],
  );
  return res.rows[0];
}

export async function markJobRunning(client: pg.PoolClient, jobId: string): Promise<DbJob | null> {
  const res = await client.query<DbJob>(
    `update jobs
     set status = 'running', attempts = attempts + 1, updated_at = now()
     where id = $1 and status = 'queued'
     returning *`,
    [jobId],
  );
  return res.rows[0] ?? null;
}

export async function claimNextJob(client: pg.PoolClient): Promise<DbJob | null> {
  const res = await client.query<DbJob>(
    `update jobs
     set status = 'running', attempts = attempts + 1, updated_at = now()
     where id = (
       select id from jobs
       where status = 'queued' and run_at <= now()
       order by run_at asc
       limit 1
       for update skip locked
     )
     returning *`,
  );
  return res.rows[0] ?? null;
}

export async function markJobSucceeded(client: pg.PoolClient, jobId: string) {
  await client.query(`update jobs set status = 'succeeded', updated_at = now() where id = $1`, [
    jobId,
  ]);
}

export async function markJobFailed(
  client: pg.PoolClient,
  input: { jobId: string; error: string; retryAt?: Date },
) {
  if (input.retryAt) {
    await client.query(
      `update jobs
       set status = 'queued', run_at = $2, last_error = $3, updated_at = now()
       where id = $1`,
      [input.jobId, input.retryAt.toISOString(), input.error],
    );
    return;
  }
  await client.query(
    `update jobs set status = 'failed', last_error = $2, updated_at = now() where id = $1`,
    [input.jobId, input.error],
  );
}
