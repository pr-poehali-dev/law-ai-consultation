import Icon from "@/components/ui/icon";
import type { DocRecommendationItem } from "@/pages/cabinet/DocsTab";
import { downloadDoc } from "@/lib/docUtils";

interface ViewDocFooterProps {
  docName: string;
  currentDocContent: string;
  sentToLawyer: boolean;
  sendingToLawyer: boolean;
  recsAnalyzing: boolean;
  hasRecs: boolean;
  liveRecs: DocRecommendationItem[];
  showRecs: boolean;
  reportOpen: boolean;
  reportText: string;
  reportLoading: boolean;
  reportSent: boolean;
  onSendToLawyer: () => void;
  onAiEditorClick: () => void;
  onToggleRecs: () => void;
  onClose: () => void;
  onOpenReport: () => void;
  onCloseReport: () => void;
  onReportTextChange: (v: string) => void;
  onSendReport: () => void;
}

export default function ViewDocFooter({
  docName,
  currentDocContent,
  sentToLawyer,
  sendingToLawyer,
  recsAnalyzing,
  hasRecs,
  liveRecs,
  showRecs,
  reportOpen,
  reportText,
  reportLoading,
  reportSent,
  onSendToLawyer,
  onAiEditorClick,
  onToggleRecs,
  onClose,
  onOpenReport,
  onCloseReport,
  onReportTextChange,
  onSendReport,
}: ViewDocFooterProps) {
  return (
    <>
      {/* Нижняя панель */}
      <div className="border-t border-slate-100 px-4 sm:px-5 py-3 shrink-0 bg-slate-50/80 rounded-b-3xl space-y-2">
        {sentToLawyer ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-emerald-50 border border-emerald-200">
            <Icon name="CheckCircle" size={14} className="text-emerald-600 shrink-0" />
            <p className="text-xs font-medium text-emerald-700">Отправлен юристу</p>
          </div>
        ) : (
          <button onClick={onSendToLawyer} disabled={sendingToLawyer}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#0a1628,#162d5a)", border: "1px solid rgba(232,168,32,0.3)", color: "#f0c060" }}>
            {sendingToLawyer
              ? <><span className="w-3.5 h-3.5 border-2 border-gold-400/40 border-t-gold-400 rounded-full animate-spin" />Отправляю...</>
              : <><Icon name="UserCheck" size={13} color="#f0c060" />Отправить на проверку юристу</>}
          </button>
        )}

        {/* Кнопка AI-помощника */}
        <button
          onClick={onAiEditorClick}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white transition-all active:scale-95 shadow-sm"
        >
          <Icon name="BrainCircuit" size={13} />
          Редактировать документ с помощью AI
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-[9px] font-bold">Профи+</span>
        </button>
        <p className="text-[10px] text-slate-400 text-center leading-snug">
          Анализ · Перспектива · Судебная практика · Редактирование
        </p>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <button onClick={onOpenReport} className="text-[10px] text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors">
            <Icon name="AlertTriangle" size={10} />Проблема
          </button>
          <div className="flex gap-2 items-center">
            {recsAnalyzing && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] text-slate-400 bg-slate-100">
                <Icon name="Loader" size={10} className="animate-spin" />
                Анализ...
              </div>
            )}
            {hasRecs && !recsAnalyzing && (
              <button
                onClick={onToggleRecs}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors"
              >
                <Icon name="Sparkles" size={11} />
                Рекомендации ({liveRecs.length})
              </button>
            )}
            <button onClick={onClose} className="text-xs text-navy-600 hover:text-navy-800 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-navy-200 hover:bg-white transition-colors font-medium">
              Закрыть
            </button>
            <button onClick={() => downloadDoc(docName, currentDocContent)} className="btn-gold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-semibold">
              <Icon name="Download" size={12} />Скачать
            </button>
          </div>
        </div>
      </div>

      {/* Модалка: Сообщить о проблеме */}
      {reportOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={onCloseReport}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            {reportSent ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icon name="CheckCircle" size={28} className="text-emerald-600" />
                </div>
                <h3 className="font-semibold text-navy-800 text-lg mb-2">Сообщение получено</h3>
                <p className="text-sm text-muted-foreground mb-6">Мы разберёмся и ответим в течение 24 часов.</p>
                <button onClick={onCloseReport} className="btn-gold px-6 py-2.5 rounded-xl text-sm font-medium">Закрыть</button>
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
                  <button onClick={onCloseReport} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors">
                    <Icon name="X" size={16} className="text-muted-foreground" />
                  </button>
                </div>
                <textarea
                  value={reportText}
                  onChange={e => onReportTextChange(e.target.value)}
                  placeholder="Опишите что не так с документом..."
                  rows={4}
                  className="w-full bg-slate-50 border border-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors resize-none mb-4"
                />
                <div className="flex gap-2">
                  <button onClick={onCloseReport} className="flex-1 py-2.5 rounded-xl text-sm text-navy-600 border border-border hover:bg-slate-50 transition-colors">Отмена</button>
                  <button onClick={onSendReport} disabled={!reportText.trim() || reportLoading}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-navy-800 text-white hover:bg-navy-900 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                    {reportLoading ? <Icon name="Loader" size={15} className="animate-spin" /> : <Icon name="Send" size={15} />}
                    {reportLoading ? "Отправка..." : "Отправить"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
