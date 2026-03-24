import { getSession } from "@/src/server/auth";
import { TopNavClient } from "./TopNavClient";

export async function TopNav() {
  const session = await getSession();
  return <TopNavClient session={session} />;
}
