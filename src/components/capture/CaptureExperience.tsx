"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/src/components/Button";
import { CaptureRecorder } from "@/src/components/capture/CaptureRecorder";
import { Input } from "@/src/components/Input";
import { Markdown } from "@/src/components/Markdown";
import { WebGLLiquidBackdrop } from "@/src/components/visual/WebGLLiquidBackdrop";
import { AgentDock } from "@/src/components/guide/AgentDock";

type ContributionSummary = {
  id: string;
  transcript: string | null;
  text_content: string | null;
  intent: string;
  intent_confidence: number | null;
  artifact_id: string | null;
};

export function CaptureExperience(props: { workspaceSlug: string }) {
  const router = useRouter();
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [contributionId, setContributionId] = useState<string | null>(null);
  const [contribution, setContribution] = useState<ContributionSummary | null>(null);
  const [title, setTitle] = useState("New idea");
  const [creating, setCreating] = useState(false);
  const [handsfree, setHandsfree] = useState(true);
  const [autoRenderStarted, setAutoRenderStarted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [portal, setPortal] = useState<null | { artifactId: string }>(null);
  const [error, setError] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [docUrl, setDocUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const transcript = useMemo(() => {
    const body = (contribution?.transcript ?? contribution?.text_content ?? "").trim();
    return body;
  }, [contribution]);

  const autoTitle = useMemo(() => {
    const base = transcript.replace(/\s+/g, " ").trim();
    if (!base) return "New idea";
    const words = base.split(" ").slice(0, 6).join(" ");
    return words.length < base.length ? `${words}…` : words;
  }, [transcript]);

  const intentLabel = useMemo(() => {
    if (!contribution?.intent) return "listening";
    return contribution.intent;
  }, [contribution?.intent]);

  const phase = useMemo(() => {
    if (portal) return "published";
    if (creating) return "structuring";
    if (transcript) return "ready";
    if (contributionId) return "transcribing";
    if (recording) return "capturing";
    return "idle";
  }, [portal, creating, transcript, contributionId, recording]);

  const guide = useMemo(() => {
    if (portal) return { title: "Opening your artifact", body: "We are routing you to the structured doc." };
    if (creating) return { title: "Structuring your doc", body: "Loop is turning your note into blocks." };
    if (transcript) return { title: "Ready to publish", body: "Auto-publish is on. You can edit the title." };
    if (contributionId) return { title: "Transcribing", body: "Hold on, capturing the clean transcript." };
    if (recording) return { title: "Keep talking", body: "Pause when done. Loop will take it from here." };
    return { title: "Start speaking", body: "One tap to begin. Loop handles the rest." };
  }, [portal, creating, transcript, contributionId, recording]);

  useEffect(() => {
    if (!contributionId) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `/api/workspaces/${props.workspaceSlug}/contributions/${contributionId}`,
        );
        const data = (await res.json().catch(() => null)) as
          | { contribution?: ContributionSummary; error?: string }
          | null;
        if (!res.ok || !data?.contribution) return;
        if (!cancelled) setContribution(data.contribution);
      } catch {
        // ignore transient errors while polling
      }
    }

    load();
    const interval = window.setInterval(load, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [contributionId, props.workspaceSlug]);

  const renderToDoc = useCallback(async () => {
    if (!contributionId) return;
    setCreating(true);
    setError(null);
    try {
      const finalTitle = (title.trim() && title.trim() !== "New idea" ? title.trim() : autoTitle).trim();
      if (finalTitle && finalTitle !== title) setTitle(finalTitle);
      const res = await fetch(
        `/api/workspaces/${props.workspaceSlug}/contributions/${contributionId}/render`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: finalTitle || "New idea", templateSlug: "prd" }),
        },
      );
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; artifactId?: string; error?: string }
        | null;
      if (!res.ok || !data?.ok || !data.artifactId) {
        setError(data?.error ?? "Render failed");
        return;
      }
      setPortal({ artifactId: data.artifactId });
      window.setTimeout(() => {
        router.push(`/w/${props.workspaceSlug}/artifacts/${data.artifactId}`);
      }, 950);
    } finally {
      setCreating(false);
    }
  }, [autoTitle, contributionId, router, props.workspaceSlug, title]);

  const importDocumentText = useCallback(
    async (documentMd: string, suggestedTitle?: string) => {
      setImportBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/workspaces/${props.workspaceSlug}/imports/document`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "new_artifact",
            title: suggestedTitle,
            documentMd,
            structureMode: "custom",
          }),
        });
        const data = (await res.json().catch(() => null)) as
          | { ok?: boolean; artifactId?: string; error?: string }
          | null;
        if (!res.ok || !data?.ok || !data.artifactId) {
          setError(data?.error ?? "Import failed");
          return;
        }
        router.push(`/w/${props.workspaceSlug}/artifacts/${data.artifactId}`);
      } finally {
        setImportBusy(false);
      }
    },
    [props.workspaceSlug, router],
  );

  async function onImportFile(file: File) {
    setError(null);
    const supported =
      file.type.startsWith("text/") ||
      /\.(md|markdown|txt|csv|json|rtf)$/i.test(file.name);
    if (!supported) {
      setError("For now, import supports text-like files (.md, .txt, .csv, .json, .rtf).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const text = await file.text();
    const titleGuess = file.name.replace(/\.[^.]+$/, "");
    await importDocumentText(text, titleGuess || "Imported file");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function importFromGoogleDoc() {
    if (!docUrl.trim()) return;
    setImportBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${props.workspaceSlug}/imports/google-doc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docUrl: docUrl.trim(),
          mode: "new_artifact",
          structureMode: "custom",
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; artifactId?: string; error?: string }
        | null;
      if (!res.ok || !data?.ok || !data.artifactId) {
        setError(data?.error ?? "Google Doc import failed");
        return;
      }
      router.push(`/w/${props.workspaceSlug}/artifacts/${data.artifactId}`);
    } finally {
      setImportBusy(false);
    }
  }

  useEffect(() => {
    if (!handsfree) return;
    if (!contributionId || !transcript) return;
    if (autoRenderStarted || creating) return;
    setAutoRenderStarted(true);
    setTitle((t) => (t.trim().length && t.trim() !== "New idea" ? t : autoTitle));
    const timeout = window.setTimeout(() => {
      renderToDoc();
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [handsfree, contributionId, transcript, autoRenderStarted, creating, autoTitle, renderToDoc]);

  return (
    <main className="app-backdrop relative min-h-[calc(100vh-72px)] overflow-hidden px-6 py-10">
      <WebGLLiquidBackdrop audioLevel={audioLevel} active />
      {portal ? (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center">
          <div className="absolute inset-0 bg-white/30 backdrop-blur-2xl" />
          <div className="portal-card relative mx-6 w-full max-w-md rounded-[32px] border border-white/70 bg-white/60 p-8 text-center shadow-[0_40px_120px_rgba(15,23,42,0.22)] backdrop-blur-3xl">
            <div className="text-gradient text-2xl font-semibold tracking-tight">Published</div>
            <p className="mt-2 text-sm text-muted">Opening your artifact…</p>
            <div className="mt-6 grid gap-2">
              <div className="shimmer h-3 w-full rounded-full" />
              <div className="shimmer h-3 w-[92%] rounded-full" />
              <div className="shimmer h-3 w-[78%] rounded-full" />
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 text-center">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/50 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-muted backdrop-blur-xl">
            Agentic capture
          </div>
          <h1 className="text-gradient text-5xl font-semibold tracking-tight sm:text-6xl">
            Talk. Pause. Done.
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-muted">
            The fastest path from messy thinking → a decision‑grade artifact. Hands‑free by default.
          </p>
        </div>

        <div className="glass-strong w-full max-w-2xl rounded-[32px] p-8">
          <div className="mx-auto grid gap-6">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <PhasePill active={phase === "capturing"} done={phase !== "idle"}>
                Capture
              </PhasePill>
              <PhasePill active={phase === "transcribing"} done={!!transcript}>
                Transcribe
              </PhasePill>
              <PhasePill active={phase === "structuring"} done={!!portal}>
                Structure
              </PhasePill>
              <PhasePill active={phase === "published"} done={!!portal}>
                Publish
              </PhasePill>
            </div>

            <div className={phase === "idle" ? "guide-ring rounded-[28px]" : ""}>
              <CaptureRecorder
                workspaceSlug={props.workspaceSlug}
                onRecordingChange={setRecording}
                onAudioLevel={(lvl) => setAudioLevel(lvl)}
                onUploaded={(id) => {
                  setContributionId(id);
                  setContribution(null);
                  setPortal(null);
                  setAutoRenderStarted(false);
                  setError(null);
                  setTitle("New idea");
                }}
              />
            </div>

            <div className="flex flex-col items-center gap-3 text-xs text-muted">
              <div>
                {phase === "idle"
                  ? "One tap. Speak. Pause. Loop auto‑stops and builds the doc."
                  : phase === "transcribing"
                    ? "Transcribing and classifying…"
                    : phase === "ready"
                      ? handsfree
                        ? "Drafting your artifact…"
                        : "Transcript ready."
                      : phase === "structuring"
                        ? "Structuring into a template…"
                        : phase === "published"
                          ? "Published. Opening…"
                          : " "}
              </div>
              <label className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/50 px-3 py-1 backdrop-blur-xl">
                <input type="checkbox" checked={handsfree} onChange={(e) => setHandsfree(e.target.checked)} />
                Hands‑free auto‑publish
              </label>
            </div>
          </div>
        </div>

        <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div
            ref={previewRef}
            className={[
              "glass tilt-card rounded-[28px] p-6 text-left transition-all duration-700",
              transcript ? "translate-y-0 opacity-100" : "translate-y-6 opacity-80",
              portal ? "scale-[1.01] ring-2 ring-white/70" : "",
            ].join(" ")}
            onPointerMove={(e) => {
              const el = previewRef.current;
              if (!el) return;
              const rect = el.getBoundingClientRect();
              const x = (e.clientX - rect.left) / rect.width - 0.5;
              const y = (e.clientY - rect.top) / rect.height - 0.5;
              el.style.setProperty("--ry", `${x * 9}deg`);
              el.style.setProperty("--rx", `${-y * 9}deg`);
              el.style.setProperty("--glowx", `${(x + 0.5) * 100}%`);
              el.style.setProperty("--glowy", `${(y + 0.5) * 100}%`);
            }}
            onPointerLeave={() => {
              const el = previewRef.current;
              if (!el) return;
              el.style.setProperty("--ry", `0deg`);
              el.style.setProperty("--rx", `0deg`);
              el.style.setProperty("--glowx", `50%`);
              el.style.setProperty("--glowy", `50%`);
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Your doc, materializing</div>
                <div className="mt-1 text-xs text-muted">
                  {transcript ? "Preview of what Loop will publish." : "Waiting for your transcript…"}
                </div>
              </div>
              <div className="intent-pill">{intentLabel}</div>
            </div>

            <div className="mt-5 grid gap-3">
              <DocBlock title="Context" ready={!!transcript} delayMs={0}>
                {transcript ? (
                  <Markdown markdown={transcript} />
                ) : (
                  <SkeletonLines lines={5} />
                )}
              </DocBlock>
              <div className="grid gap-3 sm:grid-cols-2">
                <DocBlock title="Risks / unknowns" ready={!!transcript} delayMs={140}>
                  {transcript ? <AutoBullets text={transcript} kind="risk" /> : <SkeletonLines lines={3} />}
                </DocBlock>
                <DocBlock title="Next steps" ready={!!transcript} delayMs={220}>
                  {transcript ? <AutoBullets text={transcript} kind="next" /> : <SkeletonLines lines={3} />}
                </DocBlock>
              </div>
            </div>
          </div>

          <div className="glass rounded-[28px] p-6 text-left">
            <div className="text-sm font-semibold">Agent actions</div>
            <p className="mt-1 text-xs text-muted">Low‑lift defaults. You can refine later.</p>

            <div className="mt-4 grid gap-3">
              <AgentLine done={phase !== "idle"} active={phase === "capturing"} label="Capture audio" />
              <AgentLine done={!!contributionId} active={phase === "transcribing"} label="Upload + transcribe" />
              <AgentLine done={!!transcript} active={phase === "ready"} label="Classify intent + extract" />
              <AgentLine done={!!portal} active={phase === "structuring"} label="Create artifact + populate blocks" />
            </div>

            {error ? <p className="mt-4 text-xs text-red-500">{error}</p> : null}

            <div className="mt-6 grid gap-2">
              <Button type="button" onClick={renderToDoc} disabled={!contributionId || creating}>
                {creating ? "Publishing…" : handsfree ? "Publish now" : "Publish doc"}
              </Button>
              <button
                type="button"
                className="text-xs text-blue-500 hover:underline"
                onClick={() => {
                  setContributionId(null);
                  setContribution(null);
                  setPortal(null);
                  setAutoRenderStarted(false);
                  setError(null);
                  setTitle("New idea");
                }}
              >
                Reset
              </button>
              <a className="text-xs text-blue-500 hover:underline" href={`/w/${props.workspaceSlug}`}>
                Back to workspace
              </a>
            </div>

            <div className="mt-6 rounded-2xl border border-white/70 bg-white/65 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Start from docs</div>
              <div className="mt-2 grid gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={importBusy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {importBusy ? "Importing…" : "Upload file and parse"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void onImportFile(file);
                  }}
                />
                <Input
                  value={docUrl}
                  onChange={(event) => setDocUrl(event.target.value)}
                  placeholder="Google Doc URL"
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={importBusy || !docUrl.trim()}
                  onClick={() => void importFromGoogleDoc()}
                >
                  {importBusy ? "Importing…" : "Import from Google Doc"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AgentDock title={guide.title} body={guide.body} action={phase === "idle" ? "Tap to record" : null} />
    </main>
  );
}

function PhasePill(props: { active?: boolean; done?: boolean; children: React.ReactNode }) {
  const active = !!props.active;
  const done = !!props.done;
  return (
    <div
      className={[
        "rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] backdrop-blur-xl transition-all",
        done ? "border-white/70 bg-white/60 text-slate-800" : "border-white/50 bg-white/35 text-muted",
        active ? "shadow-[0_12px_40px_rgba(56,189,248,0.18)]" : "",
      ].join(" ")}
    >
      {props.children}
    </div>
  );
}

function DocBlock(props: { title: string; ready: boolean; delayMs?: number; children: React.ReactNode }) {
  return (
    <section
      className={[
        "rounded-2xl border border-white/60 bg-white/70 p-4 backdrop-blur-xl",
        props.ready ? "doc-block-reveal" : "",
      ].join(" ")}
      style={props.ready ? { animationDelay: `${props.delayMs ?? 0}ms` } : undefined}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-slate-800">{props.title}</div>
        <div className={props.ready ? "status-dot status-dot-on" : "status-dot"} />
      </div>
      <div className="mt-3 text-sm">{props.children}</div>
    </section>
  );
}

function SkeletonLines(props: { lines: number }) {
  return (
    <div className="grid gap-2">
      {Array.from({ length: props.lines }).map((_, i) => (
        <div
          key={i}
          className="shimmer h-3 rounded-full"
          style={{ width: `${92 - i * 8}%` }}
        />
      ))}
    </div>
  );
}

function AgentLine(props: { label: string; active?: boolean; done?: boolean }) {
  const active = !!props.active;
  const done = !!props.done;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/60 bg-white/50 px-3 py-2 backdrop-blur-xl">
      <div
        className={[
          "h-2.5 w-2.5 rounded-full",
          done ? "bg-emerald-500" : active ? "bg-sky-400 animate-pulse" : "bg-slate-300",
        ].join(" ")}
      />
      <div className="text-xs text-slate-700">{props.label}</div>
    </div>
  );
}

function AutoBullets(props: { text: string; kind: "risk" | "next" }) {
  const bullets = useMemo(() => {
    const t = props.text.toLowerCase();
    const items: string[] = [];
    if (props.kind === "risk") {
      if (t.includes("legal")) items.push("Check legal/compliance implications");
      if (t.includes("privacy")) items.push("Review privacy/data handling");
      if (t.includes("dependency") || t.includes("depends")) items.push("Confirm dependencies and owners");
      if (t.includes("risk")) items.push("Document the primary risk and mitigation");
      if (items.length === 0) items.push("Identify the top 1–2 risks before shipping");
    } else {
      if (t.includes("talk to") || t.includes("ask")) items.push("Request async feedback from stakeholders");
      if (t.includes("metric") || t.includes("measure")) items.push("Define success metrics");
      if (t.includes("experiment") || t.includes("test")) items.push("Run a quick experiment/prototype");
      if (items.length === 0) items.push("Turn this into a shareable artifact and request review");
    }
    return items.slice(0, 4);
  }, [props.kind, props.text]);

  return (
    <ul className="grid gap-1 text-sm text-slate-800">
      {bullets.map((b, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-sky-400" />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}
