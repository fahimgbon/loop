import { z } from "zod";

import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";
import { getArtifact } from "@/src/server/repo/artifacts";
import { listArtifactSuggestions } from "@/src/server/services/feedbackSuggestionService";

const querySchema = z.object({
  includeClosed: z
    .union([z.literal("1"), z.literal("true"), z.literal("0"), z.literal("false")])
    .optional(),
});

export async function GET(request: Request, context: { params: Promise<{ artifactId: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { artifactId } = await context.params;
  const artifact = await withClient((client) => getArtifact(client, session.workspaceId, artifactId));
  if (!artifact) return errorJson(404, "Not found");

  const url = new URL(request.url);
  const query = querySchema.safeParse({
    includeClosed: url.searchParams.get("includeClosed") ?? undefined,
  });
  const includeClosed =
    query.success && query.data.includeClosed
      ? query.data.includeClosed === "1" || query.data.includeClosed === "true"
      : false;

  const suggestions = await withClient((client) =>
    listArtifactSuggestions(client, {
      workspaceId: session.workspaceId,
      artifactId,
      includeClosed,
    }),
  );
  return json({ suggestions });
}
