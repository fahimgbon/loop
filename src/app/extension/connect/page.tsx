import Link from "next/link";

import { ExtensionConnectCard } from "@/src/components/extension/ExtensionConnectCard";
import { createExtensionToken, getSession } from "@/src/server/auth";

export default async function ExtensionConnectPage() {
  const session = await getSession();

  if (!session) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="grid gap-4 rounded-[28px] border border-slate-300 bg-white/95 p-8 shadow-[0_28px_90px_-52px_rgba(15,23,42,0.24)]">
          <div className="intent-pill">Chrome extension</div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Sign in to connect the extension</h1>
          <p className="text-sm text-slate-600">
            The Aceync Google Docs extension needs a workspace-scoped token. Sign in first, then come back here to
            copy it.
          </p>
          <div>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl border border-slate-950 bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-[0_18px_40px_-24px_rgba(4,12,27,0.45)]"
            >
              Go to login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const token = await createExtensionToken(session);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <ExtensionConnectCard
        token={token}
        workspaceSlug={session.workspaceSlug}
        extensionRoute="/api/auth/extension-token"
      />
    </main>
  );
}
