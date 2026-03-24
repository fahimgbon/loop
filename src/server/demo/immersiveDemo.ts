export type DemoPrdSections = {
  context: string;
  problem: string;
  targetUsers: string;
  proposedSolution: string;
  nonGoals: string;
  successMetrics: string;
  risks: string;
  assumptions: string;
  openQuestions: string;
  dependencies: string;
  rolloutNotes: string;
};

export type DemoPrdDraft = {
  scenarioId: string;
  title: string;
  transcript: string;
  sections: DemoPrdSections;
};

export const LOOP_DEMO_PRD: DemoPrdDraft = {
  scenarioId: "stakeholder-alignment-copilot",
  title: "Stakeholder Alignment Copilot",
  transcript: [
    "I am a product manager exploring a feature that helps me explain early product ideas out loud instead of forcing me to draft a polished PRD from scratch.",
    "The core workflow starts with voice capture. I record a rough idea about helping teams align stakeholders asynchronously, then the system transcribes what I said immediately and turns it into a structured artifact.",
    "From there, I want the artifact to highlight the context, the problem, who this is for, the proposed solution, the success metrics, the assumptions, the dependencies, and the rollout notes.",
    "I also want the product to act like a devil's advocate. It should point out risks, open questions, and what is still too vague to ship or socialize broadly.",
    "Once the artifact exists, I want to request feedback from teammates without rewriting the whole document. Ideally I can copy a link or route the request into Slack, ask a few targeted questions, and let reviewers reply with voice or text while they read.",
    "Reviewer feedback should feel like suggestions in Google Docs instead of silent overwrites. I want to see who proposed a change, what text they are replacing, and whether I accept or decline it.",
    "The overall value is low-friction product thinking: talk first, get structure for free, pressure-test the idea asynchronously, and keep a clean source of truth that is easy to iterate on later.",
  ].join(" "),
  sections: {
    context: [
      "Product teams are still translating messy early thinking across voice notes, Slack threads, docs, and follow-up meetings.",
      "",
      "This demo shows a voice-first workflow where a PM can capture an idea once and have Loop turn it into a reviewable artifact with clear structure and next steps.",
    ].join("\n"),
    problem: [
      "Writing the first version of a PRD is high-friction, especially when the idea is still forming.",
      "",
      "Teams lose momentum because the initial capture step is slow, feedback happens in disconnected tools, and reviewers do not know which parts still need pressure-testing.",
    ].join("\n"),
    targetUsers: [
      "- Product managers who think out loud before they write.",
      "- Design and engineering partners who want lightweight async review instead of another meeting.",
      "- Leaders who need a clean source of truth before they approve experiments or rollout plans.",
    ].join("\n"),
    proposedSolution: [
      "The product lets a PM press record, see the transcript immediately, publish into a PRD, and request async feedback from collaborators without reformatting the idea by hand.",
      "",
      "Reviewer input appears as suggestions and inline comments so the author can compare the original wording against the proposed change before accepting it.",
      "",
      "The artifact stays editable over time, so the PM can return later, record another update, and keep extending the same source of truth instead of starting over.",
    ].join("\n"),
    nonGoals: [
      "- Replacing dedicated project management tools in the MVP.",
      "- Automating full go-to-market execution.",
      "- Acting as a compliance or legal approval system.",
    ].join("\n"),
    successMetrics: [
      "- 70% of first-draft artifacts are created from voice in under 3 minutes.",
      "- 60% of review requests receive at least one response within 24 hours.",
      "- 40% reduction in time from initial idea capture to shareable PRD draft.",
      "- At least 2 accepted suggestions per actively reviewed artifact during pilot.",
    ].join("\n"),
    risks: [
      "- Generated structure may overstate confidence if the original idea is still too vague.",
      "- Review routing could feel incomplete if Slack destinations are not configurable.",
      "- Suggestion UX needs to feel trustworthy or reviewers will default back to comments in separate docs.",
    ].join("\n"),
    assumptions: [
      "- PMs are more willing to capture early thinking with voice than with a blank document.",
      "- Teams value suggestion-based collaboration over direct edits for early-stage artifacts.",
      "- Reviewers will engage more often if requests are targeted to specific unknowns instead of whole-doc critique.",
    ].join("\n"),
    openQuestions: [
      "- Should Slack routing happen at the workspace level, per artifact, or per request?",
      "- What is the right default between comment-only feedback and suggestion-mode feedback?",
      "- How should the product surface follow-up recordings so the artifact history stays legible?",
    ].join("\n"),
    dependencies: [
      "- Slack integration for optional request delivery.",
      "- Reliable speech-to-text provider for production use.",
      "- Lightweight identity and permission model so reviewers can be viewers or editors.",
    ].join("\n"),
    rolloutNotes: [
      "Phase 1: Internal PM/design/engineering pilot with manual routing and mock AI.",
      "",
      "Phase 2: Enable configurable Slack delivery, reusable artifact templates, and richer review analytics.",
      "",
      "Phase 3: Add organization-specific structures, audit history, and external stakeholder review modes.",
    ].join("\n"),
  },
};

export const LOOP_DEMO_REVIEW = {
  title: "Async review: pressure-test collaboration flow",
  questions: [
    "What part of this workflow still feels too manual or high-friction?",
    "If this showed up in Slack, what context would you need before responding?",
    "Which section should stay suggestion-based instead of allowing direct edits?",
  ],
  responseText:
    "The flow is strong, but the review request should explain where the link is going before I send it. I would also keep reviewer edits in suggestion mode by default so the author can compare the original language against the proposed change.",
  dependencyQuestion:
    "Can the request creator choose the Slack destination at send time instead of relying only on the workspace default?",
};

export const LOOP_DEMO_SUGGESTION = {
  summary: "Clarify request routing and preserve suggestion mode",
  suggestedText: [
    "The product lets a PM press record, see the transcript immediately, publish into a PRD, and send a targeted review request with either a copyable link or a Slack destination picker.",
    "",
    "Reviewer input appears as suggestions by default so the author can compare the original wording against the proposed change before accepting it.",
    "",
    "The artifact stays editable over time, so the PM can return later, record another update, and keep extending the same source of truth instead of starting over.",
  ].join("\n"),
};

export const LOOP_DEMO_ANNOUNCEMENTS = [
  {
    sourceRef: "demo-google-meet-sync",
    title: "Demo meeting capture synced",
    bodyMd:
      "Imported a meeting recap into Loop and attached the transcript draft to the stakeholder alignment artifact for follow-up review.",
    source: "google_meet" as const,
  },
  {
    sourceRef: "demo-slack-launch-note",
    title: "Slack request flow preview",
    bodyMd:
      "Prepared a preview of how review-request links will look when shared into Slack. Destination routing is still mocked for the demo.",
    source: "slack" as const,
  },
  {
    sourceRef: "demo-classroom-style-brief",
    title: "Artifact styling brief added",
    bodyMd:
      "Uploaded a polished report/presentation styling brief so the generated artifact can double as a portfolio-quality deliverable.",
    source: "announcement" as const,
  },
];

export function buildDemoExtraction(text: string) {
  return {
    demoScenarioId: LOOP_DEMO_PRD.scenarioId,
    keywords: extractKeywords(text),
    prdDraft: {
      title: LOOP_DEMO_PRD.title,
      sections: LOOP_DEMO_PRD.sections,
    },
  };
}

export function getDemoPrdDraftFromExtraction(
  extracted: unknown,
): { title: string; sections: DemoPrdSections } | null {
  if (!extracted || typeof extracted !== "object") return null;

  const prdDraft = (extracted as Record<string, unknown>).prdDraft;
  if (!prdDraft || typeof prdDraft !== "object") return null;

  const title = (prdDraft as Record<string, unknown>).title;
  const sections = (prdDraft as Record<string, unknown>).sections;
  if (typeof title !== "string" || !title.trim()) return null;
  if (!sections || typeof sections !== "object") return null;

  const parsed = sections as Record<string, unknown>;
  const requiredKeys: Array<keyof DemoPrdSections> = [
    "context",
    "problem",
    "targetUsers",
    "proposedSolution",
    "nonGoals",
    "successMetrics",
    "risks",
    "assumptions",
    "openQuestions",
    "dependencies",
    "rolloutNotes",
  ];

  for (const key of requiredKeys) {
    if (typeof parsed[key] !== "string") return null;
  }

  return {
    title: title.trim(),
    sections: {
      context: parsed.context as string,
      problem: parsed.problem as string,
      targetUsers: parsed.targetUsers as string,
      proposedSolution: parsed.proposedSolution as string,
      nonGoals: parsed.nonGoals as string,
      successMetrics: parsed.successMetrics as string,
      risks: parsed.risks as string,
      assumptions: parsed.assumptions as string,
      openQuestions: parsed.openQuestions as string,
      dependencies: parsed.dependencies as string,
      rolloutNotes: parsed.rolloutNotes as string,
    },
  };
}

function extractKeywords(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const stop = new Set(["the", "a", "an", "and", "or", "to", "of", "in", "for", "on", "we", "i", "it"]);
  const freq = new Map<string, number>();
  for (const word of cleaned) {
    if (word.length < 3 || stop.has(word)) continue;
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}
