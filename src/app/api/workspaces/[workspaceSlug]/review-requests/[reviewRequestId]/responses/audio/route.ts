import { getRequestSession } from "@/src/server/auth";
import { errorJson, json } from "@/src/server/http";
import { saveAudioFile } from "@/src/server/storage";
import { addAudioReviewResponse } from "@/src/server/services/reviewResponseService";

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceSlug: string; reviewRequestId: string }> },
) {
  const session = await getRequestSession(request);
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug, reviewRequestId } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const form = await request.formData().catch(() => null);
  if (!form) return errorJson(400, "Invalid form");

  const file = form.get("file");
  if (!(file instanceof File)) return errorJson(400, "Missing audio file");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const saved = await saveAudioFile({
    workspaceId: session.workspaceId,
    bytes,
    mimeType: file.type,
    originalFilename: file.name,
  });

  const created = await addAudioReviewResponse({
    workspaceId: session.workspaceId,
    reviewRequestId,
    userId: session.userId,
    audioPath: saved.relativePath,
  });
  if (!created) return errorJson(404, "Not found");

  return json({ ok: true, contributionId: created.contributionId });
}
