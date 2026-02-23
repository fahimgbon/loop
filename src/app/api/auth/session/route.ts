import { getSession } from "@/src/server/auth";
import { json } from "@/src/server/http";

export async function GET() {
  const session = await getSession();
  return json({ session });
}

