import { redirect } from "next/navigation";

import { ArtifactGraph } from "@/src/components/graph/ArtifactGraph";
import { getSession } from "@/src/server/auth";
import { getArtifactGraphSnapshot } from "@/src/server/services/artifactGraphService";

export const dynamic = "force-dynamic";

export default async function NetworkPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { workspaceSlug } = await props.params;
  if (workspaceSlug !== session.workspaceSlug) redirect(`/w/${session.workspaceSlug}`);

  const graph = await getArtifactGraphSnapshot({ workspaceId: session.workspaceId });

  return (
    <main className="px-3 py-3 lg:px-5 lg:py-4">
      <ArtifactGraph workspaceSlug={workspaceSlug} graph={graph} mode="full" title="Network" subtitle="" />
    </main>
  );
}
