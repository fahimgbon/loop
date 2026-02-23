export const JOB_TYPES = {
  TRANSCRIBE_CONTRIBUTION: "transcribe_contribution",
  CLASSIFY_CONTRIBUTION: "classify_contribution",
  SYNC_SLACK_REPLY: "sync_slack_reply",
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

