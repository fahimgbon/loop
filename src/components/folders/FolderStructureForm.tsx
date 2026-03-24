"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";
import { Textarea } from "@/src/components/Textarea";
import { FolderCard } from "@/src/components/folders/FolderCard";
import { AgentDock } from "@/src/components/guide/AgentDock";

type EditableBlock = {
  key: string;
  type: string;
  title: string;
  contentMd: string;
};

type BlockTypeOption = {
  type: string;
  label: string;
  icon: string;
  hint: string;
  defaultTitle: string;
};

const BLOCK_TYPES: BlockTypeOption[] = [
  { type: "text", label: "Narrative", icon: "TXT", hint: "Context or explanation", defaultTitle: "Context" },
  { type: "decision", label: "Decision", icon: "DEC", hint: "Outcome + rationale", defaultTitle: "Decision" },
  { type: "question", label: "Question", icon: "Q", hint: "Pointed unknown", defaultTitle: "Open question" },
  { type: "risk", label: "Risk", icon: "RSK", hint: "What could go wrong", defaultTitle: "Risks" },
  { type: "assumption", label: "Assumption", icon: "ASM", hint: "Belief to validate", defaultTitle: "Assumptions" },
  { type: "metric", label: "Metric", icon: "MET", hint: "Measure of success", defaultTitle: "Success metrics" },
  { type: "option", label: "Option", icon: "OPT", hint: "Alternative to compare", defaultTitle: "Options" },
  { type: "table", label: "Table", icon: "TBL", hint: "Structured data", defaultTitle: "Table" },
];

function getBlockType(type: string) {
  return BLOCK_TYPES.find((t) => t.type === type) ?? BLOCK_TYPES[0];
}

function createBlock(type: string, index: number): EditableBlock {
  const meta = getBlockType(type);
  return {
    key: `${type}-${index}`,
    type,
    title: meta.defaultTitle,
    contentMd: "",
  };
}

export function FolderStructureForm(props: {
  workspaceSlug: string;
  mode: "create" | "edit";
  folderId?: string;
  initialName?: string;
  initialBlocks?: EditableBlock[];
  templates: Array<{ slug: string; name: string; group: string }>;
}) {
  const router = useRouter();
  const [name, setName] = useState(props.initialName ?? "");
  const [nameTouched, setNameTouched] = useState(false);
  const [structureMode, setStructureMode] = useState<"template" | "custom">(
    props.initialBlocks?.length ? "custom" : "template",
  );
  const [templateSlug, setTemplateSlug] = useState(props.templates[0]?.slug ?? "prd");
  const [blocks, setBlocks] = useState<EditableBlock[]>(
    props.initialBlocks?.length
      ? props.initialBlocks
      : [
          createBlock("text", 1),
          createBlock("question", 2),
        ],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [seedDoc, setSeedDoc] = useState("");
  const [inferBusy, setInferBusy] = useState(false);

  const groupedTemplates = useMemo(() => {
    const grouped = new Map<string, Array<{ slug: string; name: string }>>();
    for (const template of props.templates) {
      const list = grouped.get(template.group) ?? [];
      list.push({ slug: template.slug, name: template.name });
      grouped.set(template.group, list);
    }
    return Array.from(grouped.entries());
  }, [props.templates]);

  const templateBySlug = useMemo(() => {
    return new Map(props.templates.map((template) => [template.slug, template]));
  }, [props.templates]);
  const recommendedTemplateSlug = props.templates[0]?.slug ?? null;

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload =
        structureMode === "template"
          ? { name, templateSlug }
          : {
              name,
              blocks: blocks.map((block, index) => ({
                key: normalizeKey(block.key || block.title || `${block.type}-${index + 1}`),
                type: block.type,
                title: block.title || null,
                contentMd: block.contentMd,
              })),
            };

      const endpoint =
        props.mode === "create"
          ? `/api/workspaces/${props.workspaceSlug}/folders`
          : `/api/workspaces/${props.workspaceSlug}/folders/${props.folderId}`;
      const method = props.mode === "create" ? "POST" : "PATCH";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; folderId?: string; needsSyncCount?: number; error?: string }
        | null;
      if (!res.ok || (!data?.ok && props.mode === "edit")) {
        setError(data?.error ?? "Save failed");
        return;
      }
      if (props.mode === "create") {
        const folderId = data?.folderId;
        if (!folderId) {
          setError("Folder created but ID missing");
          return;
        }
        router.push(`/w/${props.workspaceSlug}/folders/${folderId}`);
        return;
      }
      setNotice(
        typeof data?.needsSyncCount === "number"
          ? `Saved. ${data.needsSyncCount} existing artifact(s) in this folder may need sync.`
          : "Saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  function selectStructureMode(mode: "template" | "custom") {
    setStructureMode(mode);
    if (mode === "template") {
      const selected = templateBySlug.get(templateSlug) ?? props.templates[0];
      if (selected && (!nameTouched || !name.trim())) {
        setName(selected.name);
      }
    }
  }

  function selectTemplate(slug: string) {
    const template = templateBySlug.get(slug);
    setTemplateSlug(slug);
    if (template && (!nameTouched || !name.trim())) {
      setName(template.name);
    }
  }

  function updateBlock(index: number, patch: Partial<EditableBlock>) {
    setBlocks((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addBlock(type: string) {
    setBlocks((current) => [...current, createBlock(type, current.length + 1)]);
  }

  async function inferBlocksFromSeed() {
    if (!seedDoc.trim()) return;
    setInferBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/workspaces/${props.workspaceSlug}/imports/infer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: name.trim() || undefined,
          documentMd: seedDoc,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            inferred?: {
              suggestedTitle: string;
              blocks: Array<{ key: string; type: string; title: string }>;
            };
            error?: string;
          }
        | null;
      if (!res.ok || !data?.ok || !data.inferred) {
        setError(data?.error ?? "Could not infer structure");
        return;
      }

      const inferredBlocks = data.inferred.blocks.slice(0, 16).map((block, index) => ({
        key: block.key || `${block.type}-${index + 1}`,
        type: block.type,
        title: block.title || getBlockType(block.type).defaultTitle,
        contentMd: "",
      }));
      if (inferredBlocks.length > 0) setBlocks(inferredBlocks);
      if ((!nameTouched || !name.trim()) && data.inferred.suggestedTitle) {
        setName(data.inferred.suggestedTitle);
      }
      setNotice(`Inferred ${inferredBlocks.length} block(s) from imported notes.`);
    } finally {
      setInferBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Folder name</span>
        <Input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setNameTouched(true);
          }}
          placeholder="e.g., Product discovery"
        />
      </label>

      <div className="rounded-2xl border border-white/70 bg-white/55 p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Structure source</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="folder-card text-left"
            data-selected={structureMode === "template" ? "true" : "false"}
            style={{
              "--folder-accent": "101 149 255",
              "--folder-surface": "232 239 255",
              "--folder-edge": "191 219 254",
              "--folder-ink": "30 64 175",
            } as CSSProperties}
            onClick={() => selectStructureMode("template")}
          >
            <div className="flex items-start gap-3">
              <div className="folder-icon">TPL</div>
              <div className="folder-meta">
                <div className="text-sm font-semibold text-slate-900">Template</div>
                <div className="text-xs text-muted">Start from a proven structure</div>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-muted">Best for fast setup with minimal changes.</div>
          </button>
          <button
            type="button"
            className="folder-card text-left"
            data-selected={structureMode === "custom" ? "true" : "false"}
            style={{
              "--folder-accent": "141 150 255",
              "--folder-surface": "240 236 255",
              "--folder-edge": "221 214 254",
              "--folder-ink": "91 33 182",
            } as CSSProperties}
            onClick={() => selectStructureMode("custom")}
          >
            <div className="flex items-start gap-3">
              <div className="folder-icon">BLK</div>
              <div className="folder-meta">
                <div className="text-sm font-semibold text-slate-900">Custom blocks</div>
                <div className="text-xs text-muted">Define your own schema</div>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-muted">Best when you need custom structure.</div>
          </button>
        </div>

        {structureMode === "template" ? (
          <div className="mt-5 grid gap-4">
            {groupedTemplates.map(([group, templates]) => (
              <div key={group}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">{group}</div>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {templates.map((template) => (
                    <button
                      key={template.slug}
                      type="button"
                      className="text-left"
                      aria-pressed={templateSlug === template.slug}
                      onClick={() => selectTemplate(template.slug)}
                    >
                      {(() => {
                        const isSelected = templateSlug === template.slug;
                        const badge = isSelected
                          ? template.slug === recommendedTemplateSlug
                            ? "Recommended"
                            : "Selected"
                          : null;
                        return (
                          <FolderCard
                            name={template.name}
                            subtitle="Template"
                            selected={isSelected}
                            badge={badge}
                          />
                        );
                      })()}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-white/70 bg-white/60 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
                Infer from existing document
              </div>
              <div className="mt-2 text-xs text-muted">
                Paste notes to auto-generate a custom block structure, then adjust manually.
              </div>
              <div className="mt-3 grid gap-2">
                <Textarea
                  rows={4}
                  value={seedDoc}
                  onChange={(event) => setSeedDoc(event.target.value)}
                  placeholder="Paste markdown/notes from an existing document…"
                />
                <div className="flex items-center justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={inferBlocksFromSeed}
                    disabled={inferBusy || !seedDoc.trim()}
                  >
                    {inferBusy ? "Inferring…" : "Infer blocks"}
                  </Button>
                </div>
              </div>
            </div>

            {blocks.map((block, index) => (
              <div key={index} className="rounded-2xl border border-white/70 bg-white/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="folder-icon">{getBlockType(block.type).icon}</div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-muted">Block {index + 1}</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {block.title || getBlockType(block.type).defaultTitle}
                      </div>
                      <div className="text-xs text-muted">{getBlockType(block.type).hint}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-red-500 hover:underline"
                    onClick={() => setBlocks((current) => current.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-[1.2fr_0.8fr]">
                  <Input
                    value={block.title}
                    onChange={(event) => updateBlock(index, { title: event.target.value })}
                    placeholder="Block title"
                  />
                  <select
                    className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
                    value={block.type}
                    onChange={(event) => {
                      const nextType = event.target.value;
                      const prevDefault = getBlockType(block.type).defaultTitle;
                      const nextDefault = getBlockType(nextType).defaultTitle;
                      const nextTitle = !block.title || block.title === prevDefault ? nextDefault : block.title;
                      updateBlock(index, { type: nextType, title: nextTitle });
                    }}
                  >
                    {BLOCK_TYPES.map((type) => (
                      <option key={type.type} value={type.type}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {showAdvanced ? (
                  <div className="mt-3">
                    <Input
                      value={block.key}
                      onChange={(event) => updateBlock(index, { key: event.target.value })}
                      placeholder="block-key"
                    />
                  </div>
                ) : null}
              </div>
            ))}
            <div
              className={[
                "rounded-2xl border border-dashed border-white/70 bg-white/50 p-4",
                blocks.length < 3 ? "guide-ring" : "",
              ].join(" ")}
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Add block</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {BLOCK_TYPES.map((option) => (
                  <button
                    key={option.type}
                    type="button"
                    className="point-chip"
                    onClick={() => addBlock(option.type)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="mt-3 text-xs text-muted underline decoration-dotted underline-offset-4"
                onClick={() => setShowAdvanced((current) => !current)}
              >
                {showAdvanced ? "Hide advanced fields" : "Show advanced fields"}
              </button>
            </div>
          </div>
        )}
      </div>

      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}
      <div className="flex items-center justify-end">
        <Button type="button" onClick={save} disabled={saving || !name.trim()}>
          {saving ? "Saving…" : props.mode === "create" ? "Create folder" : "Save structure"}
        </Button>
      </div>

      <AgentDock
        title={structureMode === "template" ? "Pick a template" : "Add your blocks"}
        body={
          structureMode === "template"
            ? "Select a starting structure. You can customize later."
            : "Add the blocks you want every artifact to inherit."
        }
        action={structureMode === "template" ? "Choose template" : "Add block"}
      />
    </div>
  );
}

function normalizeKey(value: string) {
  const out = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return out || "block";
}
