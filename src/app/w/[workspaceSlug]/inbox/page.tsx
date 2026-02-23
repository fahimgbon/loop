import { redirect } from "next/navigation";

import { InboxItem } from "@/src/components/inbox/InboxItem";
import { getSession } from "@/src/server/auth";
import { withClient } from "@/src/server/db";
import { listInboxContributions } from "@/src/server/repo/contributions";
import { listTemplates } from "@/src/server/repo/templates";

export const dynamic = "force-dynamic";

export default async function InboxPage(props: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { workspaceSlug } = await props.params;
  if (workspaceSlug !== session.workspaceSlug) redirect(`/w/${session.workspaceSlug}/inbox`);

  const [items, templates] = await Promise.all([
    withClient((client) => listInboxContributions(client, session.workspaceId)),
    withClient((client) => listTemplates(client, session.workspaceId)),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Inbox</h1>
          <p className="mt-1 text-sm text-muted">Untriaged audio/text contributions.</p>
        </div>
        <a className="rounded-md border border-white/60 bg-white/40 px-3 py-2 text-sm hover:bg-white/70" href={`/w/${workspaceSlug}`}>
          Back to workspace
        </a>
      </div>

      <section className="mt-8 grid gap-3">
        {items.length === 0 ? (
          <div className="glass rounded-xl p-6 text-sm text-muted">Inbox is empty.</div>
        ) : (
          items.map((item) => (
            <InboxItem key={item.id} workspaceSlug={workspaceSlug} item={item} templates={templates} />
          ))
        )}
      </section>
    </main>
  );
}
