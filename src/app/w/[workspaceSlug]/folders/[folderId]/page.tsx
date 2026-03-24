import Link from "next/link";
import { redirect } from "next/navigation";

import { FolderStructureForm } from "@/src/components/folders/FolderStructureForm";
import {
  FolderIcon,
  NewDocIcon,
  SparkIcon,
} from "@/src/components/icons/LoopIcons";
import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { getFolder, listArtifactsForFolder } from "@/src/server/repo/folders";
import { listTemplates } from "@/src/server/repo/templates";
import { parseFolderSchema } from "@/src/server/services/folderService";
import { defaultTemplates } from "@/src/server/templates/defaultTemplates";

export const dynamic = "force-dynamic";

export default async function FolderDetailPage(props: {
  params: Promise<{ workspaceSlug: string; folderId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { workspaceSlug, folderId } = await props.params;
  if (workspaceSlug !== session.workspaceSlug) redirect(`/w/${session.workspaceSlug}`);

  const folder = await withClient((client) => getFolder(client, session.workspaceId, folderId));
  if (!folder) redirect(`/w/${workspaceSlug}/folders`);

  const [templates, artifacts] = await Promise.all([
    withClient((client) => listTemplates(client, session.workspaceId)),
    withClient((client) => listArtifactsForFolder(client, session.workspaceId, folder.id)),
  ]);

  const schema = parseFolderSchema(folder.schema_json);
  const groupBySlug = new Map(defaultTemplates.map((template) => [template.slug, template.group]));
  const needsSyncCount = artifacts.filter(
    (artifact) => (artifact.folder_schema_version ?? 0) < folder.structure_version,
  ).length;
  const blockTitles = schema.defaultBlocks
    .map((block, index) => block.title?.trim() || `${block.type} ${index + 1}`)
    .slice(0, 6);

  return (
    <main className="px-3 py-3 lg:px-5 lg:py-4">
      <section className="rounded-[30px] border border-slate-200/80 bg-white/92 p-6 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.28)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              <FolderIcon className="h-4 w-4" />
              Folder detail
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Link href={`/w/${workspaceSlug}/folders`} className="hover:text-slate-900">
                Folders
              </Link>
              <span>/</span>
              <span className="text-slate-700">{folder.name}</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{folder.name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              This folder holds the reusable structure that new artifacts inherit. Tune it once here, and the workspace
              gets a more consistent collaboration surface everywhere else.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pill label={`Structure v${folder.structure_version}`} />
              <Pill label={`${artifacts.length} artifacts`} />
              <Pill label={`${schema.defaultBlocks.length} default blocks`} />
              <Pill label={`${needsSyncCount} need sync review`} />
            </div>
          </div>

          <Link
            href={`/w/${workspaceSlug}/artifacts/new?folderId=${encodeURIComponent(folder.id)}`}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-3.5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            <NewDocIcon className="h-4 w-4" />
            New artifact in folder
          </Link>
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.3)]">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <SparkIcon className="h-4 w-4" />
            Structure editor
          </div>
          <div className="mt-4">
            <FolderStructureForm
              workspaceSlug={workspaceSlug}
              mode="edit"
              folderId={folder.id}
              initialName={folder.name}
              initialBlocks={schema.defaultBlocks.map((block, index) => ({
                key: block.key ?? `${block.type}-${index + 1}`,
                type: block.type,
                title: block.title ?? "",
                contentMd: block.contentMd ?? "",
              }))}
              templates={templates.map((template) => ({
                slug: template.slug,
                name: template.name,
                group: groupBySlug.get(template.slug) ?? template.name,
              }))}
            />
          </div>
        </section>

        <aside className="grid gap-4">
          <section className="rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.3)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Default block flow</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {blockTitles.map((title) => (
                <span key={title} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
                  {title}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.3)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Sync health</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              {needsSyncCount > 0
                ? `${needsSyncCount} artifact${needsSyncCount === 1 ? "" : "s"} were created from an older structure version.`
                : "All artifacts in this folder are aligned with the latest structure."}
            </div>
          </section>
        </aside>
      </div>

      <section className="mt-5 rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.3)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Artifacts in this folder</div>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-950">What is already using this structure</h2>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {artifacts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
              No artifacts yet. The next artifact created here will inherit this structure automatically.
            </div>
          ) : (
            artifacts.map((artifact) => {
              const needsSync = (artifact.folder_schema_version ?? 0) < folder.structure_version;
              return (
                <Link
                  key={artifact.id}
                  href={`/w/${workspaceSlug}/artifacts/${artifact.id}`}
                  className="rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4 transition hover:border-slate-300 hover:bg-white"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-slate-950">{artifact.title}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        {needsSync ? "Needs a structure sync review" : "Using the latest folder structure"}
                      </div>
                    </div>
                    <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                      {new Date(artifact.updated_at).toLocaleString()}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}

function Pill(props: { label: string }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
      {props.label}
    </span>
  );
}
