import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { getNewUsers, type AdminUserEntry } from "@/lib/auth";
import { loadSeenIds, saveSeenIds, fmtDt } from "@/pages/cabinet/adminTabUtils";

const USERS_SEEN_KEY = "admin_users_seen_ids";

export default function AdminUsersBlock() {
  const [users, setUsers] = useState<AdminUserEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [seenIds, setSeenIds] = useState<number[]>(() => loadSeenIds(USERS_SEEN_KEY));
  const [cleared, setCleared] = useState(false);

  const load = useCallback(async (currentSeenIds: number[]) => {
    setLoading(true);
    const res = await getNewUsers({ seen_ids: currentSeenIds });
    setUsers(res.users);
    setTotal(res.total);
    setLoading(false);
    setCleared(false);
  }, []);

  useEffect(() => { load(seenIds); }, []);

  const handleClear = () => {
    const newSeen = [...seenIds, ...users.map(u => u.id)];
    saveSeenIds(USERS_SEEN_KEY, newSeen);
    setSeenIds(newSeen);
    setUsers([]);
    setCleared(true);
  };

  const handleRefresh = () => load(seenIds);
  const handleReset = () => {
    saveSeenIds(USERS_SEEN_KEY, []);
    setSeenIds([]);
    load([]);
  };

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
          <Icon name="Users" size={16} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-navy-800 text-sm">Регистрации пользователей</h3>
          <p className="text-[11px] text-muted-foreground">Всего в базе: {total}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={handleRefresh} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors" title="Обновить">
            <Icon name="RefreshCw" size={14} className="text-muted-foreground" />
          </button>
          {seenIds.length > 0 && (
            <button onClick={handleReset} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors" title="Показать всех">
              <Icon name="RotateCcw" size={14} className="text-slate-400" />
            </button>
          )}
          {users.length > 0 && (
            <button onClick={handleClear} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors">
              <Icon name="EyeOff" size={12} />
              Скрыть просмотренных
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
        </div>
      ) : cleared || users.length === 0 ? (
        <div className="text-center py-8">
          <Icon name="CheckCircle2" size={28} className="text-blue-200 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Новых регистраций нет</p>
          {seenIds.length > 0 && (
            <button onClick={handleReset} className="mt-2 text-xs text-navy-500 underline hover:no-underline">
              Показать всех {total} пользователей
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {users.map(u => (
            <div key={u.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
              <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 text-blue-700 font-bold text-xs uppercase">
                {(u.name || u.email)[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-semibold text-navy-800 truncate">{u.name || "—"}</p>
                  {u.is_admin && (
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 rounded-full font-medium">Админ</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                {u.phone && <p className="text-[11px] text-slate-400">{u.phone}</p>}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] text-slate-400">{fmtDt(u.created_at)}</span>
                  {u.paid_questions > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md">{u.paid_questions} вопр.</span>
                  )}
                  {u.paid_docs > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-md">{u.paid_docs} докум.</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
