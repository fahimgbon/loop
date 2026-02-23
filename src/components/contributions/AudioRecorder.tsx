"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/src/components/Button";

export function AudioRecorder(props: {
  workspaceSlug: string;
  artifactId?: string;
  blockId?: string;
  onUploaded?: (contributionId: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [, setTick] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lastContributionId, setLastContributionId] = useState<string | null>(null);

  const chunksRef = useRef<BlobPart[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const elapsed = startedAtRef.current ? Math.floor((Date.now() - startedAtRef.current) / 1000) : 0;

  useEffect(() => {
    if (!recording) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 500);
    return () => clearInterval(interval);
  }, [recording]);

  async function start() {
    setPermissionError(null);
    setLastContributionId(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (evt) => {
        if (evt.data.size > 0) chunksRef.current.push(evt.data);
      };
      mediaRecorder.start();
      streamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;
      startedAtRef.current = Date.now();
      setRecording(true);
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
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      await uploadFileBlob(blob, "note.webm");
    } finally {
      setRecording(false);
      setUploading(false);
      mediaRecorderRef.current = null;
      startedAtRef.current = null;
      setTick(0);
    }
  }

  async function uploadFileBlob(blob: Blob, filename: string) {
    const form = new FormData();
    form.append("file", blob, filename);
    if (props.artifactId) form.append("artifactId", props.artifactId);
    if (props.blockId) form.append("blockId", props.blockId);

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
    setLastContributionId(data.contributionId);
    props.onUploaded?.(data.contributionId);
  }

  async function uploadExistingFile(file: File) {
    setPermissionError(null);
    setUploading(true);
    setLastContributionId(null);
    try {
      await uploadFileBlob(file, file.name || "recording.webm");
    } catch (err) {
      setPermissionError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        {recording ? (
          <Button type="button" variant="danger" onClick={stopAndUpload} disabled={uploading}>
            {uploading ? "Uploading…" : "Stop + upload"}
          </Button>
        ) : (
          <Button type="button" onClick={start}>
            Record audio
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={recording || uploading}
        >
          Upload file
        </Button>
        <div className="text-xs text-muted">
          {recording ? `Recording… ${elapsed}s` : "Record or upload from phone"}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void uploadExistingFile(file);
        }}
      />
      {permissionError ? <p className="text-xs text-red-400">{permissionError}</p> : null}
      {lastContributionId ? (
        <p className="text-xs text-muted">
          Uploaded. Contribution:{" "}
          <a className="text-blue-400 hover:underline" href={`/api/contributions/${lastContributionId}/audio`} target="_blank">
            audio
          </a>
        </p>
      ) : null}
    </div>
  );
}
