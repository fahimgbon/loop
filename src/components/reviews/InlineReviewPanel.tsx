"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/src/components/Button";
import { ReviewAudioRecorder } from "@/src/components/reviews/ReviewAudioRecorder";
import { Textarea } from "@/src/components/Textarea";

type InlineReviewRequest = {
  id: string;
  title: string;
  dueAt: string | null;
  createdAt: string;
  questions: string[];
  blockIds: string[];
};

export function InlineReviewPanel(props: {
  workspaceSlug: string;
  artifactId: string;
  requests: InlineReviewRequest[];
  blockTitles: Array<{ id: string; title: string | null; type: string }>;
  onResponseCreated?: () => void;
}) {
  const [activeId, setActiveId] = useState(props.requests[0]?.id ?? "");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [listening, setListening] = useState(false);

  const active = useMemo(() => props.requests.find((request) => request.id === activeId) ?? null, [
    props.requests,
    activeId,
  ]);
  const blockTitleMap = useMemo(
    () => new Map(props.blockTitles.map((block) => [block.id, block.title ?? block.type])),
    [props.blockTitles],
  );

  const speechRecognitionSupported =
    typeof window !== "undefined" &&
    ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  useEffect(() => {
    const blockIds = active?.blockIds ?? [];
    window.dispatchEvent(new CustomEvent("loop:highlight-blocks", { detail: { blockIds } }));
    return () => {
      window.dispatchEvent(new CustomEvent("loop:highlight-blocks", { detail: { blockIds: [] } }));
    };
  }, [active?.blockIds]);

  async function sendText() {
    if (!active || !text.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/workspaces/${props.workspaceSlug}/review-requests/${active.id}/responses/text`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim() }),
        },
      );
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Could not send response");
        return;
      }
      setText("");
      setNotice("Response captured. Suggestions/comments are being generated.");
      props.onResponseCreated?.();
    } finally {
      setBusy(false);
    }
  }

  function speakDraft() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (!text.trim()) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text.trim()));
  }

  function dictate() {
    if (!speechRecognitionSupported || listening) return;
    type SpeechRecognitionLike = {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
    };
    const Recognition = (
      window as Window & {
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        SpeechRecognition?: new () => SpeechRecognitionLike;
      }
    ).webkitSpeechRecognition ??
      (
        window as Window & {
          SpeechRecognition?: new () => SpeechRecognitionLike;
        }
      ).SpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (!transcript) return;
      setText((current) => (current.trim() ? `${current.trimEnd()}\n${transcript}` : transcript));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  }

  if (props.requests.length === 0) {
    return (
      <div className="rounded-xl border border-white/60 bg-white/50 p-4 text-sm text-muted">
        No open review requests on this artifact.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/60 bg-white/50 p-4">
      <div className="text-sm font-semibold uppercase tracking-wide text-muted">Inline async review</div>
      <p className="mt-1 text-sm text-muted">
        Stay in this artifact, answer questions inline, and record while reading.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {props.requests.map((request) => (
          <button
            key={request.id}
            type="button"
            onClick={() => {
              setActiveId(request.id);
              setError(null);
              setNotice(null);
            }}
            className={[
              "rounded-full border px-3 py-1 text-xs transition",
              request.id === activeId
                ? "border-sky-300 bg-sky-50 text-sky-700"
                : "border-white/70 bg-white/80 text-slate-700 hover:bg-white",
            ].join(" ")}
          >
            {request.title}
          </button>
        ))}
      </div>

      {active ? (
        <div className="mt-4 grid gap-3 rounded-lg border border-white/60 bg-white/70 p-3">
          <div className="text-xs text-muted">
            Created {new Date(active.createdAt).toLocaleString()}
            {active.dueAt ? ` · Due ${new Date(active.dueAt).toLocaleString()}` : ""}
          </div>
          <div className="grid gap-2">
            {active.questions.length > 0 ? (
              active.questions.map((question, index) => (
                <div key={index} className="rounded-md border border-fuchsia-100 bg-fuchsia-50 px-3 py-2 text-sm">
                  {question}
                </div>
              ))
            ) : (
              <div className="text-sm text-muted">No explicit question on this request.</div>
            )}
          </div>
          {active.blockIds.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {active.blockIds.map((blockId) => (
                <span
                  key={blockId}
                  className="rounded-full border border-white/70 bg-white/85 px-2 py-0.5 text-[11px] text-slate-700"
                >
                  {blockTitleMap.get(blockId) ?? "Block"}
                </span>
              ))}
            </div>
          ) : null}

          <Textarea
            rows={4}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Type your response while reading the doc..."
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={speakDraft} disabled={!text.trim()}>
              Listen back
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={dictate}
              disabled={!speechRecognitionSupported || listening}
            >
              {listening ? "Listening…" : "Dictate"}
            </Button>
            <ReviewAudioRecorder
              workspaceSlug={props.workspaceSlug}
              reviewRequestId={active.id}
              autoReload={false}
              onUploaded={() => {
                setNotice("Voice response uploaded. Suggestions/comments are being generated.");
                props.onResponseCreated?.();
              }}
            />
            <div className="ml-auto">
              <Button type="button" onClick={sendText} disabled={busy || !text.trim()}>
                {busy ? "Sending…" : "Send response"}
              </Button>
            </div>
          </div>
          {error ? <div className="text-xs text-red-500">{error}</div> : null}
          {notice ? <div className="text-xs text-emerald-600">{notice}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
