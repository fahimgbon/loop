"use client";

import { useState } from "react";

import { Button } from "@/src/components/Button";

export type ReviewRequestSlackStatus =
  | "posted"
  | "slack_not_connected"
  | "channel_not_configured"
  | "post_failed";

export type ReviewRequestShareState = {
  reviewRequestId: string;
  shareUrl: string;
  slackStatus: ReviewRequestSlackStatus;
  slackChannelId: string | null;
  slackTeamName: string | null;
};

export function ReviewRequestShareCard(props: { share: ReviewRequestShareState }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(props.share.shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const tone =
    props.share.slackStatus === "posted"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <div className={["rounded-2xl border p-3", tone].join(" ")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-[0.18em]">Request ready</div>
          <p className="mt-1 text-sm">{slackMessage(props.share)}</p>
          <a
            className="mt-2 block break-all text-xs underline decoration-current/40 underline-offset-4 hover:decoration-current"
            href={props.share.shareUrl}
          >
            {props.share.shareUrl}
          </a>
        </div>
        <Button type="button" variant="secondary" onClick={() => void copyLink()}>
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </div>
  );
}

function slackMessage(share: ReviewRequestShareState) {
  if (share.slackStatus === "posted") {
    const team = share.slackTeamName ? ` in ${share.slackTeamName}` : "";
    const channel = share.slackChannelId ? ` to ${share.slackChannelId}` : "";
    return `Posted to Slack${channel}${team}. You can still copy the link if you want to send it elsewhere.`;
  }

  if (share.slackStatus === "channel_not_configured") {
    return "Slack is connected, but there is no default channel configured yet. Copy the link and share it manually for now.";
  }

  if (share.slackStatus === "post_failed") {
    return "The request was created, but the automatic Slack post did not go through. Copy the link and share it manually.";
  }

  return "The request was created. Copy the link and drop it into Slack or anywhere else you need.";
}
