import { withClient } from "@/src/server/db";
import {
  createArtifact,
  getArtifact,
  getNextBlockPosition,
  insertBlock,
  listBlocks,
  updateBlockContent,
} from "@/src/server/repo/artifacts";
import { upsertArtifactPermission } from "@/src/server/repo/artifactPermissions";
import { inferStructureFromDocument } from "@/src/server/services/structureInference";
import { createArtifactFromTemplate } from "@/src/server/services/artifactService";

type ImportMode = "new_artifact" | "extend_artifact";

type ImportBaseInput = {
  workspaceId: string;
  userId: string;
  documentMd: string;
};

export async function importDocumentWithSmartFill(
  input: ImportBaseInput & {
    mode: ImportMode;
    targetArtifactId?: string;
    title?: string;
    structureMode?: "template" | "custom";
    templateSlug?: string;
    folderId?: string;
  },
): Promise<{
  mode: ImportMode;
  artifactId: string;
  createdArtifact: boolean;
  updatedBlocks: number;
  insertedBlocks: number;
  suggestedTemplateSlug: string;
}> {
  const markdown = input.documentMd.trim();
  if (!markdown) throw new Error("Document is empty");

  const inference = await inferStructureFromDocument({
    markdown,
    explicitTitle: input.title ?? null,
  });

  if (input.mode === "extend_artifact") {
    if (!input.targetArtifactId) throw new Error("Target artifact is required");

    const targetExists = await withClient((client) =>
      getArtifact(client, input.workspaceId, input.targetArtifactId!),
    );
    if (!targetExists) throw new Error("Target artifact not found");

    const merged = await mergeIntoArtifact({
      workspaceId: input.workspaceId,
      userId: input.userId,
      artifactId: input.targetArtifactId,
      inferredBlocks: inference.blocks,
      sourceLabel: "Imported document",
    });

    return {
      mode: "extend_artifact",
      artifactId: input.targetArtifactId,
      createdArtifact: false,
      updatedBlocks: merged.updatedBlocks,
      insertedBlocks: merged.insertedBlocks,
      suggestedTemplateSlug: inference.suggestedTemplateSlug,
    };
  }

  const structureMode = input.structureMode ?? "template";
  let artifactId: string;
  if (structureMode === "custom") {
    artifactId = await createCustomArtifactFromInference({
      workspaceId: input.workspaceId,
      userId: input.userId,
      title: input.title?.trim() || inference.suggestedTitle,
      inferredBlocks: inference.blocks,
    });

    return {
      mode: "new_artifact",
      artifactId,
      createdArtifact: true,
      updatedBlocks: 0,
      insertedBlocks: inference.blocks.length,
      suggestedTemplateSlug: inference.suggestedTemplateSlug,
    };
  } else {
    const created = await createArtifactFromTemplate({
      workspaceId: input.workspaceId,
      createdBy: input.userId,
      title: input.title?.trim() || inference.suggestedTitle,
      folderId: input.folderId,
      templateSlug: input.folderId ? undefined : input.templateSlug ?? inference.suggestedTemplateSlug,
    });
    artifactId = created.artifactId;
  }

  const merged = await mergeIntoArtifact({
    workspaceId: input.workspaceId,
    userId: input.userId,
    artifactId,
    inferredBlocks: inference.blocks,
    sourceLabel: "Imported document",
  });

  return {
    mode: "new_artifact",
    artifactId,
    createdArtifact: true,
    updatedBlocks: merged.updatedBlocks,
    insertedBlocks: merged.insertedBlocks,
    suggestedTemplateSlug: inference.suggestedTemplateSlug,
  };
}

async function createCustomArtifactFromInference(input: {
  workspaceId: string;
  userId: string;
  title: string;
  inferredBlocks: Array<{ key: string; type: string; title: string; contentMd: string }>;
}) {
  return withClient(async (client) => {
    await client.query("begin;");
    try {
      const artifact = await createArtifact(client, {
        workspaceId: input.workspaceId,
        templateId: null,
        folderId: null,
        folderSchemaVersion: null,
        title: input.title,
        createdBy: input.userId,
        status: "draft",
      });

      await upsertArtifactPermission(client, {
        workspaceId: input.workspaceId,
        artifactId: artifact.id,
        userId: input.userId,
        role: "editor",
        grantedBy: input.userId,
      });

      let position = 1;
      for (const block of input.inferredBlocks.slice(0, 24)) {
        await insertBlock(client, {
          artifactId: artifact.id,
          type: block.type,
          title: block.title,
          contentMd: block.contentMd,
          position,
          meta: { origin_key: block.key, import_inferred: true },
          userId: input.userId,
        });
        position += 1;
      }

      await client.query("commit;");
      return artifact.id;
    } catch (err) {
      await client.query("rollback;");
      throw err;
    }
  });
}

async function mergeIntoArtifact(input: {
  workspaceId: string;
  userId: string;
  artifactId: string;
  inferredBlocks: Array<{ key: string; type: string; title: string; contentMd: string }>;
  sourceLabel: string;
}): Promise<{ updatedBlocks: number; insertedBlocks: number }> {
  return withClient(async (client) => {
    await client.query("begin;");
    try {
      const existingBlocks = await listBlocks(client, input.artifactId);
      let insertedBlocks = 0;
      let updatedBlocks = 0;
      let nextPos = await getNextBlockPosition(client, input.artifactId);

      for (const inferred of input.inferredBlocks) {
        const target = findBestBlock(existingBlocks, inferred);
        if (target) {
          const appended = appendImportedContent(target.content_md, inferred.contentMd, input.sourceLabel);
          if (appended !== target.content_md) {
            await updateBlockContent(client, {
              workspaceId: input.workspaceId,
              blockId: target.id,
              contentMd: appended,
              userId: input.userId,
            });
            target.content_md = appended;
            updatedBlocks += 1;
          }
          continue;
        }

        await insertBlock(client, {
          artifactId: input.artifactId,
          type: inferred.type,
          title: inferred.title,
          contentMd: appendImportedContent("", inferred.contentMd, input.sourceLabel),
          position: nextPos,
          meta: { origin_key: inferred.key, imported: true },
          userId: input.userId,
        });
        existingBlocks.push({
          id: `new-${nextPos}`,
          artifact_id: input.artifactId,
          type: inferred.type,
          title: inferred.title,
          content_md: inferred.contentMd,
          position: nextPos,
          meta: {},
          updated_at: new Date().toISOString(),
        });
        nextPos += 1;
        insertedBlocks += 1;
      }

      await client.query("commit;");
      return { updatedBlocks, insertedBlocks };
    } catch (err) {
      await client.query("rollback;");
      throw err;
    }
  });
}

function findBestBlock(
  existingBlocks: Array<{ id: string; type: string; title: string | null; content_md: string }>,
  inferred: { type: string; title: string; contentMd: string },
) {
  let best: { block: (typeof existingBlocks)[number]; score: number } | null = null;
  for (const block of existingBlocks) {
    let score = 0;
    if (normalize(block.type) === normalize(inferred.type)) score += 7;

    const titleOverlap = overlapScore(block.title ?? "", inferred.title);
    score += titleOverlap * 2;

    if (normalize(inferred.type) === "text" && normalize(block.type) === "text") score += 2;
    if (!block.title && titleOverlap > 0) score += 1;

    if (!best || score > best.score) {
      best = { block, score };
    }
  }

  if (!best) return null;
  return best.score >= 6 ? best.block : null;
}

function appendImportedContent(existing: string, incoming: string, sourceLabel: string) {
  const text = incoming.trim();
  if (!text) return existing;
  const stamp = new Date().toLocaleString();
  const section = `### ${sourceLabel} (${stamp})\n\n${text}`;
  if (!existing.trim()) return section;
  if (existing.includes(section)) return existing;
  return `${existing.trimEnd()}\n\n${section}`;
}

function overlapScore(a: string, b: string) {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (left.size === 0 || right.size === 0) return 0;
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  return overlap;
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}
