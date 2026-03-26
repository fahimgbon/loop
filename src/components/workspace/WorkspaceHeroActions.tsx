"use client";

import Link from "next/link";

import {
  CaptureIcon,
  GraphIcon,
  SearchIcon,
} from "@/src/components/icons/LoopIcons";

export function WorkspaceHeroActions(props: { workspaceSlug: string }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2.5">
      <Link
        href={`/w/${props.workspaceSlug}/capture`}
        className="inline-flex items-center gap-2.5 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-[0_12px_26px_-24px_rgba(15,23,42,0.22)] transition hover:border-slate-400 hover:bg-slate-50"
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-900">
          <CaptureIcon className="h-4 w-4" />
        </span>
        <span>Capture</span>
      </Link>

      <button
        type="button"
        className="inline-flex items-center gap-2.5 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-[0_12px_26px_-24px_rgba(15,23,42,0.22)] transition hover:border-slate-400 hover:bg-slate-50"
        onClick={() => window.dispatchEvent(new CustomEvent("aceync:ask-open"))}
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-900">
          <SearchIcon className="h-4 w-4" />
        </span>
        <span>Browse</span>
      </button>

      <Link
        href={`/w/${props.workspaceSlug}/network`}
        className="inline-flex items-center gap-2.5 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-[0_12px_26px_-24px_rgba(15,23,42,0.22)] transition hover:border-slate-400 hover:bg-slate-50"
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-900">
          <GraphIcon className="h-4 w-4" />
        </span>
        <span>Network</span>
      </Link>
    </div>
  );
}
