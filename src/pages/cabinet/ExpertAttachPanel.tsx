import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { ChatMsg } from "./ChatTab";
import type { GenDoc } from "./DocsTab";

// ── Модальное окно просмотра вложения ───────────────────────────────
export function AttachmentModal({ title, content, type, onClose }: {
  title: string;
  content: string;
  type: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-in">
        <div className={`flex items-center gap-3 px-5 py-4 border-b border-border shrink-0 ${type === "document" ? "bg-emerald-50" : "bg-blue-50"}`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${type === "document" ? "bg-emerald-100" : "bg-blue-100"}`}>
            <Icon name={type === "document" ? "FileText" : "Bot"} size={16} className={type === "document" ? "text-emerald-600" : "text-blue-600"} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{type === "document" ? "Документ" : "Ответ AI"}</p>
            <p className="text-sm font-bold text-navy-800 truncate">{title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/70 rounded-xl transition-colors">
            <Icon name="X" size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 text-sm text-navy-800 whitespace-pre-wrap leading-relaxed font-golos">
          {content || <span className="text-muted-foreground italic">Содержимое недоступно</span>}
        </div>
      </div>
    </div>
  );
}

// ── Превью прикреплённого материала (бар над вводом) ────────────────
export function AttachmentBar({ attachment, onView, onRemove }: {
  attachment: { type: string; name: string; content?: string };
  onView: (v: { title: string; content: string; type: string }) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-navy-50 border border-navy-200 rounded-2xl shrink-0 animate-fade-in">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${attachment.type === "document" ? "bg-emerald-100" : "bg-blue-100"}`}>
        <Icon name={attachment.type === "document" ? "FileText" : "Bot"} size={13} className={attachment.type === "document" ? "text-emerald-600" : "text-blue-600"} />
      </div>
      <p className="text-xs font-medium text-navy-800 flex-1 truncate">
        {attachment.type === "document" ? "Документ" : "Ответ AI"}: {attachment.name}
      </p>
      {attachment.content && (
        <button
          onClick={() => onView({ title: attachment.name, content: attachment.content!, type: attachment.type })}
          className="text-[11px] text-navy-500 hover:text-navy-700 px-2 py-1 hover:bg-navy-100 rounded-lg transition-colors flex items-center gap-1"
        >
          <Icon name="Eye" size={11} />
          Открыть
        </button>
      )}
      <button onClick={onRemove} className="p-1 text-muted-foreground hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
        <Icon name="X" size={13} />
      </button>
    </div>
  );
}

// ── Панель выбора материала для прикрепления ────────────────────────
export function AttachPanel({ aiAnswers, genDocs, onSelect, onClose }: {
  aiAnswers: ChatMsg[];
  genDocs: GenDoc[];
  onSelect: (att: { type: string; name: string; content?: string }) => void;
  onClose: () => void;
}) {
  return (
    <div className="bg-white border border-border rounded-2xl p-3 shrink-0 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-navy-700">Выберите что прикрепить юристу:</p>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
          <Icon name="X" size={13} className="text-muted-foreground" />
        </button>
      </div>
      <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
        {aiAnswers.map((m, i) => (
          <button
            key={i}
            onClick={() => onSelect({ type: "chat_answer", name: `Ответ AI #${i + 1}: ${m.text.slice(0, 50)}…`, content: m.text })}
            className="flex items-start gap-2.5 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-xl text-left transition-all"
          >
            <div className="w-6 h-6 bg-blue-200 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="Bot" size={12} className="text-blue-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-blue-800">Ответ AI #{i + 1}</p>
              <p className="text-[11px] text-blue-600 line-clamp-2">{m.text.slice(0, 100)}</p>
            </div>
            <Icon name="Paperclip" size={12} className="text-blue-400 shrink-0 mt-0.5" />
          </button>
        ))}
        {genDocs.map((doc) => (
          <button
            key={doc.id}
            onClick={() => onSelect({ type: "document", name: doc.name, content: doc.filled || doc.content })}
            className="flex items-start gap-2.5 px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-xl text-left transition-all"
          >
            <div className="w-6 h-6 bg-emerald-200 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="FileText" size={12} className="text-emerald-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-emerald-800">{doc.name}</p>
              <p className="text-[11px] text-emerald-600">{doc.date}</p>
            </div>
            <Icon name="Paperclip" size={12} className="text-emerald-400 shrink-0 mt-0.5" />
          </button>
        ))}
        {aiAnswers.length === 0 && genDocs.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">Нет доступных материалов</p>
        )}
      </div>
    </div>
  );
}

// ── Хук для управления состоянием вложений ──────────────────────────
export function useAttachment() {
  const [attachment, setAttachment] = useState<{ type: string; name: string; content?: string } | null>(null);
  const [showAttachPanel, setShowAttachPanel] = useState(false);
  const [viewFullMsg, setViewFullMsg] = useState<{ title: string; content: string; type: string } | null>(null);
  return { attachment, setAttachment, showAttachPanel, setShowAttachPanel, viewFullMsg, setViewFullMsg };
}
