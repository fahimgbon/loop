import Link from "next/link";
import { redirect } from "next/navigation";

import { FolderStructureForm } from "@/src/components/folders/FolderStructureForm";
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

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-4 flex items-center gap-2 text-xs text-muted">
        <Link href={`/w/${workspaceSlug}/folders`} className="rounded-full border border-white/60 bg-white/40 px-3 py-1 hover:bg-white/70">
          Folders
        </Link>
        <span>/</span>
        <span className="rounded-full border border-white/60 bg-white/60 px-3 py-1 text-slate-800">{folder.name}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{folder.name}</h1>
          <p className="mt-1 text-sm text-muted">
            Structure version {folder.structure_version}. Updating this affects new artifacts immediately.
          </p>
        </div>
        <Link
          href={`/w/${workspaceSlug}/artifacts/new?folderId=${encodeURIComponent(folder.id)}`}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          New artifact in folder
        </Link>
      </div>

      <div className="glass mt-6 rounded-xl p-6">
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

      <section className="mt-6 grid gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Artifacts in this folder</h2>
        {artifacts.length === 0 ? (
          <div className="glass rounded-xl p-5 text-sm text-muted">No artifacts yet.</div>
        ) : (
          artifacts.map((artifact) => {
            const needsSync = (artifact.folder_schema_version ?? 0) < folder.structure_version;
            return (
              <Link
                key={artifact.id}
                href={`/w/${workspaceSlug}/artifacts/${artifact.id}`}
                className="glass rounded-xl p-4 hover:bg-white/70"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{artifact.title}</div>
                    <div className="text-xs text-muted">
                      {needsSync ? "Needs structure sync review" : "Structure up to date"}
                    </div>
                  </div>
                  <div className="text-xs text-muted">{new Date(artifact.updated_at).toLocaleString()}</div>
                </div>
              </Link>
            );
          })
        )}
      </section>
    </main>
  );
}
