import type pg from "pg";

export type AnnouncementSource =
  | "manual"
  | "announcement"
  | "google_classroom"
  | "google_form"
  | "google_meet"
  | "slack";

export type DbAnnouncement = {
  id: string;
  workspace_id: string;
  title: string;
  body_md: string;
  source: AnnouncementSource;
  source_ref: string | null;
  created_by: string | null;
  created_at: string;
};

export async function listAnnouncements(
  client: pg.PoolClient,
  workspaceId: string,
  limit = 100,
): Promise<
  Array<
    Pick<
      DbAnnouncement,
      "id" | "title" | "body_md" | "source" | "source_ref" | "created_at"
    > & {
      created_by_name: string | null;
      created_by_email: string | null;
    }
  >
> {
  try {
    const res = await client.query<
    Pick<
      DbAnnouncement,
      "id" | "title" | "body_md" | "source" | "source_ref" | "created_at"
    > & {
      created_by_name: string | null;
      created_by_email: string | null;
    }
  >(
    `select
       a.id,
       a.title,
       a.body_md,
       a.source,
       a.source_ref,
       a.created_at,
       u.name as created_by_name,
       u.email as created_by_email
     from announcements a
     left join users u on u.id = a.created_by
     where a.workspace_id = $1
     order by a.created_at desc
     limit $2`,
    [workspaceId, Math.max(1, Math.min(limit, 300))],
  );
    return res.rows;
  } catch (err) {
    if ((err as { code?: string })?.code === "42P01") return [];
    throw err;
  }
}

export async function createAnnouncement(
  client: pg.PoolClient,
  input: {
    workspaceId: string;
    title: string;
    bodyMd?: string;
    source?: AnnouncementSource;
    sourceRef?: string | null;
    createdBy?: string | null;
  },
): Promise<{ id: string }> {
  try {
    const res = await client.query<{ id: string }>(
      `insert into announcements (workspace_id, title, body_md, source, source_ref, created_by)
       values ($1, $2, $3, $4::announcement_source, $5, $6)
       returning id`,
      [
        input.workspaceId,
        input.title,
        input.bodyMd ?? "",
        input.source ?? "manual",
        input.sourceRef ?? null,
        input.createdBy ?? null,
      ],
    );
    return res.rows[0];
  } catch (err) {
    if ((err as { code?: string })?.code === "42P01") {
      throw new Error("Database is missing announcements tables. Run npm run db:migrate.");
    }
    throw err;
  }
}

export async function getAnnouncementBySourceRef(
  client: pg.PoolClient,
  input: { workspaceId: string; sourceRef: string },
): Promise<DbAnnouncement | null> {
  try {
    const res = await client.query<DbAnnouncement>(
      `select id, workspace_id, title, body_md, source, source_ref, created_by, created_at
       from announcements
       where workspace_id = $1 and source_ref = $2
       limit 1`,
      [input.workspaceId, input.sourceRef],
    );
    return res.rows[0] ?? null;
  } catch (err) {
    if ((err as { code?: string })?.code === "42P01") return null;
    throw err;
  }
}
