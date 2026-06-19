import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { LawyerDialog } from "@/lib/auth";

const DARK = {
  bg:      "#0f172a",
  surface: "#1e293b",
  s2:      "#162032",
  s3:      "#0d1526",
  border:  "rgba(255,255,255,.07)",
  accent:  "#06b6f7",
  text:    "#e2e8f0",
  sub:     "#64748b",
};

const CSS = `
@keyframes el-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes el-pulse{0%,100%{box-shadow:0 0 0 0 rgba(6,182,247,.35)}70%{box-shadow:0 0 0 6px rgba(6,182,247,0)}}
.el-row:hover{background:rgba(6,182,247,.04)!important}
.el-row:active{background:rgba(6,182,247,.08)!important}
.el-filter.active{background:linear-gradient(135deg,#06b6f7,#0284c7)!important;color:#fff!important;border-color:transparent!important;box-shadow:0 4px 12px rgba(6,182,247,.3)!important}
`;

type Filter = "all" | "new" | "active" | "closed";

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин`;
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

function planBadge(plan?: string | null) {
  if (plan === "starter") return { text: "Старт", color: "#3b82f6", bg: "rgba(59,130,246,.12)" };
  if (plan === "pro")     return { text: "Профи", color: "#8b5cf6", bg: "rgba(139,92,246,.12)" };
  if (plan === "max")     return { text: "Макс",  color: "#f59e0b", bg: "rgba(245,158,11,.12)" };
  return { text: "Free", color: DARK.sub, bg: "rgba(100,116,139,.1)" };
}

interface Props {
  dialogs: LawyerDialog[];
  loading: boolean;
  showArchive: boolean;
  onToggleArchive: () => void;
  onSelect: (userId: number) => void;
  onRefresh: () => void;
}

export default function ExpertDialogList({ dialogs, loading, showArchive, onToggleArchive, onSelect, onRefresh }: Props) {
  const [filter, setFilter]   = useState<Filter>("all");
  const [search, setSearch]   = useState("");
  const [activeTab, setActiveTab] = useState<"chats" | "stats">("chats");

  /* Статистика */
  const total   = dialogs.length;
  const newMsgs = dialogs.filter(d => (d.unread ?? 0) > 0).length;
  const active  = dialogs.filter(d => !d.is_closed).length;
  const closed  = dialogs.filter(d => d.is_closed).length;

  /* Фильтрация */
  const filtered = dialogs.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !q || (d.name || "").toLowerCase().includes(q) || (d.email || "").toLowerCase().includes(q);
    const matchFilter =
      filter === "all"    ? true
      : filter === "new"    ? (d.unread ?? 0) > 0
      : filter === "active" ? !d.is_closed
      : d.is_closed;
    return matchSearch && matchFilter;
  });

  const stats = [
    { label: "Всего",     value: total,   icon: "Users",        color: DARK.accent },
    { label: "Новых",     value: newMsgs, icon: "Bell",         color: "#ef4444" },
    { label: "Активных",  value: active,  icon: "MessageSquare",color: "#22c55e" },
    { label: "Закрыто",   value: closed,  icon: "Archive",      color: DARK.sub },
  ];

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all",    label: "Все",       count: total },
    { id: "new",    label: "Новые",     count: newMsgs },
    { id: "active", label: "В работе",  count: active },
    { id: "closed", label: "Закрытые",  count: closed },
  ];

  return (
    <div style={{
      maxWidth: 720, width: "100%", margin: "0 auto",
      display: "flex", flexDirection: "column", gap: 12,
      animation: "el-in .3s ease",
    }}>
      <style>{CSS}</style>

      {/* ── Шапка ───────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        background: DARK.surface, borderRadius: 20,
        border: `1px solid ${DARK.border}`,
        padding: "14px 18px",
        boxShadow: "4px 4px 16px rgba(0,0,0,.3),-2px -2px 8px rgba(255,255,255,.03)",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, flexShrink: 0,
          background: "linear-gradient(135deg,#0369a1,#0f4c81)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 14px rgba(6,182,247,.25)", animation: "el-pulse 2.5s infinite",
        }}>
          <Icon name="Scale" size={20} style={{ color: "#fff" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: DARK.text, margin: 0 }}>Юридическая панель</p>
          <p style={{ fontSize: 11, color: DARK.sub, margin: 0, marginTop: 2 }}>Управление консультациями</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 12px", borderRadius: 20,
            background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.2)",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e" }}>Онлайн</span>
          </div>
          <button onClick={onRefresh} style={{
            width: 34, height: 34, borderRadius: 10,
            background: DARK.s2, border: `1px solid ${DARK.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}>
            <Icon name="RefreshCw" size={14} style={{ color: DARK.sub }} />
          </button>
        </div>
      </div>

      {/* ── Табы: Чаты / Статистика ──────────────────────────────────── */}
      <div style={{
        display: "flex", gap: 4,
        background: DARK.s3, borderRadius: 14, padding: 4,
        border: `1px solid ${DARK.border}`,
      }}>
        {[
          { id: "chats", label: "💬 Чаты" },
          { id: "stats", label: "📊 Статистика" },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as "chats" | "stats")} style={{
            flex: 1, padding: "8px 0", borderRadius: 10, border: "none",
            background: activeTab === t.id
              ? "linear-gradient(135deg,#06b6f7,#0284c7)"
              : "transparent",
            color: activeTab === t.id ? "#fff" : DARK.sub,
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            boxShadow: activeTab === t.id ? "0 4px 12px rgba(6,182,247,.25)" : "none",
            transition: "all .2s",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Статистика ───────────────────────────────────────────────── */}
      {activeTab === "stats" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, animation: "el-in .2s ease" }}>
          {stats.map(s => (
            <div key={s.label} style={{
              background: DARK.surface, borderRadius: 16,
              border: `1px solid ${DARK.border}`,
              padding: "16px 14px",
              boxShadow: "4px 4px 12px rgba(0,0,0,.25),-1px -1px 4px rgba(255,255,255,.02)",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: `${s.color}15`,
                  border: `1px solid ${s.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon name={s.icon} size={15} style={{ color: s.color }} />
                </div>
                <span style={{ fontSize: 26, fontWeight: 800, color: DARK.text }}>{s.value}</span>
              </div>
              <p style={{ fontSize: 11, color: DARK.sub, margin: 0, fontWeight: 600 }}>{s.label}</p>
            </div>
          ))}
          {/* За сегодня */}
          <div style={{
            gridColumn: "1/-1",
            background: DARK.surface, borderRadius: 16,
            border: "1px solid rgba(6,182,247,.12)",
            padding: "14px 16px",
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: DARK.accent, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: ".06em" }}>Новые сообщения сегодня</p>
            {dialogs.filter(d => (d.unread ?? 0) > 0).length === 0 ? (
              <p style={{ fontSize: 12, color: DARK.sub, margin: 0 }}>Новых сообщений нет</p>
            ) : dialogs.filter(d => (d.unread ?? 0) > 0).slice(0, 4).map(d => (
              <div key={d.user_id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 0",
                borderBottom: "1px solid rgba(255,255,255,.04)",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: "linear-gradient(135deg,#06b6f7,#0284c7)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: "#fff",
                }}>
                  {(d.name?.[0] ?? "?").toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: DARK.text, margin: 0 }}>{d.name || d.email}</p>
                  <p style={{ fontSize: 10, color: DARK.sub, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {d.last_message?.slice(0, 50)}
                  </p>
                </div>
                <span style={{ fontSize: 10, color: DARK.sub, flexShrink: 0 }}>{d.last_at ? fmtTime(d.last_at) : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Список чатов ─────────────────────────────────────────────── */}
      {activeTab === "chats" && (
        <>
          {/* Поиск */}
          <div style={{ position: "relative" }}>
            <Icon name="Search" size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: DARK.sub, pointerEvents: "none" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по имени или email..."
              style={{
                width: "100%", padding: "10px 14px 10px 42px",
                background: DARK.surface, borderRadius: 14,
                border: `1px solid ${DARK.border}`,
                color: DARK.text, fontSize: 13,
                outline: "none", boxSizing: "border-box",
                boxShadow: "4px 4px 12px rgba(0,0,0,.2),-1px -1px 4px rgba(255,255,255,.02)",
                transition: "border-color .2s",
              }}
              onFocus={e => (e.target.style.borderColor = "rgba(6,182,247,.4)")}
              onBlur={e => (e.target.style.borderColor = DARK.border)}
            />
          </div>

          {/* Фильтры */}
          <div style={{ display: "flex", gap: 6 }}>
            {filters.map(f => (
              <button key={f.id}
                className={`el-filter${filter === f.id ? " active" : ""}`}
                onClick={() => setFilter(f.id)}
                style={{
                  flex: 1, padding: "7px 4px", borderRadius: 10,
                  background: DARK.s2, border: `1px solid ${DARK.border}`,
                  color: DARK.sub, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  transition: "all .2s",
                }}>
                {f.label}
                {f.count > 0 && (
                  <span style={{ marginLeft: 4, fontSize: 9, opacity: .7 }}>({f.count})</span>
                )}
              </button>
            ))}
            <button onClick={onToggleArchive} style={{
              padding: "7px 12px", borderRadius: 10,
              background: showArchive ? "rgba(6,182,247,.12)" : DARK.s2,
              border: showArchive ? "1px solid rgba(6,182,247,.3)" : `1px solid ${DARK.border}`,
              color: showArchive ? DARK.accent : DARK.sub,
              fontSize: 11, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5,
              transition: "all .2s",
            }}>
              <Icon name="Archive" size={12} />
              <span className="hidden sm:inline">Архив</span>
            </button>
          </div>

          {/* Список */}
          <div style={{
            background: DARK.surface, borderRadius: 20,
            border: `1px solid ${DARK.border}`,
            overflow: "hidden",
            boxShadow: "4px 4px 16px rgba(0,0,0,.25),-2px -2px 8px rgba(255,255,255,.02)",
          }}>
            {loading ? (
              <div style={{ padding: "48px 0", display: "flex", justifyContent: "center" }}>
                <div style={{ width: 36, height: 36, border: "3px solid rgba(6,182,247,.2)", borderTopColor: DARK.accent, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "56px 0", textAlign: "center" }}>
                <Icon name={showArchive ? "Archive" : "Inbox"} size={36} style={{ color: "rgba(255,255,255,.08)", marginBottom: 12 }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: DARK.sub, margin: 0 }}>
                  {search ? "Ничего не найдено" : showArchive ? "Архив пуст" : "Нет обращений"}
                </p>
              </div>
            ) : (
              filtered.map((d, i) => {
                const pl = planBadge(d.purchased_plan);
                const isNew = (d.unread ?? 0) > 0;
                const initial = (d.name?.[0] ?? d.email?.[0] ?? "?").toUpperCase();

                return (
                  <button key={d.user_id}
                    className="el-row"
                    onClick={() => onSelect(d.user_id)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12,
                      padding: "14px 18px", textAlign: "left",
                      background: "transparent",
                      borderBottom: i < filtered.length - 1 ? `1px solid ${DARK.border}` : "none",
                      border: "none", cursor: "pointer",
                      transition: "background .15s",
                    }}
                  >
                    {/* Аватар */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 14, flexShrink: 0,
                        background: d.is_closed
                          ? "rgba(100,116,139,.15)"
                          : isNew
                            ? "linear-gradient(135deg,#06b6f7,#0284c7)"
                            : "linear-gradient(135deg,#1e3a5f,#2d5282)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 15, fontWeight: 700, color: d.is_closed ? DARK.sub : "#fff",
                        boxShadow: isNew ? "0 4px 12px rgba(6,182,247,.3)" : "0 4px 10px rgba(0,0,0,.3)",
                      }}>
                        {initial}
                      </div>
                      {/* Онлайн / непрочитанные */}
                      {isNew && (
                        <span style={{
                          position: "absolute", top: -5, right: -5,
                          minWidth: 18, height: 18, borderRadius: 9, padding: "0 4px",
                          background: "#ef4444", color: "#fff",
                          fontSize: 10, fontWeight: 700,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          border: `2px solid ${DARK.surface}`,
                        }}>
                          {d.unread}
                        </span>
                      )}
                      {d.is_closed && (
                        <span style={{
                          position: "absolute", bottom: -3, right: -3,
                          width: 16, height: 16, borderRadius: "50%",
                          background: "#22c55e",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          border: `2px solid ${DARK.surface}`,
                        }}>
                          <Icon name="Check" size={8} style={{ color: "#fff" }} />
                        </span>
                      )}
                    </div>

                    {/* Инфо */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                        <span style={{
                          fontSize: 13, fontWeight: isNew ? 700 : 600,
                          color: isNew ? DARK.text : "#94a3b8",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {d.name || d.email}
                        </span>
                        <span style={{ fontSize: 10, color: DARK.sub, flexShrink: 0 }}>
                          {d.last_at ? fmtTime(d.last_at) : ""}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{
                          fontSize: 11, color: isNew ? "#94a3b8" : DARK.sub,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          fontWeight: isNew ? 500 : 400,
                        }}>
                          {d.last_sender === "admin" ? "Вы: " : ""}
                          {d.last_message?.slice(0, 48)}
                        </span>
                        <span style={{
                          flexShrink: 0, fontSize: 9, fontWeight: 600,
                          padding: "2px 7px", borderRadius: 6,
                          background: pl.bg, color: pl.color,
                        }}>
                          {pl.text}
                        </span>
                      </div>
                    </div>

                    <Icon name="ChevronRight" size={14} style={{ color: "rgba(255,255,255,.12)", flexShrink: 0 }} />
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
