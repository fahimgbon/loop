import { z } from "zod";

import { getRequestSession } from "@/src/server/auth";
import { errorJson, json } from "@/src/server/http";
import { importDocumentWithSmartFill } from "@/src/server/services/importService";

const schema = z
  .object({
    title: z.string().optional(),
    documentMd: z.string().min(1).max(150_000),
    mode: z.enum(["new_artifact", "extend_artifact"]),
    targetArtifactId: z.string().uuid().optional(),
    structureMode: z.enum(["template", "custom"]).optional(),
    templateSlug: z.string().min(1).optional(),
    folderId: z.string().uuid().optional(),
  })
  .refine((data) => (data.mode === "extend_artifact" ? Boolean(data.targetArtifactId) : true), {
    message: "targetArtifactId is required for extend mode",
    path: ["targetArtifactId"],
  });

export async function POST(request: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getRequestSession(request);
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  try {
    const imported = await importDocumentWithSmartFill({
      workspaceId: session.workspaceId,
      userId: session.userId,
      documentMd: parsed.data.documentMd,
      mode: parsed.data.mode,
      targetArtifactId: parsed.data.targetArtifactId,
      structureMode: parsed.data.structureMode,
      templateSlug: parsed.data.templateSlug,
      folderId: parsed.data.folderId,
      title: parsed.data.title,
    });

    return json({
      ok: true,
      mode: imported.mode,
      artifactId: imported.artifactId,
      createdArtifact: imported.createdArtifact,
      updatedBlocks: imported.updatedBlocks,
      insertedBlocks: imported.insertedBlocks,
      suggestedTemplateSlug: imported.suggestedTemplateSlug,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return errorJson(400, message);
  }
}
