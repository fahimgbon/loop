import { getRequestSession } from "@/src/server/auth";
import { json } from "@/src/server/http";

export async function GET(request: Request) {
  const session = await getRequestSession(request);
  return json({ session });
}
