import { redirect } from "next/navigation";

import { WorkspaceShellClient } from "@/src/components/workspace/WorkspaceShellClient";
import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { listArtifacts } from "@/src/server/repo/artifacts";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout(props: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { workspaceSlug } = await props.params;
  if (workspaceSlug !== session.workspaceSlug) redirect(`/w/${session.workspaceSlug}`);

  const artifacts = await withClient((client) => listArtifacts(client, session.workspaceId, { limit: 10 }));

  return (
    <WorkspaceShellClient
      workspaceSlug={workspaceSlug}
      role={session.role}
      recentArtifacts={artifacts.slice(0, 10).map((artifact) => ({
        id: artifact.id,
        title: artifact.title,
        updatedAt: artifact.updated_at,
      }))}
    >
      {props.children}
    </WorkspaceShellClient>
  );
}
