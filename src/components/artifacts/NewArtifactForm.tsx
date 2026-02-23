"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";
import { Textarea } from "@/src/components/Textarea";
import { FolderCard } from "@/src/components/folders/FolderCard";
import { AgentDock } from "@/src/components/guide/AgentDock";

type InferResult = {
  suggestedTitle: string;
  suggestedTemplateSlug: string;
  blocks: Array<{ key: string; type: string; title: string; confidence: number; rationale: string }>;
};

export function NewArtifactForm(props: {
  workspaceSlug: string;
  folders: Array<{ id: string; slug: string; name: string; structure_version: number }>;
  templates: Array<{ id: string; slug: string; name: string; group?: string }>;
  artifacts: Array<{ id: string; title: string; status: string; updatedAt: string }>;
  initialFolderId?: string | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState(() => {
    if (props.initialFolderId && props.folders.some((folder) => folder.id === props.initialFolderId)) {
      return props.initialFolderId;
    }
    return props.folders[0]?.id ?? "";
  });
  const [templateSlug, setTemplateSlug] = useState(props.templates[0]?.slug ?? "prd");
  const [structureMode, setStructureMode] = useState<"template" | "custom">("template");
  const [creationMode, setCreationMode] = useState<"scratch" | "import">("scratch");
  const [importTarget, setImportTarget] = useState<"new_artifact" | "extend_artifact">("new_artifact");
  const [importDoc, setImportDoc] = useState("");
  const [extendArtifactId, setExtendArtifactId] = useState(props.artifacts[0]?.id ?? "");
  const [inferBusy, setInferBusy] = useState(false);
  const [inferred, setInferred] = useState<InferResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectionTouched, setSelectionTouched] = useState(false);
  const [templateTouched, setTemplateTouched] = useState(false);

  const needsTitle = creationMode === "scratch";
  const canSubmitScratch = title.trim().length >= 2;
  const canSubmitImport =
    importDoc.trim().length > 0 &&
    (importTarget === "new_artifact" || (importTarget === "extend_artifact" && !!extendArtifactId));

  const inferredTemplateName = useMemo(
    () => props.templates.find((template) => template.slug === inferred?.suggestedTemplateSlug)?.name ?? null,
    [inferred, props.templates],
  );

  async function analyzeImport() {
    if (!importDoc.trim()) return;
    setInferBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${props.workspaceSlug}/imports/infer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          documentMd: importDoc,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; inferred?: InferResult; error?: string }
        | null;
      if (!res.ok || !data?.ok || !data.inferred) {
        setError(data?.error ?? "Could not analyze document");
        return;
      }
      setInferred(data.inferred);
      if (!title.trim()) setTitle(data.inferred.suggestedTitle);
      if (!templateTouched) setTemplateSlug(data.inferred.suggestedTemplateSlug);
    } finally {
      setInferBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (creationMode === "scratch") {
        const res = await fetch(`/api/workspaces/${props.workspaceSlug}/artifacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            folderId: folderId || undefined,
            templateSlug: folderId ? undefined : templateSlug,
          }),
        });
        const data = (await res.json().catch(() => null)) as
          | { ok?: boolean; artifactId?: string; error?: string }
          | null;
        if (!res.ok || !data?.ok || !data.artifactId) {
          setError(data?.error ?? "Create failed");
          return;
        }
        router.push(`/w/${props.workspaceSlug}/artifacts/${data.artifactId}`);
        return;
      }

      const res = await fetch(`/api/workspaces/${props.workspaceSlug}/imports/document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() ? title.trim() : undefined,
          documentMd: importDoc,
          mode: importTarget,
          targetArtifactId: importTarget === "extend_artifact" ? extendArtifactId : undefined,
          structureMode: structureMode,
          folderId: importTarget === "new_artifact" && structureMode === "template" ? folderId || undefined : undefined,
          templateSlug:
            importTarget === "new_artifact" && structureMode === "template" && !folderId
              ? templateSlug
              : undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; artifactId?: string; error?: string }
        | null;
      if (!res.ok || !data?.ok || !data.artifactId) {
        setError(data?.error ?? "Import failed");
        return;
      }
      router.push(`/w/${props.workspaceSlug}/artifacts/${data.artifactId}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/70 bg-white/60 p-2">
        <button
          type="button"
          className={[
            "rounded-xl px-3 py-2 text-sm transition",
            creationMode === "scratch"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-muted hover:bg-white/70",
          ].join(" ")}
          onClick={() => setCreationMode("scratch")}
        >
          Start fresh
        </button>
        <button
          type="button"
          className={[
            "rounded-xl px-3 py-2 text-sm transition",
            creationMode === "import"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-muted hover:bg-white/70",
          ].join(" ")}
          onClick={() => setCreationMode("import")}
        >
          Import existing doc
        </button>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="text-muted">{needsTitle ? "Title" : "Title (optional)"}</span>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., New onboarding flow"
          required={needsTitle}
        />
      </label>

      {creationMode === "scratch" ? (
        <div className="grid gap-2 text-sm">
          <span className="text-muted">Folder structure</span>
          {props.folders.length > 0 ? (
            <div className={["grid gap-3 sm:grid-cols-2", selectionTouched ? "" : "guide-ring"].join(" ")}>
              {props.folders.map((folder, idx) => (
                <button
                  key={folder.id}
                  type="button"
                  className="text-left"
                  onClick={() => {
                    setFolderId(folder.id);
                    setSelectionTouched(true);
                  }}
                  aria-pressed={folderId === folder.id}
                >
                  <FolderCard
                    name={folder.name}
                    subtitle={`Version ${folder.structure_version}`}
                    selected={folderId === folder.id}
                    badge={
                      folderId === folder.id
                        ? idx === 0 && !selectionTouched
                          ? "Recommended"
                          : "Selected"
                        : idx === 0 && !selectionTouched
                          ? "Recommended"
                          : null
                    }
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="grid gap-3">
              <p className="text-xs text-muted">No folders yet. Create one, or use a template for this artifact.</p>
              <div className={["grid gap-3 sm:grid-cols-2", templateTouched ? "" : "guide-ring"].join(" ")}>
                {props.templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className="text-left"
                    onClick={() => {
                      setTemplateSlug(template.slug);
                      setTemplateTouched(true);
                    }}
                    aria-pressed={templateSlug === template.slug}
                  >
                    <FolderCard
                      name={template.name}
                      subtitle="Template"
                      selected={templateSlug === template.slug}
                      badge={
                        templateSlug === template.slug
                          ? !templateTouched && template.id === props.templates[0]?.id
                            ? "Recommended"
                            : "Selected"
                          : !templateTouched && template.id === props.templates[0]?.id
                            ? "Recommended"
                            : null
                      }
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="rounded-2xl border border-white/70 bg-white/65 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Import flow</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className={["folder-card text-left", importTarget === "new_artifact" ? "guide-ring" : ""].join(" ")}
                data-selected={importTarget === "new_artifact" ? "true" : "false"}
                onClick={() => setImportTarget("new_artifact")}
              >
                <div className="text-sm font-semibold text-slate-900">Create new artifact</div>
                <div className="text-xs text-muted">For new ideas from past notes</div>
              </button>
              <button
                type="button"
                className={["folder-card text-left", importTarget === "extend_artifact" ? "guide-ring" : ""].join(" ")}
                data-selected={importTarget === "extend_artifact" ? "true" : "false"}
                onClick={() => setImportTarget("extend_artifact")}
              >
                <div className="text-sm font-semibold text-slate-900">Extend existing artifact</div>
                <div className="text-xs text-muted">Add new signal to an active doc</div>
              </button>
            </div>
          </div>

          {importTarget === "extend_artifact" ? (
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Target artifact</span>
              <select
                className="rounded-md border border-white/70 bg-white/85 px-3 py-2 text-sm outline-none focus:border-accent"
                value={extendArtifactId}
                onChange={(event) => setExtendArtifactId(event.target.value)}
              >
                {props.artifacts.map((artifact) => (
                  <option key={artifact.id} value={artifact.id}>
                    {artifact.title} · {artifact.status}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="grid gap-2 rounded-2xl border border-white/70 bg-white/65 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Structure mode</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className="folder-card text-left"
                  data-selected={structureMode === "template" ? "true" : "false"}
                  onClick={() => setStructureMode("template")}
                >
                  <div className="text-sm font-semibold text-slate-900">Template smart-fill</div>
                  <div className="text-xs text-muted">Map imported notes into a standard schema</div>
                </button>
                <button
                  type="button"
                  className="folder-card text-left"
                  data-selected={structureMode === "custom" ? "true" : "false"}
                  onClick={() => setStructureMode("custom")}
                >
                  <div className="text-sm font-semibold text-slate-900">Custom inferred blocks</div>
                  <div className="text-xs text-muted">Create dynamic blocks from imported structure</div>
                </button>
              </div>
            </div>
          )}

          <label className="grid gap-1 text-sm">
            <span className="text-muted">Paste existing notes / markdown</span>
            <Textarea
              rows={8}
              value={importDoc}
              onChange={(event) => setImportDoc(event.target.value)}
              placeholder="Paste notes, minutes, Google Doc export, or markdown."
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={analyzeImport} disabled={inferBusy || !importDoc.trim()}>
              {inferBusy ? "Analyzing…" : "Analyze structure"}
            </Button>
            {inferredTemplateName ? (
              <span className="rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs text-slate-700">
                Recommended template: {inferredTemplateName}
              </span>
            ) : null}
          </div>

          {inferred ? (
            <div className="rounded-2xl border border-white/70 bg-white/70 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Inferred blocks</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {inferred.blocks.slice(0, 8).map((block) => (
                  <div key={block.key} className="rounded-xl border border-white/70 bg-white/85 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-slate-900">{block.title}</div>
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] text-sky-700">
                        {Math.round(block.confidence * 100)}%
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {block.type} · {block.rationale}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="text-xs text-muted">
        <a className="text-blue-500 hover:underline" href={`/w/${props.workspaceSlug}/folders/new`}>
          Create or edit folder structures
        </a>
      </div>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <div className="flex items-center justify-end">
        <Button
          type="submit"
          disabled={loading || (creationMode === "scratch" ? !canSubmitScratch : !canSubmitImport)}
        >
          {loading
            ? "Processing…"
            : creationMode === "scratch"
              ? "Create"
              : importTarget === "extend_artifact"
                ? "Import into artifact"
                : "Import and create"}
        </Button>
      </div>

      <AgentDock
        title={
          creationMode === "scratch"
            ? props.folders.length > 0
              ? "Choose a folder structure"
              : "Pick a template"
            : importTarget === "extend_artifact"
              ? "Import into existing artifact"
              : "Import and auto-structure"
        }
        body={
          creationMode === "scratch"
            ? props.folders.length > 0
              ? "Artifacts inherit the folder schema. Pick one to keep docs aligned."
              : "No folders yet. Start from a template or create a folder."
            : importTarget === "extend_artifact"
              ? "Paste notes and target an artifact. Loop smart-fills relevant blocks."
              : "Paste notes once. Loop infers block structure and builds the artifact."
        }
        action={creationMode === "scratch" ? "Create artifact" : "Analyze and import"}
      />
    </form>
  );
}
