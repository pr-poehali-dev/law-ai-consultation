import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";
import { hasActiveSubscription } from "@/lib/auth";
import type { GenDoc } from "@/pages/cabinet/DocsTab";

interface DocsDonePhaseProps {
  user: User;
  currentDoc: GenDoc;
  genDocs: GenDoc[];
  onResetForm: () => void;
  onGoToChat: () => void;
  onOpenDoc: (doc: GenDoc) => void;
  onDownload: (name: string, content: string) => void;
  onAnalyzeDoc: (doc: GenDoc) => void;
  onSetCurrentDoc: (doc: GenDoc) => void;
  onSetFillValues: (vals: Record<string, string>) => void;
  onSetPhase: (phase: "form" | "generating" | "filling" | "done") => void;
  onOpenReport: () => void;
}

export default function DocsDonePhase({
  user,
  currentDoc,
  genDocs,
  onResetForm,
  onGoToChat,
  onOpenDoc,
  onDownload,
  onAnalyzeDoc,
  onSetCurrentDoc,
  onSetFillValues,
  onSetPhase,
  onOpenReport,
}: DocsDonePhaseProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Шапка успеха */}
      <div className="bg-emerald-50 rounded-3xl border border-emerald-200 p-5 flex items-center gap-4">
        <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center shrink-0">
          <Icon name="CheckCircle" size={22} className="text-emerald-600" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-navy-800">{currentDoc.name} — готов</div>
          <div className="text-xs text-muted-foreground mt-0.5">Реквизиты заполнены и применены к документу</div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={() => onOpenDoc(currentDoc)}
            className="text-xs text-navy-600 hover:text-navy-800 px-3 py-2 rounded-xl border border-emerald-200 hover:bg-white transition-colors font-medium"
          >
            Открыть
          </button>
          <button
            onClick={() => onDownload(currentDoc.name, currentDoc.filled)}
            className="btn-gold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 font-medium"
          >
            <Icon name="Download" size={13} />Скачать .docx
          </button>
        </div>
      </div>

      {/* Кнопки действий */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={onResetForm}
          className="text-sm text-navy-600 hover:text-navy-800 px-5 py-2.5 rounded-xl border border-border hover:border-navy-300 transition-colors"
        >
          Создать ещё
        </button>
        <button
          onClick={() => onAnalyzeDoc(currentDoc)}
          className="text-sm px-5 py-2.5 rounded-xl flex items-center gap-2 bg-gradient-to-r from-blue-600 to-navy-700 hover:from-blue-700 hover:to-navy-800 text-white transition-all shadow-sm active:scale-95"
        >
          <Icon name="Bot" size={15} />
          {(user.isAdmin || user.paidQuestions > 0 || hasActiveSubscription(user, "consult"))
            ? "Проанализировать AI"
            : "Проанализировать · 290 ₽"}
        </button>
        <button
          onClick={onGoToChat}
          className="btn-gold text-sm px-5 py-2.5 rounded-xl flex items-center gap-2"
        >
          <Icon name="MessageCircle" size={15} />Задать вопрос юристу
        </button>
      </div>

      {/* Сообщить о проблеме */}
      <div className="flex justify-center">
        <button
          onClick={onOpenReport}
          className="text-xs text-muted-foreground hover:text-red-500 flex items-center gap-1.5 transition-colors py-1"
        >
          <Icon name="AlertTriangle" size={12} />
          Сообщить о проблеме с документом
        </button>
      </div>

      {/* Все документы */}
      {genDocs.length > 0 && (
        <div className="bg-white rounded-3xl border border-border shadow-sm p-5">
          <div className="flex items-center gap-1.5 mb-3 text-[11px] text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            Документы хранятся 7 дней — скачайте, чтобы не потерять
          </div>
          <h3 className="font-semibold text-navy-800 text-sm mb-3">Все документы</h3>
          <div className="space-y-2">
            {genDocs.map((doc) => (
              <div key={doc.id} className="py-2.5 border-b border-border/60 last:border-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-navy-800 truncate">{doc.name}</div>
                    <div className="text-xs text-muted-foreground">{doc.date}</div>
                  </div>
                  <button onClick={() => onOpenDoc(doc)} className="shrink-0 p-1.5 rounded-lg hover:bg-navy-50 text-navy-400 hover:text-navy-700 transition-colors">
                    <Icon name="Eye" size={14} />
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => { onSetCurrentDoc(doc); onSetFillValues(Object.fromEntries(doc.placeholders.map((p) => [p, ""]))); onSetPhase("filling"); }}
                    className="flex-1 text-xs text-navy-600 px-2.5 py-2 rounded-lg hover:bg-navy-50 transition-colors border border-border text-center"
                  >
                    Реквизиты
                  </button>
                  <button
                    onClick={() => onDownload(doc.name, doc.filled)}
                    className="flex-1 text-xs text-navy-600 px-2.5 py-2 rounded-lg hover:bg-navy-50 transition-colors flex items-center justify-center gap-1 border border-border"
                  >
                    <Icon name="Download" size={12} />Скачать
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}