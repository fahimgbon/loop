import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { listFolders } from "@/src/server/repo/folders";
import { FolderCard } from "@/src/components/folders/FolderCard";

export const dynamic = "force-dynamic";

export default async function FolderListPage(props: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { workspaceSlug } = await props.params;
  if (workspaceSlug !== session.workspaceSlug) redirect(`/w/${session.workspaceSlug}`);

  const folders = await withClient((client) => listFolders(client, session.workspaceId));

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Folders</h1>
          <p className="mt-1 text-sm text-muted">
            Folder structures define inherited blocks for every new artifact created inside them.
          </p>
        </div>
        <Link
          href={`/w/${workspaceSlug}/folders/new`}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          New folder
        </Link>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {folders.length === 0 ? (
          <div className="glass rounded-xl p-5 text-sm text-muted">No folders yet.</div>
        ) : (
          folders.map((folder, idx) => (
            <Link
              key={folder.id}
              href={`/w/${workspaceSlug}/folders/${folder.id}`}
              className="block"
            >
              <FolderCard
                name={folder.name}
                subtitle={`Version ${folder.structure_version}`}
                meta={new Date(folder.updated_at).toLocaleDateString()}
                badge={idx === 0 ? "Most recent" : null}
              />
            </Link>
          ))
        )}
      </section>
    </main>
  );
}
