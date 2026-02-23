import { getSession } from "@/src/server/auth";

export default async function HomePage() {
  const session = await getSession();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Decision-grade async collaboration</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Loop captures low-lift audio/text input and turns it into structured artifacts, review requests, and a
        searchable decision repository.
      </p>

      <section className="glass mt-10 grid gap-4 rounded-xl p-6">
        <h2 className="text-lg font-semibold">MVP focus</h2>
        <ul className="grid gap-2 text-sm text-muted">
          <li>Structured, template-backed docs (Markdown blocks)</li>
          <li>Review requests → higher-quality async feedback</li>
          <li>Slack-first capture + orchestration</li>
          <li>Decision/risk/question tracking as first-class blocks</li>
        </ul>
      </section>

      {session ? (
        <section className="glass mt-6 rounded-xl p-6">
          <a className="inline-flex rounded-md bg-accent px-3 py-2 text-sm font-medium text-white" href={`/w/${session.workspaceSlug}`}>
            Open workspace
          </a>
        </section>
      ) : null}
    </main>
  );
}
