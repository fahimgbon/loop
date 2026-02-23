import { z } from "zod";

import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";
import { getGoogleInstallationForWorkspace } from "@/src/server/repo/googleInstallations";
import { getWorkspaceById } from "@/src/server/repo/workspaces";
import { syncGoogleCalendar } from "@/src/server/services/googleSyncService";

const schema = z.object({
  calendarId: z.string().min(1).nullable().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");
  if (session.role !== "admin") return errorJson(403, "Admin only");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) return errorJson(400, "Invalid request");

  const [workspace, google] = await Promise.all([
    withClient((client) => getWorkspaceById(client, session.workspaceId)),
    withClient((client) => getGoogleInstallationForWorkspace(client, session.workspaceId)),
  ]);
  if (!google) return errorJson(400, "Google Workspace not connected");

  const calendarId =
    parsed.data.calendarId ??
    workspace?.default_google_calendar_id ??
    "primary";

  const results = await syncGoogleCalendar({
    workspaceId: session.workspaceId,
    calendarId,
  });

  return json({ ok: true, ...results });
}
