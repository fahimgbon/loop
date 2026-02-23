"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function AgentDock(props: { title: string; body: string; action?: string | null }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="agent-dock" aria-live="polite">
      <div className="agent-orb" />
      <div className="grid gap-1">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted">Guide</div>
        <div className="text-sm font-semibold text-slate-900">{props.title}</div>
        <div className="text-xs text-muted">{props.body}</div>
        {props.action ? <div className="agent-action">{props.action}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
