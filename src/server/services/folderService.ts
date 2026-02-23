import type pg from "pg";

import {
  deleteBlockById,
  getArtifact,
  getNextBlockPosition,
  insertBlock,
  listBlocks,
  markArtifactFolderSchemaVersion,
  normalizeBlockPositions,
} from "@/src/server/repo/artifacts";
import { getFolder, listArtifactsNeedingFolderSync } from "@/src/server/repo/folders";
import { templateSchemaV1 } from "@/src/server/services/templateSchemas";

type SchemaBlock = {
  key: string;
  type: string;
  title: string | null;
  contentMd: string;
  meta: Record<string, unknown>;
};

export type FolderSyncPreview = {
  hasFolder: boolean;
  folderId: string | null;
  folderName: string | null;
  folderStructureVersion: number | null;
  artifactStructureVersion: number | null;
  outdated: boolean;
  additions: Array<{ key: string; type: string; title: string | null }>;
  deletions: Array<{ blockId: string; key: string; type: string; title: string | null }>;
};

export type ApplyFolderSyncResult = {
  appliedAdditions: number;
  appliedDeletions: number;
  newArtifactStructureVersion: number | null;
};

export async function getFolderSyncPreview(
  client: pg.PoolClient,
  input: { workspaceId: string; artifactId: string },
): Promise<FolderSyncPreview | null> {
  const artifact = await getArtifact(client, input.workspaceId, input.artifactId);
  if (!artifact) return null;
  if (!artifact.folder_id) {
    return {
      hasFolder: false,
      folderId: null,
      folderName: null,
      folderStructureVersion: null,
      artifactStructureVersion: null,
      outdated: false,
      additions: [],
      deletions: [],
    };
  }

  const folder = await getFolder(client, input.workspaceId, artifact.folder_id);
  if (!folder) {
    return {
      hasFolder: false,
      folderId: artifact.folder_id,
      folderName: null,
      folderStructureVersion: null,
      artifactStructureVersion: artifact.folder_schema_version,
      outdated: false,
      additions: [],
      deletions: [],
    };
  }

  const schema = parseFolderSchema(folder.schema_json);
  const blocks = await listBlocks(client, artifact.id);
  const diff = computeFolderDiff(schema, blocks);
  const outdated =
    (artifact.folder_schema_version ?? 0) < folder.structure_version ||
    diff.additions.length > 0 ||
    diff.deletions.length > 0;

  return {
    hasFolder: true,
    folderId: folder.id,
    folderName: folder.name,
    folderStructureVersion: folder.structure_version,
    artifactStructureVersion: artifact.folder_schema_version,
    outdated,
    additions: diff.additions.map((a) => ({ key: a.key, type: a.type, title: a.title })),
    deletions: diff.deletions.map((d) => ({
      blockId: d.blockId,
      key: d.key,
      type: d.type,
      title: d.title,
    })),
  };
}

export async function applyFolderSync(
  client: pg.PoolClient,
  input: {
    workspaceId: string;
    artifactId: string;
    userId: string;
    applyAdditions: boolean;
    applyDeletions: boolean;
  },
): Promise<ApplyFolderSyncResult | null> {
  const artifact = await getArtifact(client, input.workspaceId, input.artifactId);
  if (!artifact || !artifact.folder_id) return null;

  const folder = await getFolder(client, input.workspaceId, artifact.folder_id);
  if (!folder) return null;

  const schema = parseFolderSchema(folder.schema_json);
  const blocks = await listBlocks(client, artifact.id);
  const diff = computeFolderDiff(schema, blocks);

  let appliedAdditions = 0;
  let appliedDeletions = 0;

  if (input.applyAdditions) {
    let position = await getNextBlockPosition(client, artifact.id);
    for (const block of diff.additions) {
      await insertBlock(client, {
        artifactId: artifact.id,
        type: block.type,
        title: block.title,
        contentMd: block.contentMd,
        position,
        meta: { ...block.meta, origin_key: block.key },
        userId: input.userId,
      });
      position += 1;
      appliedAdditions += 1;
    }
  }

  if (input.applyDeletions) {
    for (const block of diff.deletions) {
      await deleteBlockById(client, { artifactId: artifact.id, blockId: block.blockId });
      appliedDeletions += 1;
    }
    if (appliedDeletions > 0) {
      await normalizeBlockPositions(client, artifact.id);
    }
  }

  await markArtifactFolderSchemaVersion(client, {
    workspaceId: input.workspaceId,
    artifactId: artifact.id,
    folderSchemaVersion: folder.structure_version,
  });

  return {
    appliedAdditions,
    appliedDeletions,
    newArtifactStructureVersion: folder.structure_version,
  };
}

export async function getFolderOutdatedArtifactCount(
  client: pg.PoolClient,
  input: { workspaceId: string; folderId: string; folderStructureVersion: number },
): Promise<number> {
  const rows = await listArtifactsNeedingFolderSync(
    client,
    input.workspaceId,
    input.folderId,
    input.folderStructureVersion,
  );
  return rows.length;
}

export function parseFolderSchema(raw: unknown) {
  const parsed = templateSchemaV1.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Invalid folder structure schema");
  }
  return parsed.data;
}

function computeFolderDiff(
  schema: ReturnType<typeof parseFolderSchema>,
  artifactBlocks: Array<{ id: string; type: string; title: string | null; content_md: string; meta: unknown }>,
) {
  const expected = schema.defaultBlocks.map<SchemaBlock>((block, index) => ({
    key: normalizeKey(block.key ?? fallbackKey(block.type, block.title ?? null, index)),
    type: block.type,
    title: block.title ?? null,
    contentMd: block.contentMd ?? "",
    meta: block.meta ?? {},
  }));

  const expectedByKey = new Map(expected.map((block) => [block.key, block]));
  const artifactWithKeys = artifactBlocks.map((block, index) => ({
    blockId: block.id,
    key: normalizeKey(readOriginKey(block.meta) ?? fallbackKey(block.type, block.title, index)),
    type: block.type,
    title: block.title,
  }));

  const existingKeys = new Set(artifactWithKeys.map((block) => block.key));
  const additions = expected.filter((block) => !existingKeys.has(block.key));
  const deletions = artifactWithKeys.filter((block) => !expectedByKey.has(block.key));
  return { additions, deletions };
}

function readOriginKey(meta: unknown): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const record = meta as Record<string, unknown>;
  const key = record.origin_key;
  return typeof key === "string" && key.trim() ? key : null;
}

function fallbackKey(type: string, title: string | null | undefined, index: number) {
  const source = `${type}-${title ?? "untitled"}-${index + 1}`;
  return source;
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

