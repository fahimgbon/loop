import { redirect } from "next/navigation";

import { UnifiedWorkspaceClient } from "@/src/components/workspace/UnifiedWorkspaceClient";
import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { listInboxContributions } from "@/src/server/repo/contributions";
import { getWorkspaceSearchExplorer } from "@/src/server/services/searchExplorerService";

export const dynamic = "force-dynamic";

export default async function UnifiedPage(props: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { workspaceSlug } = await props.params;
  if (workspaceSlug !== session.workspaceSlug) redirect(`/w/${session.workspaceSlug}`);

  const [explorer, inboxItems] = await Promise.all([
    getWorkspaceSearchExplorer({ workspaceId: session.workspaceId, q: "" }),
    withClient((client) => listInboxContributions(client, session.workspaceId)),
  ]);

  const artifacts = Array.from(
    new Map(
      explorer.folders
        .flatMap((folder) => folder.artifacts)
        .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())
        .map((artifact) => [
          artifact.id,
          {
            id: artifact.id,
            title: artifact.title,
            status: artifact.status,
            updatedAt: artifact.updated_at,
            groupName: artifact.browse_group_name,
            excerpt: artifact.summary_excerpt,
          },
        ]),
    ).values(),
  );

  const folders = explorer.folders
    .map((folder) => ({
      key: folder.key,
      id: folder.id,
      slug: folder.slug,
      name: folder.name,
      kind: folder.kind,
      artifactCount: folder.artifactCount,
      updatedAt: folder.updatedAt,
      artifacts: folder.artifacts.map((artifact) => ({
        id: artifact.id,
        title: artifact.title,
        status: artifact.status,
        updatedAt: artifact.updated_at,
        excerpt: artifact.summary_excerpt,
      })),
      suggestedBlocks: folder.suggestedBlocks,
    }))
    .sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1;
      if (right.artifactCount !== left.artifactCount) return right.artifactCount - left.artifactCount;
      return left.name.localeCompare(right.name);
    });

  const inbox = inboxItems.map((item) => ({
    id: item.id,
    intent: item.intent,
    createdAt: item.created_at,
    preview: (item.transcript ?? item.text_content ?? "").trim() || null,
  }));

  return (
    <UnifiedWorkspaceClient
      workspaceSlug={workspaceSlug}
      artifacts={artifacts}
      folders={folders}
      inbox={inbox}
      templates={explorer.templates}
    />
  );
}
