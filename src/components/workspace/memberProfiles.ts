import type { StaticImageData } from "next/image";

import bitmojiKoreanHeart from "../../../BitmojiKoreanHeart.png";
import bitmojiLaptop from "../../../BitmojiLaptop.png";
import bitmojiOther from "../../../BitmojiOther.png";
import bitmojiRaisedHand from "../../../BitmojiRaisedHand.png";

export type WorkspaceProfileMember = {
  userId: string;
  name: string;
  email: string;
  role: "admin" | "member";
  avatarSrc?: StaticImageData | null;
};

type MemberTone = {
  accent: string;
  glow: string;
  surface: string;
  ink: string;
};

type MemberProfilePreset = {
  title: string;
  summary: string;
  strengths: string[];
  rituals: string[];
  favoriteSpaces: string[];
};

const PROFILE_AVATARS: Record<string, StaticImageData> = {
  "admin@loop.local": bitmojiLaptop,
  "hannah@loop.local": bitmojiRaisedHand,
  "marcus@loop.local": bitmojiOther,
  "priya@loop.local": bitmojiKoreanHeart,
};

const DEFAULT_AVATARS = [bitmojiLaptop, bitmojiRaisedHand, bitmojiOther, bitmojiKoreanHeart];

const PROFILE_PRESETS: Record<string, MemberProfilePreset> = {
  "admin@loop.local": {
    title: "Workspace lead",
    summary: "Keeps the workspace legible, turns rough notes into momentum, and makes sure requests land with clear owners.",
    strengths: ["Tighten scope", "Unblock delivery", "Set the next step"],
    rituals: ["Reviews open threads daily", "Prefers crisp summaries over long status notes"],
    favoriteSpaces: ["Network", "Inbox", "Shared folders"],
  },
  "hannah@loop.local": {
    title: "Research and synthesis",
    summary: "Turns early conversations into clear hypotheses, cleaner structure, and sharper questions for the rest of the team.",
    strengths: ["Research framing", "Insight distillation", "Feedback phrasing"],
    rituals: ["Uses voice capture first", "Leaves comment-style edits instead of overwriting"],
    favoriteSpaces: ["Capture", "Research folders", "Open threads"],
  },
  "marcus@loop.local": {
    title: "Operations and rollout",
    summary: "Connects the artifact to execution details, dependencies, and the practical steps needed to make an idea real.",
    strengths: ["Dependencies", "Rollout planning", "Cross-team coordination"],
    rituals: ["Skims the network before adding new docs", "Flags risk early"],
    favoriteSpaces: ["Folders", "Network", "Connected artifacts"],
  },
  "priya@loop.local": {
    title: "Design systems and polish",
    summary: "Makes the work feel clear, presentable, and ready to share without sacrificing structure underneath.",
    strengths: ["Narrative clarity", "Visual polish", "Presentation readiness"],
    rituals: ["Looks for repeated structure", "Turns recurring patterns into reusable folders"],
    favoriteSpaces: ["Folders", "Network", "Artifact canvas"],
  },
};

const TONES: MemberTone[] = [
  { accent: "101 149 255", glow: "215 232 255", surface: "242 247 255", ink: "30 64 175" },
  { accent: "141 150 255", glow: "228 226 255", surface: "246 244 255", ink: "91 33 182" },
  { accent: "117 192 255", glow: "220 240 255", surface: "241 249 255", ink: "12 74 110" },
  { accent: "230 176 210", glow: "249 231 241", surface: "253 244 248", ink: "157 23 77" },
];

export function buildMemberProfile(member: WorkspaceProfileMember) {
  const preset = PROFILE_PRESETS[member.email.toLowerCase()] ?? defaultPreset(member);
  const tone = TONES[stableHash(member.email || member.name) % TONES.length];
  const pulse = stableHash(`${member.email}:${member.role}`);
  const avatarSrc =
    member.avatarSrc ??
    PROFILE_AVATARS[member.email.toLowerCase()] ??
    DEFAULT_AVATARS[stableHash(`${member.email}:${member.userId}`) % DEFAULT_AVATARS.length];

  return {
    ...member,
    ...preset,
    tone,
    avatarSrc,
    stats: {
      artifacts: 4 + (pulse % 5),
      threads: 1 + (pulse % 4),
      folders: 2 + (pulse % 3),
    },
    availability:
      member.role === "admin" ? "Usually the fastest route for a decision." : "Best pulled in early, before the artifact hardens.",
  };
}

function defaultPreset(member: WorkspaceProfileMember): MemberProfilePreset {
  if (member.role === "admin") {
    return {
      title: "Workspace steward",
      summary: "Keeps collaboration moving, spots gaps in the doc, and helps the team turn drafts into shared direction.",
      strengths: ["Decision framing", "Prioritization", "Review triage"],
      rituals: ["Works from the network when context is spread out", "Uses requests to keep feedback visible"],
      favoriteSpaces: ["Inbox", "Network", "Artifact side panel"],
    };
  }

  return {
    title: "Core contributor",
    summary: "Adds detail, responds in context, and helps the artifact become clearer for everyone else using the workspace.",
    strengths: ["Async feedback", "Draft improvement", "Artifact cleanup"],
    rituals: ["Responds directly in the doc", "Builds on existing structure instead of starting over"],
    favoriteSpaces: ["Artifact canvas", "Search", "Shared folders"],
  };
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}
