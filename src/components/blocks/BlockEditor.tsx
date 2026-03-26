"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/src/components/Button";
import { Textarea } from "@/src/components/Textarea";

export type BlockDto = {
  id: string;
  type: string;
  title: string | null;
  content_md: string;
  position: number;
};

type TableBlockContent = {
  version: 1;
  columns: string[];
  rows: string[][];
};

export function BlockEditor(props: {
  artifactId: string;
  block: BlockDto;
  autoEdit?: boolean;
}) {
  const isTableBlock = props.block.type === "table";
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(isTableBlock ? props.block.content_md : toEditorText(props.block.content_md));
  const [tableDraft, setTableDraft] = useState<TableBlockContent>(() => parseTableBlockContent(props.block.content_md));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pointMode, setPointMode] = useState<"addition" | "question" | null>(null);
  const [pointText, setPointText] = useState("");

  const lastSavedRef = useRef(isTableBlock ? props.block.content_md : toEditorText(props.block.content_md));
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const badge = blockBadge(props.block.type);

  useEffect(() => {
    if (editing) return;
    const nextText = isTableBlock ? props.block.content_md : toEditorText(props.block.content_md);
    setContent(nextText);
    lastSavedRef.current = nextText;
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
      const normalized = isTableBlock ? next : normalizeEditorText(next);
      const res = await fetch(`/api/artifacts/${props.artifactId}/blocks/${props.block.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentMd: normalized }),
      });
      if (!res.ok) throw new Error("Save failed");
      lastSavedRef.current = normalized;
      setSavedAt(Date.now());
      setContent(normalized);
      if (isTableBlock) setTableDraft(parseTableBlockContent(normalized));
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
    const prefix = kind === "question" ? "Question: " : "Addition: ";
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
                if ((isTableBlock ? content : normalizeEditorText(content)) === lastSavedRef.current) {
                  setEditing(false);
                  return;
                }
                void persist(content, true);
              }}
              className="min-h-[140px] rounded-2xl border border-slate-200 bg-white px-4 py-4 text-[15px] leading-7 text-slate-900 shadow-[0_12px_32px_-26px_rgba(15,23,42,0.12)]"
            />
          )
        ) : isTableBlock ? (
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.1)]">
            <ReadOnlyTableBlock table={parseTableBlockContent(content)} />
          </div>
        ) : content.trim().length ? (
          <div className="px-1 py-1 text-[15px] leading-7 text-slate-900">
            <DocumentTextView text={content} />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
            Empty block.
          </div>
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
              <th className="w-14 border-b border-slate-200 px-2 pb-3 align-middle">
                <button
                  type="button"
                  onClick={addColumn}
                  aria-label="Add column"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-lg font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  +
                </button>
              </th>
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
            <tr>
              <td colSpan={table.columns.length + 1} className="px-2 pt-3">
                <button
                  type="button"
                  onClick={addRow}
                  aria-label="Add row"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  <span className="text-base leading-none">+</span>
                  <span>Add row</span>
                </button>
              </td>
            </tr>
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

function DocumentTextView(props: { text: string }) {
  const sections = props.text
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);

  if (sections.length === 0) return null;

  return (
    <div className="grid gap-3">
      {sections.map((section, index) => {
        const lines = section.split("\n").map((line) => line.trimEnd());
        const isList = lines.every((line) => /^\s*(?:[-*•]|\d+\.)\s+/.test(line));

        if (isList) {
          return (
            <ul key={index} className="grid gap-2 pl-5 text-[15px] leading-7 text-slate-900">
              {lines.map((line, itemIndex) => (
                <li key={itemIndex}>{line.replace(/^\s*(?:[-*•]|\d+\.)\s+/, "")}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={index} className="whitespace-pre-wrap text-[15px] leading-7 text-slate-900">
            {section}
          </p>
        );
      })}
    </div>
  );
}

function toEditorText(content: string) {
  return normalizeEditorText(
    content
      .replace(/\r\n/g, "\n")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^>\s?/gm, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/__(.*?)__/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/_(.*?)_/g, "$1")
      .replace(/~~(.*?)~~/g, "$1")
      .replace(/`([^`]*)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^\s*[-*+]\s+/gm, "• ")
      .replace(/^\s*#### Accepted suggestion\s*$/gim, "")
      .trim(),
  );
}

function normalizeEditorText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
