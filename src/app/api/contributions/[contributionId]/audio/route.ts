import { readFile } from "node:fs/promises";
import path from "node:path";

import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { errorJson } from "@/src/server/http";
import { getContribution } from "@/src/server/repo/contributions";

export async function GET(_: Request, context: { params: Promise<{ contributionId: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { contributionId } = await context.params;
  const contribution = await withClient((client) =>
    getContribution(client, session.workspaceId, contributionId),
  );
  if (!contribution) return errorJson(404, "Not found");
  if (!contribution.audio_path) return errorJson(404, "No audio");

  const fullPath = path.join(process.cwd(), contribution.audio_path);
  const bytes = await readFile(fullPath);
  const mimeType = extToMime(path.extname(fullPath).slice(1));

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

function extToMime(ext: string) {
  switch (ext) {
    case "webm":
      return "audio/webm";
    case "wav":
      return "audio/wav";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    default:
      return "application/octet-stream";
  }
}

