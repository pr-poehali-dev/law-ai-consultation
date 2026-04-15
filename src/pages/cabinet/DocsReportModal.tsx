import Icon from "@/components/ui/icon";

interface DocsReportModalProps {
  reportText: string;
  reportLoading: boolean;
  reportSent: boolean;
  onChangeText: (v: string) => void;
  onSend: () => void;
  onClose: () => void;
}

export default function DocsReportModal({
  reportText,
  reportLoading,
  reportSent,
  onChangeText,
  onSend,
  onClose,
}: DocsReportModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
        {reportSent ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Icon name="CheckCircle" size={28} className="text-emerald-600" />
            </div>
            <h3 className="font-semibold text-navy-800 text-lg mb-2">Сообщение получено</h3>
            <p className="text-sm text-muted-foreground mb-1">Мы рассмотрим обращение в течение 24 часов.</p>
            <p className="text-sm text-muted-foreground mb-6">Отслеживайте ответ в разделе <span className="font-medium text-navy-700">«Профиль»</span>.</p>
            <button
              onClick={onClose}
              className="btn-gold px-6 py-2.5 rounded-xl text-sm font-medium"
            >
              Закрыть
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                  <Icon name="AlertTriangle" size={17} className="text-red-500" />
                </div>
                <h3 className="font-semibold text-navy-800">Сообщить о проблеме</h3>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors">
                <Icon name="X" size={16} className="text-muted-foreground" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Опишите что не так с документом — мы разберёмся и ответим в течение 24 часов.</p>
            <textarea
              value={reportText}
              onChange={(e) => onChangeText(e.target.value)}
              placeholder="Например: в документе неверно указан тип иска, отсутствует раздел о судебных расходах..."
              rows={4}
              className="w-full bg-slate-50 border border-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors resize-none mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm text-navy-600 border border-border hover:bg-slate-50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={onSend}
                disabled={!reportText.trim() || reportLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-navy-800 text-white hover:bg-navy-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {reportLoading ? <Icon name="Loader" size={15} className="animate-spin" /> : <Icon name="Send" size={15} />}
                {reportLoading ? "Отправка..." : "Отправить"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
