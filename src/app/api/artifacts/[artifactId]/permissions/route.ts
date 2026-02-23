import { z } from "zod";

import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";
import {
  deleteArtifactPermission,
  listArtifactPermissions,
  upsertArtifactPermission,
} from "@/src/server/repo/artifactPermissions";
import { getArtifact } from "@/src/server/repo/artifacts";
import { listWorkspaceMembers } from "@/src/server/repo/workspaces";

const upsertSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["viewer", "editor"]),
});

const deleteSchema = z.object({
  userId: z.string().uuid(),
});

export async function GET(_: Request, context: { params: Promise<{ artifactId: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");
  const { artifactId } = await context.params;

  const artifact = await withClient((client) => getArtifact(client, session.workspaceId, artifactId));
  if (!artifact) return errorJson(404, "Not found");

  const [permissions, members] = await Promise.all([
    withClient((client) =>
      listArtifactPermissions(client, { workspaceId: session.workspaceId, artifactId }),
    ),
    withClient((client) => listWorkspaceMembers(client, session.workspaceId)),
  ]);

  return json({
    permissions: permissions.map((permission) => ({
      userId: permission.user_id,
      name: permission.name,
      email: permission.email,
      role: permission.role,
      grantedByName: permission.granted_by_name,
      updatedAt: permission.updated_at,
    })),
    members: members.map((member) => ({
      userId: member.user_id,
      role: member.role,
      name: member.name,
      email: member.email,
    })),
  });
}

export async function POST(request: Request, context: { params: Promise<{ artifactId: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");
  const { artifactId } = await context.params;

  const body = await request.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  const artifact = await withClient((client) => getArtifact(client, session.workspaceId, artifactId));
  if (!artifact) return errorJson(404, "Not found");

  const saved = await withClient((client) =>
    upsertArtifactPermission(client, {
      workspaceId: session.workspaceId,
      artifactId,
      userId: parsed.data.userId,
      role: parsed.data.role,
      grantedBy: session.userId,
    }),
  );
  if (!saved) return errorJson(400, "User must be a workspace member");

  return json({ ok: true });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ artifactId: string }> },
) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");
  const { artifactId } = await context.params;

  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  if (parsed.data.userId === session.userId) {
    return errorJson(400, "You cannot remove your own artifact access");
  }

  const artifact = await withClient((client) => getArtifact(client, session.workspaceId, artifactId));
  if (!artifact) return errorJson(404, "Not found");

  await withClient((client) =>
    deleteArtifactPermission(client, {
      workspaceId: session.workspaceId,
      artifactId,
      userId: parsed.data.userId,
    }),
  );

  return json({ ok: true });
}
