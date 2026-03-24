import { redirect } from "next/navigation";

import { ArtifactGraph } from "@/src/components/graph/ArtifactGraph";
import { GraphIcon } from "@/src/components/icons/LoopIcons";
import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { getWorkspaceById } from "@/src/server/repo/workspaces";
import { getArtifactGraphSnapshot } from "@/src/server/services/artifactGraphService";

export const dynamic = "force-dynamic";

export default async function NetworkPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { workspaceSlug } = await props.params;
  if (workspaceSlug !== session.workspaceSlug) redirect(`/w/${session.workspaceSlug}`);

  const [workspace, graph] = await Promise.all([
    withClient((client) => getWorkspaceById(client, session.workspaceId)),
    getArtifactGraphSnapshot({ workspaceId: session.workspaceId }),
  ]);

  return (
    <main className="px-3 py-3 lg:px-5 lg:py-4">
      <section className="rounded-[30px] border border-slate-200/80 bg-white/94 p-6 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.18)]">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          <GraphIcon className="h-4 w-4" />
          Network
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
          {workspace?.name ?? "Loop"}
        </h1>
        <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-600">
          Hover to trace links, click to inspect, and search when you want to jump directly.
        </p>
      </section>

      <div className="mt-5">
        <ArtifactGraph
          workspaceSlug={workspaceSlug}
          graph={graph}
          mode="full"
          title="Network"
          subtitle="Saved folders, inferred groups, and the links emerging from real workspace content."
        />
      </div>
    </main>
  );
}
