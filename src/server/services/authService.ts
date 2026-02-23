import bcrypt from "bcryptjs";

import { withClient } from "@/src/server/db";
import { upsertFolderBySlug } from "@/src/server/repo/folders";
import { createUser, getUserByEmail } from "@/src/server/repo/users";
import { createWorkspace, getFirstWorkspaceForUser, upsertMembership } from "@/src/server/repo/workspaces";
import { defaultTemplates } from "@/src/server/templates/defaultTemplates";
import { slugify } from "@/src/server/slug";

export async function loginWithPassword(input: { email: string; password: string }) {
  return withClient(async (client) => {
    const user = await getUserByEmail(client, input.email);
    if (!user) return null;
    const ok = await bcrypt.compare(input.password, user.password_hash);
    if (!ok) return null;
    const membership = await getFirstWorkspaceForUser(client, user.id);
    if (!membership) return null;
    return {
      userId: user.id,
      workspaceId: membership.workspaceId,
      workspaceSlug: membership.workspaceSlug,
      role: membership.role,
      name: user.name,
      email: user.email,
    };
  });
}

export async function setupWorkspaceAndAdmin(input: {
  workspaceSlug: string;
  workspaceName: string;
  name: string;
  email: string;
  password: string;
}) {
  return withClient(async (client) => {
    await client.query("begin;");
    try {
      const passwordHash = await bcrypt.hash(input.password, 10);
      const user = await createUser(client, {
        email: input.email,
        name: input.name,
        passwordHash,
      });
      const workspace = await createWorkspace(client, {
        slug: input.workspaceSlug,
        name: input.workspaceName,
      });
      await upsertMembership(client, {
        workspaceId: workspace.id,
        userId: user.id,
        role: "admin",
      });

      for (const template of defaultTemplates) {
        await client.query(
          `insert into templates (workspace_id, slug, name, schema_json, created_by)
           values ($1, $2, $3, $4::jsonb, $5)
           on conflict (workspace_id, slug)
           do update set name = excluded.name, schema_json = excluded.schema_json, updated_at = now()`,
          [workspace.id, template.slug, template.name, JSON.stringify(template.schema), user.id],
        );

        await upsertFolderBySlug(client, {
          workspaceId: workspace.id,
          slug: slugify(template.name),
          name: template.name,
          schemaJson: template.schema,
          createdBy: user.id,
        });
      }

      await client.query("commit;");
      return { userId: user.id, workspaceId: workspace.id, workspaceSlug: workspace.slug, role: "admin" as const };
    } catch (err) {
      await client.query("rollback;");
      throw err;
    }
  });
}
