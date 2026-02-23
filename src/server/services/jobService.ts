import { runJobById } from "@/src/server/jobs/runner";

export function shouldInlineJobs() {
  if (process.env.INLINE_JOBS === "1") return true;
  if (process.env.INLINE_JOBS === "0") return false;
  return process.env.NODE_ENV !== "production";
}

export async function maybeRunJob(jobId: string) {
  if (!shouldInlineJobs()) return false;
  try {
    await runJobById(jobId, { allowRetry: false });
    return true;
  } catch {
    return false;
  }
}

