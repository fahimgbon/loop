import { z } from "zod";

import { getSession } from "@/src/server/auth";
import { errorJson, json } from "@/src/server/http";
import { inferStructureFromDocument } from "@/src/server/services/structureInference";

const schema = z.object({
  title: z.string().optional(),
  documentMd: z.string().min(1).max(150_000),
});

export async function POST(request: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  const inferred = await inferStructureFromDocument({
    markdown: parsed.data.documentMd,
    explicitTitle: parsed.data.title ?? null,
  });

  return json({
    ok: true,
    inferred: {
      suggestedTitle: inferred.suggestedTitle,
      suggestedTemplateSlug: inferred.suggestedTemplateSlug,
      blocks: inferred.blocks.map((block) => ({
        key: block.key,
        type: block.type,
        title: block.title,
        confidence: block.confidence,
        rationale: block.rationale,
      })),
    },
  });
}
