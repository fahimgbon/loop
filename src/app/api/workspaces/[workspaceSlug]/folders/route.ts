import { z } from "zod";
import type pg from "pg";

import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";
import { createFolder, getFolderBySlug, listFolders } from "@/src/server/repo/folders";
import { getTemplateBySlug } from "@/src/server/repo/templates";
import { templateSchemaV1 } from "@/src/server/services/templateSchemas";
import { slugify } from "@/src/server/slug";
import { defaultTemplates } from "@/src/server/templates/defaultTemplates";

const customBlockSchema = z.object({
  key: z.string().min(1).optional(),
  type: z.string().min(1),
  title: z.string().nullable().optional(),
  contentMd: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});

const createSchema = z
  .object({
    name: z.string().min(2),
    templateSlug: z.string().min(1).optional(),
    blocks: z.array(customBlockSchema).optional(),
  })
  .refine((data) => Boolean(data.templateSlug) || Boolean(data.blocks?.length), {
    message: "Provide templateSlug or blocks",
  });

export async function GET(_: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const folders = await withClient((client) => listFolders(client, session.workspaceId));
  return json({ folders });
}

export async function POST(request: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  try {
    const schema = await withClient((client) =>
      resolveFolderSchema(client, session.workspaceId, {
        templateSlug: parsed.data.templateSlug,
        blocks: parsed.data.blocks,
      }),
    );

    const folder = await withClient(async (client) => {
      const slug = await makeUniqueFolderSlug(client, session.workspaceId, parsed.data.name);
      return createFolder(client, {
        workspaceId: session.workspaceId,
        slug,
        name: parsed.data.name,
        schemaJson: schema,
        createdBy: session.userId,
      });
    });

    return json({ ok: true, folderId: folder.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return errorJson(400, message);
  }
}

async function resolveFolderSchema(
  client: pg.PoolClient,
  workspaceId: string,
  input: { templateSlug?: string; blocks?: Array<z.infer<typeof customBlockSchema>> },
) {
  if (input.templateSlug) {
    const template = await getTemplateBySlug(client, workspaceId, input.templateSlug);
    const schemaSource =
      template?.schema_json ??
      defaultTemplates.find((item) => item.slug === input.templateSlug)?.schema;
    if (!schemaSource) throw new Error(`Template not found: ${input.templateSlug}`);
    const parsed = templateSchemaV1.safeParse(schemaSource);
    if (!parsed.success) throw new Error(`Template schema invalid: ${input.templateSlug}`);
    return parsed.data;
  }

  const blocks = (input.blocks ?? []).map((block, index) => ({
    key: normalizeKey(block.key ?? `${block.type}-${block.title ?? "block"}-${index + 1}`),
    type: block.type,
    title: block.title ?? null,
    contentMd: block.contentMd ?? "",
    meta: block.meta ?? {},
  }));
  if (blocks.length === 0) throw new Error("At least one block is required");
  const allowed = Array.from(new Set(blocks.map((block) => block.type)));
  return {
    version: 1 as const,
    description: "Custom folder structure",
    allowedBlockTypes: allowed,
    defaultBlocks: blocks,
  };
}

async function makeUniqueFolderSlug(
  client: pg.PoolClient,
  workspaceId: string,
  name: string,
) {
  const base = slugify(name) || "folder";
  let candidate = base;
  let i = 1;
  while (await getFolderBySlug(client, workspaceId, candidate)) {
    i += 1;
    candidate = `${base}-${i}`;
  }
  return candidate;
}

function normalizeKey(value: string) {
  const out = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return out || "block";
}
