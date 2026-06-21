import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";
import { downloadDoc } from "@/lib/docUtils";
import type { GenDoc } from "@/pages/cabinet/DocsTab";

interface HistoryTabProps {
  user: User;
  messages: unknown[];
  genDocs?: GenDoc[];
  onGoToChat: () => void;
  onAskAI: (prompt: string) => void;
  onOpenDoc?: (doc: GenDoc) => void;
}

export default function HistoryTab({ genDocs = [], onOpenDoc }: HistoryTabProps) {
  if (genDocs.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <h2 className="font-cormorant font-bold text-3xl text-navy-800 mb-6">Мои документы</h2>
        <div className="bg-white rounded-3xl border border-border p-12 text-center shadow-sm">
          <div className="w-14 h-14 bg-navy-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Icon name="FileText" size={24} className="text-navy-400" />
          </div>
          <p className="text-muted-foreground mb-1">Документов пока нет</p>
          <p className="text-xs text-muted-foreground/70">Созданные документы появятся здесь</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
        <h2 className="font-cormorant font-bold text-2xl sm:text-3xl text-navy-800">Мои документы</h2>
        <span className="text-xs text-muted-foreground bg-slate-100 px-2.5 py-1.5 rounded-xl shrink-0">
          {genDocs.length} {genDocs.length === 1 ? "документ" : genDocs.length < 5 ? "документа" : "документов"}
        </span>
      </div>

      <div className="flex items-center gap-1.5 mb-4 text-[11px] text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
        Документы хранятся в вашем браузере — скачайте, чтобы не потерять при очистке
      </div>

      <div className="space-y-2">
        {genDocs.map((doc) => (
          <div key={doc.id} className="bg-white rounded-2xl border border-border shadow-sm p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-navy-50 rounded-xl flex items-center justify-center shrink-0">
              <Icon name="FileText" size={16} className="text-navy-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-navy-800 truncate">{doc.name}</p>
              <p className="text-xs text-muted-foreground">
                {doc.date}
                {doc.editedAt && <span className="ml-1.5 text-amber-600">· ред. {doc.editedAt}</span>}
              </p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {onOpenDoc && (
                <button
                  onClick={() => onOpenDoc(doc)}
                  className="text-xs text-navy-600 hover:text-navy-800 px-2.5 py-2 rounded-lg hover:bg-navy-50 transition-colors flex items-center gap-1 border border-border"
                >
                  <Icon name="Eye" size={12} />
                  <span className="hidden sm:inline">Просмотр</span>
                </button>
              )}
              <button
                onClick={() => downloadDoc(doc.name, doc.editedContent || doc.filled)}
                className="text-xs text-navy-600 hover:text-navy-800 px-2.5 py-2 rounded-lg hover:bg-navy-50 transition-colors flex items-center gap-1 border border-border"
              >
                <Icon name="Download" size={12} />
                <span className="hidden sm:inline">Скачать</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}