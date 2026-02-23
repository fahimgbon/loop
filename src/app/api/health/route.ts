import { json } from "@/src/server/http";

export async function GET() {
  return json({ ok: true });
}

