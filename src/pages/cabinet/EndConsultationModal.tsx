import Icon from "@/components/ui/icon";

interface EndConsultationModalProps {
  clientName: string;
  clientBalance: number;
  messageCount: number;
  fileCount: number;
  durationMin: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function EndConsultationModal({
  clientName, clientBalance, messageCount, fileCount, durationMin,
  onConfirm, onCancel, loading,
}: EndConsultationModalProps) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
        style={{ animation: "lc-in .25s ease" }}>

        {/* Шапка */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)" }}>
            <span className="text-2xl">🛑</span>
          </div>
          <p className="text-base font-bold text-navy-900">Завершить консультацию?</p>
          <p className="text-xs text-slate-500 mt-1">Это действие необратимо</p>
        </div>

        {/* Детали */}
        <div className="px-5 py-4 space-y-3">
          {/* Клиент */}
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-[11px] text-slate-500 font-medium">Клиент</span>
            <span className="text-[12px] font-bold text-navy-800">{clientName}</span>
          </div>

          {/* Баланс */}
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-[11px] text-slate-500 font-medium">Баланс консультаций</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-bold text-navy-800">{clientBalance}</span>
              <Icon name="ArrowRight" size={11} className="text-slate-400" />
              <span className="text-[12px] font-bold text-red-600">{Math.max(0, clientBalance - 1)}</span>
            </div>
          </div>

          {/* Статистика */}
          <div className="grid grid-cols-3 gap-2 py-1">
            {[
              { label: "Минут", value: durationMin, icon: "Clock" },
              { label: "Сообщений", value: messageCount, icon: "MessageSquare" },
              { label: "Файлов", value: fileCount, icon: "Paperclip" },
            ].map(s => (
              <div key={s.label} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-50">
                <Icon name={s.icon} size={13} className="text-slate-400" />
                <span className="text-sm font-bold text-navy-800">{s.value}</span>
                <span className="text-[9px] text-slate-400 font-medium">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Предупреждение */}
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50">
            <Icon name="AlertTriangle" size={13} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 leading-relaxed">
              История сохранится в архиве. Клиент получит уведомление о завершении.
            </p>
          </div>
        </div>

        {/* Кнопки */}
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Отмена
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)", boxShadow: "0 4px 14px rgba(220,38,38,.3)" }}>
            {loading
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><span>🛑</span> Да, завершить</>}
          </button>
        </div>
      </div>
    </div>
  );
}
