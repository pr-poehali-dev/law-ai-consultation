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
  reminder?: boolean | null;
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

// ─── API ──────────────────────────────────────────────────────────────────────

async function apiFetch<T>(
  action: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": getToken(),
    },
    body: JSON.stringify({ action, ...params }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

type Urgency = "overdue" | "today" | "soon" | "normal" | null;

function urgency(dateStr?: string | null): Urgency {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 3) return "soon";
  return "normal";
}

function urgencyBadgeClasses(u: Urgency): string {
  if (u === "overdue") return "text-red-600 bg-red-50 border border-red-200";
  if (u === "today") return "text-red-600 bg-red-50 border border-red-200";
  if (u === "soon") return "text-amber-600 bg-amber-50 border border-amber-200";
  return "text-slate-500 bg-slate-50 border border-slate-200";
}

function urgencyTextClass(u: Urgency): string {
  if (u === "overdue") return "text-red-600";
  if (u === "today") return "text-red-600";
  if (u === "soon") return "text-amber-600";
  return "text-slate-500";
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

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

// ─── InlineForm ───────────────────────────────────────────────────────────────

interface FieldDef {
  name: string;
  placeholder: string;
  type?: string;
  required?: boolean;
}

function InlineForm({
  fields,
  onSubmit,
  onCancel,
  submitLabel = "Добавить",
  loading = false,
}: {
  fields: FieldDef[];
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
          type={f.type ?? "text"}
          placeholder={f.placeholder}
          required={f.required}
          value={vals[f.name]}
          onChange={(e) =>
            setVals((v) => ({ ...v, [f.name]: e.target.value }))
          }
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

// ─── HearingsSection ──────────────────────────────────────────────────────────

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
      await apiFetch("hearings.create", {
        case_id: caseId,
        hear_date: vals.hear_date,
        hear_time: vals.hear_time || undefined,
        room: vals.room || undefined,
      });
      setAdding(false);
      onReload();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (hearingId: number) => {
    if (!window.confirm("Удалить заседание?")) return;
    try {
      await apiFetch("hearings.delete", { hearing_id: hearingId });
      onReload();
    } catch {
      // ignore
    }
  };

  return (
    <div>
      <SectionHeader
        label={`Заседания (${hearings.length})`}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        onAdd={() => {
          setAdding(true);
          setOpen(true);
        }}
      />
      {open && (
        <div>
          {adding && (
            <InlineForm
              fields={[
                {
                  name: "hear_date",
                  placeholder: "Дата (ГГГГ-ММ-ДД)",
                  type: "date",
                  required: true,
                },
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
                  className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 ${urgencyBadgeClasses(u)}`}
                >
                  {fmtDate(h.hear_date)}
                </span>
                <div className="flex-1 min-w-0">
                  {h.hear_time && (
                    <span className="text-[11px] text-slate-600">{h.hear_time}</span>
                  )}
                  {h.room && (
                    <span className="text-[11px] text-slate-400 ml-1">· {h.room}</span>
                  )}
                  {h.result && (
                    <p className="text-[10px] text-emerald-600 truncate mt-0.5">
                      {h.result}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(h.id)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500"
                  title="Удалить"
                >
                  <Icon name="Trash2" size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── TasksSection ─────────────────────────────────────────────────────────────

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
    if (!vals.title) return;
    setSaving(true);
    try {
      await apiFetch("tasks.create", {
        case_id: caseId,
        title: vals.title,
        due_date: vals.due_date || undefined,
      });
      setAdding(false);
      onReload();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (task: Task) => {
    try {
      await apiFetch("tasks.update", {
        task_id: task.id,
        title: task.title,
        is_completed: !task.is_completed,
        due_date: task.due_date ?? undefined,
        reminder: task.reminder ?? undefined,
      });
      onReload();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (taskId: number) => {
    if (!window.confirm("Удалить задачу?")) return;
    try {
      await apiFetch("tasks.delete", { task_id: taskId });
      onReload();
    } catch {
      // ignore
    }
  };

  return (
    <div>
      <SectionHeader
        label={`Задачи (${tasks.length})`}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        onAdd={() => {
          setAdding(true);
          setOpen(true);
        }}
      />
      {open && (
        <div>
          {adding && (
            <InlineForm
              fields={[
                {
                  name: "title",
                  placeholder: "Название задачи",
                  required: true,
                },
                { name: "due_date", placeholder: "Срок (ГГГГ-ММ-ДД)", type: "date" },
              ]}
              onSubmit={handleAdd}
              onCancel={() => setAdding(false)}
              loading={saving}
            />
          )}
          {tasks.length === 0 && !adding && (
            <p className="px-3 py-2 text-[11px] text-slate-400">Нет задач</p>
          )}
          {tasks.map((t) => {
            const u = urgency(t.due_date);
            return (
              <div
                key={t.id}
                className="flex items-start gap-2 px-3 py-1.5 border-b border-border/50 group hover:bg-slate-50/80"
              >
                <input
                  type="checkbox"
                  checked={t.is_completed}
                  onChange={() => handleToggle(t)}
                  className="mt-0.5 shrink-0 accent-navy-800 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[11px] leading-tight break-words ${
                      t.is_completed
                        ? "line-through text-slate-400"
                        : "text-slate-700"
                    }`}
                  >
                    {t.title}
                  </p>
                  {t.due_date && (
                    <span
                      className={`text-[10px] font-medium ${urgencyTextClass(u)}`}
                    >
                      до {fmtDate(t.due_date)}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500"
                  title="Удалить"
                >
                  <Icon name="Trash2" size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── DocumentsSection ─────────────────────────────────────────────────────────

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
    if (!vals.name) return;
    setSaving(true);
    try {
      await apiFetch("documents.create", {
        case_id: caseId,
        name: vals.name,
        doc_type: vals.doc_type || undefined,
        deadline: vals.deadline || undefined,
      });
      setAdding(false);
      onReload();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleToggleReady = async (doc: Document) => {
    try {
      await apiFetch("documents.update", {
        doc_id: doc.id,
        name: doc.name,
        is_prepared: !doc.is_prepared,
        doc_type: doc.doc_type ?? undefined,
        deadline: doc.deadline ?? undefined,
        notes: doc.notes ?? undefined,
      });
      onReload();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (docId: number) => {
    if (!window.confirm("Удалить документ?")) return;
    try {
      await apiFetch("documents.delete", { doc_id: docId });
      onReload();
    } catch {
      // ignore
    }
  };

  return (
    <div>
      <SectionHeader
        label={`Документы (${documents.length})`}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        onAdd={() => {
          setAdding(true);
          setOpen(true);
        }}
      />
      {open && (
        <div>
          {adding && (
            <InlineForm
              fields={[
                { name: "name", placeholder: "Название документа", required: true },
                { name: "doc_type", placeholder: "Тип (необяз.)" },
                { name: "deadline", placeholder: "Срок (ГГГГ-ММ-ДД)", type: "date" },
              ]}
              onSubmit={handleAdd}
              onCancel={() => setAdding(false)}
              loading={saving}
            />
          )}
          {documents.length === 0 && !adding && (
            <p className="px-3 py-2 text-[11px] text-slate-400">Нет документов</p>
          )}
          {documents.map((d) => {
            const u = urgency(d.deadline);
            return (
              <div
                key={d.id}
                className="flex items-start gap-2 px-3 py-1.5 border-b border-border/50 group hover:bg-slate-50/80"
              >
                <input
                  type="checkbox"
                  checked={d.is_prepared}
                  onChange={() => handleToggleReady(d)}
                  className="mt-0.5 shrink-0 accent-emerald-600 cursor-pointer"
                  title={d.is_prepared ? "Готов" : "Не готов"}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[11px] leading-tight break-words ${
                      d.is_prepared ? "text-slate-400" : "text-slate-700"
                    }`}
                  >
                    {d.name}
                  </p>
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    {d.doc_type && (
                      <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                        {d.doc_type}
                      </span>
                    )}
                    {d.deadline && (
                      <span
                        className={`text-[10px] font-medium ${urgencyTextClass(u)}`}
                      >
                        до {fmtDate(d.deadline)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(d.id)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500"
                  title="Удалить"
                >
                  <Icon name="Trash2" size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── AddCaseForm ──────────────────────────────────────────────────────────────

function AddCaseForm({
  onSaved,
  onCancel,
}: {
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [vals, setVals] = useState({
    case_number: "",
    court: "",
    judge: "",
    plaintiff: "",
    defendant: "",
    status: "active",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof vals) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setVals((v) => ({ ...v, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vals.case_number || !vals.court) return;
    setSaving(true);
    try {
      await apiFetch("cases.create", {
        case_number: vals.case_number,
        court: vals.court,
        judge: vals.judge || undefined,
        plaintiff: vals.plaintiff || undefined,
        defendant: vals.defendant || undefined,
        status: vals.status,
      });
      onSaved();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full bg-white border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-navy-400 placeholder:text-slate-300";

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-3 my-2 bg-slate-50 border border-border rounded-lg p-3 space-y-1.5"
    >
      <p className="text-[11px] font-semibold text-slate-600 mb-2">Новое дело</p>
      <input
        className={inputCls}
        placeholder="Номер дела *"
        required
        value={vals.case_number}
        onChange={set("case_number")}
      />
      <input
        className={inputCls}
        placeholder="Суд *"
        required
        value={vals.court}
        onChange={set("court")}
      />
      <input
        className={inputCls}
        placeholder="Судья (необяз.)"
        value={vals.judge}
        onChange={set("judge")}
      />
      <input
        className={inputCls}
        placeholder="Истец (необяз.)"
        value={vals.plaintiff}
        onChange={set("plaintiff")}
      />
      <input
        className={inputCls}
        placeholder="Ответчик (необяз.)"
        value={vals.defendant}
        onChange={set("defendant")}
      />
      <select
        className={inputCls}
        value={vals.status}
        onChange={set("status")}
      >
        <option value="active">Активное</option>
        <option value="pending">На рассмотрении</option>
        <option value="closed">Закрыто</option>
        <option value="suspended">Приостановлено</option>
      </select>
      <div className="flex gap-1.5 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-1 rounded-md text-[11px] font-semibold text-white bg-navy-800 hover:bg-navy-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "..." : "Создать"}
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

// ─── CaseCard ─────────────────────────────────────────────────────────────────

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
      className={`w-full text-left px-3 py-2.5 border-b border-border/60 transition-colors ${
        selected
          ? "bg-navy-50 border-l-2 border-l-navy-600"
          : "hover:bg-slate-50/80"
      }`}
    >
      <div className="flex items-start justify-between gap-1 min-w-0">
        <span className="text-[12px] font-bold text-slate-800 truncate leading-tight">
          {c.case_number}
        </span>
        {c.pending_tasks > 0 && (
          <span className="shrink-0 text-[9px] font-bold px-1 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
            {c.pending_tasks}
          </span>
        )}
      </div>
      <p className="text-[10px] text-slate-500 truncate mt-0.5">{c.court}</p>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        {c.next_hearing ? (
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${urgencyBadgeClasses(u)}`}
          >
            {fmtDate(c.next_hearing)}
          </span>
        ) : (
          <span className="text-[10px] text-slate-300">нет заседаний</span>
        )}
        {c.docs_total > 0 && (
          <span
            className={`text-[10px] ${
              c.docs_ready === c.docs_total
                ? "text-emerald-600"
                : "text-slate-400"
            }`}
          >
            {c.docs_ready}/{c.docs_total} докум.
          </span>
        )}
      </div>
    </button>
  );
}

// ─── SelectedCaseDetail ───────────────────────────────────────────────────────

function SelectedCaseDetail({
  caseId,
  onClose,
  onDeleteCase,
}: {
  caseId: number;
  onClose: () => void;
  onDeleteCase: () => void;
}) {
  const [data, setData] = useState<FullCase | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<FullCase>("cases.get", { case_id: caseId });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDeleteCase = async () => {
    if (!window.confirm("Удалить дело и все связанные данные?")) return;
    try {
      await apiFetch("cases.delete", { case_id: caseId });
      onDeleteCase();
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Icon name="Loader2" size={16} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-3">
        <p className="text-[11px] text-red-500">{error}</p>
        <button
          onClick={load}
          className="mt-1 text-[11px] text-navy-700 underline"
        >
          Повторить
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="border-t border-border bg-white">
      {/* Case detail header */}
      <div className="flex items-start gap-2 px-3 py-2.5 bg-navy-50 border-b border-border">
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-navy-900 leading-tight truncate">
            {data.case_number}
          </p>
          {data.judge && (
            <p className="text-[10px] text-slate-500 truncate">
              Судья: {data.judge}
            </p>
          )}
          {(data.plaintiff || data.defendant) && (
            <p className="text-[10px] text-slate-400 truncate">
              {[data.plaintiff, data.defendant].filter(Boolean).join(" / ")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleDeleteCase}
            className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Удалить дело"
          >
            <Icon name="Trash2" size={12} />
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors"
            title="Закрыть"
          >
            <Icon name="X" size={12} />
          </button>
        </div>
      </div>

      {/* Sections */}
      <HearingsSection
        caseId={data.id}
        hearings={data.hearings}
        onReload={load}
      />
      <TasksSection
        caseId={data.id}
        tasks={data.tasks}
        onReload={load}
      />
      <DocumentsSection
        caseId={data.id}
        documents={data.documents}
        onReload={load}
      />
    </div>
  );
}

// ─── OrganizerPanel ───────────────────────────────────────────────────────────

export default function OrganizerPanel({ user: _user }: { user: User }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addingCase, setAddingCase] = useState(false);

  const loadCases = useCallback(async () => {
    setLoadingCases(true);
    try {
      const res = await apiFetch<{ cases: CaseListItem[] }>("cases.list");
      setCases(res.cases ?? []);
    } catch {
      // ignore
    } finally {
      setLoadingCases(false);
    }
  }, []);

  useEffect(() => {
    if (panelOpen) {
      loadCases();
    }
  }, [panelOpen, loadCases]);

  const handleSelectCase = (id: number) => {
    setSelectedId((prev) => (prev === id ? null : id));
    setAddingCase(false);
  };

  const handleCaseDeleted = () => {
    setSelectedId(null);
    loadCases();
  };

  const handleCaseSaved = () => {
    setAddingCase(false);
    loadCases();
  };

  // ── Closed state ─────────────────────────────────────────────────────────────
  if (!panelOpen) {
    return (
      <div className="hidden lg:flex shrink-0 items-start pt-3">
        <button
          onClick={() => setPanelOpen(true)}
          className="group flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-l-2xl bg-white/90 border border-r-0 border-slate-200 shadow-md hover:bg-slate-50 hover:shadow-lg transition-all backdrop-blur-sm"
          title="Открыть органайзер дел"
        >
          <Icon name="Scale" size={16} className="text-navy-600 group-hover:text-navy-800 transition-colors" />
          <span
            className="text-[10px] font-bold text-navy-500 tracking-widest group-hover:text-navy-700 transition-colors"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            ДЕЛА
          </span>
          <Icon name="ChevronLeft" size={10} className="text-slate-300" />
        </button>
      </div>
    );
  }

  // ── Open state ────────────────────────────────────────────────────────────────
  return (
    <div className="hidden lg:flex shrink-0 w-72 flex-col min-h-0 bg-white border-l border-slate-200 shadow-[-4px_0_16px_rgba(0,0,0,0.06)]">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-3 py-3 shrink-0"
        style={{ background: "linear-gradient(135deg,rgba(15,76,129,0.04),rgba(26,107,181,0.02))", borderBottom: "1px solid rgba(15,76,129,0.08)" }}>
        <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
          <Icon name="Scale" size={14} color="#fff" />
        </div>
        <span className="text-[13px] font-bold text-navy-900 flex-1">Дела</span>
        <button
          onClick={() => setAddingCase((v) => !v)}
          className="w-7 h-7 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}
          title="Добавить дело"
        >
          <Icon name="Plus" size={13} color="#fff" />
        </button>
        <button
          onClick={() => setPanelOpen(false)}
          className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
          title="Свернуть панель"
        >
          <Icon name="ChevronRight" size={14} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {addingCase && (
          <AddCaseForm onSaved={handleCaseSaved} onCancel={() => setAddingCase(false)} />
        )}

        {loadingCases && (
          <div className="flex items-center justify-center py-8">
            <Icon name="Loader2" size={18} className="animate-spin text-slate-300" />
          </div>
        )}

        {!loadingCases && cases.length === 0 && !addingCase && (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <Icon name="Scale" size={28} className="text-slate-200 mb-2" />
            <p className="text-[12px] text-slate-400">Дел пока нет</p>
            <button
              onClick={() => setAddingCase(true)}
              className="mt-2 text-[11px] text-navy-700 underline hover:text-navy-900"
            >
              Добавить первое дело
            </button>
          </div>
        )}

        {!loadingCases &&
          cases.map((c) => (
            <div key={c.id}>
              <CaseCard
                c={c}
                selected={selectedId === c.id}
                onClick={() => handleSelectCase(c.id)}
              />
              {selectedId === c.id && (
                <SelectedCaseDetail
                  caseId={c.id}
                  onClose={() => setSelectedId(null)}
                  onDeleteCase={handleCaseDeleted}
                />
              )}
            </div>
          ))}
      </div>
    </div>
  );
}