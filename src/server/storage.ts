import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { nanoid } from "nanoid";

const UPLOAD_ROOT = path.join(process.cwd(), "data", "uploads");

export async function saveAudioFile(input: {
  workspaceId: string;
  bytes: Uint8Array;
  mimeType: string;
  originalFilename?: string;
}): Promise<{ relativePath: string }> {
  const ext = mimeToExt(input.mimeType, input.originalFilename);
  const dir = path.join(UPLOAD_ROOT, input.workspaceId, "audio");
  await mkdir(dir, { recursive: true });
  const filename = `${new Date().toISOString().replace(/[:.]/g, "-")}_${nanoid(10)}.${ext}`;
  const fullPath = path.join(dir, filename);
  await writeFile(fullPath, input.bytes);
  const relativePath = path.relative(process.cwd(), fullPath);
  return { relativePath };
}

export function pathToMimeType(filePath: string) {
  return extToMime(path.extname(filePath).slice(1));
}

function mimeToExt(mime: string, originalFilename?: string) {
  switch (mime) {
    case "audio/webm":
    case "video/webm":
      return "webm";
    case "audio/wav":
      return "wav";
    case "audio/mpeg":
      return "mp3";
    case "audio/mp4":
      return "m4a";
    case "video/mp4":
      return "mp4";
    case "audio/ogg":
      return "ogg";
    case "video/quicktime":
      return "mov";
    case "video/x-matroska":
      return "mkv";
    default:
      return filenameToExt(originalFilename) ?? "bin";
  }
}

function filenameToExt(filename?: string) {
  if (!filename) return null;
  const ext = path.extname(filename).slice(1).toLowerCase();
  return ext || null;
}

function extToMime(ext: string) {
  switch (ext.toLowerCase()) {
    case "webm":
      return "video/webm";
    case "wav":
      return "audio/wav";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "mp4":
      return "video/mp4";
    case "ogg":
      return "audio/ogg";
    case "mov":
      return "video/quicktime";
    case "mkv":
      return "video/x-matroska";
    default:
      return "application/octet-stream";
  }
}
