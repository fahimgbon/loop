import "./loadEnv";

import bcrypt from "bcryptjs";
import pg from "pg";

import { getEnv } from "@/src/server/env";
import { upsertFolderBySlug } from "@/src/server/repo/folders";
import { slugify } from "@/src/server/slug";
import { defaultTemplates } from "@/src/server/templates/defaultTemplates";

function getSeedConfig() {
  return {
    workspaceSlug: process.env.SEED_WORKSPACE_SLUG ?? "demo",
    workspaceName: process.env.SEED_WORKSPACE_NAME ?? "Demo Workspace",
    adminName: process.env.SEED_ADMIN_NAME ?? "Admin",
    adminEmail: process.env.SEED_ADMIN_EMAIL ?? "admin@loop.local",
    adminPassword: process.env.SEED_ADMIN_PASSWORD ?? "admin",
  };
}

async function main() {
  const env = getEnv();
  const seed = getSeedConfig();
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("begin;");

    const workspaceRes = await client.query<{ id: string; slug: string }>(
      `select id, slug from workspaces where slug = $1`,
      [seed.workspaceSlug],
    );

    let workspaceId: string;
    if (workspaceRes.rowCount === 0) {
      const created = await client.query<{ id: string }>(
        `insert into workspaces (slug, name) values ($1, $2) returning id`,
        [seed.workspaceSlug, seed.workspaceName],
      );
      workspaceId = created.rows[0].id;
    } else {
      workspaceId = workspaceRes.rows[0].id;
    }

    const emailKey = seed.adminEmail.toLowerCase();
    const userRes = await client.query<{ id: string }>(
      `select id from users where lower(email) = $1`,
      [emailKey],
    );

    let userId: string;
    if (userRes.rowCount === 0) {
      const passwordHash = await bcrypt.hash(seed.adminPassword, 10);
      const created = await client.query<{ id: string }>(
        `insert into users (email, name, password_hash) values ($1, $2, $3) returning id`,
        [seed.adminEmail, seed.adminName, passwordHash],
      );
      userId = created.rows[0].id;
    } else {
      userId = userRes.rows[0].id;
    }

    await client.query(
      `insert into workspace_memberships (workspace_id, user_id, role)
       values ($1, $2, 'admin')
       on conflict (workspace_id, user_id) do update set role = excluded.role`,
      [workspaceId, userId],
    );

    for (const template of defaultTemplates) {
      await client.query(
        `insert into templates (workspace_id, slug, name, schema_json, created_by)
         values ($1, $2, $3, $4::jsonb, $5)
         on conflict (workspace_id, slug)
         do update set name = excluded.name, schema_json = excluded.schema_json, updated_at = now()`,
        [workspaceId, template.slug, template.name, JSON.stringify(template.schema), userId],
      );

      await upsertFolderBySlug(client, {
        workspaceId,
        slug: slugify(template.name),
        name: template.name,
        schemaJson: template.schema,
        createdBy: userId,
      });
    }

    const artifactRes = await client.query<{ id: string }>(
      `select id from artifacts where workspace_id = $1 and title = $2`,
      [workspaceId, "Welcome to Loop"],
    );

    if (artifactRes.rowCount === 0) {
      const prdTemplateRes = await client.query<{ id: string }>(
        `select id from templates where workspace_id = $1 and slug = 'prd'`,
        [workspaceId],
      );
      const templateId = prdTemplateRes.rows[0]?.id ?? null;
      const prdFolderSlug = slugify(
        defaultTemplates.find((template) => template.slug === "prd")?.name ?? "prd",
      );
      const prdFolderRes = await client.query<{ id: string; structure_version: number }>(
        `select id, structure_version from artifact_folders where workspace_id = $1 and slug = $2`,
        [workspaceId, prdFolderSlug],
      );
      const folderId = prdFolderRes.rows[0]?.id ?? null;
      const folderSchemaVersion = prdFolderRes.rows[0]?.structure_version ?? null;

      const createdArtifact = await client.query<{ id: string }>(
        `insert into artifacts (workspace_id, template_id, folder_id, folder_schema_version, title, status, created_by)
         values ($1, $2, $3, $4, $5, 'active', $6)
         returning id`,
        [workspaceId, templateId, folderId, folderSchemaVersion, "Welcome to Loop", userId],
      );
      const artifactId = createdArtifact.rows[0].id;

      const schema = defaultTemplates.find((t) => t.slug === "prd")!.schema;
      const blocks = schema.defaultBlocks.map((b, idx) => ({
        ...b,
        position: idx + 1,
      }));

      for (const block of blocks) {
        await client.query(
          `insert into artifact_blocks (artifact_id, type, title, content_md, position, meta, created_by, updated_by)
           values ($1, $2, $3, $4, $5, $6::jsonb, $7, $7)`,
          [
            artifactId,
            block.type,
            block.title ?? null,
            block.contentMd ?? "",
            block.position,
            JSON.stringify({ ...(block.meta ?? {}), origin_key: block.key ?? `${block.type}-${block.position}` }),
            userId,
          ],
        );
      }
    }

    await client.query("commit;");
    process.stdout.write(
      `Seed complete.\n- Workspace: ${seed.workspaceSlug}\n- Admin: ${seed.adminEmail} (password: ${seed.adminPassword})\n`,
    );
  } catch (err) {
    await client.query("rollback;");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
