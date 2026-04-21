import Icon from "@/components/ui/icon";
import DocPreview from "@/components/DocPreview";
import type { User } from "@/lib/auth";
import { hasActiveSubscription } from "@/lib/auth";
import type { GenDoc } from "@/pages/cabinet/DocsTab";

interface DocsFillingPhaseProps {
  user: User;
  currentDoc: GenDoc;
  fillValues: Record<string, string>;
  onFillChange: (key: string, value: string) => void;
  onApplyFill: () => void;
  onSetPhase: (phase: "form" | "generating" | "filling" | "done") => void;
  onOpenDoc: (doc: GenDoc) => void;
  onDownload: (name: string, content: string) => void;
  onAnalyzeDoc: (doc: GenDoc) => void;
  onOpenReport: () => void;
}

export default function DocsFillingPhase({
  user,
  currentDoc,
  fillValues,
  onFillChange,
  onApplyFill,
  onSetPhase,
  onOpenDoc,
  onDownload,
  onAnalyzeDoc,
  onOpenReport,
}: DocsFillingPhaseProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      {/* Левая колонка — форма реквизитов */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-cormorant font-bold text-xl sm:text-2xl text-navy-800">Заполнить реквизиты</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate max-w-[200px] sm:max-w-none">{currentDoc.name}</p>
          </div>
          <button
            onClick={() => onSetPhase("form")}
            className="text-xs text-muted-foreground hover:text-navy-700 flex items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <Icon name="ArrowLeft" size={13} />Назад
          </button>
        </div>

        {currentDoc.placeholders.length === 0 ? (
          <div className="text-center py-6">
            <Icon name="CheckCircle" size={32} className="text-emerald-500 mx-auto mb-2" />
            <p className="text-sm text-navy-700 font-medium">Все реквизиты уже заполнены</p>
            <p className="text-xs text-muted-foreground mt-1">AI внёс данные из вашего описания в документ</p>
          </div>
        ) : (
          <>
            <div className="bg-blue-50 rounded-2xl px-4 py-3 mb-4 border border-blue-100">
              <p className="text-xs text-blue-700 leading-relaxed">
                AI выделил поля, которые нужно заполнить. Введите данные — документ обновится автоматически.
              </p>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {currentDoc.placeholders.map((key) => (
                <div key={key}>
                  <label className="text-xs font-medium text-navy-700 mb-1 block">
                    {key.replace(/_/g, " ")}
                  </label>
                  <input
                    type="text"
                    value={fillValues[key] || ""}
                    onChange={(e) => onFillChange(key, e.target.value)}
                    placeholder={`Введите ${key.replace(/_/g, " ").toLowerCase()}`}
                    className="w-full bg-slate-50 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-navy-400 transition-colors"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={onApplyFill}
              className="btn-gold w-full py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 mt-5"
            >
              <Icon name="CheckCircle" size={16} />Применить реквизиты
            </button>
          </>
        )}
      </div>

      {/* Правая колонка — предпросмотр (только desktop) */}
      <div className="hidden lg:flex bg-white rounded-3xl border border-border shadow-sm flex-col overflow-hidden" style={{ maxHeight: "calc(100dvh - 180px)", minHeight: "300px" }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <span className="text-sm font-semibold text-navy-800">Предпросмотр</span>
          <div className="flex gap-2">
            <button
              onClick={() => onOpenDoc(currentDoc)}
              className="text-xs text-navy-600 hover:text-navy-800 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Полный экран
            </button>
            <button
              onClick={() => onDownload(currentDoc.name, currentDoc.filled)}
              className="btn-gold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5"
            >
              <Icon name="Download" size={12} />Скачать
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <DocPreview content={currentDoc.filled} fillValues={fillValues} />
        </div>
        <div className="shrink-0 px-5 py-3.5 border-t border-border space-y-2">
          <button
            onClick={() => onAnalyzeDoc(currentDoc)}
            className="w-full py-2.5 rounded-2xl font-medium flex items-center justify-center gap-2 text-sm bg-gradient-to-r from-blue-600 to-navy-700 text-white hover:from-blue-700 hover:to-navy-800 transition-all active:scale-95"
          >
            <Icon name="Bot" size={15} />
            {(user.isAdmin || user.paidQuestions > 0 || hasActiveSubscription(user, "consult"))
              ? "Проанализировать AI-юристом"
              : "Проанализировать AI · 350 ₽"}
          </button>
          <button
            onClick={onOpenReport}
            className="w-full text-xs text-muted-foreground hover:text-red-500 flex items-center justify-center gap-1.5 py-1 transition-colors"
          >
            <Icon name="AlertTriangle" size={12} />
            Сообщить о проблеме с документом
          </button>
        </div>
      </div>

      {/* Мобильная кнопка предпросмотра */}
      <div className="lg:hidden bg-white rounded-3xl border border-border shadow-sm p-5 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
            <Icon name="FileText" size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-navy-800">{currentDoc.name}</p>
            <p className="text-xs text-muted-foreground">Документ готов к просмотру</p>
          </div>
        </div>
        <button
          onClick={() => onOpenDoc(currentDoc)}
          className="btn-gold w-full py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 text-sm"
        >
          <Icon name="Eye" size={15} />Просмотреть документ
        </button>
        <button
          onClick={() => onDownload(currentDoc.name, currentDoc.filled)}
          className="w-full py-3 rounded-2xl font-medium flex items-center justify-center gap-2 text-sm border border-border text-navy-700 hover:bg-slate-50 transition-colors"
        >
          <Icon name="Download" size={15} />Скачать .docx
        </button>
        <button
          onClick={() => onAnalyzeDoc(currentDoc)}
          className="w-full py-3 rounded-2xl font-medium flex items-center justify-center gap-2 text-sm bg-gradient-to-r from-blue-600 to-navy-700 text-white hover:from-blue-700 hover:to-navy-800 transition-all active:scale-95"
        >
          <Icon name="Bot" size={15} />
          {(user.isAdmin || user.paidQuestions > 0 || hasActiveSubscription(user, "consult"))
            ? "Проанализировать AI-юристом"
            : "Проанализировать AI · 350 ₽"}
        </button>
      </div>
    </div>
  );
}