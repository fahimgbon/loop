import Link from "next/link";
import { redirect } from "next/navigation";

import { FolderStructureForm } from "@/src/components/folders/FolderStructureForm";
import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { listTemplates } from "@/src/server/repo/templates";
import { defaultTemplates } from "@/src/server/templates/defaultTemplates";

export const dynamic = "force-dynamic";

export default async function NewFolderPage(props: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { workspaceSlug } = await props.params;
  if (workspaceSlug !== session.workspaceSlug) redirect(`/w/${session.workspaceSlug}`);

  const templates = await withClient((client) => listTemplates(client, session.workspaceId));
  const groupBySlug = new Map(defaultTemplates.map((template) => [template.slug, template.group]));

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-4 flex items-center gap-2 text-xs text-muted">
        <Link href={`/w/${workspaceSlug}/folders`} className="rounded-full border border-white/60 bg-white/40 px-3 py-1 hover:bg-white/70">
          Folders
        </Link>
        <span>/</span>
        <span className="rounded-full border border-white/60 bg-white/60 px-3 py-1 text-slate-800">New</span>
      </div>

      <h1 className="text-xl font-semibold tracking-tight">New folder structure</h1>
      <p className="mt-1 text-sm text-muted">
        Choose a starter template or define custom blocks. Every new artifact in this folder inherits the structure.
      </p>

      <div className="glass mt-6 rounded-xl p-6">
        <FolderStructureForm
          workspaceSlug={workspaceSlug}
          mode="create"
          templates={templates.map((template) => ({
            slug: template.slug,
            name: template.name,
            group: groupBySlug.get(template.slug) ?? template.name,
          }))}
        />
      </div>
    </main>
  );
}
