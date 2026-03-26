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
      accent: "110 195 255",
      surface: "230 244 255",
      edge: "173 217 255",
      ink: "18 58 163",
    };
  }
  if (n.includes("policy")) {
    return {
      icon: GraphIcon,
      label: "Policy",
      accent: "176 150 255",
      surface: "241 236 255",
      edge: "217 203 255",
      ink: "88 28 182",
    };
  }
  if (n.includes("startup") || n.includes("idea")) {
    return {
      icon: SparkIcon,
      label: "Startup",
      accent: "255 172 205",
      surface: "255 238 246",
      edge: "255 209 226",
      ink: "157 23 77",
    };
  }
  if (n.includes("prd") || n.includes("product")) {
    return {
      icon: FolderIcon,
      label: "PRD",
      accent: "138 222 196",
      surface: "235 251 245",
      edge: "182 238 216",
      ink: "17 94 89",
    };
  }
  return {
    icon: FolderIcon,
    label: "Folder",
    accent: "255 206 127",
    surface: "255 246 226",
    edge: "255 225 172",
    ink: "146 64 14",
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
            {props.subtitle ? <div className="truncate text-xs text-slate-600">{props.subtitle}</div> : null}
          </div>
        </div>
        {props.count != null ? (
          <div
            className="inline-flex h-8 min-w-[78px] shrink-0 items-center justify-center whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold tabular-nums"
            style={{
              border: `1px solid rgb(${visual.edge} / 0.92)`,
              background: "rgba(255,255,255,0.92)",
              color: `rgb(${visual.ink} / 0.96)`,
            }}
          >
            {props.count} doc{props.count === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>
      {props.lead ? (
        <div
          className="mt-3 min-h-[44px] text-sm leading-6 text-slate-700"
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
      <div className="mt-auto flex items-center justify-between pt-3 text-[11px] text-slate-600">
        <span className="folder-pill">{label}</span>
        {props.meta ? <span className="shrink-0 whitespace-nowrap">{props.meta}</span> : <span />}
      </div>
    </div>
  );
}
