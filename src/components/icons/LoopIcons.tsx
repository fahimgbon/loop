import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
const SPADE_PATH =
  "M458.915 307.705c0 62.63-54 91.32-91.34 91.34-41.64 0-73.1-18.86-91.83-34.26 2.47 50.95 14.53 87.35 68.65 116h-176.79c54.12-28.65 66.18-65.05 68.65-116-18.73 15.39-50.2 34.28-91.83 34.26-37.29 0-91.34-28.71-91.34-91.34 0-114.47 80.64-83.32 202.91-276.49 122.28 193.17 202.92 162.03 202.92 276.49z";

export function SpadeGlyph(props: IconProps) {
  return (
    <svg viewBox="0 0 512 512" fill="none" aria-hidden="true" {...props}>
      <path d={SPADE_PATH} fill="currentColor" />
    </svg>
  );
}

export function LoopMark(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <circle cx="16" cy="16" r="16" fill="currentColor" />
      <g transform="translate(6.2 5.4) scale(0.038)">
        <path d={SPADE_PATH} fill="white" />
      </g>
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true" {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  );
}

export function CaptureIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true" {...props}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11.5a6 6 0 0 0 12 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

export function InboxIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true" {...props}>
      <path d="M4 5h16l-1.4 11.2A2 2 0 0 1 16.6 18H7.4a2 2 0 0 1-1.98-1.8L4 5Z" />
      <path d="M4 13h4l2 3h4l2-3h4" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true" {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true" {...props}>
      <path d="M3.5 6.5A2.5 2.5 0 0 1 6 4h4l2 2h6A2.5 2.5 0 0 1 20.5 8.5v8A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5v-10Z" />
    </svg>
  );
}

export function NewDocIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true" {...props}>
      <path d="M7 3.5h7l4 4V20H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" />
      <path d="M14 3.5V8h4" />
      <path d="M12 11v6" />
      <path d="M9 14h6" />
    </svg>
  );
}

export function PanelIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true" {...props}>
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <path d="M14 4v16" />
    </svg>
  );
}

export function CommentIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true" {...props}>
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H10l-4 4v-4H7.5A2.5 2.5 0 0 1 5 12.5v-6Z" />
    </svg>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true" {...props}>
      <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true" {...props}>
      <path d="M8 14a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M16.5 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M3.5 20a4.5 4.5 0 0 1 9 0" />
      <path d="M13 20a3.8 3.8 0 0 1 7.5 0" />
    </svg>
  );
}

export function GraphIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true" {...props}>
      <circle cx="6.5" cy="7" r="2.5" />
      <circle cx="17.5" cy="6" r="2.5" />
      <circle cx="12" cy="17.5" r="3" />
      <path d="M8.7 8.3 10.8 15" />
      <path d="M15.3 7.8 13.3 15" />
      <path d="M9 7h6" />
    </svg>
  );
}

export function LinkNodesIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true" {...props}>
      <path d="M9.5 7.5h-2A3.5 3.5 0 0 0 4 11v0a3.5 3.5 0 0 0 3.5 3.5h2" />
      <path d="M14.5 16.5h2A3.5 3.5 0 0 0 20 13v0a3.5 3.5 0 0 0-3.5-3.5h-2" />
      <path d="M8.5 12h7" />
    </svg>
  );
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true" {...props}>
      <path d="M8 16 16.5 7.5" />
      <path d="M10 7.5h6.5V14" />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true" {...props}>
      <path d="m14.5 6.5-5 5 5 5" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true" {...props}>
      <path d="m9.5 6.5 5 5-5 5" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true" {...props}>
      <path d="m6.5 9.5 5.5 5 5.5-5" />
    </svg>
  );
}
