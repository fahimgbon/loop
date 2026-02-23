import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { nanoid } from "nanoid";

const UPLOAD_ROOT = path.join(process.cwd(), "data", "uploads");

export async function saveAudioFile(input: {
  workspaceId: string;
  bytes: Uint8Array;
  mimeType: string;
}): Promise<{ relativePath: string }> {
  const ext = mimeToExt(input.mimeType);
  const dir = path.join(UPLOAD_ROOT, input.workspaceId, "audio");
  await mkdir(dir, { recursive: true });
  const filename = `${new Date().toISOString().replace(/[:.]/g, "-")}_${nanoid(10)}.${ext}`;
  const fullPath = path.join(dir, filename);
  await writeFile(fullPath, input.bytes);
  const relativePath = path.relative(process.cwd(), fullPath);
  return { relativePath };
}

function mimeToExt(mime: string) {
  switch (mime) {
    case "audio/webm":
      return "webm";
    case "audio/wav":
      return "wav";
    case "audio/mpeg":
      return "mp3";
    case "audio/mp4":
      return "m4a";
    case "audio/ogg":
      return "ogg";
    default:
      return "bin";
  }
}

