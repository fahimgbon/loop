import { withClient } from "@/src/server/db";
import { listArtifacts } from "@/src/server/repo/artifacts";
import { listFolders } from "@/src/server/repo/folders";
import { defaultTemplates } from "@/src/server/templates/defaultTemplates";

type ArtifactRow = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  folder_id: string | null;
  folder_name: string | null;
};

type GraphBlockRow = {
  artifact_id: string;
  block_title: string | null;
  block_type: string;
  content_excerpt: string;
};

export type ArtifactGraphNode = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  folderId: string | null;
  folderName: string | null;
  collectionKey: string;
  collectionName: string;
  collectionKind: "folder" | "smart";
  inferredTemplateSlug: string;
  blockThemes: string[];
  keywords: string[];
  x: number;
  y: number;
  radius: number;
  degree: number;
  color: string;
};

export type ArtifactGraphEdge = {
  id: string;
  source: string;
  target: string;
  weight: number;
  reasons: string[];
  primaryReason: string;
};

export type ArtifactGraphCollection = {
  key: string;
  name: string;
  kind: "folder" | "smart";
  templateSlug: string | null;
  artifactCount: number;
  artifactIds: string[];
  sharedThemes: string[];
  sharedKeywords: string[];
  updatedAt: string | null;
  x: number;
  y: number;
  radius: number;
  color: string;
};

export type ArtifactGraphSnapshot = {
  viewBox: { width: number; height: number };
  nodes: ArtifactGraphNode[];
  edges: ArtifactGraphEdge[];
  collections: ArtifactGraphCollection[];
};

export type ArtifactGraphConnectionSummary = {
  node: ArtifactGraphNode | null;
  neighbors: Array<{
    id: string;
    title: string;
    collectionName: string;
    weight: number;
    primaryReason: string;
  }>;
};

const CANVAS_WIDTH = 1280;
const MIN_CANVAS_HEIGHT = 720;
const COLLECTION_COLORS = [
  "59 130 246",
  "14 165 233",
  "16 185 129",
  "99 102 241",
  "236 72 153",
  "245 158 11",
  "249 115 22",
  "20 184 166",
];

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "align",
  "alignment",
  "also",
  "among",
  "because",
  "being",
  "between",
  "build",
  "could",
  "document",
  "documents",
  "draft",
  "early",
  "first",
  "from",
  "have",
  "idea",
  "ideas",
  "into",
  "just",
  "like",
  "loop",
  "make",
  "more",
  "need",
  "notes",
  "open",
  "people",
  "platform",
  "product",
  "project",
  "really",
  "record",
  "recording",
  "report",
  "should",
  "some",
  "something",
  "team",
  "teams",
  "that",
  "their",
  "there",
  "these",
  "they",
  "this",
  "through",
  "update",
  "using",
  "want",
  "what",
  "when",
  "where",
  "with",
  "would",
]);

export async function getArtifactGraphSnapshot(input: {
  workspaceId: string;
}): Promise<ArtifactGraphSnapshot> {
  const rows = await withClient(async (client) => {
    const [artifacts, folders, blocks] = await Promise.all([
      listArtifacts(client, input.workspaceId),
      listFolders(client, input.workspaceId),
      client.query<GraphBlockRow>(
        `select
           a.id as artifact_id,
           b.title as block_title,
           b.type as block_type,
           left(regexp_replace(coalesce(b.content_md, ''), E'[\\n\\r\\t]+', ' ', 'g'), 640) as content_excerpt
         from artifacts a
         join artifact_blocks b on b.artifact_id = a.id
         where a.workspace_id = $1
         order by a.updated_at desc, b.position asc`,
        [input.workspaceId],
      ),
    ]);

    return {
      artifacts: artifacts as ArtifactRow[],
      folders,
      blocks: blocks.rows,
    };
  });

  return buildGraphSnapshot(rows);
}

export async function getArtifactConnectionSummary(input: {
  workspaceId: string;
  artifactId: string;
}): Promise<ArtifactGraphConnectionSummary> {
  const graph = await getArtifactGraphSnapshot({ workspaceId: input.workspaceId });
  const node = graph.nodes.find((item) => item.id === input.artifactId) ?? null;
  if (!node) return { node: null, neighbors: [] };

  const nodeLookup = new Map(graph.nodes.map((item) => [item.id, item]));
  const neighbors = graph.edges
    .filter((edge) => edge.source === input.artifactId || edge.target === input.artifactId)
    .map((edge) => {
      const neighborId = edge.source === input.artifactId ? edge.target : edge.source;
      const neighbor = nodeLookup.get(neighborId);
      if (!neighbor) return null;
      return {
        id: neighbor.id,
        title: neighbor.title,
        collectionName: neighbor.collectionName,
        weight: edge.weight,
        primaryReason: edge.primaryReason,
      };
    })
    .filter((item): item is NonNullable<typeof item> => !!item)
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 5);

  return { node, neighbors };
}

function buildGraphSnapshot(input: {
  artifacts: ArtifactRow[];
  folders: Array<{ id: string; slug: string; name: string; structure_version: number; updated_at: string }>;
  blocks: GraphBlockRow[];
}): ArtifactGraphSnapshot {
  const blocksByArtifact = groupBlocksByArtifact(input.blocks);
  const folderLookup = new Map(input.folders.map((folder) => [folder.id, folder]));
  const metadata = input.artifacts.map((artifact) => {
    const blocks = blocksByArtifact.get(artifact.id) ?? [];
    const inferredTemplateSlug = inferTemplateSlug(blocks);
    const collection =
      artifact.folder_id && folderLookup.has(artifact.folder_id)
        ? {
            key: `folder:${artifact.folder_id}`,
            name: artifact.folder_name ?? folderLookup.get(artifact.folder_id)?.name ?? "Folder",
            kind: "folder" as const,
            templateSlug: null,
          }
        : {
            key: `smart:${inferredTemplateSlug}`,
            name: defaultTemplates.find((template) => template.slug === inferredTemplateSlug)?.group ?? "Connected work",
            kind: "smart" as const,
            templateSlug: inferredTemplateSlug,
          };

    const blockThemes = summarizeBlockThemes(blocks);
    const keywords = extractKeywords([
      artifact.title,
      ...blocks.flatMap((block) => [block.block_title ?? "", block.content_excerpt ?? ""]),
    ]);

    return {
      artifact,
      inferredTemplateSlug,
      collection,
      blockThemes,
      keywords,
    };
  });

  const collections = buildCollections(metadata);
  const layout = layoutCollections(collections);
  const rawNodes = layoutNodes(metadata, layout);
  const edges = buildEdges(rawNodes);
  const degreeMap = buildDegreeMap(edges);

  const nodes = rawNodes.map((node) => ({
    ...node,
    degree: degreeMap.get(node.id) ?? 0,
    radius: 11 + Math.min(10, (degreeMap.get(node.id) ?? 0) * 1.8),
  }));

  const collectionsWithRadius = collections.map((collection) => {
    const clusterNodes = nodes.filter((node) => node.collectionKey === collection.key);
    const farthestDistance =
      clusterNodes.length === 0
        ? 84
        : Math.max(
            ...clusterNodes.map((node) =>
              Math.hypot(node.x - collection.x, node.y - collection.y) + node.radius + 34,
            ),
          );
    return {
      ...collection,
      radius: Math.max(88, farthestDistance),
    };
  });

  const rows = Math.max(1, Math.ceil(collections.length / Math.max(1, Math.ceil(Math.sqrt(collections.length || 1)))));
  return {
    viewBox: {
      width: CANVAS_WIDTH,
      height: Math.max(MIN_CANVAS_HEIGHT, rows * 320),
    },
    nodes,
    edges,
    collections: collectionsWithRadius,
  };
}

function groupBlocksByArtifact(rows: GraphBlockRow[]) {
  const grouped = new Map<string, GraphBlockRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.artifact_id) ?? [];
    list.push(row);
    grouped.set(row.artifact_id, list);
  }
  return grouped;
}

function buildCollections(
  metadata: Array<{
    artifact: ArtifactRow;
    inferredTemplateSlug: string;
    collection: { key: string; name: string; kind: "folder" | "smart"; templateSlug: string | null };
    blockThemes: string[];
    keywords: string[];
  }>,
) {
  const grouped = new Map<
    string,
    {
      key: string;
      name: string;
      kind: "folder" | "smart";
      templateSlug: string | null;
      artifactIds: string[];
      updatedAt: string | null;
      themes: string[];
      keywords: string[];
    }
  >();

  for (const item of metadata) {
    const existing = grouped.get(item.collection.key);
    if (existing) {
      existing.artifactIds.push(item.artifact.id);
      existing.updatedAt =
        !existing.updatedAt || new Date(item.artifact.updated_at) > new Date(existing.updatedAt)
          ? item.artifact.updated_at
          : existing.updatedAt;
      existing.themes.push(...item.blockThemes);
      existing.keywords.push(...item.keywords);
      continue;
    }

    grouped.set(item.collection.key, {
      key: item.collection.key,
      name: item.collection.name,
      kind: item.collection.kind,
      templateSlug: item.collection.templateSlug,
      artifactIds: [item.artifact.id],
      updatedAt: item.artifact.updated_at,
      themes: [...item.blockThemes],
      keywords: [...item.keywords],
    });
  }

  return Array.from(grouped.values())
    .sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1;
      return left.name.localeCompare(right.name);
    })
    .map((collection, index) => ({
      key: collection.key,
      name: collection.name,
      kind: collection.kind,
      templateSlug: collection.templateSlug,
      artifactCount: collection.artifactIds.length,
      artifactIds: collection.artifactIds,
      sharedThemes: summarizeTerms(collection.themes, 4),
      sharedKeywords: summarizeTerms(collection.keywords, 4),
      updatedAt: collection.updatedAt,
      x: 0,
      y: 0,
      radius: 0,
      color: COLLECTION_COLORS[index % COLLECTION_COLORS.length],
    }));
}

function layoutCollections(collections: ArtifactGraphCollection[]) {
  if (collections.length === 0) return new Map<string, { x: number; y: number; color: string }>();

  const cols = Math.max(1, Math.ceil(Math.sqrt(collections.length)));
  const rows = Math.ceil(collections.length / cols);
  const height = Math.max(MIN_CANVAS_HEIGHT, rows * 320);
  const cellWidth = CANVAS_WIDTH / cols;
  const cellHeight = height / rows;

  const layout = new Map<string, { x: number; y: number; color: string }>();
  collections.forEach((collection, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    layout.set(collection.key, {
      x: col * cellWidth + cellWidth / 2,
      y: row * cellHeight + cellHeight / 2,
      color: collection.color,
    });
    collection.x = col * cellWidth + cellWidth / 2;
    collection.y = row * cellHeight + cellHeight / 2;
  });

  return layout;
}

function layoutNodes(
  metadata: Array<{
    artifact: ArtifactRow;
    inferredTemplateSlug: string;
    collection: { key: string; name: string; kind: "folder" | "smart"; templateSlug: string | null };
    blockThemes: string[];
    keywords: string[];
  }>,
  layout: Map<string, { x: number; y: number; color: string }>,
): ArtifactGraphNode[] {
  const grouped = new Map<string, typeof metadata>();
  for (const item of metadata) {
    const list = grouped.get(item.collection.key) ?? [];
    list.push(item);
    grouped.set(item.collection.key, list);
  }

  const nodes: ArtifactGraphNode[] = [];
  for (const [collectionKey, items] of grouped.entries()) {
    const center = layout.get(collectionKey);
    if (!center) continue;

    const sorted = [...items].sort((left, right) => left.artifact.title.localeCompare(right.artifact.title));
    const offset = stableHash(collectionKey) % 360;
    sorted.forEach((item, index) => {
      const { ring, position, ringSize } = getRingPosition(index, sorted.length);
      const radius = ring === 0 ? 0 : 72 + ring * 56 + Math.min(18, sorted.length * 2);
      const angle = ((offset + (360 / Math.max(1, ringSize)) * position) * Math.PI) / 180;
      const x = center.x + Math.cos(angle) * radius;
      const y = center.y + Math.sin(angle) * radius;

      nodes.push({
        id: item.artifact.id,
        title: item.artifact.title,
        status: item.artifact.status,
        updatedAt: item.artifact.updated_at,
        folderId: item.artifact.folder_id,
        folderName: item.artifact.folder_name,
        collectionKey: item.collection.key,
        collectionName: item.collection.name,
        collectionKind: item.collection.kind,
        inferredTemplateSlug: item.inferredTemplateSlug,
        blockThemes: item.blockThemes,
        keywords: item.keywords,
        x,
        y,
        radius: 13,
        degree: 0,
        color: center.color,
      });
    });
  }

  return nodes;
}

function buildEdges(nodes: ArtifactGraphNode[]) {
  const rawEdges: ArtifactGraphEdge[] = [];
  for (let index = 0; index < nodes.length; index += 1) {
    for (let inner = index + 1; inner < nodes.length; inner += 1) {
      const left = nodes[index];
      const right = nodes[inner];
      const sharedThemes = intersect(left.blockThemes, right.blockThemes).slice(0, 2);
      const sharedKeywords = intersect(left.keywords, right.keywords).filter((term) => term.length >= 5).slice(0, 2);

      let weight = 0;
      const reasons: string[] = [];

      if (left.folderId && left.folderId === right.folderId) {
        weight += 2.9;
        reasons.push(`Same folder: ${left.collectionName}`);
      } else if (!left.folderId && !right.folderId && left.inferredTemplateSlug === right.inferredTemplateSlug) {
        weight += 1.35;
        reasons.push(`Similar structure: ${left.collectionName}`);
      }

      if (sharedThemes.length > 0) {
        weight += sharedThemes.length * 0.95;
        reasons.push(`Shared blocks: ${sharedThemes.join(", ")}`);
      }

      if (sharedKeywords.length > 0) {
        weight += sharedKeywords.length * 0.7;
        reasons.push(`Transcript overlap: ${sharedKeywords.join(", ")}`);
      }

      if (weight < 1.8 && reasons.length < 2) continue;

      rawEdges.push({
        id: `${left.id}:${right.id}`,
        source: left.id,
        target: right.id,
        weight,
        reasons,
        primaryReason: reasons[0] ?? "Related work",
      });
    }
  }

  const sorted = rawEdges.sort((left, right) => right.weight - left.weight);
  const counts = new Map<string, number>();
  const chosen: ArtifactGraphEdge[] = [];
  for (const edge of sorted) {
    if ((counts.get(edge.source) ?? 0) >= 5) continue;
    if ((counts.get(edge.target) ?? 0) >= 5) continue;
    chosen.push(edge);
    counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
    counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
  }

  return chosen;
}

function buildDegreeMap(edges: ArtifactGraphEdge[]) {
  const degreeMap = new Map<string, number>();
  for (const edge of edges) {
    degreeMap.set(edge.source, (degreeMap.get(edge.source) ?? 0) + 1);
    degreeMap.set(edge.target, (degreeMap.get(edge.target) ?? 0) + 1);
  }
  return degreeMap;
}

function summarizeBlockThemes(blocks: GraphBlockRow[]) {
  const seen = new Set<string>();
  const themes: string[] = [];
  for (const block of blocks) {
    const title = (block.block_title?.trim() || defaultBlockTitle(block.block_type)).replace(/\s+/g, " ");
    const normalized = title.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    themes.push(title);
    if (themes.length === 5) break;
  }
  return themes;
}

function summarizeTerms(values: string[], limit: number) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

function extractKeywords(parts: string[]) {
  const counts = new Map<string, number>();
  const joined = parts.join(" ").toLowerCase();
  const matches = joined.match(/[a-z][a-z0-9-]{2,}/g) ?? [];
  for (const match of matches) {
    const term = match.replace(/^-+|-+$/g, "");
    if (!term || STOP_WORDS.has(term)) continue;
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 6)
    .map(([value]) => value);
}

function intersect(left: string[], right: string[]) {
  const rightSet = new Set(right.map((item) => item.toLowerCase()));
  return left.filter((item) => rightSet.has(item.toLowerCase()));
}

function inferTemplateSlug(blocks: GraphBlockRow[]) {
  const combined = blocks
    .map((block) => [block.block_title ?? "", block.content_excerpt ?? ""].join("\n"))
    .join("\n")
    .toLowerCase();
  const counts = new Map<string, number>();
  for (const block of blocks) {
    counts.set(block.block_type, (counts.get(block.block_type) ?? 0) + 1);
  }

  if (/\b(policy|compliance|regulation|legal|governance)\b/.test(combined)) return "policy-proposal";
  if (/\b(startup|venture|market|gtm|go-to-market|pricing|founder|customer segment|value proposition)\b/.test(combined)) {
    return "startup-idea";
  }
  if (/\b(research|study|interview|survey|experiment|hypothesis)\b/.test(combined)) return "research-question";

  const questionCount = counts.get("question") ?? 0;
  const metricCount = counts.get("metric") ?? 0;
  const riskCount = counts.get("risk") ?? 0;

  if (questionCount >= 2 && metricCount === 0 && riskCount <= 1) return "research-question";
  if (metricCount >= 1 || riskCount >= 1) return "prd";
  if ((counts.get("option") ?? 0) >= 1 && /\b(customer|market|value|launch)\b/.test(combined)) {
    return "startup-idea";
  }
  return "prd";
}

function defaultBlockTitle(type: string) {
  if (type === "question") return "Open question";
  if (type === "risk") return "Risk";
  if (type === "decision") return "Decision";
  if (type === "metric") return "Success metric";
  if (type === "assumption") return "Assumption";
  if (type === "option") return "Option";
  if (type === "table") return "Table";
  return "Context";
}

function getRingPosition(index: number, total: number) {
  if (index === 0) return { ring: 0, position: 0, ringSize: 1 };

  let remaining = index - 1;
  let ring = 1;
  let capacity = 6;
  while (remaining >= capacity) {
    remaining -= capacity;
    ring += 1;
    capacity += 4;
  }

  return {
    ring,
    position: remaining,
    ringSize: Math.min(capacity, Math.max(1, total - 1)),
  };
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}
