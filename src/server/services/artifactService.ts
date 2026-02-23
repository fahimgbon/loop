import { withClient } from "@/src/server/db";
import { createArtifact, insertBlock } from "@/src/server/repo/artifacts";
import { upsertArtifactPermission } from "@/src/server/repo/artifactPermissions";
import { getFolder } from "@/src/server/repo/folders";
import { getTemplateBySlug } from "@/src/server/repo/templates";
import { templateSchemaV1 } from "@/src/server/services/templateSchemas";
import { defaultTemplates } from "@/src/server/templates/defaultTemplates";

export async function createArtifactFromTemplate(input: {
  workspaceId: string;
  createdBy: string;
  templateSlug?: string;
  folderId?: string;
  title: string;
}) {
  return withClient(async (client) => {
    await client.query("begin;");
    try {
      let templateId: string | null = null;
      let folderId: string | null = null;
      let folderSchemaVersion: number | null = null;
      let schemaSource: unknown;

      if (input.folderId) {
        const folder = await getFolder(client, input.workspaceId, input.folderId);
        if (!folder) throw new Error("Folder not found");
        folderId = folder.id;
        folderSchemaVersion = folder.structure_version;
        schemaSource = folder.schema_json;
      } else {
        const slug = input.templateSlug ?? "prd";
        const template = await getTemplateBySlug(client, input.workspaceId, slug);
        if (template) {
          templateId = template.id;
          schemaSource = template.schema_json;
        } else {
          const builtin = defaultTemplates.find((item) => item.slug === slug);
          if (!builtin) throw new Error(`Template not found: ${slug}`);
          schemaSource = builtin.schema;
        }
      }

      const parsedSchema = templateSchemaV1.safeParse(schemaSource);
      if (!parsedSchema.success) throw new Error("Invalid structure schema");

      const artifact = await createArtifact(client, {
        workspaceId: input.workspaceId,
        templateId,
        folderId,
        folderSchemaVersion,
        title: input.title,
        createdBy: input.createdBy,
        status: "draft",
      });

      await upsertArtifactPermission(client, {
        workspaceId: input.workspaceId,
        artifactId: artifact.id,
        userId: input.createdBy,
        role: "editor",
        grantedBy: input.createdBy,
      });

      let position = 1;
      for (const block of parsedSchema.data.defaultBlocks) {
        const originKey = block.key ?? makeBlockOriginKey(block.type, block.title ?? null, position);
        await insertBlock(client, {
          artifactId: artifact.id,
          type: block.type,
          title: block.title ?? null,
          contentMd: block.contentMd ?? "",
          position,
          meta: { ...(block.meta ?? {}), origin_key: originKey },
          userId: input.createdBy,
        });
        position += 1;
      }

      await client.query("commit;");
      return { artifactId: artifact.id };
    } catch (err) {
      await client.query("rollback;");
      throw err;
    }
  });
}

function makeBlockOriginKey(type: string, title: string | null | undefined, index: number) {
  const raw = `${type}-${title ?? "untitled"}-${index}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return raw || `block-${index}`;
}
