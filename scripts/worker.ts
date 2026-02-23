import "./loadEnv";

import { withClient } from "@/src/server/db";
import { claimNextJob } from "@/src/server/repo/jobs";
import { processJob } from "@/src/server/jobs/runner";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runOnce() {
  const job = await withClient((client) => claimNextJob(client));
  if (!job) return false;

  await processJob(job, { allowRetry: true });
  return true;
}

async function main() {
  // eslint-disable-next-line no-console
  console.log("Loop worker started.");
  while (true) {
    const didWork = await runOnce();
    if (!didWork) await sleep(750);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
