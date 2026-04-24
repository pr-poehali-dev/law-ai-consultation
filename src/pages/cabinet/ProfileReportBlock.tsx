import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { sendReport, getMyReports, type Report } from "@/lib/auth";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function MyReports({ userId, onSeenUpdate }: { userId: number; onSeenUpdate?: (count: number) => void }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyReports().then(({ reports: r, unseen_count }) => {
      setReports(r);
      setLoading(false);
      onSeenUpdate?.(unseen_count);
    });
  }, [userId]);

  if (loading) return <p className="text-xs text-muted-foreground py-2">Загрузка...</p>;
  if (!reports.length) return null;

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold text-navy-700 uppercase tracking-wider">Ваши обращения</p>
      {reports.map(r => (
        <div key={r.id} className={`rounded-2xl border p-3 text-xs space-y-1.5 ${
          r.status === "replied" ? "border-emerald-200 bg-emerald-50/60"
          : r.status === "closed" ? "border-slate-200 bg-slate-50"
          : "border-amber-200 bg-amber-50/60"
        }`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">{fmtDate(r.created_at)}</span>
            <div className="flex items-center gap-1.5">
              {r.status === "replied" && !r.reply_seen && (
                <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-500 text-white animate-pulse">
                  Новый ответ!
                </span>
              )}
              <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${
                r.status === "replied" ? "bg-emerald-100 text-emerald-700"
                : r.status === "closed" ? "bg-slate-100 text-slate-600"
                : "bg-amber-100 text-amber-700"
              }`}>
                {r.status === "new" ? "Ожидает ответа" : r.status === "replied" ? "Получен ответ" : "Закрыто"}
              </span>
            </div>
          </div>
          <p className="text-navy-700 leading-relaxed line-clamp-3">{r.message}</p>
          {r.admin_reply && (
            <div className="mt-2 pl-3 border-l-2 border-emerald-400">
              <p className="text-[10px] font-semibold text-emerald-700 mb-0.5">Ответ юриста:</p>
              <p className="text-navy-700 leading-relaxed">{r.admin_reply}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface ProfileReportBlockProps {
  userId: number;
}

export default function ProfileReportBlock({ userId }: ProfileReportBlockProps) {
  const [reportText, setReportText] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportErr, setReportErr] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [reportKey, setReportKey] = useState(0);
  const [unseenCount, setUnseenCount] = useState(0);

  // При монтировании проверяем непрочитанные ответы
  useEffect(() => {
    getMyReports().then(({ unseen_count }) => {
      setUnseenCount(unseen_count);
      // Автоматически открываем блок если есть новый ответ
      if (unseen_count > 0) setShowReport(true);
    });
  }, [userId]);

  const handleReport = async () => {
    if (!reportText.trim()) return;
    setReportSending(true);
    setReportErr("");
    const result = await sendReport(reportText.trim());
    setReportSending(false);
    if (result.ok) {
      setReportSent(true);
      setReportText("");
      setReportKey(k => k + 1);
      setTimeout(() => { setReportSent(false); setShowReport(false); }, 3000);
    } else {
      setReportErr(result.error || "Ошибка отправки");
    }
  };

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm p-4 sm:p-6">
      <button
        onClick={() => { setShowReport(!showReport); if (!showReport) setUnseenCount(0); }}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
            <Icon name="AlertTriangle" size={15} className="text-orange-500" />
            {unseenCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-emerald-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unseenCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-navy-800">Обращения и поддержка</span>
            {unseenCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                Новый ответ
              </span>
            )}
          </div>
        </div>
        <Icon name={showReport ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground" />
      </button>

      {showReport && (
        <div className="mt-4">
          <textarea
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            placeholder="Опишите проблему подробно — что произошло, при каких действиях, что ожидалось..."
            rows={4}
            className="w-full bg-slate-50 border border-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors resize-none mb-3"
          />
          {reportErr && <p className="text-xs text-red-500 mb-2">{reportErr}</p>}
          {reportSent && <p className="text-xs text-emerald-600 mb-2">✓ Обращение отправлено. Ответ появится здесь.</p>}
          <button
            onClick={handleReport}
            disabled={reportSending || !reportText.trim()}
            className="btn-gold px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {reportSending
              ? <><Icon name="Loader" size={14} className="animate-spin" />Отправка...</>
              : <><Icon name="Send" size={14} />Отправить обращение</>
            }
          </button>
          <MyReports
            key={reportKey}
            userId={userId}
            onSeenUpdate={(count) => setUnseenCount(count)}
          />
        </div>
      )}
    </div>
  );
}
