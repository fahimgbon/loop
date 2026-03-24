import type { CSSProperties, ComponentType, SVGProps } from "react";

import {
  FolderIcon,
  GraphIcon,
  SearchIcon,
  SparkIcon,
} from "@/src/components/icons/LoopIcons";

type FolderVisual = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  accent: string;
  surface: string;
  edge: string;
  ink: string;
};

function inferFolderVisual(name: string): FolderVisual {
  const n = name.toLowerCase();
  if (n.includes("research")) {
    return {
      icon: SearchIcon,
      label: "Research",
      accent: "118 180 255",
      surface: "234 244 255",
      edge: "191 219 254",
      ink: "30 64 175",
    };
  }
  if (n.includes("policy")) {
    return {
      icon: GraphIcon,
      label: "Policy",
      accent: "155 150 255",
      surface: "240 236 255",
      edge: "221 214 254",
      ink: "91 33 182",
    };
  }
  if (n.includes("startup") || n.includes("idea")) {
    return {
      icon: SparkIcon,
      label: "Startup",
      accent: "235 170 207",
      surface: "251 236 245",
      edge: "244 206 226",
      ink: "157 23 77",
    };
  }
  if (n.includes("prd") || n.includes("product")) {
    return {
      icon: FolderIcon,
      label: "PRD",
      accent: "104 145 255",
      surface: "232 239 255",
      edge: "191 219 254",
      ink: "30 64 175",
    };
  }
  return {
    icon: FolderIcon,
    label: "Folder",
    accent: "166 182 255",
    surface: "239 242 255",
    edge: "214 220 255",
    ink: "67 56 202",
  };
}

export function FolderCard(props: {
  name: string;
  subtitle?: string | null;
  meta?: string | null;
  label?: string | null;
  badge?: string | null;
  selected?: boolean;
  count?: number | null;
  lead?: string | null;
  chips?: string[];
  kind?: "folder" | "smart";
}) {
  const visual = inferFolderVisual(props.name);
  const Icon = visual.icon;
  const label = props.label ?? visual.label;

  return (
    <div
      className="folder-card flex h-full flex-col"
      data-selected={props.selected ? "true" : "false"}
      style={
        {
          "--folder-accent": visual.accent,
          "--folder-surface": visual.surface,
          "--folder-edge": visual.edge,
          "--folder-ink": visual.ink,
        } as CSSProperties
      }
    >
      {props.badge ? <span className="guide-badge">{props.badge}</span> : null}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="folder-icon">
            <Icon className="h-5 w-5" />
          </div>
          <div className="folder-meta min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">{props.name}</div>
            {props.subtitle ? <div className="truncate text-xs text-muted">{props.subtitle}</div> : null}
          </div>
        </div>
        {props.count != null ? (
          <div
            className="inline-flex min-w-[72px] shrink-0 items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums"
            style={{
              border: `1px solid rgb(${visual.edge} / 0.92)`,
              background: `rgb(${visual.surface} / 0.88)`,
              color: `rgb(${visual.ink} / 0.88)`,
            }}
          >
            {props.count} doc{props.count === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>
      {props.lead ? (
        <div
          className="mt-3 min-h-[48px] text-sm leading-6 text-slate-600"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {props.lead}
        </div>
      ) : null}
      {props.chips && props.chips.length > 0 ? (
        <div className="mt-3 flex min-h-[56px] flex-wrap content-start gap-2">
          {props.chips.slice(0, 3).map((chip) => (
            <span key={chip} className="folder-pill">
              {chip}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-auto flex items-center justify-between pt-3 text-[11px] text-muted">
        <span className="folder-pill">{props.kind === "smart" ? `${label} cluster` : label}</span>
        {props.meta ? <span className="shrink-0 whitespace-nowrap">{props.meta}</span> : <span />}
      </div>
    </div>
  );
}
