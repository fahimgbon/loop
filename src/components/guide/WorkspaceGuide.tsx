"use client";

import { AgentDock } from "@/src/components/guide/AgentDock";

export function WorkspaceGuide(props: { artifactsCount: number; foldersCount: number }) {
  if (props.artifactsCount > 0 && props.foldersCount > 0) {
    return (
      <AgentDock
        title="Keep the flow moving"
        body="Capture updates or ask for async input to keep decisions unblocked."
        action="Open Capture"
      />
    );
  }

  if (props.foldersCount === 0) {
    return (
      <AgentDock
        title="Start with a folder"
        body="Folders define the default block structure for all new artifacts."
        action="Create folder"
      />
    );
  }

  return (
    <AgentDock
      title="Create your first artifact"
      body="Pick a folder structure and start capturing async feedback."
      action="New artifact"
    />
  );
}
