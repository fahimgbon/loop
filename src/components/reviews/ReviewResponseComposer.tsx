"use client";

import { useState } from "react";

import { Button } from "@/src/components/Button";
import { Textarea } from "@/src/components/Textarea";
import { ReviewAudioRecorder } from "@/src/components/reviews/ReviewAudioRecorder";

export function ReviewResponseComposer(props: { workspaceSlug: string; reviewRequestId: string }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [listening, setListening] = useState(false);
  const speechRecognitionSupported =
    typeof window !== "undefined" &&
    ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  async function submit() {
    setLoading(true);
    setError(null);
    setOk(false);
    try {
      const res = await fetch(
        `/api/workspaces/${props.workspaceSlug}/review-requests/${props.reviewRequestId}/responses/text`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        },
      );
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Submit failed");
        return;
      }
      setText("");
      setOk(true);
      window.location.reload();
    } finally {
      setLoading(false);
    }
  }

  function speakDraft() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const content = text.trim();
    if (!content) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
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

    const SpeechRecognitionCtor = (
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
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
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

  return (
    <div className="grid gap-3">
      <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write your feedback…" />
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
          {listening ? "Listening…" : "Dictate response"}
        </Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <ReviewAudioRecorder workspaceSlug={props.workspaceSlug} reviewRequestId={props.reviewRequestId} />
        <Button type="button" onClick={submit} disabled={loading || !text.trim()}>
          {loading ? "Sending…" : "Send text"}
        </Button>
      </div>
      {ok ? <p className="text-xs text-green-400">Sent.</p> : null}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
