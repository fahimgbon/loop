import crypto from "node:crypto";

import { getEnv } from "@/src/server/env";

export function verifySlackRequest(input: {
  rawBody: string;
  headers: Headers;
}): { ok: true } | { ok: false; error: string } {
  const env = getEnv();
  const signingSecret = env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return { ok: false, error: "Slack signing secret not configured" };

  const timestamp = input.headers.get("x-slack-request-timestamp");
  const signature = input.headers.get("x-slack-signature");
  if (!timestamp || !signature) return { ok: false, error: "Missing Slack signature headers" };

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, error: "Invalid timestamp" };
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 60 * 5) return { ok: false, error: "Stale request" };

  const base = `v0:${timestamp}:${input.rawBody}`;
  const expected =
    "v0=" + crypto.createHmac("sha256", signingSecret).update(base, "utf8").digest("hex");
  const ok = timingSafeEqual(expected, signature);
  return ok ? { ok: true } : { ok: false, error: "Invalid signature" };
}

function timingSafeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

