import { redirect } from "next/navigation";

import { ArtifactWorkspace } from "@/src/components/artifacts/ArtifactWorkspace";
import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { listArtifactPermissions } from "@/src/server/repo/artifactPermissions";
import { getArtifact, listBlocks } from "@/src/server/repo/artifacts";
import { listOpenReviewRequests, listReviewRequestTargets } from "@/src/server/repo/reviewRequests";
import { listWorkspaceMembers } from "@/src/server/repo/workspaces";
import { getArtifactConnectionSummary } from "@/src/server/services/artifactGraphService";

export const dynamic = "force-dynamic";

export default async function ArtifactPage(props: {
  params: Promise<{ workspaceSlug: string; artifactId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { workspaceSlug, artifactId } = await props.params;
  if (workspaceSlug !== session.workspaceSlug) redirect(`/w/${session.workspaceSlug}`);

  const artifact = await withClient((client) => getArtifact(client, session.workspaceId, artifactId));
  if (!artifact) redirect(`/w/${workspaceSlug}`);

  const [blocks, openRequests, permissions, workspaceMembers, connectionSummary] = await Promise.all([
    withClient((client) => listBlocks(client, artifactId)),
    withClient((client) => listOpenReviewRequests(client, session.workspaceId, artifactId)),
    withClient((client) => listArtifactPermissions(client, { workspaceId: session.workspaceId, artifactId })),
    withClient((client) => listWorkspaceMembers(client, session.workspaceId)),
    getArtifactConnectionSummary({ workspaceId: session.workspaceId, artifactId }),
  ]);
  const requestDetails = await Promise.all(
    openRequests.map(async (request) => {
      const blockIds = await withClient((client) => listReviewRequestTargets(client, request.id));
      const questions = Array.isArray(request.questions) ? (request.questions as string[]) : [];
      return {
        id: request.id,
        title: request.title,
        dueAt: request.due_at,
        createdAt: request.created_at,
        questions,
        blockIds,
      };
    }),
  );

  return (
    <ArtifactWorkspace
      workspaceSlug={workspaceSlug}
      artifactId={artifactId}
      artifactTitle={artifact.title}
      artifactStatus={artifact.status}
      initialBlocks={blocks}
      requests={requestDetails}
      openRequestSummaries={openRequests.map((request) => ({
        id: request.id,
        title: request.title,
        createdAt: request.created_at,
        dueAt: request.due_at,
      }))}
      collaborators={permissions.map((permission) => ({
        userId: permission.user_id,
        name: permission.name,
        email: permission.email,
        role: permission.role,
      }))}
      workspaceMembers={workspaceMembers.map((member) => ({
        userId: member.user_id,
        name: member.name,
        email: member.email,
        role: member.role,
      }))}
      linkedArtifacts={connectionSummary.neighbors}
    />
  );
}
