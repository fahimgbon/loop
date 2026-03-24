import { redirect } from "next/navigation";

import { SearchWorkspaceClient } from "@/src/components/search/SearchWorkspaceClient";
import { getSession } from "@/src/server/auth";
import { getWorkspaceSearchExplorer } from "@/src/server/services/searchExplorerService";

export const dynamic = "force-dynamic";

export default async function SearchPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { workspaceSlug } = await props.params;
  if (workspaceSlug !== session.workspaceSlug) redirect(`/w/${session.workspaceSlug}`);

  const initialResult = await getWorkspaceSearchExplorer({
    workspaceId: session.workspaceId,
    q: "",
  });

  return <SearchWorkspaceClient workspaceSlug={workspaceSlug} initialResult={initialResult} />;
}
