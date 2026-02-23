export type TemplateSchemaV1 = {
  version: 1;
  description?: string;
  allowedBlockTypes: string[];
  defaultBlocks: Array<{
    key?: string;
    type: string;
    title?: string | null;
    contentMd?: string;
    meta?: Record<string, unknown>;
  }>;
};

export const defaultTemplates: Array<{
  slug: string;
  name: string;
  group: string;
  schema: TemplateSchemaV1;
}> = [
  {
    slug: "research-question",
    name: "Research question",
    group: "Research question",
    schema: {
      version: 1,
      description: "Frame, test, and conclude a collaborative research question.",
      allowedBlockTypes: [
        "text",
        "question",
        "assumption",
        "table",
        "metric",
        "risk",
      ],
      defaultBlocks: [
        { key: "rq-question", type: "question", title: "Research question", contentMd: "" },
        { key: "rq-context", type: "text", title: "Context and motivation", contentMd: "" },
        { key: "rq-hypothesis", type: "assumption", title: "Hypothesis", contentMd: "" },
        { key: "rq-method", type: "text", title: "Method / approach", contentMd: "" },
        { key: "rq-data", type: "table", title: "Data and evidence", contentMd: "" },
        { key: "rq-findings", type: "text", title: "Findings", contentMd: "" },
        { key: "rq-risks", type: "risk", title: "Validity risks", contentMd: "" },
        { key: "rq-open", type: "question", title: "Open questions", contentMd: "" },
      ],
    },
  },
  {
    slug: "policy-proposal",
    name: "Policy proposal",
    group: "Policy proposal",
    schema: {
      version: 1,
      description: "Capture policy intent, implications, and rollout readiness.",
      allowedBlockTypes: ["text", "decision", "risk", "assumption", "question", "metric", "table"],
      defaultBlocks: [
        { key: "pp-summary", type: "text", title: "Policy summary", contentMd: "" },
        { key: "pp-problem", type: "text", title: "Problem and intent", contentMd: "" },
        { key: "pp-scope", type: "text", title: "Scope and applicability", contentMd: "" },
        { key: "pp-decision", type: "decision", title: "Proposed policy decision", contentMd: "" },
        { key: "pp-compliance", type: "text", title: "Compliance and legal notes", contentMd: "" },
        { key: "pp-operational", type: "risk", title: "Operational risks", contentMd: "" },
        { key: "pp-enforcement", type: "text", title: "Enforcement and ownership", contentMd: "" },
        { key: "pp-open", type: "question", title: "Open concerns", contentMd: "" },
      ],
    },
  },
  {
    slug: "startup-idea",
    name: "Startup idea",
    group: "Startup idea",
    schema: {
      version: 1,
      description: "Validate opportunity, value proposition, and early go-to-market.",
      allowedBlockTypes: ["text", "decision", "risk", "assumption", "question", "metric", "option", "table"],
      defaultBlocks: [
        { key: "si-problem", type: "text", title: "Problem statement", contentMd: "" },
        { key: "si-customer", type: "text", title: "Customer segment", contentMd: "" },
        { key: "si-value", type: "text", title: "Value proposition", contentMd: "" },
        { key: "si-solution", type: "option", title: "Solution concept", contentMd: "" },
        { key: "si-gtm", type: "text", title: "Go-to-market sketch", contentMd: "" },
        { key: "si-metrics", type: "metric", title: "Early success metrics", contentMd: "" },
        { key: "si-risks", type: "risk", title: "Biggest risks", contentMd: "" },
        { key: "si-asks", type: "question", title: "Questions to validate next", contentMd: "" },
      ],
    },
  },
  {
    slug: "prd",
    name: "Project in an established organization (PRD)",
    group: "Project in an established organization (PRD)",
    schema: {
      version: 1,
      description: "A standardized product requirements structure for established teams.",
      allowedBlockTypes: ["text", "decision", "risk", "assumption", "question", "metric", "option", "table"],
      defaultBlocks: [
        { key: "prd-context", type: "text", title: "Context", contentMd: "" },
        { key: "prd-problem", type: "text", title: "Problem", contentMd: "" },
        { key: "prd-users", type: "text", title: "Target users", contentMd: "" },
        { key: "prd-solution", type: "text", title: "Proposed solution", contentMd: "" },
        { key: "prd-nongoals", type: "text", title: "Non-goals", contentMd: "" },
        { key: "prd-metrics", type: "metric", title: "Success metrics", contentMd: "" },
        { key: "prd-risks", type: "risk", title: "Risks", contentMd: "" },
        { key: "prd-assumptions", type: "assumption", title: "Assumptions", contentMd: "" },
        { key: "prd-open", type: "question", title: "Open questions", contentMd: "" },
        { key: "prd-dependencies", type: "text", title: "Dependencies", contentMd: "" },
        { key: "prd-rollout", type: "text", title: "Rollout notes", contentMd: "" },
      ],
    },
  },
];
