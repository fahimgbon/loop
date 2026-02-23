import { readFile } from "node:fs/promises";

import type { AiProvider, ClassificationResult, TranscriptionResult } from "@/src/server/ai/types";
import type { ContributionIntent } from "@/src/server/repo/contributions";

export class MockAiProvider implements AiProvider {
  async transcribeAudio(input: { absolutePath: string }): Promise<TranscriptionResult> {
    const bytes = await readFile(input.absolutePath);
    return {
      transcript: `[[mock transcription]] (${bytes.length} bytes)`,
    };
  }

  async classifyText(input: { text: string }): Promise<ClassificationResult> {
    const text = input.text.trim();
    const intent = classifyHeuristic(text);
    return {
      intent,
      confidence: text.length ? 0.55 : 0.1,
      extractedJson: text.length ? { keywords: extractKeywords(text) } : null,
    };
  }
}

function classifyHeuristic(text: string): ContributionIntent {
  const t = text.toLowerCase();
  if (!t) return "unknown";
  if (t.includes("?") || t.startsWith("q:") || t.startsWith("question")) return "question";
  if (t.includes("assume") || t.startsWith("assumption")) return "assumption";
  if (t.includes("risk") || t.includes("legal") || t.includes("compliance")) return "risk";
  if (t.includes("idea") || t.includes("we should") || t.includes("let's")) return "idea";
  if (t.includes("feedback") || t.includes("nit") || t.includes("suggest")) return "feedback";
  return "feedback";
}

function extractKeywords(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const stop = new Set(["the", "a", "an", "and", "or", "to", "of", "in", "for", "on", "we", "i", "it"]);
  const freq = new Map<string, number>();
  for (const w of cleaned) {
    if (w.length < 3) continue;
    if (stop.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);
}

