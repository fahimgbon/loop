import { z } from "zod";

import { getSession } from "@/src/server/auth";
import { errorJson, json } from "@/src/server/http";
import { createMeetingTextContribution } from "@/src/server/services/contributionService";

const schema = z.object({
  title: z.string().max(200).optional(),
  notesMd: z.string().min(1).max(80_000),
  artifactId: z.string().uuid().optional(),
  sourceRef: z.string().max(500).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  const content = [
    parsed.data.title?.trim() ? `Meeting: ${parsed.data.title.trim()}` : null,
    parsed.data.notesMd.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");

  const sourceRef =
    parsed.data.sourceRef?.trim() || `manual_meeting:${new Date().toISOString()}:${session.userId}`;

  const created = await createMeetingTextContribution({
    workspaceId: session.workspaceId,
    artifactId: parsed.data.artifactId ?? null,
    sourceRef,
    text: content,
  });

  return json({ ok: true, contributionId: created.id });
}
