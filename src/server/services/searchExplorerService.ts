import { withClient } from "@/src/server/db";
import { listArtifacts } from "@/src/server/repo/artifacts";
import { listFolders } from "@/src/server/repo/folders";
import { defaultTemplates } from "@/src/server/templates/defaultTemplates";

type BrowseArtifact = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  folder_id: string | null;
  folder_name: string | null;
};

type BlockSummary = {
  artifact_id: string;
  block_title: string | null;
  block_type: string;
  content_excerpt: string;
};

type ExplorerArtifact = BrowseArtifact & {
  browse_group_key: string;
  browse_group_name: string;
  browse_group_kind: "folder" | "smart";
  inferred_template_slug: string;
  summary_excerpt: string | null;
  summary_blocks: Array<{ title: string | null; type: string }>;
};

export type SearchExplorerResult = {
  artifacts: ExplorerArtifact[];
  blocks: Array<{
    block_id: string;
    block_title: string | null;
    block_type: string;
    content_excerpt: string;
    artifact_id: string;
    artifact_title: string;
    browse_group_key: string;
    browse_group_name: string;
    browse_group_kind: "folder" | "smart";
  }>;
  folders: Array<{
    key: string;
    id: string;
    slug: string;
    name: string;
    kind: "folder" | "smart";
    templateSlug: string | null;
    artifactCount: number;
    updatedAt: string | null;
    artifacts: ExplorerArtifact[];
    suggestedBlocks: Array<{ key: string; type: string; title: string | null; contentMd: string }>;
  }>;
  templates: Array<{ slug: string; name: string; group: string }>;
};

export async function getWorkspaceSearchExplorer(input: {
  workspaceId: string;
  q: string;
}): Promise<SearchExplorerResult> {
  const q = input.q.trim();

  const [browseArtifacts, folders, browseBlockRows] = await Promise.all([
    withClient((client) => listArtifacts(client, input.workspaceId)),
    withClient((client) => listFolders(client, input.workspaceId)),
    withClient((client) =>
      client.query<BlockSummary>(
        `select
           a.id as artifact_id,
           b.title as block_title,
           b.type as block_type,
           left(regexp_replace(coalesce(b.content_md, ''), E'[\\n\\r\\t]+', ' ', 'g'), 240) as content_excerpt
         from artifacts a
         join artifact_blocks b on b.artifact_id = a.id
         where a.workspace_id = $1
         order by a.updated_at desc, b.position asc`,
        [input.workspaceId],
      ),
    ),
  ]);

  const blocksByArtifact = groupBlocksByArtifact(browseBlockRows.rows);
  const explorerArtifacts = browseArtifacts.map((artifact) =>
    buildExplorerArtifact(artifact, blocksByArtifact.get(artifact.id) ?? []),
  );
  const artifactLookup = new Map(explorerArtifacts.map((artifact) => [artifact.id, artifact]));
  const explorerFolders = buildExplorerFolders(explorerArtifacts, folders, blocksByArtifact);
  const templates = defaultTemplates.map((template) => ({
    slug: template.slug,
    name: template.name,
    group: template.group,
  }));

  if (!q.length) {
    return {
      artifacts: [],
      blocks: [],
      folders: explorerFolders,
      templates,
    };
  }

  const results = await withClient(async (client) => {
    const artifacts = await client.query<BrowseArtifact>(
      `select a.id, a.title, a.status, a.updated_at, a.folder_id, f.name as folder_name
       from artifacts a
       left join artifact_folders f on f.id = a.folder_id
       where a.workspace_id = $1 and a.title ilike '%' || $2 || '%'
       order by a.updated_at desc
       limit 24`,
      [input.workspaceId, q],
    );

    const blocks = await client.query<{
      block_id: string;
      block_title: string | null;
      block_type: string;
      content_excerpt: string;
      artifact_id: string;
      artifact_title: string;
    }>(
      `select
         b.id as block_id,
         b.title as block_title,
         b.type as block_type,
         left(regexp_replace(coalesce(b.content_md, ''), E'[\\n\\r\\t]+', ' ', 'g'), 220) as content_excerpt,
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
      [input.workspaceId, q],
    );

    return { artifacts: artifacts.rows, blocks: blocks.rows };
  });

  return {
    artifacts: results.artifacts.map((artifact) => {
      const enriched =
        artifactLookup.get(artifact.id) ??
        buildExplorerArtifact(artifact, blocksByArtifact.get(artifact.id) ?? []);
      return {
        ...artifact,
        browse_group_key: enriched.browse_group_key,
        browse_group_name: enriched.browse_group_name,
        browse_group_kind: enriched.browse_group_kind,
        inferred_template_slug: enriched.inferred_template_slug,
        summary_excerpt: enriched.summary_excerpt,
        summary_blocks: enriched.summary_blocks,
      };
    }),
    blocks: results.blocks.map((block) => {
      const enriched = artifactLookup.get(block.artifact_id);
      return {
        ...block,
        browse_group_key: enriched?.browse_group_key ?? "all",
        browse_group_name: enriched?.browse_group_name ?? "All files",
        browse_group_kind: enriched?.browse_group_kind ?? "smart",
      };
    }),
    folders: explorerFolders,
    templates,
  };
}

function groupBlocksByArtifact(rows: BlockSummary[]) {
  const grouped = new Map<string, BlockSummary[]>();
  for (const row of rows) {
    const list = grouped.get(row.artifact_id) ?? [];
    list.push(row);
    grouped.set(row.artifact_id, list);
  }
  return grouped;
}

function buildExplorerArtifact(artifact: BrowseArtifact, blocks: BlockSummary[]): ExplorerArtifact {
  const inferredTemplateSlug = inferTemplateSlug(blocks);
  const template = defaultTemplates.find((item) => item.slug === inferredTemplateSlug) ?? defaultTemplates[3];

  const summaryBlocks = summarizeBlocks(blocks);
  const summaryExcerpt =
    blocks.find((block) => block.content_excerpt.trim().length > 0)?.content_excerpt.trim() ?? null;
  if (artifact.folder_id) {
    return {
      ...artifact,
      browse_group_key: `folder:${artifact.folder_id}`,
      browse_group_name: artifact.folder_name ?? "Folder",
      browse_group_kind: "folder",
      inferred_template_slug: inferredTemplateSlug,
      summary_excerpt: summaryExcerpt,
      summary_blocks: summaryBlocks,
    };
  }

  return {
    ...artifact,
    browse_group_key: `smart:${template.slug}`,
    browse_group_name: template.group,
    browse_group_kind: "smart",
    inferred_template_slug: template.slug,
    summary_excerpt: summaryExcerpt,
    summary_blocks: summaryBlocks,
  };
}

function summarizeBlocks(blocks: BlockSummary[]) {
  const seen = new Set<string>();
  const summary: Array<{ title: string | null; type: string }> = [];
  for (const block of blocks) {
    const title = block.block_title?.trim() || defaultBlockTitle(block.block_type);
    const key = `${block.block_type}:${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    summary.push({ title, type: block.block_type });
    if (summary.length === 4) break;
  }
  return summary;
}

function buildExplorerFolders(
  artifacts: ExplorerArtifact[],
  folders: Array<{ id: string; slug: string; name: string; structure_version: number; updated_at: string }>,
  blocksByArtifact: Map<string, BlockSummary[]>,
) {
  const actualFolders = folders.map((folder) => {
    const folderArtifacts = artifacts.filter((artifact) => artifact.folder_id === folder.id);
    return {
      key: `folder:${folder.id}`,
      id: folder.id,
      slug: folder.slug,
      name: folder.name,
      kind: "folder" as const,
      templateSlug: null,
      artifactCount: folderArtifacts.length,
      updatedAt: folder.updated_at,
      artifacts: folderArtifacts,
      suggestedBlocks: [] as Array<{ key: string; type: string; title: string | null; contentMd: string }>,
    };
  });

  const smartBucketMap = new Map<
    string,
    {
      key: string;
      id: string;
      slug: string;
      name: string;
      kind: "smart";
      templateSlug: string;
      artifacts: ExplorerArtifact[];
    }
  >();

  for (const artifact of artifacts) {
    if (artifact.folder_id) continue;
    const template = defaultTemplates.find((item) => item.slug === artifact.inferred_template_slug) ?? defaultTemplates[3];
    const existing = smartBucketMap.get(artifact.browse_group_key);
    if (existing) {
      existing.artifacts.push(artifact);
      continue;
    }
    smartBucketMap.set(artifact.browse_group_key, {
      key: artifact.browse_group_key,
      id: template.slug,
      slug: template.slug,
      name: template.group,
      kind: "smart",
      templateSlug: template.slug,
      artifacts: [artifact],
    });
  }

  const smartFolders = Array.from(smartBucketMap.values())
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((folder) => {
      const fallbackTemplate =
        defaultTemplates.find((item) => item.slug === folder.templateSlug) ?? defaultTemplates[3];
      return {
        ...folder,
        artifactCount: folder.artifacts.length,
        updatedAt: folder.artifacts[0]?.updated_at ?? null,
        suggestedBlocks: buildSuggestedBlocks(folder.artifacts, blocksByArtifact, fallbackTemplate.schema.defaultBlocks),
      };
    });

  return [...actualFolders, ...smartFolders];
}

function buildSuggestedBlocks(
  artifacts: ExplorerArtifact[],
  blocksByArtifact: Map<string, BlockSummary[]>,
  fallbackBlocks: Array<{ key?: string; type: string; title?: string | null; contentMd?: string }>,
) {
  const counts = new Map<
    string,
    { count: number; type: string; title: string; order: number }
  >();
  let order = 0;

  for (const artifact of artifacts) {
    const blocks = blocksByArtifact.get(artifact.id) ?? [];
    for (const block of blocks) {
      const title = block.block_title?.trim() || defaultBlockTitle(block.block_type);
      const key = `${block.block_type}:${title.toLowerCase()}`;
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
        continue;
      }
      counts.set(key, {
        count: 1,
        type: block.block_type,
        title,
        order,
      });
      order += 1;
    }
  }

  const inferredBlocks = Array.from(counts.values())
    .sort((left, right) => right.count - left.count || left.order - right.order)
    .slice(0, 10)
    .map((block, index) => ({
      key: normalizeKey(`${block.type}-${block.title}-${index + 1}`),
      type: block.type,
      title: block.title,
      contentMd: "",
    }));

  if (inferredBlocks.length > 0) return inferredBlocks;

  return fallbackBlocks.map((block, index) => ({
    key: normalizeKey(block.key ?? `${block.type}-${block.title ?? "block"}-${index + 1}`),
    type: block.type,
    title: block.title ?? defaultBlockTitle(block.type),
    contentMd: block.contentMd ?? "",
  }));
}

function inferTemplateSlug(blocks: BlockSummary[]) {
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

function normalizeKey(value: string) {
  const out = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return out || "block";
}
