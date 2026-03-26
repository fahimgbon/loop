import Link from "next/link";
import { redirect } from "next/navigation";

import { FolderCard } from "@/src/components/folders/FolderCard";
import {
  FolderIcon,
  NewDocIcon,
  SearchIcon,
  SparkIcon,
} from "@/src/components/icons/LoopIcons";
import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { listArtifacts } from "@/src/server/repo/artifacts";
import { listFolders } from "@/src/server/repo/folders";
import { getArtifactGraphSnapshot } from "@/src/server/services/artifactGraphService";

export const dynamic = "force-dynamic";

export default async function FolderListPage(props: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { workspaceSlug } = await props.params;
  if (workspaceSlug !== session.workspaceSlug) redirect(`/w/${session.workspaceSlug}`);

  const [folders, artifacts, graph] = await Promise.all([
    withClient((client) => listFolders(client, session.workspaceId)),
    withClient((client) => listArtifacts(client, session.workspaceId)),
    getArtifactGraphSnapshot({ workspaceId: session.workspaceId }),
  ]);

  const folderCollections = new Map(
    graph.collections.filter((collection) => collection.kind === "folder").map((collection) => [collection.key, collection]),
  );
  const smartCollections = graph.collections.filter((collection) => collection.kind === "smart");

  const enrichedFolders = folders.map((folder) => {
    const collection = folderCollections.get(`folder:${folder.id}`);
    return {
      ...folder,
      artifactCount: collection?.artifactCount ?? artifacts.filter((artifact) => artifact.folder_id === folder.id).length,
      themes: collection?.sharedThemes ?? [],
      summary:
        collection?.sharedKeywords.length
          ? `Shared language: ${collection.sharedKeywords.slice(0, 3).join(", ")}`
          : "A stable structure for related artifacts.",
    };
  });

  return (
    <main className="px-3 py-3 lg:px-5 lg:py-4">
      <section className="rounded-[30px] border border-slate-200/90 bg-white/96 p-6 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.22)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              <FolderIcon className="h-4 w-4" />
              Folders
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
              Folders
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/w/${workspaceSlug}/search`}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300/90 bg-white/98 px-3.5 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              <SearchIcon className="h-4 w-4" />
              Browse workspace
            </Link>
            <Link
              href={`/w/${workspaceSlug}/folders/new`}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-3.5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              <NewDocIcon className="h-4 w-4" />
              New folder
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[28px] border border-slate-200/90 bg-white/96 p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.22)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">Saved folders</div>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-950">Saved</h2>
            </div>
            <div className="rounded-full border border-slate-300/80 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
              {enrichedFolders.length} total
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {enrichedFolders.length > 0 ? (
              enrichedFolders.map((folder, index) => (
                <Link
                  key={folder.id}
                  href={`/w/${workspaceSlug}/folders/${folder.id}`}
                  className="block h-full"
                >
                  <FolderCard
                    name={folder.name}
                    subtitle={`Structure v${folder.structure_version}`}
                    meta={new Date(folder.updated_at).toLocaleDateString()}
                    badge={index === 0 ? "Most active" : null}
                    count={folder.artifactCount}
                    lead={folder.summary}
                    chips={folder.themes}
                  />
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/92 px-4 py-6 text-sm text-slate-700">
                No folders yet. Start with an inferred cluster on the right or create one from scratch.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200/90 bg-white/96 p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.22)]">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
            <SparkIcon className="h-4 w-4" />
            Suggested
          </div>
          <div className="mt-4 grid gap-3">
            {smartCollections.length > 0 ? (
              smartCollections.slice(0, 6).map((collection) => (
                <div key={collection.key} className="h-full">
                  <FolderCard
                    name={collection.name}
                    subtitle="Auto-inferred from artifacts"
                    label="Smart"
                    kind="smart"
                    count={collection.artifactCount}
                    lead={
                      collection.sharedKeywords.length > 0
                        ? `Transcript overlap: ${collection.sharedKeywords.slice(0, 3).join(", ")}`
                        : "Repeated structure is already emerging."
                    }
                    chips={collection.sharedThemes}
                  />
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/92 px-4 py-6 text-sm text-slate-700">
                Smart folder suggestions will appear as more artifacts accumulate.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
