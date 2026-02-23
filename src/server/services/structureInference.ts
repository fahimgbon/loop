import { getAiProvider } from "@/src/server/ai";

type Section = {
  title: string;
  contentMd: string;
};

type InferredType = {
  type: string;
  confidence: number;
  rationale: string;
};

export type InferredBlock = {
  key: string;
  type: string;
  title: string;
  contentMd: string;
  confidence: number;
  rationale: string;
};

export type InferredStructure = {
  suggestedTitle: string;
  suggestedTemplateSlug: string;
  blocks: InferredBlock[];
  schema: {
    version: 1;
    description: string;
    allowedBlockTypes: string[];
    defaultBlocks: Array<{
      key: string;
      type: string;
      title: string;
      contentMd: string;
      meta: Record<string, unknown>;
    }>;
  };
};

export async function inferStructureFromDocument(input: {
  markdown: string;
  explicitTitle?: string | null;
}): Promise<InferredStructure> {
  const text = (input.markdown ?? "").trim();
  const sections = splitSections(text);
  const blocks: InferredBlock[] = [];

  for (const [index, section] of sections.entries()) {
    const inferred = await inferType(section);
    const key = normalizeKey(`${inferred.type}-${section.title || "section"}-${index + 1}`);
    blocks.push({
      key,
      type: inferred.type,
      title: section.title || defaultTitle(inferred.type),
      contentMd: section.contentMd.trim(),
      confidence: inferred.confidence,
      rationale: inferred.rationale,
    });
  }

  const fallbackBlock: InferredBlock = {
    key: "text-context-1",
    type: "text",
    title: "Context",
    contentMd: text,
    confidence: 0.45,
    rationale: "Fallback context block",
  };

  const normalizedBlocks = (blocks.length > 0 ? blocks : [fallbackBlock]).slice(0, 20);
  const allowedBlockTypes = Array.from(new Set(normalizedBlocks.map((block) => block.type)));
  const suggestedTemplateSlug = pickTemplate(normalizedBlocks, input.explicitTitle ?? null, text);
  const suggestedTitle = inferTitle(input.explicitTitle ?? null, sections, text);

  return {
    suggestedTitle,
    suggestedTemplateSlug,
    blocks: normalizedBlocks,
    schema: {
      version: 1,
      description: "Inferred from imported document",
      allowedBlockTypes,
      defaultBlocks: normalizedBlocks.map((block) => ({
        key: block.key,
        type: block.type,
        title: block.title,
        contentMd: block.contentMd,
        meta: {
          inference_confidence: block.confidence,
          inference_rationale: block.rationale,
        },
      })),
    },
  };
}

function splitSections(markdown: string): Section[] {
  if (!markdown.trim()) return [];
  const lines = markdown.split(/\r?\n/);
  const sections: Section[] = [];
  let currentTitle = "";
  let currentBody: string[] = [];

  const flush = () => {
    const content = currentBody.join("\n").trim();
    if (!content && !currentTitle) return;
    sections.push({
      title: currentTitle.trim(),
      contentMd: content,
    });
  };

  for (const line of lines) {
    const heading = line.match(/^#{1,4}\s+(.+)$/);
    if (heading) {
      flush();
      currentTitle = heading[1].trim();
      currentBody = [];
      continue;
    }
    currentBody.push(line);
  }

  flush();
  if (sections.length === 0) {
    sections.push({ title: "Imported notes", contentMd: markdown.trim() });
  }
  return sections;
}

async function inferType(section: Section): Promise<InferredType> {
  const title = section.title.trim().toLowerCase();
  const content = section.contentMd.trim();
  const joined = `${section.title}\n${content}`.trim();
  const ai = getAiProvider();

  const titleType = typeFromTitle(title);
  if (titleType) {
    return {
      type: titleType,
      confidence: 0.88,
      rationale: "Heading keyword match",
    };
  }

  if (!joined) {
    return { type: "text", confidence: 0.4, rationale: "Empty section defaults to text" };
  }

  try {
    const classified = await ai.classifyText({ text: joined });
    if (classified.intent === "risk") {
      return { type: "risk", confidence: classified.confidence ?? 0.62, rationale: "AI intent: risk" };
    }
    if (classified.intent === "assumption") {
      return {
        type: "assumption",
        confidence: classified.confidence ?? 0.62,
        rationale: "AI intent: assumption",
      };
    }
    if (classified.intent === "question") {
      return {
        type: "question",
        confidence: classified.confidence ?? 0.62,
        rationale: "AI intent: question",
      };
    }
    if (classified.intent === "idea") {
      return { type: "option", confidence: classified.confidence ?? 0.62, rationale: "AI intent: idea" };
    }
    if (classified.intent === "feedback") {
      return { type: "text", confidence: classified.confidence ?? 0.58, rationale: "AI intent: feedback" };
    }
  } catch {
    // Fallback heuristics below.
  }

  const lower = joined.toLowerCase();
  if (/\b(metric|kpi|north star|goal|measure|success)\b/.test(lower)) {
    return { type: "metric", confidence: 0.8, rationale: "Metric keyword match" };
  }
  if (/\b(decision|decide|approved|chose|choice)\b/.test(lower)) {
    return { type: "decision", confidence: 0.8, rationale: "Decision keyword match" };
  }
  if (/\b(assume|hypothesis|belief|assumption)\b/.test(lower)) {
    return { type: "assumption", confidence: 0.8, rationale: "Assumption keyword match" };
  }
  if (/\b(risk|concern|compliance|security|privacy)\b/.test(lower)) {
    return { type: "risk", confidence: 0.8, rationale: "Risk keyword match" };
  }
  if (/\b(option|alternative|tradeoff)\b/.test(lower)) {
    return { type: "option", confidence: 0.78, rationale: "Option keyword match" };
  }
  if (/\?/.test(lower)) {
    return { type: "question", confidence: 0.74, rationale: "Question punctuation match" };
  }
  if (/\|.*\|/.test(lower)) {
    return { type: "table", confidence: 0.72, rationale: "Markdown table match" };
  }
  return { type: "text", confidence: 0.56, rationale: "Default narrative section" };
}

function typeFromTitle(title: string): string | null {
  if (!title) return null;
  if (/\b(question|unknown|ask|faq)\b/.test(title)) return "question";
  if (/\b(risk|risky|concern|guardrail)\b/.test(title)) return "risk";
  if (/\b(decision|call|choice)\b/.test(title)) return "decision";
  if (/\b(metric|success|kpi|goal)\b/.test(title)) return "metric";
  if (/\b(assumption|hypothesis)\b/.test(title)) return "assumption";
  if (/\b(option|alternative|path)\b/.test(title)) return "option";
  if (/\b(table|matrix)\b/.test(title)) return "table";
  return null;
}

function defaultTitle(type: string) {
  if (type === "question") return "Open question";
  if (type === "risk") return "Risk";
  if (type === "decision") return "Decision";
  if (type === "metric") return "Success metric";
  if (type === "assumption") return "Assumption";
  if (type === "option") return "Option";
  if (type === "table") return "Table";
  return "Context";
}

function pickTemplate(blocks: InferredBlock[], explicitTitle: string | null, body: string): string {
  const title = (explicitTitle ?? "").toLowerCase();
  const combined = `${title}\n${body}`.toLowerCase();
  if (/\b(policy|compliance|regulation|legal)\b/.test(combined)) return "policy-proposal";
  if (/\b(startup|venture|market|gtm|founder)\b/.test(combined)) return "startup-idea";
  if (/\b(research|hypothesis|study|experiment|paper)\b/.test(combined)) return "research-question";

  const counts = new Map<string, number>();
  for (const block of blocks) {
    counts.set(block.type, (counts.get(block.type) ?? 0) + 1);
  }
  const q = counts.get("question") ?? 0;
  const m = counts.get("metric") ?? 0;
  const r = counts.get("risk") ?? 0;
  if (q >= 2 && m === 0 && r <= 1) return "research-question";
  if (m >= 1 && r >= 1) return "prd";
  return "prd";
}

function inferTitle(explicitTitle: string | null, sections: Section[], markdown: string) {
  const title = (explicitTitle ?? "").trim();
  if (title) return title;
  const firstHeading = sections.find((section) => section.title.trim())?.title.trim();
  if (firstHeading) return firstHeading;
  const firstLine = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return "Imported document";
  if (firstLine.length <= 72) return firstLine.replace(/^#+\s*/, "");
  return `${firstLine.slice(0, 69).trimEnd()}…`;
}

function normalizeKey(value: string) {
  const out = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return out || "block";
}
