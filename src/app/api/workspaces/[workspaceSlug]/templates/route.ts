import { getSession } from "@/src/server/auth";
import { errorJson, json } from "@/src/server/http";
import { withClient } from "@/src/server/db";
import { listTemplates } from "@/src/server/repo/templates";
import { defaultTemplates } from "@/src/server/templates/defaultTemplates";

export async function GET(_: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const templates = await withClient((client) => listTemplates(client, session.workspaceId));
  const groupBySlug = new Map(defaultTemplates.map((template) => [template.slug, template.group]));
  const fallbackTemplates =
    templates.length > 0
      ? templates
      : defaultTemplates.map((template) => ({
          id: template.slug,
          slug: template.slug,
          name: template.name,
        }));
  return json({
    templates: fallbackTemplates.map((template) => ({
      ...template,
      group: groupBySlug.get(template.slug) ?? template.name,
    })),
  });
}
