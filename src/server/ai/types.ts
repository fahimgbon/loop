import type { ContributionIntent } from "@/src/server/repo/contributions";

export type TranscriptionResult = {
  transcript: string;
};

export type ClassificationResult = {
  intent: ContributionIntent;
  confidence: number | null;
  extractedJson: Record<string, unknown> | null;
};

export interface AiProvider {
  transcribeAudio(input: { absolutePath: string; mimeType?: string | null }): Promise<TranscriptionResult>;
  classifyText(input: { text: string }): Promise<ClassificationResult>;
}

