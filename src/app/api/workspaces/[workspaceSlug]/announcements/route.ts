import { z } from "zod";

import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { errorJson, json } from "@/src/server/http";
import { createAnnouncement, listAnnouncements } from "@/src/server/repo/announcements";

const postSchema = z.object({
  title: z.string().min(2).max(180),
  bodyMd: z.string().max(30_000).optional(),
  source: z
    .enum(["manual", "announcement", "google_classroom", "google_form", "google_meet", "slack"])
    .optional(),
  sourceRef: z.string().max(500).optional(),
});

export async function GET(_: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const announcements = await withClient((client) => listAnnouncements(client, session.workspaceId, 80));
  return json({
    announcements: announcements.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      bodyMd: announcement.body_md,
      source: announcement.source,
      sourceRef: announcement.source_ref,
      createdAt: announcement.created_at,
      createdByName: announcement.created_by_name,
      createdByEmail: announcement.created_by_email,
    })),
  });
}

export async function POST(request: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  const created = await withClient((client) =>
    createAnnouncement(client, {
      workspaceId: session.workspaceId,
      title: parsed.data.title.trim(),
      bodyMd: parsed.data.bodyMd?.trim() ?? "",
      source: parsed.data.source ?? "manual",
      sourceRef: parsed.data.sourceRef?.trim() || null,
      createdBy: session.userId,
    }),
  );
  return json({ ok: true, announcementId: created.id });
}
