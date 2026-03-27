import { getRequestSession } from "@/src/server/auth";
import { errorJson, json } from "@/src/server/http";
import { saveAudioFile } from "@/src/server/storage";
import { verifySlackCaptureToken } from "@/src/server/slack/capture";
import { createSlackMediaContribution, createWebAudioContribution } from "@/src/server/services/contributionService";

export async function POST(request: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getRequestSession(request);
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const form = await request.formData().catch(() => null);
  if (!form) return errorJson(400, "Invalid form");

  const file = form.get("file");
  if (!(file instanceof File)) return errorJson(400, "Missing recording or video file");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const saved = await saveAudioFile({
    workspaceId: session.workspaceId,
    bytes,
    mimeType: file.type,
    originalFilename: file.name,
  });

  const artifactId = typeof form.get("artifactId") === "string" ? String(form.get("artifactId")) : null;
  const blockId = typeof form.get("blockId") === "string" ? String(form.get("blockId")) : null;
  const slackCaptureToken =
    typeof form.get("slackCaptureToken") === "string" ? String(form.get("slackCaptureToken")).trim() : "";

  const slackCapture = slackCaptureToken ? await verifySlackCaptureToken(slackCaptureToken) : null;
  if (slackCaptureToken && (!slackCapture || slackCapture.workspaceId !== session.workspaceId)) {
    return errorJson(400, "Invalid Slack capture link");
  }

  const created = slackCapture
    ? await createSlackMediaContribution({
        workspaceId: session.workspaceId,
        userId: session.userId,
        audioPath: saved.relativePath,
        sourceRef: JSON.stringify({
          kind: "slack_capture",
          teamId: slackCapture.slackTeamId,
          channelId: slackCapture.channelId,
          userId: slackCapture.slackUserId,
          uploadedBy: session.userId,
          fileName: file.name || null,
          mimeType: file.type || null,
        }),
      })
    : await createWebAudioContribution({
        workspaceId: session.workspaceId,
        userId: session.userId,
        artifactId,
        blockId,
        audioPath: saved.relativePath,
      });

  return json({
    ok: true,
    contributionId: created.id,
    audioPath: saved.relativePath,
    source: slackCapture ? "slack" : "web_audio",
  });
}
