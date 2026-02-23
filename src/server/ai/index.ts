import { getEnv } from "@/src/server/env";

import type { AiProvider } from "./types";
import { MockAiProvider } from "./mock";
import { OpenAiProvider } from "./openai";

let cached: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (cached) return cached;
  const env = getEnv();
  cached = env.AI_PROVIDER === "openai" ? new OpenAiProvider() : new MockAiProvider();
  return cached;
}

