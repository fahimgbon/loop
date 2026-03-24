import Link from "next/link";
import type { ReactNode } from "react";

import {
  ArrowUpRightIcon,
  CaptureIcon,
  CommentIcon,
  FolderIcon,
  GraphIcon,
  InboxIcon,
  LinkNodesIcon,
  LoopMark,
  SearchIcon,
  SparkIcon,
  UsersIcon,
} from "@/src/components/icons/LoopIcons";
import { getSession } from "@/src/server/auth";

const workflow = [
  {
    title: "Capture once",
    body: "Speak naturally or drop in notes. Loop handles the cleanup and keeps the raw signal attached.",
    icon: CaptureIcon,
  },
  {
    title: "Shape the artifact",
    body: "Turn the transcript into structure: decisions, risks, next steps, research, and open questions.",
    icon: SparkIcon,
  },
  {
    title: "Pull in context",
    body: "Request input, connect teammates, and watch related work appear across folders and the network.",
    icon: LinkNodesIcon,
  },
];

const suite = [
  "Voice-first capture",
  "Structured artifacts",
  "Inline suggestions",
  "Shared folders",
  "Searchable workspace memory",
  "Connected network view",
];

const stats = [
  { label: "Capture to artifact", value: "under 90s" },
  { label: "Views in one system", value: "capture, docs, search, network" },
  { label: "Collaboration model", value: "shared, not single-owner" },
];

export default async function HomePage() {
  const session = await getSession();
  const primaryHref = session ? `/w/${session.workspaceSlug}` : "/setup";
  const primaryLabel = session ? "Open workspace" : "Start your workspace";

  return (
    <main className="relative overflow-hidden pb-20">
      <div className="orb orb-1 pointer-events-none" />
      <div className="orb orb-2 pointer-events-none" />
      <div className="orb orb-3 pointer-events-none" />

      <section className="relative mx-auto max-w-7xl px-6 pb-20 pt-10 sm:pt-16 lg:pb-24 lg:pt-20">
        <div className="grid gap-14 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/78 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600 shadow-sm backdrop-blur-xl">
              <LoopMark className="h-4 w-4 text-slate-950" />
              Decision-grade async collaboration
            </div>

            <h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-6xl lg:text-7xl">
              Turn messy updates into <span className="text-gradient">decision-ready work.</span>
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              Loop listens once, structures the artifact, routes feedback, and keeps every document connected across
              teammates, folders, search, and the network.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={primaryHref}
                className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,rgb(var(--accent)),rgb(var(--accent-2)))] px-5 py-3 text-sm font-medium text-white shadow-[0_18px_40px_-24px_rgba(101,149,255,0.55)] transition hover:brightness-[0.98]"
              >
                {primaryLabel}
                <ArrowUpRightIcon className="h-4 w-4" />
              </Link>
              <a
                href="#product"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white/92 px-5 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                See the flow
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {suite.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/80 bg-white/72 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-xl"
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {stats.map((item) => (
                <MetricCard key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          </div>

          <HeroCanvas />
        </div>
      </section>

      <section id="product" className="relative mx-auto max-w-7xl px-6 py-8 lg:py-10">
        <SectionHeader
          eyebrow="Product"
          title="Everything your team needs after the update lands"
          body="Loop is not just capture. It is the full path from rough signal to a shared artifact people can actually work from."
        />

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <MarketingCard className="p-6 lg:p-7">
            <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
              <div>
                <FeatureLabel icon={<CaptureIcon className="h-4 w-4" />}>Capture</FeatureLabel>
                <h3 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                  Speak once. Publish into structure.
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Record naturally, watch the transcript appear immediately, then turn it into sections your team
                  already understands.
                </p>
                <div className="mt-5 grid gap-2">
                  {workflow.map((step) => (
                    <WorkflowRow key={step.title} title={step.title} body={step.body} icon={<step.icon className="h-4 w-4" />} />
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(243,247,255,0.92))] p-4 shadow-[0_22px_60px_-42px_rgba(15,23,42,0.18)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Stakeholder alignment brief</div>
                    <div className="mt-1 text-xs text-slate-500">Live transcript shaping into a PRD</div>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                    Recording
                  </span>
                </div>

                <div className="mt-4 rounded-[22px] border border-slate-200 bg-white/92 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Transcript</div>
                  <div className="mt-3 grid gap-2">
                    <PreviewLine width="w-[94%]" />
                    <PreviewLine width="w-[88%]" />
                    <PreviewLine width="w-[76%]" />
                  </div>
                </div>

                <div className="mt-4 rounded-[22px] border border-slate-200 bg-white/92 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Structured doc</div>
                    <span className="rounded-full bg-[rgb(var(--accent-soft)_/_0.65)] px-2 py-1 text-[11px] font-medium text-slate-700">
                      Decision ready
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <MiniPanel title="Problem" tone="blue" />
                    <MiniPanel title="Proposed solution" tone="violet" />
                    <MiniPanel title="Risks" tone="pink" />
                    <MiniPanel title="Next steps" tone="sky" />
                  </div>
                </div>
              </div>
            </div>
          </MarketingCard>

          <div className="grid gap-5">
            <MarketingCard className="p-6">
              <FeatureLabel icon={<CommentIcon className="h-4 w-4" />}>Collaboration</FeatureLabel>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.04em] text-slate-950">
                Suggestions, requests, and ownership live beside the work.
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Review in context, request async input, and keep the artifact moving without turning one person into the bottleneck.
              </p>
              <div className="mt-5 grid gap-3">
                <InlineSuggestionPreview />
                <CommentThreadPreview />
              </div>
            </MarketingCard>

            <MarketingCard className="p-6">
              <FeatureLabel icon={<SearchIcon className="h-4 w-4" />}>Search + folders</FeatureLabel>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.04em] text-slate-950">
                Everything stays easy to find.
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Browse saved folders, explore suggested clusters inferred from the work, and search across artifacts without losing structure.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <FolderPreviewCard title="Research question" subtitle="4 docs · suggested cluster" tone="blue" />
                <FolderPreviewCard title="Policy proposal" subtitle="7 docs · saved folder" tone="violet" />
              </div>
            </MarketingCard>
          </div>
        </div>
      </section>

      <section id="teams" className="relative mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-5 lg:grid-cols-[0.94fr_1.06fr]">
          <MarketingCard className="p-6 lg:p-7">
            <FeatureLabel icon={<UsersIcon className="h-4 w-4" />}>Teams</FeatureLabel>
            <h3 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
              Built for shared ownership, not just a single doc owner.
            </h3>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">
              Teammates are first-class surfaces. Open profiles, see who usually shapes what, and keep collaboration legible across the workspace.
            </p>
            <div className="mt-6 grid gap-3">
              <TeamValueRow
                title="Clickable teammate profiles"
                body="Every member surface opens richer context instead of dead-ending in an avatar."
              />
              <TeamValueRow
                title="Requests tied to the artifact"
                body="Questions, suggestions, and due dates stay attached to the work instead of disappearing into chat."
              />
              <TeamValueRow
                title="A workspace that reads as collaborative"
                body="Folders, search, and network make the work feel shared even before real-time multiplayer arrives."
              />
            </div>
          </MarketingCard>

          <MarketingCard className="p-5 lg:p-6">
            <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
              <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,246,255,0.92))] p-4 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.16)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Team surface</div>
                <div className="mt-4 grid gap-3">
                  <TeammateRow name="Hannah Brooks" role="Research" tone="blue" />
                  <TeammateRow name="Marcus Chen" role="Operations" tone="violet" />
                  <TeammateRow name="Priya Shah" role="Design systems" tone="pink" />
                </div>
              </div>

              <div className="rounded-[30px] border border-slate-200/80 bg-white/96 p-5 shadow-[0_22px_70px_-44px_rgba(15,23,42,0.18)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,rgba(220,233,255,0.95),rgba(242,238,255,0.95))] text-lg font-semibold text-slate-900">
                    HB
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Hannah Brooks</div>
                    <div className="mt-1 text-xs text-slate-500">Research and synthesis</div>
                  </div>
                </div>
                <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Best for</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <MiniTag>Research framing</MiniTag>
                    <MiniTag>Insight distillation</MiniTag>
                    <MiniTag>Feedback phrasing</MiniTag>
                  </div>
                </div>
                <div className="mt-4 rounded-[22px] border border-slate-200 bg-white p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Usually found in</div>
                  <div className="mt-3 grid gap-2">
                    <PreviewListItem icon={<CaptureIcon className="h-4 w-4" />} label="Capture" />
                    <PreviewListItem icon={<CommentIcon className="h-4 w-4" />} label="Open threads" />
                    <PreviewListItem icon={<FolderIcon className="h-4 w-4" />} label="Research folders" />
                  </div>
                </div>
              </div>
            </div>
          </MarketingCard>
        </div>
      </section>

      <section id="network" className="relative mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-5 lg:grid-cols-[1.04fr_0.96fr]">
          <MarketingCard className="p-6 lg:p-7">
            <FeatureLabel icon={<GraphIcon className="h-4 w-4" />}>Network</FeatureLabel>
            <h3 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
              A living map of how artifacts connect.
            </h3>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">
              Loop infers links from structure and transcription language, so related work surfaces even when nobody manually filed it.
            </p>
            <div className="mt-6 grid gap-3">
              <NetworkFact
                title="High-level at home"
                body="The homepage gives a quick read on what is connected, without overwhelming the rest of the workspace."
              />
              <NetworkFact
                title="Deeper in the network tab"
                body="Drill down, follow branches, and shift the focal node as the context gets more specific."
              />
              <NetworkFact
                title="Intentional treatment for loose work"
                body="Unfiled artifacts still appear as suggested clusters so they feel emergent, not broken."
              />
            </div>
          </MarketingCard>

          <MarketingCard className="p-5 lg:p-6">
            <div className="rounded-[30px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,246,255,0.9))] p-4 shadow-[0_22px_70px_-44px_rgba(15,23,42,0.18)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Workspace network</div>
                  <div className="mt-1 text-xs text-slate-500">Hover to trace. Click to go deeper.</div>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                  Suggested clusters included
                </span>
              </div>

              <div className="relative mt-5 h-[360px] overflow-hidden rounded-[26px] border border-slate-200 bg-white/90">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(226,239,255,0.7),transparent_34%),radial-gradient(circle_at_82%_16%,rgba(226,220,255,0.56),transparent_32%),radial-gradient(circle_at_72%_82%,rgba(246,231,239,0.4),transparent_30%)]" />
                <svg viewBox="0 0 680 360" className="absolute inset-0 h-full w-full" aria-hidden="true">
                  <path d="M180 165 C 250 165, 250 120, 320 120" className="network-curve network-curve-active" opacity="0.92" />
                  <path d="M180 165 C 255 165, 250 205, 326 205" className="network-curve" opacity="0.72" />
                  <path d="M320 120 C 395 120, 405 92, 492 92" className="network-curve network-curve-active" opacity="0.86" />
                  <path d="M320 120 C 395 120, 410 150, 508 156" className="network-curve" opacity="0.68" />
                  <path d="M326 205 C 402 205, 412 236, 522 256" className="network-curve" opacity="0.64" />
                </svg>

                <GraphNode x="180px" y="165px" label="Stakeholder Alignment Copilot" tone="root" />
                <GraphNode x="320px" y="120px" label="Problem" tone="blue" />
                <GraphNode x="326px" y="205px" label="Research question" tone="violet" />
                <GraphNode x="492px" y="92px" label="Target users" tone="sky" />
                <GraphNode x="508px" y="156px" label="Proposed solution" tone="pink" />
                <GraphNode x="522px" y="256px" label="Suggested cluster" tone="muted" />
              </div>
            </div>
          </MarketingCard>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-4 rounded-[34px] border border-white/75 bg-[linear-gradient(135deg,rgba(225,236,255,0.82),rgba(245,240,255,0.88),rgba(255,255,255,0.94))] p-6 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.22)] lg:grid-cols-[0.85fr_1.15fr] lg:p-8">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Why teams switch</div>
            <h3 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
              One system for capture, context, collaboration, and retrieval.
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ReasonCard
              icon={<CaptureIcon className="h-4 w-4" />}
              title="Less blank-page overhead"
              body="The fastest input path no longer creates the weakest documentation."
            />
            <ReasonCard
              icon={<CommentIcon className="h-4 w-4" />}
              title="Better async feedback"
              body="Comments, suggestions, and open requests stay grounded in the artifact."
            />
            <ReasonCard
              icon={<SearchIcon className="h-4 w-4" />}
              title="Search with structure intact"
              body="Find artifacts by title, block themes, folder patterns, and repeated transcript language."
            />
            <ReasonCard
              icon={<InboxIcon className="h-4 w-4" />}
              title="A calmer operating layer"
              body="Instead of hopping between docs, chat, and task tools, the context is already connected."
            />
          </div>
        </div>
      </section>

      <section id="footer-cta" className="relative mx-auto max-w-7xl px-6 pb-12 pt-8">
        <div className="overflow-hidden rounded-[36px] border border-slate-200/80 bg-slate-950 px-6 py-8 text-white shadow-[0_40px_120px_-64px_rgba(15,23,42,0.7)] lg:px-8 lg:py-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(151,180,255,0.2),transparent_28%),radial-gradient(circle_at_84%_18%,rgba(199,180,255,0.18),transparent_26%),radial-gradient(circle_at_74%_86%,rgba(255,192,220,0.16),transparent_24%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Loop</div>
              <h2 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-white">
                The workspace for turning spoken thinking into shared execution.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72">
                Capture faster, collaborate with less friction, and keep the network of work visible as your team grows.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={primaryHref}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-100"
              >
                {primaryLabel}
                <ArrowUpRightIcon className="h-4 w-4" />
              </Link>
              {!session ? (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-medium text-white/86 transition hover:bg-white/10"
                >
                  Log in
                </Link>
              ) : null}
            </div>
          </div>

          <div className="relative mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/52">
            <span>Voice capture</span>
            <span>Structured artifacts</span>
            <span>Shared ownership</span>
            <span>Networked context</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function HeroCanvas() {
  return (
    <div className="glass-strong relative overflow-hidden rounded-[36px] p-5 shadow-[0_36px_110px_-58px_rgba(15,23,42,0.24)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(222,238,255,0.72),transparent_26%),radial-gradient(circle_at_84%_12%,rgba(230,223,255,0.58),transparent_22%),radial-gradient(circle_at_78%_84%,rgba(248,228,239,0.42),transparent_22%)]" />

      <div className="relative">
        <div className="flex items-center justify-between gap-3 rounded-[24px] border border-white/80 bg-white/82 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <LoopMark className="h-8 w-8 text-slate-950" />
            <div>
              <div className="text-sm font-semibold text-slate-900">Loop workspace</div>
              <div className="mt-1 text-xs text-slate-500">Capture · Collaborate · Connect</div>
            </div>
          </div>
          <div className="flex gap-2">
            <HeaderPill icon={<CaptureIcon className="h-4 w-4" />} label="Voice-first" />
            <HeaderPill icon={<GraphIcon className="h-4 w-4" />} label="Networked" />
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="grid gap-4">
            <PreviewCard className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Fresh capture</div>
                  <div className="mt-1 text-xs text-slate-500">Transcript appears instantly</div>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                  Live
                </span>
              </div>
              <div className="mt-4 grid gap-2">
                <PreviewLine width="w-[92%]" />
                <PreviewLine width="w-[78%]" />
                <PreviewLine width="w-[88%]" />
                <PreviewLine width="w-[64%]" />
              </div>
            </PreviewCard>

            <PreviewCard className="p-4">
              <div className="text-sm font-semibold text-slate-900">Team routing</div>
              <div className="mt-3 grid gap-2">
                <PreviewListItem icon={<UsersIcon className="h-4 w-4" />} label="Hannah · research and synthesis" />
                <PreviewListItem icon={<CommentIcon className="h-4 w-4" />} label="Async review request is ready" />
                <PreviewListItem icon={<InboxIcon className="h-4 w-4" />} label="Request lands in the shared inbox" />
              </div>
            </PreviewCard>
          </div>

          <div className="grid gap-4">
            <PreviewCard className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Decision-grade artifact</div>
                  <div className="mt-1 text-xs text-slate-500">A voice note becomes structured work</div>
                </div>
                <span className="rounded-full bg-[linear-gradient(135deg,rgba(101,149,255,0.16),rgba(141,150,255,0.18))] px-2.5 py-1 text-[11px] font-medium text-slate-700">
                  Draft
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MiniPanel title="Context" tone="blue" />
                <MiniPanel title="Problem" tone="sky" />
                <MiniPanel title="Target users" tone="violet" />
                <MiniPanel title="Rollout notes" tone="pink" />
              </div>
              <div className="mt-4 rounded-[22px] border border-slate-200 bg-white/92 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Suggestions</div>
                <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">Replace “Slack only” with broader tool integration</div>
                    <div className="mt-1 text-xs text-slate-500">Suggested by Marcus · stays in context</div>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600">
                    Open
                  </span>
                </div>
              </div>
            </PreviewCard>

            <div className="grid gap-4 sm:grid-cols-[1.05fr_0.95fr]">
              <PreviewCard className="p-4">
                <div className="text-sm font-semibold text-slate-900">Network</div>
                <div className="mt-3 h-28 rounded-[20px] border border-slate-200 bg-[radial-gradient(circle_at_18%_20%,rgba(226,239,255,0.8),transparent_34%),radial-gradient(circle_at_82%_18%,rgba(226,220,255,0.62),transparent_32%),rgba(255,255,255,0.9)] p-3">
                  <div className="relative h-full">
                    <span className="absolute left-2 top-8 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700">
                      Artifact
                    </span>
                    <span className="absolute left-[42%] top-3 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700">
                      Folder
                    </span>
                    <span className="absolute right-2 bottom-4 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700">
                      Suggested cluster
                    </span>
                    <svg viewBox="0 0 240 92" className="absolute inset-0 h-full w-full" aria-hidden="true">
                      <path d="M42 44 C 92 44, 86 18, 128 18" className="network-curve" opacity="0.84" />
                      <path d="M128 18 C 176 18, 180 62, 214 62" className="network-curve network-curve-active" opacity="0.92" />
                    </svg>
                  </div>
                </div>
              </PreviewCard>

              <PreviewCard className="p-4">
                <div className="text-sm font-semibold text-slate-900">Folder system</div>
                <div className="mt-3 grid gap-2">
                  <FolderPreviewCard title="Policy proposal" subtitle="Saved folder" tone="violet" />
                  <FolderPreviewCard title="Research question" subtitle="Suggested cluster" tone="blue" />
                </div>
              </PreviewCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader(props: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="max-w-3xl">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{props.eyebrow}</div>
      <h2 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-slate-950">{props.title}</h2>
      <p className="mt-4 text-sm leading-7 text-slate-600">{props.body}</p>
    </div>
  );
}

function MarketingCard(props: { children: ReactNode; className?: string }) {
  return (
    <div
      className={[
        "rounded-[32px] border border-white/75 bg-white/84 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.2)] backdrop-blur-2xl",
        props.className ?? "",
      ].join(" ")}
    >
      {props.children}
    </div>
  );
}

function MetricCard(props: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white/80 bg-white/78 p-4 shadow-[0_18px_46px_-34px_rgba(15,23,42,0.16)] backdrop-blur-xl">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{props.label}</div>
      <div className="mt-3 text-sm font-medium text-slate-900">{props.value}</div>
    </div>
  );
}

function FeatureLabel(props: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm">
      {props.icon}
      {props.children}
    </div>
  );
}

function WorkflowRow(props: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white/88 p-4 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.14)]">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgba(226,239,255,0.9),rgba(243,241,255,0.9))] text-slate-700">
          {props.icon}
        </span>
        {props.title}
      </div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{props.body}</div>
    </div>
  );
}

function PreviewCard(props: { children: ReactNode; className?: string }) {
  return (
    <div
      className={[
        "rounded-[28px] border border-white/80 bg-white/84 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.18)] backdrop-blur-xl",
        props.className ?? "",
      ].join(" ")}
    >
      {props.children}
    </div>
  );
}

function PreviewLine(props: { width: string }) {
  return <div className={`h-3 rounded-full bg-[linear-gradient(90deg,rgba(226,239,255,0.95),rgba(243,241,255,0.92))] ${props.width}`} />;
}

function MiniPanel(props: { title: string; tone: "blue" | "sky" | "violet" | "pink" }) {
  const tones = {
    blue: "bg-[linear-gradient(135deg,rgba(226,239,255,0.96),rgba(255,255,255,0.95))] border-[rgba(191,219,254,0.9)]",
    sky: "bg-[linear-gradient(135deg,rgba(234,244,255,0.96),rgba(255,255,255,0.95))] border-[rgba(186,230,253,0.82)]",
    violet: "bg-[linear-gradient(135deg,rgba(243,241,255,0.96),rgba(255,255,255,0.95))] border-[rgba(221,214,254,0.88)]",
    pink: "bg-[linear-gradient(135deg,rgba(251,236,245,0.96),rgba(255,255,255,0.95))] border-[rgba(244,206,226,0.88)]",
  } as const;

  return (
    <div className={`rounded-[18px] border p-3 ${tones[props.tone]}`}>
      <div className="text-sm font-medium text-slate-900">{props.title}</div>
      <div className="mt-2 grid gap-1">
        <PreviewLine width="w-[78%]" />
        <PreviewLine width="w-[56%]" />
      </div>
    </div>
  );
}

function InlineSuggestionPreview() {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white/92 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Suggestion mode</div>
      <div className="mt-3 grid gap-2">
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 px-3 py-2 text-sm text-slate-700 line-through decoration-rose-300">
          Product teams are still translating ideas across voice notes and follow-up docs.
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm text-slate-700">
          Reframe it around the artifact: teams capture once, then Loop structures the work and keeps feedback visible.
        </div>
      </div>
    </div>
  );
}

function CommentThreadPreview() {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white/92 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Async thread</div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">2 open</span>
      </div>
      <div className="mt-3 grid gap-2">
        <PreviewListItem icon={<CommentIcon className="h-4 w-4" />} label="What is the biggest product risk?" />
        <PreviewListItem icon={<UsersIcon className="h-4 w-4" />} label="Priya suggested clarifying the rollout step." />
      </div>
    </div>
  );
}

function FolderPreviewCard(props: { title: string; subtitle: string; tone: "blue" | "violet" | "pink" | "sky" }) {
  const tones = {
    blue: "bg-[linear-gradient(135deg,rgba(232,239,255,0.92),rgba(255,255,255,0.94))] border-[rgba(191,219,254,0.86)]",
    violet: "bg-[linear-gradient(135deg,rgba(240,236,255,0.92),rgba(255,255,255,0.94))] border-[rgba(221,214,254,0.9)]",
    pink: "bg-[linear-gradient(135deg,rgba(251,236,245,0.92),rgba(255,255,255,0.94))] border-[rgba(244,206,226,0.9)]",
    sky: "bg-[linear-gradient(135deg,rgba(234,244,255,0.92),rgba(255,255,255,0.94))] border-[rgba(186,230,253,0.9)]",
  } as const;

  return (
    <div className={`rounded-[22px] border p-4 ${tones[props.tone]}`}>
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/70 bg-white/78 text-slate-700 shadow-sm">
          <FolderIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{props.title}</div>
          <div className="truncate text-xs text-slate-500">{props.subtitle}</div>
        </div>
      </div>
    </div>
  );
}

function TeammateRow(props: { name: string; role: string; tone: "blue" | "violet" | "pink" }) {
  const tones = {
    blue: "bg-[linear-gradient(135deg,rgba(232,239,255,0.92),rgba(255,255,255,0.96))]",
    violet: "bg-[linear-gradient(135deg,rgba(240,236,255,0.92),rgba(255,255,255,0.96))]",
    pink: "bg-[linear-gradient(135deg,rgba(251,236,245,0.92),rgba(255,255,255,0.96))]",
  } as const;

  return (
    <div className={`flex items-center justify-between gap-3 rounded-[20px] border border-slate-200 p-3 ${tones[props.tone]}`}>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-900">{props.name}</div>
        <div className="truncate text-xs text-slate-500">{props.role}</div>
      </div>
      <span className="rounded-full border border-white/80 bg-white/85 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-600">
        Open
      </span>
    </div>
  );
}

function MiniTag(props: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
      {props.children}
    </span>
  );
}

function PreviewListItem(props: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/84 px-3 py-2.5 text-sm text-slate-700">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
        {props.icon}
      </span>
      <span className="truncate">{props.label}</span>
    </div>
  );
}

function TeamValueRow(props: { title: string; body: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white/88 p-4 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.12)]">
      <div className="text-sm font-semibold text-slate-900">{props.title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{props.body}</div>
    </div>
  );
}

function NetworkFact(props: { title: string; body: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white/88 p-4 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.12)]">
      <div className="text-sm font-semibold text-slate-900">{props.title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{props.body}</div>
    </div>
  );
}

function ReasonCard(props: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-white/75 bg-white/84 p-4 shadow-[0_14px_34px_-26px_rgba(15,23,42,0.14)]">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgba(226,239,255,0.95),rgba(243,241,255,0.9))] text-slate-700">
        {props.icon}
      </div>
      <div className="mt-4 text-sm font-semibold text-slate-900">{props.title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{props.body}</div>
    </div>
  );
}

function HeaderPill(props: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/88 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm">
      {props.icon}
      {props.label}
    </span>
  );
}

function GraphNode(props: { x: string; y: string; label: string; tone: "root" | "blue" | "sky" | "violet" | "pink" | "muted" }) {
  const tones = {
    root: "bg-[linear-gradient(135deg,rgba(232,239,255,1),rgba(255,255,255,0.96))] border-[rgba(191,219,254,0.95)]",
    blue: "bg-[linear-gradient(135deg,rgba(232,239,255,0.96),rgba(255,255,255,0.95))] border-[rgba(191,219,254,0.9)]",
    sky: "bg-[linear-gradient(135deg,rgba(234,244,255,0.96),rgba(255,255,255,0.95))] border-[rgba(186,230,253,0.9)]",
    violet: "bg-[linear-gradient(135deg,rgba(240,236,255,0.96),rgba(255,255,255,0.95))] border-[rgba(221,214,254,0.9)]",
    pink: "bg-[linear-gradient(135deg,rgba(251,236,245,0.96),rgba(255,255,255,0.95))] border-[rgba(244,206,226,0.9)]",
    muted: "bg-white/94 border-slate-200",
  } as const;

  return (
    <div
      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-2 text-xs font-medium text-slate-700 shadow-[0_14px_32px_-24px_rgba(15,23,42,0.16)] ${tones[props.tone]}`}
      style={{ left: props.x, top: props.y }}
    >
      <span className="block max-w-[150px] truncate">{props.label}</span>
    </div>
  );
}
