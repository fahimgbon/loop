"use client";

import { useState } from "react";

import { Button } from "@/src/components/Button";

export function ExtensionConnectCard(props: {
  token: string;
  workspaceSlug: string;
  extensionRoute: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyToken() {
    await navigator.clipboard.writeText(props.token);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="grid gap-4 rounded-[28px] border border-slate-300 bg-white/95 p-6 shadow-[0_28px_90px_-52px_rgba(15,23,42,0.24)]">
      <div className="intent-pill">Chrome extension</div>
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Connect Aceync Docs</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Paste this token into the extension popup. It will connect the Google Docs side panel to the{" "}
          <span className="font-medium text-slate-900">{props.workspaceSlug}</span> workspace and let the extension
          create artifacts plus upload voice feedback.
        </p>
      </div>

      <div className="grid gap-3 rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Extension token</div>
        <textarea
          readOnly
          value={props.token}
          className="min-h-[148px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-800 shadow-[0_12px_28px_-24px_rgba(4,12,27,0.2)] outline-none"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={copyToken}>
            {copied ? "Copied" : "Copy token"}
          </Button>
          <a
            href={props.extensionRoute}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-950 shadow-[0_10px_28px_-22px_rgba(4,12,27,0.28)] transition hover:border-slate-400 hover:bg-slate-50"
          >
            Refresh token JSON
          </a>
        </div>
      </div>

      <div className="grid gap-2 rounded-[22px] border border-slate-200 bg-white p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">How to use it</div>
        <ol className="grid gap-2 text-sm text-slate-700">
          <li>1. Load the unpacked extension from the repo&apos;s <code>extension/</code> folder.</li>
          <li>2. In the popup, set your app URL and paste the token above.</li>
          <li>3. Open any Google Doc and use the Aceync panel to sync the doc into a structured artifact.</li>
          <li>4. Record voice feedback in the panel. The transcript and suggestions will land in Aceync.</li>
        </ol>
      </div>
    </div>
  );
}
