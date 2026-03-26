import { redirect } from "next/navigation";

import { CaptureExperience } from "@/src/components/capture/CaptureExperience";
import { getSession } from "@/src/server/auth";

export const dynamic = "force-dynamic";

export default async function CapturePage(props: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams?: Promise<{ contributionId?: string | string[] }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { workspaceSlug } = await props.params;
  if (workspaceSlug !== session.workspaceSlug) redirect(`/w/${session.workspaceSlug}/capture`);
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const contributionParam = searchParams?.contributionId;
  const initialContributionId =
    typeof contributionParam === "string"
      ? contributionParam
      : Array.isArray(contributionParam)
        ? contributionParam[0] ?? null
        : null;

  return <CaptureExperience workspaceSlug={workspaceSlug} initialContributionId={initialContributionId} />;
}
