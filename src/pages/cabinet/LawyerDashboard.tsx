import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { LawyerDialog } from "@/lib/auth";

interface LawyerDashboardProps {
  dialogs: LawyerDialog[];
  onSelectDialog: (userId: number) => void;
}

type Filter = "all" | "new" | "active" | "closed";

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

export default function LawyerDashboard({ dialogs, onSelectDialog }: LawyerDashboardProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  /* Статистика */
  const total = dialogs.length;
  const withNew = dialogs.filter(d => (d.unread ?? 0) > 0).length;
  const active = dialogs.filter(d => !d.is_closed).length;
  const closed = dialogs.filter(d => d.is_closed).length;

  /* Фильтрация */
  const filtered = dialogs.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !q || (d.name || "").toLowerCase().includes(q) || (d.email || "").toLowerCase().includes(q);
    const matchFilter =
      filter === "all" ? true
      : filter === "new" ? (d.unread ?? 0) > 0
      : filter === "active" ? !d.is_closed
      : d.is_closed;
    return matchSearch && matchFilter;
  });

  return (
    <div className="max-w-3xl w-full mx-auto flex flex-col gap-3"
      style={{ minHeight: "clamp(400px, calc(100svh - 200px), 700px)" }}>

      {/* Шапка */}
      <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-sm shrink-0"
        style={{ background: "linear-gradient(135deg,#fff 80%,rgba(15,76,129,.03))" }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow"
          style={{ background: "linear-gradient(135deg,#0f2d5e,#1a4080)" }}>
          <Icon name="Scale" size={17} className="text-[#e8a820]" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-navy-900">Юридическая панель</p>
          <p className="text-[10.5px] text-slate-500">Управление консультациями</p>
        </div>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-[11px] font-bold text-emerald-700">Онлайн</span>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-4 gap-2 shrink-0">
        {[
          { label: "Всего", value: total, icon: "Users", color: "#0f4c81", bg: "rgba(15,76,129,.08)" },
          { label: "Новых", value: withNew, icon: "Bell", color: "#ef4444", bg: "rgba(239,68,68,.08)" },
          { label: "Активных", value: active, icon: "MessageSquare", color: "#059669", bg: "rgba(5,150,105,.08)" },
          { label: "Закрыто", value: closed, icon: "Archive", color: "#64748b", bg: "rgba(100,116,139,.08)" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col items-center gap-1.5 shadow-sm">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: s.bg }}>
              <Icon name={s.icon} size={15} style={{ color: s.color }} />
            </div>
            <span className="text-xl font-bold text-navy-900 leading-none">{s.value}</span>
            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Поиск + фильтры */}
      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
        <div className="relative flex-1">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени или email..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-navy-800 placeholder:text-slate-400 outline-none focus:border-navy-300 focus:shadow-[0_0_0_3px_rgba(15,76,129,.08)] transition-all"
          />
        </div>
        <div className="flex gap-1">
          {(["all","new","active","closed"] as Filter[]).map(f => {
            const labels: Record<Filter, string> = { all: "Все", new: "Новые", active: "В работе", closed: "Закрытые" };
            const counts = { all: total, new: withNew, active, closed };
            return (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${
                  filter === f
                    ? "text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
                style={filter === f ? { background: "linear-gradient(135deg,#0f2d5e,#1a4080)" } : {}}>
                {labels[f]}
                {counts[f] > 0 && (
                  <span className={`ml-1 text-[9px] ${filter === f ? "text-white/70" : "text-slate-400"}`}>
                    {counts[f]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Список чатов */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
        style={{ scrollbarWidth: "none" }}>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-50">
              <Icon name="MessageSquare" size={22} className="text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-400">
              {search ? "Ничего не найдено" : "Нет консультаций"}
            </p>
          </div>
        )}

        {filtered.map((d, i) => {
          const isNew = (d.unread ?? 0) > 0;
          const isClosed = d.is_closed;
          const lastMsg = d.last_message || "";

          return (
            <button key={d.user_id} onClick={() => onSelectDialog(d.user_id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all hover:bg-slate-50 active:bg-slate-100 ${
                i < filtered.length - 1 ? "border-b border-slate-100" : ""
              }`}>

              {/* Аватар */}
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm"
                  style={{
                    background: isClosed
                      ? "linear-gradient(135deg,#e2e8f0,#cbd5e1)"
                      : isNew
                        ? "linear-gradient(135deg,#0f2d5e,#1a4080)"
                        : "linear-gradient(135deg,#1e40af,#2563eb)",
                    color: isClosed ? "#94a3b8" : "#e8a820",
                  }}>
                  {(d.name || "?")[0].toUpperCase()}
                </div>
                {/* Онлайн-индикатор */}
                {!isClosed && (
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                    isNew ? "bg-emerald-400" : "bg-slate-300"
                  }`} />
                )}
              </div>

              {/* Имя + превью */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className={`text-sm truncate ${isNew ? "font-bold text-navy-900" : "font-semibold text-navy-700"}`}>
                    {d.name || `Клиент #${d.user_id}`}
                  </p>
                  {isClosed && (
                    <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-400 uppercase tracking-wide">
                      закрыт
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  {lastMsg ? lastMsg.slice(0, 70) : d.email || "Нет сообщений"}
                </p>
              </div>

              {/* Время + непрочитанные */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                {d.last_at && (
                  <span className="text-[9.5px] text-slate-400 tabular-nums">{fmtTime(d.last_at)}</span>
                )}
                {(d.unread ?? 0) > 0 && (
                  <span className="min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold text-white px-1"
                    style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)" }}>
                    {d.unread}
                  </span>
                )}
                {isClosed && !isNew && (
                  <Icon name="Archive" size={12} className="text-slate-300" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}