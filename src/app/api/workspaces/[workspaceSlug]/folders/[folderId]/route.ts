import { z } from "zod";

import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";
import { getFolder, listArtifactsForFolder, updateFolder } from "@/src/server/repo/folders";
import { getTemplateBySlug } from "@/src/server/repo/templates";
import { getFolderOutdatedArtifactCount, parseFolderSchema } from "@/src/server/services/folderService";
import { templateSchemaV1 } from "@/src/server/services/templateSchemas";
import { defaultTemplates } from "@/src/server/templates/defaultTemplates";

const customBlockSchema = z.object({
  key: z.string().min(1).optional(),
  type: z.string().min(1),
  title: z.string().nullable().optional(),
  contentMd: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});

const patchSchema = z
  .object({
    name: z.string().min(2),
    templateSlug: z.string().min(1).optional(),
    blocks: z.array(customBlockSchema).optional(),
  })
  .refine((data) => Boolean(data.templateSlug) || Boolean(data.blocks?.length), {
    message: "Provide templateSlug or blocks",
  });

export async function GET(
  _: Request,
  context: { params: Promise<{ workspaceSlug: string; folderId: string }> },
) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug, folderId } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const folder = await withClient((client) => getFolder(client, session.workspaceId, folderId));
  if (!folder) return errorJson(404, "Not found");
  const schema = parseFolderSchema(folder.schema_json);
  const artifacts = await withClient((client) => listArtifactsForFolder(client, session.workspaceId, folder.id));

  return json({
    folder: {
      id: folder.id,
      slug: folder.slug,
      name: folder.name,
      structureVersion: folder.structure_version,
      schema,
      updatedAt: folder.updated_at,
    },
    artifacts,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ workspaceSlug: string; folderId: string }> },
) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug, folderId } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  try {
    const schema = await withClient(async (client) => {
      if (parsed.data.templateSlug) {
        const template = await getTemplateBySlug(client, session.workspaceId, parsed.data.templateSlug);
        const schemaSource =
          template?.schema_json ??
          defaultTemplates.find((item) => item.slug === parsed.data.templateSlug)?.schema;
        if (!schemaSource) throw new Error(`Template not found: ${parsed.data.templateSlug}`);
        const parsedTemplate = templateSchemaV1.safeParse(schemaSource);
        if (!parsedTemplate.success) throw new Error("Template schema invalid");
        return parsedTemplate.data;
      }
      const blocks = (parsed.data.blocks ?? []).map((block, index) => ({
        key: normalizeKey(block.key ?? `${block.type}-${block.title ?? "block"}-${index + 1}`),
        type: block.type,
        title: block.title ?? null,
        contentMd: block.contentMd ?? "",
        meta: block.meta ?? {},
      }));
      if (blocks.length === 0) throw new Error("At least one block is required");
      return {
        version: 1 as const,
        description: "Custom folder structure",
        allowedBlockTypes: Array.from(new Set(blocks.map((block) => block.type))),
        defaultBlocks: blocks,
      };
    });

    const updated = await withClient((client) =>
      updateFolder(client, {
        workspaceId: session.workspaceId,
        folderId,
        name: parsed.data.name,
        schemaJson: schema,
      }),
    );

    const needsSyncCount = await withClient((client) =>
      getFolderOutdatedArtifactCount(client, {
        workspaceId: session.workspaceId,
        folderId,
        folderStructureVersion: updated.structure_version,
      }),
    );

    return json({ ok: true, structureVersion: updated.structure_version, needsSyncCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return errorJson(400, message);
  }
}

function normalizeKey(value: string) {
  const out = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return out || "block";
}
