import { redirect } from "next/navigation";

import { CaptureExperience } from "@/src/components/capture/CaptureExperience";
import { getSession } from "@/src/server/auth";

export const dynamic = "force-dynamic";

export default async function CapturePage(props: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { workspaceSlug } = await props.params;
  if (workspaceSlug !== session.workspaceSlug) redirect(`/w/${session.workspaceSlug}/capture`);

  return <CaptureExperience workspaceSlug={workspaceSlug} />;
}

