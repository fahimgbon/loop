import { clearSessionCookie } from "@/src/server/auth";
import { json } from "@/src/server/http";

export async function POST() {
  await clearSessionCookie();
  return json({ ok: true });
}

