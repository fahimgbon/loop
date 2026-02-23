"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/src/components/Button";

export function CaptureRecorder(props: {
  workspaceSlug: string;
  onUploaded: (contributionId: string) => void;
  onRecordingChange?: (recording: boolean) => void;
  onAudioLevel?: (level: number) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [autoStop, setAutoStop] = useState(true);
  const [level, setLevel] = useState(0);
  const [, setTick] = useState(0);

  const chunksRef = useRef<BlobPart[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const levelRef = useRef(0);
  const lastVoiceAtRef = useRef<number>(0);
  const voiceStartedRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const lastUiUpdateRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const elapsed = startedAtRef.current
    ? Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000))
    : 0;

  useEffect(() => {
    if (!recording) return;
    const interval = window.setInterval(() => setTick((t) => t + 1), 500);
    return () => window.clearInterval(interval);
  }, [recording]);

  useEffect(() => {
    props.onRecordingChange?.(recording);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  useEffect(() => {
    props.onAudioLevel?.(levelRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setPermissionError(null);
    stopRequestedRef.current = false;
    voiceStartedRef.current = false;
    lastVoiceAtRef.current = Date.now();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (evt) => {
        if (evt.data.size > 0) chunksRef.current.push(evt.data);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setRecording(true);
      setTick(0);

      // Audio level analyser for visuals + auto-stop.
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.85;
      source.connect(analyser);
      analyserRef.current = analyser;

      const timeDomain = new Uint8Array(analyser.fftSize);
      const loop = () => {
        if (!analyserRef.current || !startedAtRef.current) return;
        analyserRef.current.getByteTimeDomainData(timeDomain);

        let sum = 0;
        for (let i = 0; i < timeDomain.length; i++) {
          const v = (timeDomain[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / timeDomain.length);
        const smoothed = levelRef.current * 0.82 + rms * 0.18;
        levelRef.current = smoothed;
        const uiNow = performance.now();
        if (uiNow - lastUiUpdateRef.current > 50) {
          lastUiUpdateRef.current = uiNow;
          setLevel(smoothed);
          props.onAudioLevel?.(smoothed);
        }

        const now = Date.now();
        const voiceThreshold = 0.028;
        if (smoothed > voiceThreshold) {
          lastVoiceAtRef.current = now;
          voiceStartedRef.current = true;
        }

        if (autoStop && !stopRequestedRef.current && voiceStartedRef.current) {
          const minMs = 1400;
          const silenceMs = 1150;
          const startedAt = startedAtRef.current;
          if (now - startedAt > minMs && now - lastVoiceAtRef.current > silenceMs) {
            stopRequestedRef.current = true;
            stopAndUpload();
            return;
          }
        }

        rafRef.current = window.requestAnimationFrame(loop);
      };
      rafRef.current = window.requestAnimationFrame(loop);
    } catch (err) {
      setPermissionError(err instanceof Error ? err.message : "Microphone permission denied");
    }
  }

  async function stopAndUpload() {
    if (!mediaRecorderRef.current) return;
    setUploading(true);

    try {
      const recorder = mediaRecorderRef.current;
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
      });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      analyserRef.current?.disconnect();
      analyserRef.current = null;
      await audioCtxRef.current?.close().catch(() => null);
      audioCtxRef.current = null;
      levelRef.current = 0;
      setLevel(0);
      props.onAudioLevel?.(0);

      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      await uploadBlob(blob, "capture.webm");
    } finally {
      setRecording(false);
      setUploading(false);
      mediaRecorderRef.current = null;
      startedAtRef.current = null;
      setTick(0);
    }
  }

  async function uploadBlob(blob: Blob, filename: string) {
    const form = new FormData();
    form.append("file", blob, filename);
    const res = await fetch(`/api/workspaces/${props.workspaceSlug}/contributions/audio`, {
      method: "POST",
      body: form,
    });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; contributionId?: string; error?: string }
      | null;
    if (!res.ok || !data?.ok || !data.contributionId) {
      throw new Error(data?.error ?? "Upload failed");
    }
    props.onUploaded(data.contributionId);
  }

  async function uploadFromFile(file: File) {
    setUploading(true);
    setPermissionError(null);
    try {
      await uploadBlob(file, file.name || "capture.webm");
    } catch (err) {
      setPermissionError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="grid place-items-center gap-4">
      <div className="relative grid place-items-center">
        <div className="pointer-events-none absolute inset-[-22px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(56,189,248,0.55),rgba(167,139,250,0.25),transparent_70%)] blur-2xl" />
        <div className="pointer-events-none absolute inset-[-34px] rounded-full bg-[radial-gradient(circle_at_70%_30%,rgba(236,72,153,0.38),transparent_62%)] blur-3xl" />

        <div className="pointer-events-none absolute inset-[-10px] rounded-full border border-white/70 bg-white/30 backdrop-blur-2xl shadow-[0_24px_80px_rgba(15,23,42,0.18)]" />

        <div
          className={[
            "pointer-events-none absolute inset-[-18px] rounded-full",
            "transition-opacity duration-300",
            recording ? "opacity-100" : "opacity-60",
          ].join(" ")}
          style={{
            boxShadow:
              recording
                ? "0 0 0 8px rgba(56,189,248,0.14), 0 0 0 18px rgba(167,139,250,0.10)"
                : "0 0 0 8px rgba(56,189,248,0.10), 0 0 0 18px rgba(167,139,250,0.06)",
            transform: recording ? `scale(${1 + level * 0.8})` : "scale(1)",
          }}
        />

        {recording ? (
          <Button
            type="button"
            variant="danger"
            className="h-20 w-20 rounded-full shadow-[0_18px_60px_rgba(244,63,94,0.35)]"
            onClick={stopAndUpload}
            disabled={uploading}
          >
            {uploading ? "…" : "Stop"}
          </Button>
        ) : (
          <button
            type="button"
            onClick={start}
            className="h-20 w-20 rounded-full border border-white/70 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.95),rgba(56,189,248,0.25))] text-sm font-semibold text-slate-900 shadow-[0_18px_60px_rgba(56,189,248,0.18)] transition hover:scale-[1.02] active:scale-[0.98]"
          >
            Record
          </button>
        )}
      </div>

      <div className="text-center">
        <div className="text-sm font-medium">
          {recording ? "Recording…" : uploading ? "Uploading…" : "Tap and speak naturally"}
        </div>
        <div className="mt-1 text-xs text-muted">
          {recording ? `${elapsed}s · ${autoStop ? "Auto‑stop on silence" : "Manual stop"}` : "10–90s is ideal"}
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={autoStop} onChange={(e) => setAutoStop(e.target.checked)} />
        Auto‑stop when you pause
      </label>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={recording || uploading}
        >
          Upload recording
        </Button>
        <span className="text-xs text-muted">Perfect for mobile voice memos and quick pings.</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void uploadFromFile(file);
        }}
      />

      {permissionError ? <p className="text-xs text-red-500">{permissionError}</p> : null}
    </div>
  );
}
