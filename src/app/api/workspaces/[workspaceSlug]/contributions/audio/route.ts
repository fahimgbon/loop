import { getSession } from "@/src/server/auth";
import { errorJson, json } from "@/src/server/http";
import { saveAudioFile } from "@/src/server/storage";
import { createWebAudioContribution } from "@/src/server/services/contributionService";

export async function POST(request: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const form = await request.formData().catch(() => null);
  if (!form) return errorJson(400, "Invalid form");

  const file = form.get("file");
  if (!(file instanceof File)) return errorJson(400, "Missing audio file");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const saved = await saveAudioFile({ workspaceId: session.workspaceId, bytes, mimeType: file.type });

  const artifactId = typeof form.get("artifactId") === "string" ? String(form.get("artifactId")) : null;
  const blockId = typeof form.get("blockId") === "string" ? String(form.get("blockId")) : null;

  const created = await createWebAudioContribution({
    workspaceId: session.workspaceId,
    userId: session.userId,
    artifactId,
    blockId,
    audioPath: saved.relativePath,
  });

  return json({ ok: true, contributionId: created.id, audioPath: saved.relativePath });
}

