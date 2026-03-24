"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/src/components/Button";
import { Markdown } from "@/src/components/Markdown";
import { Textarea } from "@/src/components/Textarea";

export type BlockDto = {
  id: string;
  type: string;
  title: string | null;
  content_md: string;
  position: number;
};

export type BlockSuggestionPreview = {
  originalText: string;
  suggestedText: string;
  applyMode: "replace" | "append";
};

type TableBlockContent = {
  version: 1;
  columns: string[];
  rows: string[][];
};

type SuggestionPreviewState =
  | {
      mode: "replace";
      before: string;
      original: string;
      after: string;
    }
  | {
      mode: "replace_unmatched";
      content: string;
      originalText: string;
    };

export function BlockEditor(props: {
  artifactId: string;
  block: BlockDto;
  autoEdit?: boolean;
  suggestionPreview?: BlockSuggestionPreview | null;
}) {
  const isTableBlock = props.block.type === "table";
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(props.block.content_md);
  const [tableDraft, setTableDraft] = useState<TableBlockContent>(() => parseTableBlockContent(props.block.content_md));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pointMode, setPointMode] = useState<"addition" | "question" | null>(null);
  const [pointText, setPointText] = useState("");

  const lastSavedRef = useRef(props.block.content_md);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const badge = useMemo(() => blockBadge(props.block.type), [props.block.type]);
  const suggestionState = useMemo(
    () => buildSuggestionPreviewState(content, props.suggestionPreview),
    [content, props.suggestionPreview],
  );

  useEffect(() => {
    if (editing) return;
    setContent(props.block.content_md);
    lastSavedRef.current = props.block.content_md;
    if (isTableBlock) {
      setTableDraft(parseTableBlockContent(props.block.content_md));
    }
  }, [props.block.content_md, editing, isTableBlock]);

  useEffect(() => {
    if (!props.autoEdit) return;
    setPointMode(null);
    if (isTableBlock) setTableDraft(parseTableBlockContent(lastSavedRef.current));
    setEditing(true);
  }, [isTableBlock, props.autoEdit]);

  useEffect(() => {
    if (!editing) return;
    const t = window.setTimeout(() => textareaRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [editing]);

  async function persist(next: string, close: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/artifacts/${props.artifactId}/blocks/${props.block.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentMd: next }),
      });
      if (!res.ok) throw new Error("Save failed");
      lastSavedRef.current = next;
      setSavedAt(Date.now());
      setContent(next);
      if (isTableBlock) setTableDraft(parseTableBlockContent(next));
      if (close) setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    await persist(isTableBlock ? serializeTableBlockContent(tableDraft) : content, true);
  }

  async function savePointed(kind: "addition" | "question") {
    if (isTableBlock) return;
    const text = pointText.trim();
    if (!text) return;
    const prefix = kind === "question" ? "- -> Question: " : "- -> Addition: ";
    const base = lastSavedRef.current.trimEnd();
    const next = base.length ? `${base}\n${prefix}${text}` : `${prefix}${text}`;
    await persist(next, false);
    setPointText("");
    setPointMode(null);
  }

  function enterEditMode() {
    setPointMode(null);
    if (isTableBlock) {
      setTableDraft(parseTableBlockContent(content));
    }
    setEditing(true);
  }

  function cancelEditMode() {
    setPointText("");
    setContent(lastSavedRef.current);
    if (isTableBlock) {
      setTableDraft(parseTableBlockContent(lastSavedRef.current));
    }
    setEditing(false);
  }

  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className={badge.className}>
              <span className="text-xs font-semibold">{badge.icon}</span>
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">{badge.label}</span>
            </div>
            {props.block.title ? (
              <div className="truncate text-sm font-semibold text-slate-900">{props.block.title}</div>
            ) : null}
          </div>
          <div className="mt-1 text-[11px] text-muted">
            {saving ? "Saving…" : savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : " "}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button
                variant="secondary"
                type="button"
                onClick={cancelEditMode}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="button" onClick={save} disabled={saving}>
                Save
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              type="button"
              onClick={enterEditMode}
            >
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3">
        {editing ? (
          isTableBlock ? (
            <EditableTableBlock table={tableDraft} onChange={setTableDraft} />
          ) : (
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={7}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void save();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEditMode();
                }
              }}
              onBlur={() => {
                if (content === lastSavedRef.current) {
                  setEditing(false);
                  return;
                }
                void persist(content, true);
              }}
            />
          )
        ) : isTableBlock ? (
          <button
            type="button"
            className="w-full cursor-text rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-left"
            onClick={enterEditMode}
          >
            <ReadOnlyTableBlock table={parseTableBlockContent(content)} />
          </button>
        ) : content.trim().length ? (
          <div
            className="cursor-text rounded-xl border border-white/60 bg-white/60 p-3 backdrop-blur-xl"
            onClick={enterEditMode}
          >
            {suggestionState ? (
              <SuggestionAwareBlockContent state={suggestionState} />
            ) : (
              <Markdown markdown={content} />
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={enterEditMode}
            className="w-full rounded-xl border border-dashed border-white/70 bg-white/50 p-4 text-left text-sm text-muted backdrop-blur-xl hover:bg-white/70"
          >
            Type markdown… <span className="text-slate-500">⌘</span>
            <span className="text-slate-500">⏎</span> to save
          </button>
        )}
      </div>

      {!editing && !isTableBlock ? (
        <div className="mt-3 border-t border-slate-200/70 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={pointMode === "addition" ? "point-chip ring-2 ring-sky-200" : "point-chip"}
              onClick={() => {
                setPointMode("addition");
                setPointText("");
              }}
              disabled={saving}
            >
              + Addition
            </button>
            <button
              type="button"
              className={pointMode === "question" ? "point-chip ring-2 ring-fuchsia-200" : "point-chip"}
              onClick={() => {
                setPointMode("question");
                setPointText("");
              }}
              disabled={saving}
            >
              + Pointed question
            </button>
            {!pointMode ? (
              <div className="text-[11px] text-slate-400">Add focused follow-up without opening a full modal.</div>
            ) : null}
          </div>

          {pointMode ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                value={pointText}
                onChange={(e) => setPointText(e.target.value)}
                placeholder={
                  pointMode === "question"
                    ? "What specific question should collaborators answer?"
                    : "What pointed addition should be captured?"
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setPointMode(null);
                    setPointText("");
                    return;
                  }
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void savePointed(pointMode);
                  }
                }}
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setPointMode(null);
                    setPointText("");
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={() => void savePointed(pointMode)} disabled={saving || !pointText.trim()}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SuggestionAwareBlockContent(props: {
  state: SuggestionPreviewState;
}) {
  return (
    <div className="grid gap-2">
      {props.state.mode === "replace" ? (
        <>
          {props.state.before.trim() ? <Markdown markdown={props.state.before} /> : null}
          <div className="whitespace-pre-wrap text-[15px] leading-7 text-slate-400 line-through decoration-rose-300 decoration-2">
            {props.state.original}
          </div>
          {props.state.after.trim() ? <Markdown markdown={props.state.after} /> : null}
        </>
      ) : (
        <>
          <Markdown markdown={props.state.content} />
          <div className="whitespace-pre-wrap text-[14px] leading-6 text-slate-400 line-through decoration-rose-300 decoration-2">
            {props.state.originalText}
          </div>
        </>
      )}
    </div>
  );
}

function EditableTableBlock(props: {
  table: TableBlockContent;
  onChange: (next: TableBlockContent) => void;
}) {
  const table = normalizeTableBlockContent(props.table);

  function updateColumn(index: number, value: string) {
    const columns = [...table.columns];
    columns[index] = value;
    props.onChange(normalizeTableBlockContent({ ...table, columns }));
  }

  function updateCell(rowIndex: number, columnIndex: number, value: string) {
    const rows = table.rows.map((row) => [...row]);
    rows[rowIndex] ??= Array.from({ length: table.columns.length }, () => "");
    rows[rowIndex][columnIndex] = value;
    props.onChange(normalizeTableBlockContent({ ...table, rows }));
  }

  function addColumn() {
    const nextIndex = table.columns.length + 1;
    props.onChange({
      version: 1,
      columns: [...table.columns, `Column ${nextIndex}`],
      rows: table.rows.map((row) => [...row, ""]),
    });
  }

  function removeColumn(index: number) {
    if (table.columns.length <= 1) return;
    props.onChange({
      version: 1,
      columns: table.columns.filter((_, columnIndex) => columnIndex !== index),
      rows: table.rows.map((row) => row.filter((_, columnIndex) => columnIndex !== index)),
    });
  }

  function addRow() {
    props.onChange({
      version: 1,
      columns: [...table.columns],
      rows: [...table.rows, Array.from({ length: table.columns.length }, () => "")],
    });
  }

  function removeRow(index: number) {
    if (table.rows.length <= 1) return;
    props.onChange({
      version: 1,
      columns: [...table.columns],
      rows: table.rows.filter((_, rowIndex) => rowIndex !== index),
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={addColumn} className="px-3 py-2 text-xs">
          Add column
        </Button>
        <Button type="button" variant="secondary" onClick={addRow} className="px-3 py-2 text-xs">
          Add row
        </Button>
        <div className="text-xs text-slate-500">Edit cells directly, then save the block.</div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr>
              {table.columns.map((column, columnIndex) => (
                <th key={`column-${columnIndex}`} className="min-w-[180px] border-b border-slate-200 px-2 pb-3 text-left align-top">
                  <div className="flex items-start gap-2">
                    <input
                      value={column}
                      onChange={(event) => updateColumn(columnIndex, event.target.value)}
                      aria-label={`Column ${columnIndex + 1} title`}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5"
                    />
                    <button
                      type="button"
                      onClick={() => removeColumn(columnIndex)}
                      aria-label={`Remove column ${columnIndex + 1}`}
                      disabled={table.columns.length <= 1}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ×
                    </button>
                  </div>
                </th>
              ))}
              <th className="w-12 border-b border-slate-200 px-2 pb-3" />
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {table.columns.map((_, columnIndex) => (
                  <td key={`cell-${rowIndex}-${columnIndex}`} className="border-b border-slate-200 px-2 py-3 align-top">
                    <input
                      value={row[columnIndex] ?? ""}
                      onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                      aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5"
                      placeholder="Add value"
                    />
                  </td>
                ))}
                <td className="border-b border-slate-200 px-2 py-3 align-top">
                  <button
                    type="button"
                    onClick={() => removeRow(rowIndex)}
                    aria-label={`Remove row ${rowIndex + 1}`}
                    disabled={table.rows.length <= 1}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReadOnlyTableBlock(props: { table: TableBlockContent }) {
  const table = normalizeTableBlockContent(props.table);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {table.columns.map((column, columnIndex) => (
                <th key={`readonly-column-${columnIndex}`} className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-900">
                  {column || `Column ${columnIndex + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={`readonly-row-${rowIndex}`}>
                {table.columns.map((_, columnIndex) => (
                  <td key={`readonly-cell-${rowIndex}-${columnIndex}`} className="border-b border-slate-100 px-4 py-3 align-top text-slate-700">
                    {row[columnIndex]?.trim() ? row[columnIndex] : <span className="text-slate-300">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function buildSuggestionPreviewState(
  content: string,
  suggestion?: BlockSuggestionPreview | null,
): SuggestionPreviewState | null {
  if (!suggestion) return null;

  const originalText = suggestion.originalText.trim();
  if (suggestion.applyMode === "replace" && originalText) {
    const index = content.indexOf(originalText);
    if (index >= 0) {
      return {
        mode: "replace",
        before: content.slice(0, index),
        original: content.slice(index, index + originalText.length),
        after: content.slice(index + originalText.length),
      };
    }
    return {
      mode: "replace_unmatched",
      content,
      originalText,
    };
  }

  return null;
}

function parseTableBlockContent(content: string): TableBlockContent {
  const normalized = content.trim();
  if (!normalized) {
    return normalizeTableBlockContent({
      version: 1,
      columns: ["Column 1", "Column 2"],
      rows: [["", ""]],
    });
  }

  try {
    const parsed = JSON.parse(normalized) as Partial<TableBlockContent>;
    if (parsed && Array.isArray(parsed.columns) && Array.isArray(parsed.rows)) {
      return normalizeTableBlockContent({
        version: 1,
        columns: parsed.columns.map((value) => (typeof value === "string" ? value : "")),
        rows: parsed.rows.map((row) =>
          Array.isArray(row) ? row.map((value) => (typeof value === "string" ? value : "")) : [],
        ),
      });
    }
  } catch {
    // Fall through to markdown/plain-text parsing.
  }

  const markdownTable = parseMarkdownTable(normalized);
  if (markdownTable) return markdownTable;

  return normalizeTableBlockContent({
    version: 1,
    columns: ["Notes"],
    rows: [[normalized]],
  });
}

function normalizeTableBlockContent(input: TableBlockContent): TableBlockContent {
  const columns = input.columns.length > 0 ? input.columns.map((value) => value || "") : ["Column 1"];
  const rowsSource = input.rows.length > 0 ? input.rows : [Array.from({ length: columns.length }, () => "")];
  const rows = rowsSource.map((row) => {
    const next = Array.from({ length: columns.length }, (_, index) => row[index] ?? "");
    return next;
  });
  return {
    version: 1,
    columns,
    rows,
  };
}

function serializeTableBlockContent(table: TableBlockContent) {
  return JSON.stringify(normalizeTableBlockContent(table));
}

function parseMarkdownTable(content: string): TableBlockContent | null {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return null;
  if (!lines.every((line) => line.includes("|"))) return null;

  const header = splitMarkdownTableLine(lines[0]);
  const separator = splitMarkdownTableLine(lines[1]);
  if (header.length === 0 || header.length !== separator.length) return null;
  const isSeparator = separator.every((cell) => /^:?-{3,}:?$/.test(cell));
  if (!isSeparator) return null;

  const rows = lines.slice(2).map(splitMarkdownTableLine);
  return normalizeTableBlockContent({
    version: 1,
    columns: header,
    rows,
  });
}

function splitMarkdownTableLine(line: string) {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function blockBadge(type: string) {
  const t = type.toLowerCase();
  if (t === "risk") {
    return {
      icon: "⚠︎",
      label: "Risk",
      className:
        "inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700",
    };
  }
  if (t === "question") {
    return {
      icon: "?",
      label: "Question",
      className:
        "inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-fuchsia-700",
    };
  }
  if (t === "decision") {
    return {
      icon: "✓",
      label: "Decision",
      className:
        "inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700",
    };
  }
  if (t === "assumption") {
    return {
      icon: "△",
      label: "Assumption",
      className:
        "inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800",
    };
  }
  if (t === "metric") {
    return {
      icon: "◎",
      label: "Metric",
      className:
        "inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700",
    };
  }
  if (t === "table") {
    return {
      icon: "▦",
      label: "Table",
      className:
        "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700",
    };
  }
  if (t === "option") {
    return {
      icon: "⇄",
      label: "Option",
      className:
        "inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-indigo-700",
    };
  }
  return {
    icon: "Aa",
    label: type || "Text",
    className:
      "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/60 px-3 py-1 text-slate-800 backdrop-blur-xl",
  };
}
