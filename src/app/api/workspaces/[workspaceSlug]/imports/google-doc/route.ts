import { z } from "zod";

import { getRequestSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { getEnv } from "@/src/server/env";
import { errorJson, json } from "@/src/server/http";
import {
  getGoogleInstallationForWorkspace,
  updateGoogleTokens,
} from "@/src/server/repo/googleInstallations";
import { createWebTextContribution } from "@/src/server/services/contributionService";
import { importDocumentWithSmartFill } from "@/src/server/services/importService";

const schema = z.object({
  docUrl: z.string().url(),
  mode: z.enum(["new_artifact", "extend_artifact"]).default("new_artifact"),
  targetArtifactId: z.string().uuid().optional(),
  title: z.string().optional(),
  structureMode: z.enum(["template", "custom"]).optional(),
  templateSlug: z.string().optional(),
  folderId: z.string().uuid().optional(),
  captureContribution: z.boolean().optional(),
});

function extractGoogleDocFileId(url: string) {
  const direct = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (direct) return direct[1];
  const idParam = new URL(url).searchParams.get("id");
  if (idParam && /^[a-zA-Z0-9_-]+$/.test(idParam)) return idParam;
  return null;
}

async function refreshAccessToken(input: {
  workspaceId: string;
  refreshToken: string;
}): Promise<{ accessToken: string; tokenType: string | null; tokenExpiresAt: Date | null }> {
  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth not configured");
  }
  const body = new URLSearchParams();
  body.set("client_id", env.GOOGLE_CLIENT_ID);
  body.set("client_secret", env.GOOGLE_CLIENT_SECRET);
  body.set("refresh_token", input.refreshToken);
  body.set("grant_type", "refresh_token");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await response.json().catch(() => null)) as
    | { access_token?: string; token_type?: string; expires_in?: number }
    | null;
  if (!data?.access_token) throw new Error("Could not refresh Google token");
  const tokenExpiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;

  await withClient((client) =>
    updateGoogleTokens(client, {
      workspaceId: input.workspaceId,
      accessToken: data.access_token!,
      tokenType: data.token_type ?? null,
      tokenExpiresAt,
    }),
  );
  return { accessToken: data.access_token, tokenType: data.token_type ?? null, tokenExpiresAt };
}

async function getValidAccessToken(workspaceId: string) {
  const installation = await withClient((client) =>
    getGoogleInstallationForWorkspace(client, workspaceId),
  );
  if (!installation) throw new Error("Google Workspace is not connected");
  const expiresAt = installation.token_expires_at ? new Date(installation.token_expires_at) : null;
  const expiresSoon = expiresAt ? expiresAt.getTime() - Date.now() < 2 * 60 * 1000 : false;
  if (!expiresSoon) return installation.access_token;
  if (!installation.refresh_token) throw new Error("Google token expired; reconnect required");
  const refreshed = await refreshAccessToken({
    workspaceId,
    refreshToken: installation.refresh_token,
  });
  return refreshed.accessToken;
}

async function exportGoogleDocText(accessToken: string, fileId: string) {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export`);
  url.searchParams.set("mimeType", "text/plain");
  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not export Google Doc text");
  return response.text();
}

export async function POST(request: Request, context: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getRequestSession(request);
  if (!session) return errorJson(401, "Unauthorized");

  const { workspaceSlug } = await context.params;
  if (workspaceSlug !== session.workspaceSlug) return errorJson(403, "Forbidden");

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorJson(400, "Invalid request");

  const fileId = extractGoogleDocFileId(parsed.data.docUrl);
  if (!fileId) return errorJson(400, "Invalid Google Doc URL");

  try {
    const accessToken = await getValidAccessToken(session.workspaceId);
    const text = await exportGoogleDocText(accessToken, fileId);
    const imported = await importDocumentWithSmartFill({
      workspaceId: session.workspaceId,
      userId: session.userId,
      documentMd: text,
      mode: parsed.data.mode,
      targetArtifactId: parsed.data.targetArtifactId,
      title: parsed.data.title,
      structureMode: parsed.data.structureMode,
      templateSlug: parsed.data.templateSlug,
      folderId: parsed.data.folderId,
    });

    let contributionId: string | null = null;
    if (parsed.data.captureContribution) {
      const contributionText = buildGoogleDocContributionText({
        title: parsed.data.title?.trim() || null,
        docUrl: parsed.data.docUrl,
        body: text,
      });
      const contribution = await createWebTextContribution({
        workspaceId: session.workspaceId,
        userId: session.userId,
        artifactId: imported.artifactId,
        text: contributionText,
        sourceRef: `google_doc:${fileId}:${imported.artifactId}`,
      });
      contributionId = contribution.id;
    }

    return json({
      ok: true,
      artifactId: imported.artifactId,
      mode: imported.mode,
      createdArtifact: imported.createdArtifact,
      updatedBlocks: imported.updatedBlocks,
      insertedBlocks: imported.insertedBlocks,
      suggestedTemplateSlug: imported.suggestedTemplateSlug,
      contributionId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google Doc import failed";
    return errorJson(400, message);
  }
}

function buildGoogleDocContributionText(input: { title: string | null; docUrl: string; body: string }) {
  const pieces = [
    input.title ? `Google Doc: ${input.title}` : "Google Doc import",
    `Source: ${input.docUrl}`,
    "",
    input.body.trim(),
  ].filter(Boolean);
  return pieces.join("\n");
}
