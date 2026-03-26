"use client";

import type { ReactNode } from "react";

type Person = {
  id?: string;
  name: string;
  email?: string | null;
};

export function AvatarStack(props: {
  people: Person[];
  max?: number;
  size?: "sm" | "md";
  onPersonClick?: (person: Person) => void;
}) {
  const max = props.max ?? 4;
  const visible = props.people.slice(0, max);
  const overflow = Math.max(0, props.people.length - visible.length);
  const sizeClass = props.size === "sm" ? "h-8 w-8 text-[11px]" : "h-9 w-9 text-xs";

  return (
    <div className="flex items-center">
      {visible.map((person, index) => (
        <AvatarBubble
          key={person.id ?? `${person.name}-${index}`}
          person={person}
          sizeClass={sizeClass}
          overlapClass={index === 0 ? "" : "-ml-2.5"}
          onClick={props.onPersonClick}
        >
          {getInitials(person.name || person.email || "Aceync")}
        </AvatarBubble>
      ))}
      {overflow > 0 ? (
        <span
          className={[
            "inline-flex shrink-0 items-center justify-center rounded-full border-2 border-white bg-slate-100 font-semibold text-slate-700 shadow-sm",
            sizeClass,
            visible.length > 0 ? "-ml-2.5" : "",
          ].join(" ")}
          title={`${overflow} more`}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

function AvatarBubble(props: {
  children: ReactNode;
  person: Person;
  sizeClass: string;
  overlapClass: string;
  onClick?: (person: Person) => void;
}) {
  const className = [
    "inline-flex shrink-0 items-center justify-center rounded-full border-2 border-white font-semibold text-slate-900 shadow-sm transition",
    props.sizeClass,
    props.overlapClass,
    props.onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400" : "",
  ].join(" ");

  const content = (
    <>
      {props.children}
    </>
  );

  if (!props.onClick) {
    return (
      <span
        className={className}
        style={avatarStyle(props.person.name || props.person.email || "")}
        title={props.person.email ? `${props.person.name} · ${props.person.email}` : props.person.name}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={className}
      style={avatarStyle(props.person.name || props.person.email || "")}
      title={props.person.email ? `${props.person.name} · ${props.person.email}` : props.person.name}
      onClick={() => props.onClick?.(props.person)}
      aria-label={`Open profile for ${props.person.name}`}
    >
      {content}
    </button>
  );
}

function getInitials(value: string) {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "L";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

function avatarStyle(seed: string) {
  const palette = [
    { bg: "rgba(219, 234, 254, 0.96)", fg: "rgb(30, 64, 175)" },
    { bg: "rgba(220, 252, 231, 0.96)", fg: "rgb(22, 101, 52)" },
    { bg: "rgba(254, 242, 242, 0.96)", fg: "rgb(153, 27, 27)" },
    { bg: "rgba(243, 232, 255, 0.96)", fg: "rgb(107, 33, 168)" },
    { bg: "rgba(255, 247, 237, 0.96)", fg: "rgb(154, 52, 18)" },
    { bg: "rgba(236, 254, 255, 0.96)", fg: "rgb(21, 94, 117)" },
  ];
  const index = stableHash(seed) % palette.length;
  const choice = palette[index];
  return {
    background: choice.bg,
    color: choice.fg,
  };
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}
