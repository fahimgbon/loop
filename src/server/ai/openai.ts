import type { AiProvider, ClassificationResult, TranscriptionResult } from "@/src/server/ai/types";
import { getEnv } from "@/src/server/env";

import { MockAiProvider } from "./mock";

/**
 * Minimal OpenAI-backed provider.
 *
 * For now, transcription is implemented via OpenAI Whisper-compatible endpoint.
 * Classification falls back to heuristics until a team-selected LLM prompt is locked.
 */
export class OpenAiProvider implements AiProvider {
  private fallback = new MockAiProvider();

  async transcribeAudio(input: { absolutePath: string; mimeType?: string | null }): Promise<TranscriptionResult> {
    const env = getEnv();
    if (!env.OPENAI_API_KEY) {
      return {
        transcript: "[transcription disabled: set OPENAI_API_KEY]",
      };
    }

    // NOTE: This is intentionally conservative: it may need updates depending on your OpenAI API version.
    const { readFile } = await import("node:fs/promises");
    const bytes = await readFile(input.absolutePath);
    const extension = mimeTypeToExtension(input.mimeType);
    const file = new File([bytes], `capture.${extension}`, { type: input.mimeType ?? "application/octet-stream" });

    const form = new FormData();
    form.append("file", file);
    form.append("model", "whisper-1");

    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: form,
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      return { transcript: `[transcription failed: ${resp.status}] ${txt}`.slice(0, 4000) };
    }
    const data = (await resp.json().catch(() => null)) as { text?: string } | null;
    return { transcript: (data?.text ?? "").trim() || "[empty transcript]" };
  }

  async classifyText(input: { text: string }): Promise<ClassificationResult> {
    return this.fallback.classifyText(input);
  }
}

function mimeTypeToExtension(mimeType?: string | null) {
  switch (mimeType) {
    case "audio/wav":
      return "wav";
    case "audio/mpeg":
      return "mp3";
    case "audio/mp4":
      return "m4a";
    case "audio/ogg":
      return "ogg";
    case "video/mp4":
      return "mp4";
    case "video/quicktime":
      return "mov";
    case "video/x-matroska":
      return "mkv";
    case "video/webm":
    case "audio/webm":
      return "webm";
    default:
      return "bin";
  }
}
