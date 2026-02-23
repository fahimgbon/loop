import { getEnv } from "@/src/server/env";
import { withClient } from "@/src/server/db";
import { getContributionBySourceRef } from "@/src/server/repo/contributions";
import { getGoogleInstallationForWorkspace, updateGoogleTokens } from "@/src/server/repo/googleInstallations";
import { findArtifactByTitle } from "@/src/server/repo/artifacts";
import { createMeetingTextContribution } from "@/src/server/services/contributionService";
import { importDocumentWithSmartFill } from "@/src/server/services/importService";

type GoogleCalendarEvent = {
  id: string;
  summary?: string | null;
  description?: string | null;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attachments?: Array<{ fileId?: string; title?: string; mimeType?: string }>;
};

type GoogleCalendarResponse = {
  items?: GoogleCalendarEvent[];
};

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";

function extractArtifactId(input?: string | null): string | null {
  if (!input) return null;
  const text = input.trim();
  if (!text) return null;
  const explicit = text.match(/loop:artifact:([0-9a-f-]{36})/i);
  if (explicit) return explicit[1];
  const uuidMatch = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuidMatch) return uuidMatch[0];
  const urlMatch = text.match(/\/artifacts\/([0-9a-f-]{36})/i);
  if (urlMatch) return urlMatch[1];
  return null;
}

async function refreshAccessToken(input: {
  workspaceId: string;
  refreshToken: string;
}): Promise<{ accessToken: string; expiresAt: Date | null; tokenType: string | null }> {
  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth not configured");
  }

  const body = new URLSearchParams();
  body.set("client_id", env.GOOGLE_CLIENT_ID);
  body.set("client_secret", env.GOOGLE_CLIENT_SECRET);
  body.set("refresh_token", input.refreshToken);
  body.set("grant_type", "refresh_token");

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await resp.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number; token_type?: string }
    | null;
  if (!data?.access_token) throw new Error("Failed to refresh Google token");

  const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
  await withClient((client) =>
    updateGoogleTokens(client, {
      workspaceId: input.workspaceId,
      accessToken: data.access_token!,
      tokenType: data.token_type ?? null,
      tokenExpiresAt: expiresAt,
    }),
  );

  return { accessToken: data.access_token, expiresAt, tokenType: data.token_type ?? null };
}

async function getAccessToken(workspaceId: string) {
  const installation = await withClient((client) => getGoogleInstallationForWorkspace(client, workspaceId));
  if (!installation) throw new Error("Google not connected");

  const expiresAt = installation.token_expires_at ? new Date(installation.token_expires_at) : null;
  const isExpired = expiresAt ? expiresAt.getTime() - Date.now() < 2 * 60 * 1000 : false;
  if (!isExpired) {
    return {
      accessToken: installation.access_token,
      installedBy: installation.installed_by,
    };
  }

  if (!installation.refresh_token) throw new Error("Google token expired; reconnect required");
  const refreshed = await refreshAccessToken({
    workspaceId,
    refreshToken: installation.refresh_token,
  });
  return {
    accessToken: refreshed.accessToken,
    installedBy: installation.installed_by,
  };
}

async function exportGoogleDocText(accessToken: string, fileId: string): Promise<string | null> {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export`);
  url.searchParams.set("mimeType", "text/plain");
  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) return null;
  return resp.text();
}

export async function syncGoogleCalendar(input: {
  workspaceId: string;
  calendarId: string;
  daysBack?: number;
  maxEvents?: number;
}): Promise<{ events: number; attachments: number; contributions: number; signalUpdates: number }> {
  const auth = await getAccessToken(input.workspaceId);
  const timeMin = new Date(Date.now() - (input.daysBack ?? 30) * 24 * 60 * 60 * 1000).toISOString();

  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events`);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("maxResults", String(input.maxEvents ?? 50));
  url.searchParams.set("supportsAttachments", "true");
  url.searchParams.set(
    "fields",
    "items(id,summary,description,start,end,attachments(fileId,title,mimeType))",
  );

  const resp = await fetch(url.toString(), { headers: { Authorization: `Bearer ${auth.accessToken}` } });
  if (!resp.ok) throw new Error("Failed to fetch calendar events");
  const data = (await resp.json().catch(() => null)) as GoogleCalendarResponse | null;
  const events = data?.items ?? [];

  let attachmentCount = 0;
  let contributionCount = 0;
  let signalUpdates = 0;

  for (const event of events) {
    const attachments = event.attachments ?? [];
    if (!attachments.length) continue;

    const artifactFromDescription = extractArtifactId(event.description);
    const artifactFromTitle =
      !artifactFromDescription && event.summary
        ? await withClient((client) =>
            findArtifactByTitle(client, { workspaceId: input.workspaceId, title: event.summary! }),
          )
        : null;
    const linkedArtifactId = artifactFromDescription ?? artifactFromTitle?.id ?? null;

    for (const attachment of attachments) {
      if (!attachment.fileId || attachment.mimeType !== GOOGLE_DOC_MIME) continue;
      attachmentCount += 1;

      const sourceRef = `google_calendar:${input.calendarId}:event:${event.id}:file:${attachment.fileId}`;
      const existing = await withClient((client) =>
        getContributionBySourceRef(client, { workspaceId: input.workspaceId, sourceRef }),
      );
      if (existing) continue;

      const docText = await exportGoogleDocText(auth.accessToken, attachment.fileId);
      if (!docText) continue;

      const header = [
        `Meeting: ${event.summary ?? "Untitled"}`,
        event.start?.dateTime || event.start?.date ? `Start: ${event.start.dateTime ?? event.start.date}` : null,
        attachment.title ? `Doc: ${attachment.title}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const description = event.description?.trim();
      const combined = [header, docText, description ? `Event description:\n${description}` : null]
        .filter(Boolean)
        .join("\n\n")
        .trim();
      if (!combined) continue;

      await createMeetingTextContribution({
        workspaceId: input.workspaceId,
        artifactId: linkedArtifactId,
        sourceRef,
        text: combined,
      });
      contributionCount += 1;

      if (linkedArtifactId && auth.installedBy) {
        try {
          const merged = await importDocumentWithSmartFill({
            workspaceId: input.workspaceId,
            userId: auth.installedBy,
            mode: "extend_artifact",
            targetArtifactId: linkedArtifactId,
            documentMd: combined,
            title: event.summary ?? undefined,
          });
          if (merged.updatedBlocks > 0 || merged.insertedBlocks > 0) signalUpdates += 1;
        } catch {
          // Ignore import errors for individual events, continue syncing.
        }
      }
    }
  }

  return {
    events: events.length,
    attachments: attachmentCount,
    contributions: contributionCount,
    signalUpdates,
  };
}
