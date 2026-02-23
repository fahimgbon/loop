import { redirect } from "next/navigation";

import { NewArtifactForm } from "@/src/components/artifacts/NewArtifactForm";
import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { listArtifacts } from "@/src/server/repo/artifacts";
import { listFolders } from "@/src/server/repo/folders";
import { listTemplates } from "@/src/server/repo/templates";
import { defaultTemplates } from "@/src/server/templates/defaultTemplates";

export const dynamic = "force-dynamic";

export default async function NewArtifactPage(props: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { workspaceSlug } = await props.params;
  const search = await props.searchParams;
  if (workspaceSlug !== session.workspaceSlug) redirect(`/w/${session.workspaceSlug}`);

  const [folders, templates, artifacts] = await Promise.all([
    withClient((client) => listFolders(client, session.workspaceId)),
    withClient((client) => listTemplates(client, session.workspaceId)),
    withClient((client) => listArtifacts(client, session.workspaceId)),
  ]);
  const groupBySlug = new Map(defaultTemplates.map((template) => [template.slug, template.group]));
  const resolvedTemplates =
    templates.length > 0
      ? templates
      : defaultTemplates.map((template) => ({
          id: template.slug,
          slug: template.slug,
          name: template.name,
        }));

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-xl font-semibold tracking-tight">New artifact</h1>
      <p className="mt-1 text-sm text-muted">
        Start from a folder structure so every artifact inherits consistent blocks and fields.
      </p>
      <div className="glass mt-6 rounded-xl p-6">
        <NewArtifactForm
          workspaceSlug={workspaceSlug}
          folders={folders}
          initialFolderId={typeof search.folderId === "string" ? search.folderId : null}
          templates={resolvedTemplates.map((template) => ({
            ...template,
            group: groupBySlug.get(template.slug) ?? template.name,
          }))}
          artifacts={artifacts.map((artifact) => ({
            id: artifact.id,
            title: artifact.title,
            status: artifact.status,
            updatedAt: artifact.updated_at,
          }))}
        />
      </div>
    </main>
  );
}
