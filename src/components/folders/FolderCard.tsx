import type { CSSProperties } from "react";

type FolderVisual = {
  icon: string;
  label: string;
  accent: string;
};

function inferFolderVisual(name: string): FolderVisual {
  const n = name.toLowerCase();
  if (n.includes("research")) return { icon: "RQ", label: "Research", accent: "56 189 248" };
  if (n.includes("policy")) return { icon: "POL", label: "Policy", accent: "251 146 60" };
  if (n.includes("startup") || n.includes("idea")) return { icon: "IDEA", label: "Startup", accent: "244 114 182" };
  if (n.includes("prd") || n.includes("product")) return { icon: "PRD", label: "PRD", accent: "59 130 246" };
  return { icon: "DOC", label: "Folder", accent: "148 163 184" };
}

export function FolderCard(props: {
  name: string;
  subtitle?: string | null;
  meta?: string | null;
  label?: string | null;
  badge?: string | null;
  selected?: boolean;
}) {
  const visual = inferFolderVisual(props.name);
  const label = props.label ?? visual.label;

  return (
    <div
      className="folder-card"
      data-selected={props.selected ? "true" : "false"}
      style={{ "--folder-accent": visual.accent } as CSSProperties}
    >
      {props.badge ? <span className="guide-badge">{props.badge}</span> : null}
      <div className="flex items-start gap-3">
        <div className="folder-icon">{visual.icon}</div>
        <div className="folder-meta">
          <div className="text-sm font-semibold text-slate-900">{props.name}</div>
          {props.subtitle ? <div className="text-xs text-muted">{props.subtitle}</div> : null}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
        <span className="folder-pill">{label}</span>
        {props.meta ? <span>{props.meta}</span> : <span />}
      </div>
    </div>
  );
}
