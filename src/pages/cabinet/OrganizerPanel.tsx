import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { getToken } from "@/lib/auth";
import type { User } from "@/lib/auth";
import func2url from "../../../backend/func2url.json";

const BASE_URL = (func2url as Record<string, string>)["organizer-api"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface CaseListItem {
  id: number;
  case_number: string;
  court: string;
  judge?: string | null;
  plaintiff?: string | null;
  defendant?: string | null;
  status: string;
  next_hearing?: string | null;
  hearings_count: number;
  pending_tasks: number;
  docs_total: number;
  docs_ready: number;
}

interface Hearing {
  id: number;
  hear_date: string;
  hear_time?: string | null;
  room?: string | null;
  notes?: string | null;
  result?: string | null;
}

interface Task {
  id: number;
  title: string;
  due_date?: string | null;
  is_completed: boolean;
  reminder?: string | null;
}

interface Document {
  id: number;
  name: string;
  doc_type?: string | null;
  is_prepared: boolean;
  deadline?: string | null;
  notes?: string | null;
}

interface FullCase extends CaseListItem {
  hearings: Hearing[];
  tasks: Task[];
  documents: Document[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

function urgency(dateStr?: string | null): "overdue" | "today" | "soon" | "normal" | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 3) return "soon";
  return "normal";
}

function urgencyClasses(u: ReturnType<typeof urgency>): string {
  if (u === "overdue") return "text-red-600 bg-red-50";
  if (u === "today") return "text-red-600 bg-red-50";
  if (u === "soon") return "text-amber-600 bg-amber-50";
  return "text-slate-500 bg-slate-50";
}

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Auth-Token": getToken(),
  };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  label,
  open,
  onToggle,
  onAdd,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 border-b border-border">
      <button
        onClick={onToggle}
        className="flex-1 flex items-center gap-1 text-left min-w-0"
      >
        <Icon
          name={open ? "ChevronDown" : "ChevronRight"}
          size={12}
          className="text-slate-400 shrink-0"
        />
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide truncate">
          {label}
        </span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-navy-800 hover:bg-slate-200 transition-colors"
        title="Добавить"
      >
        <Icon name="Plus" size={12} />
      </button>
    </div>
  );
}

function InlineForm({
  fields,
  onSubmit,
  onCancel,
  submitLabel = "Добавить",
  loading = false,
}: {
  fields: { name: string; placeholder: string; type?: string; required?: boolean }[];
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
  submitLabel?: string;
  loading?: boolean;
}) {
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, ""]))
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(vals);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-3 my-2 bg-slate-50 border border-border rounded-lg p-2.5 space-y-1.5"
    >
      {fields.map((f) => (
        <input
          key={f.name}
          type={f.type || "text"}
          placeholder={f.placeholder}
          required={f.required}
          value={vals[f.name]}
          onChange={(e) => setVals((v) => ({ ...v, [f.name]: e.target.value }))}
          className="w-full bg-white border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-navy-400 placeholder:text-slate-300"
        />
      ))}
      <div className="flex gap-1.5 pt-0.5">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-1 rounded-md text-[11px] font-semibold text-white bg-navy-800 hover:bg-navy-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-2 py-1 rounded-md text-[11px] text-slate-500 hover:bg-slate-200 transition-colors"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}

// ─── Hearings Section ─────────────────────────────────────────────────────────

function HearingsSection({
  caseId,
  hearings,
  onReload,
}: {
  caseId: number;
  hearings: Hearing[];
  onReload: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAdd = async (vals: Record<string, string>) => {
    if (!vals.hear_date) return;
    setSaving(true);
    try {
      await apiFetch(`/cases/${caseId}/hearings`, {
        method: "POST",
        body: JSON.stringify({
          hear_date: vals.hear_date,
          hear_time: vals.hear_time || undefined,
          room: vals.room || undefined,
        }),
      });
      setAdding(false);
      onReload();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (hid: number) => {
    if (!window.confirm("Удалить заседание?")) return;
    try {
      await apiFetch(`/cases/${caseId}/hearings/${hid}`, { method: "DELETE" });
      onReload();
    } catch {
      /* ignore */
    }
  };

  return (
    <div>
      <SectionHeader
        label={`Заседания (${hearings.length})`}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        onAdd={() => setAdding(true)}
      />
      {open && (
        <div>
          {adding && (
            <InlineForm
              fields={[
                { name: "hear_date", placeholder: "Дата (ГГГГ-ММ-ДД)", type: "date", required: true },
                { name: "hear_time", placeholder: "Время (необяз.)", type: "time" },
                { name: "room", placeholder: "Зал/кабинет (необяз.)" },
              ]}
              onSubmit={handleAdd}
              onCancel={() => setAdding(false)}
              loading={saving}
            />
          )}
          {hearings.length === 0 && !adding && (
            <p className="px-3 py-2 text-[11px] text-slate-400">Нет заседаний</p>
          )}
          {hearings.map((h) => {
            const u = urgency(h.hear_date);
            return (
              <div
                key={h.id}
                className="flex items-start gap-2 px-3 py-1.5 border-b border-border/50 group hover:bg-slate-50/80"
              >
                <span
                  className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 ${urgencyClasses(u)}`}
                >
                  {fmtDate(h.hear_date)}
                  {h.hear_time ? ` ${h.hear_time.slice(0, 5)}` : ""}
                </span>
                <div className="flex-1 min-w-0">
                  {h.room && (
                    <p className="text-[11px] text-slate-500 truncate">Зал: {h.room}</p>
                  )}
                  {h.result && (
                    <p className="text-[11px] text-slate-600 truncate">{h.result}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(h.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500"
                >
                  <Icon name="Trash2" size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tasks Section ────────────────────────────────────────────────────────────

function TasksSection({
  caseId,
  tasks,
  onReload,
}: {
  caseId: number;
  tasks: Task[];
  onReload: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAdd = async (vals: Record<string, string>) => {
    if (!vals.title.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/cases/${caseId}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: vals.title,
          due_date: vals.due_date || undefined,
        }),
      });
      setAdding(false);
      onReload();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (t: Task) => {
    try {
      await apiFetch(`/cases/${caseId}/tasks/${t.id}`, {
        method: "PUT",
        body: JSON.stringify({ title: t.title, is_completed: !t.is_completed }),
      });
      onReload();
    } catch {
      /* ignore */
    }
  };

  const pending = tasks.filter((t) => !t.is_completed);
  const done = tasks.filter((t) => t.is_completed);

  return (
    <div>
      <SectionHeader
        label={`Задачи (${pending.length} активных)`}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        onAdd={() => setAdding(true)}
      />
      {open && (
        <div>
          {adding && (
            <InlineForm
              fields={[
                { name: "title", placeholder: "Название задачи", required: true },
                { name: "due_date", placeholder: "Срок (необяз.)", type: "date" },
              ]}
              onSubmit={handleAdd}
              onCancel={() => setAdding(false)}
              loading={saving}
            />
          )}
          {tasks.length === 0 && !adding && (
            <p className="px-3 py-2 text-[11px] text-slate-400">Нет задач</p>
          )}
          {[...pending, ...done].map((t) => {
            const u = urgency(t.due_date);
            return (
              <div
                key={t.id}
                className="flex items-start gap-2 px-3 py-1.5 border-b border-border/50 group hover:bg-slate-50/80"
              >
                <button
                  onClick={() => handleToggle(t)}
                  className={`shrink-0 w-3.5 h-3.5 mt-0.5 rounded border flex items-center justify-center transition-colors ${
                    t.is_completed
                      ? "bg-emerald-500 border-emerald-500"
                      : "bg-white border-slate-300 hover:border-navy-400"
                  }`}
                >
                  {t.is_completed && <Icon name="Check" size={9} className="text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[12px] leading-snug ${
                      t.is_completed ? "line-through text-slate-400" : "text-slate-700"
                    }`}
                  >
                    {t.title}
                  </p>
                  {t.due_date && !t.is_completed && (
                    <span
                      className={`text-[10px] font-medium px-1 py-0.5 rounded ${urgencyClasses(u)}`}
                    >
                      до {fmtDate(t.due_date)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Documents Section ────────────────────────────────────────────────────────

function DocumentsSection({
  caseId,
  documents,
  onReload,
}: {
  caseId: number;
  documents: Document[];
  onReload: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAdd = async (vals: Record<string, string>) => {
    if (!vals.name.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/cases/${caseId}/documents`, {
        method: "POST",
        body: JSON.stringify({
          name: vals.name,
          doc_type: vals.doc_type || undefined,
          deadline: vals.deadline || undefined,
        }),
      });
      setAdding(false);
      onReload();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePrepared = async (doc: Document) => {
    try {
      await apiFetch(`/cases/${caseId}/documents/${doc.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: doc.name, is_prepared: !doc.is_prepared }),
      });
      onReload();
    } catch {
      /* ignore */
    }
  };

  const ready = documents.filter((d) => d.is_prepared).length;

  return (
    <div>
      <SectionHeader
        label={`Документы (${ready}/${documents.length})`}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        onAdd={() => setAdding(true)}
      />
      {open && (
        <div>
          {adding && (
            <InlineForm
              fields={[
                { name: "name", placeholder: "Название документа", required: true },
                { name: "doc_type", placeholder: "Тип (необяз.)" },
                { name: "deadline", placeholder: "Срок (необяз.)", type: "date" },
              ]}
              onSubmit={handleAdd}
              onCancel={() => setAdding(false)}
              loading={saving}
            />
          )}
          {documents.length === 0 && !adding && (
            <p className="px-3 py-2 text-[11px] text-slate-400">Нет документов</p>
          )}
          {documents.map((doc) => {
            const u = urgency(doc.deadline);
            return (
              <div
                key={doc.id}
                className="flex items-start gap-2 px-3 py-1.5 border-b border-border/50 group hover:bg-slate-50/80"
              >
                <button
                  onClick={() => handleTogglePrepared(doc)}
                  className={`shrink-0 w-3.5 h-3.5 mt-0.5 rounded border flex items-center justify-center transition-colors ${
                    doc.is_prepared
                      ? "bg-emerald-500 border-emerald-500"
                      : "bg-white border-slate-300 hover:border-navy-400"
                  }`}
                >
                  {doc.is_prepared && <Icon name="Check" size={9} className="text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[12px] leading-snug truncate ${
                      doc.is_prepared ? "line-through text-slate-400" : "text-slate-700"
                    }`}
                  >
                    {doc.name}
                  </p>
                  {doc.doc_type && (
                    <p className="text-[10px] text-slate-400 truncate">{doc.doc_type}</p>
                  )}
                  {doc.deadline && !doc.is_prepared && (
                    <span
                      className={`text-[10px] font-medium px-1 py-0.5 rounded ${urgencyClasses(u)}`}
                    >
                      до {fmtDate(doc.deadline)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Case Card (collapsed list item) ─────────────────────────────────────────

function CaseCard({
  c,
  selected,
  onClick,
}: {
  c: CaseListItem;
  selected: boolean;
  onClick: () => void;
}) {
  const u = urgency(c.next_hearing);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors hover:bg-slate-50 ${
        selected ? "bg-blue-50/60 border-l-2 border-l-navy-600" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <span className="text-[12px] font-semibold text-navy-800 leading-snug line-clamp-1 flex-1">
          {c.case_number}
        </span>
        <span
          className={`shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
            c.status === "active"
              ? "bg-emerald-100 text-emerald-700"
              : c.status === "closed"
              ? "bg-slate-100 text-slate-500"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {c.status === "active" ? "Актив." : c.status === "closed" ? "Закрыто" : c.status}
        </span>
      </div>
      <p className="text-[11px] text-slate-500 truncate mb-1.5">{c.court}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {c.next_hearing && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${urgencyClasses(u)}`}>
            <Icon name="Calendar" size={9} className="inline mr-0.5 -mt-px" />
            {fmtDate(c.next_hearing)}
          </span>
        )}
        {c.pending_tasks > 0 && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
            <Icon name="ListTodo" size={9} className="inline mr-0.5 -mt-px" />
            {c.pending_tasks}
          </span>
        )}
        <span className="text-[10px] text-slate-400 ml-auto">
          {c.docs_ready}/{c.docs_total} док.
        </span>
      </div>
    </button>
  );
}

// ─── Add Case Form ────────────────────────────────────────────────────────────

function AddCaseForm({
  onSubmit,
  onCancel,
  loading,
}: {
  onSubmit: (vals: Record<string, string>) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="border-b border-border bg-slate-50/80">
      <p className="px-3 pt-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
        Новое дело
      </p>
      <InlineForm
        fields={[
          { name: "case_number", placeholder: "Номер дела", required: true },
          { name: "court", placeholder: "Суд", required: true },
          { name: "plaintiff", placeholder: "Истец (необяз.)" },
          { name: "defendant", placeholder: "Ответчик (необяз.)" },
          { name: "judge", placeholder: "Судья (необяз.)" },
        ]}
        onSubmit={onSubmit}
        onCancel={onCancel}
        submitLabel="Создать дело"
        loading={loading}
      />
    </div>
  );
}

// ─── Full Case Detail ─────────────────────────────────────────────────────────

function CaseDetail({
  fullCase,
  onReload,
  onDelete,
}: {
  fullCase: FullCase;
  onReload: () => void;
  onDelete: () => void;
}) {
  const handleDelete = () => {
    if (window.confirm(`Удалить дело ${fullCase.case_number}?`)) {
      onDelete();
    }
  };

  return (
    <div className="border-t border-border">
      {/* Case meta */}
      <div className="px-3 py-2 bg-slate-50/60 border-b border-border/50">
        {fullCase.plaintiff && (
          <p className="text-[11px] text-slate-500 truncate">
            <span className="text-slate-400">Истец: </span>
            {fullCase.plaintiff}
          </p>
        )}
        {fullCase.defendant && (
          <p className="text-[11px] text-slate-500 truncate">
            <span className="text-slate-400">Ответчик: </span>
            {fullCase.defendant}
          </p>
        )}
        {fullCase.judge && (
          <p className="text-[11px] text-slate-500 truncate">
            <span className="text-slate-400">Судья: </span>
            {fullCase.judge}
          </p>
        )}
        <button
          onClick={handleDelete}
          className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400 hover:text-red-500 transition-colors"
        >
          <Icon name="Trash2" size={10} />
          Удалить дело
        </button>
      </div>

      <HearingsSection
        caseId={fullCase.id}
        hearings={fullCase.hearings}
        onReload={onReload}
      />
      <TasksSection
        caseId={fullCase.id}
        tasks={fullCase.tasks}
        onReload={onReload}
      />
      <DocumentsSection
        caseId={fullCase.id}
        documents={fullCase.documents}
        onReload={onReload}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface OrganizerPanelProps {
  user: User;
}

export default function OrganizerPanel({ user: _user }: OrganizerPanelProps) {
  const [open, setOpen] = useState(false);
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [fullCase, setFullCase] = useState<FullCase | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingCase, setLoadingCase] = useState(false);
  const [addingCase, setAddingCase] = useState(false);
  const [savingCase, setSavingCase] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCases = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const data = await apiFetch<{ cases: CaseListItem[] }>("/cases");
      setCases(data.cases || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadFullCase = useCallback(async (id: number) => {
    setLoadingCase(true);
    try {
      const data = await apiFetch<FullCase>(`/cases/${id}`);
      setFullCase(data);
    } catch {
      /* ignore */
    } finally {
      setLoadingCase(false);
    }
  }, []);

  // Load on open
  useEffect(() => {
    if (open) {
      loadCases();
    }
  }, [open, loadCases]);

  // Load full case when selection changes
  useEffect(() => {
    if (selectedId !== null) {
      loadFullCase(selectedId);
    } else {
      setFullCase(null);
    }
  }, [selectedId, loadFullCase]);

  const handleSelectCase = (id: number) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const handleAddCase = async (vals: Record<string, string>) => {
    setSavingCase(true);
    try {
      await apiFetch<CaseListItem>("/cases", {
        method: "POST",
        body: JSON.stringify({
          case_number: vals.case_number,
          court: vals.court,
          judge: vals.judge || undefined,
          plaintiff: vals.plaintiff || undefined,
          defendant: vals.defendant || undefined,
          status: "active",
        }),
      });
      setAddingCase(false);
      await loadCases();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSavingCase(false);
    }
  };

  const handleDeleteCase = async () => {
    if (!selectedId) return;
    try {
      await apiFetch(`/cases/${selectedId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "deleted" }),
      });
      setSelectedId(null);
      setFullCase(null);
      await loadCases();
    } catch {
      /* ignore */
    }
  };

  const handleReloadCase = useCallback(async () => {
    if (selectedId !== null) {
      await Promise.all([loadFullCase(selectedId), loadCases()]);
    }
  }, [selectedId, loadFullCase, loadCases]);

  // ── Closed state: show toggle button ───────────────────────────────────────
  if (!open) {
    return (
      <div className="hidden lg:flex shrink-0 items-start pt-4">
        <button
          onClick={() => setOpen(true)}
          className="flex flex-col items-center gap-1 px-1.5 py-2.5 bg-white border border-border rounded-r-xl shadow-sm text-slate-400 hover:text-navy-800 hover:shadow-md transition-all group"
          title="Органайзер дел"
        >
          <Icon name="Scale" size={16} className="group-hover:text-navy-700 transition-colors" />
          <span
            className="text-[9px] font-semibold text-slate-400 group-hover:text-navy-700 transition-colors"
            style={{ writingMode: "vertical-rl", textOrientation: "mixed", letterSpacing: "0.05em" }}
          >
            ДЕЛА
          </span>
          <Icon name="ChevronRight" size={12} className="text-slate-300 group-hover:text-navy-500 transition-colors" />
        </button>
      </div>
    );
  }

  // ── Open panel ─────────────────────────────────────────────────────────────
  return (
    <div className="hidden lg:flex shrink-0 w-72 flex-col bg-white border-r border-border max-h-full overflow-hidden shadow-sm">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-white shrink-0">
        <span className="text-base leading-none">⚖️</span>
        <h2 className="flex-1 text-[13px] font-bold text-navy-800 tracking-tight">Дела</h2>
        <button
          onClick={() => {
            setAddingCase(true);
          }}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-navy-800 hover:bg-slate-100 transition-colors"
          title="Добавить дело"
        >
          <Icon name="Plus" size={14} />
        </button>
        <button
          onClick={() => setOpen(false)}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-navy-800 hover:bg-slate-100 transition-colors"
          title="Свернуть"
        >
          <Icon name="ChevronLeft" size={14} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Add case form */}
        {addingCase && (
          <AddCaseForm
            onSubmit={handleAddCase}
            onCancel={() => setAddingCase(false)}
            loading={savingCase}
          />
        )}

        {/* Error banner */}
        {error && (
          <div className="mx-3 my-2 flex items-center gap-2 px-2.5 py-2 bg-red-50 border border-red-200 rounded-lg">
            <Icon name="AlertCircle" size={12} className="text-red-500 shrink-0" />
            <p className="text-[11px] text-red-600 flex-1">{error}</p>
            <button
              onClick={loadCases}
              className="text-[10px] text-red-500 underline hover:no-underline shrink-0"
            >
              Повтор
            </button>
          </div>
        )}

        {/* Loading */}
        {loadingList && cases.length === 0 && (
          <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
            <Icon name="Loader" size={14} className="animate-spin" />
            <span className="text-[12px]">Загрузка...</span>
          </div>
        )}

        {/* Empty state */}
        {!loadingList && cases.length === 0 && !error && !addingCase && (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <Icon name="FolderOpen" size={18} className="text-slate-400" />
            </div>
            <p className="text-[12px] font-semibold text-slate-600 mb-1">Нет дел</p>
            <p className="text-[11px] text-slate-400 mb-3">
              Добавьте первое дело, чтобы отслеживать заседания, задачи и документы
            </p>
            <button
              onClick={() => setAddingCase(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-navy-800 hover:bg-navy-700 transition-colors"
            >
              <Icon name="Plus" size={12} />
              Добавить дело
            </button>
          </div>
        )}

        {/* Case list */}
        {cases.map((c) => (
          <div key={c.id}>
            <CaseCard
              c={c}
              selected={selectedId === c.id}
              onClick={() => handleSelectCase(c.id)}
            />
            {selectedId === c.id && (
              <div>
                {loadingCase && !fullCase && (
                  <div className="flex items-center justify-center py-4 gap-1.5 text-slate-400 border-b border-border/50">
                    <Icon name="Loader" size={12} className="animate-spin" />
                    <span className="text-[11px]">Загрузка...</span>
                  </div>
                )}
                {fullCase && fullCase.id === selectedId && (
                  <CaseDetail
                    fullCase={fullCase}
                    onReload={handleReloadCase}
                    onDelete={handleDeleteCase}
                  />
                )}
              </div>
            )}
          </div>
        ))}

        {/* Refresh button when list is populated */}
        {cases.length > 0 && (
          <div className="px-3 py-2 flex justify-end">
            <button
              onClick={loadCases}
              disabled={loadingList}
              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40"
            >
              <Icon
                name="RefreshCw"
                size={10}
                className={loadingList ? "animate-spin" : ""}
              />
              Обновить
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
