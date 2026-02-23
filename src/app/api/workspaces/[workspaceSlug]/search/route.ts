import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";

export async function GET(request: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length === 0) return json({ artifacts: [], blocks: [] });

  const results = await withClient(async (client) => {
    const artifacts = await client.query<{ id: string; title: string; status: string; updated_at: string }>(
      `select id, title, status, updated_at
       from artifacts
       where workspace_id = $1 and title ilike '%' || $2 || '%'
       order by updated_at desc
       limit 20`,
      [session.workspaceId, q],
    );

    const blocks = await client.query<{
      block_id: string;
      block_title: string | null;
      block_type: string;
      artifact_id: string;
      artifact_title: string;
    }>(
      `select
         b.id as block_id,
         b.title as block_title,
         b.type as block_type,
         a.id as artifact_id,
         a.title as artifact_title
       from artifact_blocks b
       join artifacts a on a.id = b.artifact_id
       where a.workspace_id = $1
         and (
           (b.title is not null and b.title ilike '%' || $2 || '%')
           or b.content_md ilike '%' || $2 || '%'
         )
       order by a.updated_at desc, b.position asc
       limit 50`,
      [session.workspaceId, q],
    );

    return { artifacts: artifacts.rows, blocks: blocks.rows };
  });

  return json(results);
}

