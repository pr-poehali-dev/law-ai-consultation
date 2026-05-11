import { useRef } from "react";
import Icon from "@/components/ui/icon";

interface DocAiChatInputProps {
  editInput: string;
  editCost: { docs: number; questions: number } | null;
  editErr: string;
  editLoading: boolean;
  analyzing: boolean;
  analysisDone: boolean;
  pendingConfirm: boolean;
  pendingPartial: { note: string; instruction: string } | null;
  editCount: number;
  onInputChange: (v: string) => void;
  onEditRequest: () => void;
  onConfirmEdit: () => void;
  onCancelConfirm: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export default function DocAiChatInput({
  editInput,
  editCost,
  editErr,
  editLoading,
  analyzing,
  analysisDone,
  pendingConfirm,
  pendingPartial,
  editCount,
  onInputChange,
  onEditRequest,
  onConfirmEdit,
  onCancelConfirm,
  onKeyDown,
}: DocAiChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cost = editCost;

  if (pendingConfirm && cost) {
    return (
      <div
        className="px-3 sm:px-4 py-3 border-t shrink-0"
        style={{ borderColor: "rgba(240,192,96,0.2)", background: "rgba(240,192,96,0.06)" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Icon name="AlertCircle" size={14} className="text-gold-400 shrink-0" />
          <p className="text-[11px] font-bold text-gold-400">Подтвердите редактирование</p>
        </div>
        <p className="text-[10px] text-navy-300 mb-2.5 leading-relaxed line-clamp-2">«{editInput}»</p>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 rounded-xl p-2 text-center border border-navy-600">
            <p className="text-lg font-bold text-white">{cost.docs}</p>
            <p className="text-[9px] text-navy-400">{cost.docs === 1 ? "документ" : "документа"}</p>
          </div>
          <Icon name="Plus" size={14} className="text-navy-500 shrink-0" />
          <div className="flex-1 rounded-xl p-2 text-center border border-navy-600">
            <p className="text-lg font-bold text-white">1</p>
            <p className="text-[9px] text-navy-400">вопрос</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancelConfirm}
            className="flex-1 py-2 rounded-xl text-xs font-semibold text-navy-300 border border-navy-600 transition-colors hover:text-white"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            Отмена
          </button>
          <button
            onClick={onConfirmEdit}
            className="flex-1 py-2 rounded-xl text-xs font-bold transition-colors active:scale-95"
            style={{ background: "linear-gradient(135deg,#162d5a,#0f2040)", border: "1px solid rgba(240,192,96,0.4)", color: "#f0c060" }}
          >
            Подтвердить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="px-3 sm:px-4 py-3 border-t shrink-0"
      style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(10,22,40,0.8)" }}
    >
      {editErr && (
        <div
          className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 mb-2 border border-red-500/30"
          style={{ background: "rgba(239,68,68,0.1)" }}
        >
          <Icon name="AlertCircle" size={11} className="text-red-400 shrink-0" />
          <span className="text-[10px] text-red-400">{editErr}</span>
        </div>
      )}
      {cost && (
        <div
          className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 mb-2 border border-gold-500/20"
          style={{ background: "rgba(240,192,96,0.06)" }}
        >
          <Icon name="Banknote" size={11} className="text-gold-500 shrink-0" />
          <span className="text-[10px] text-gold-400">
            Стоимость: <b>{cost.docs} {cost.docs === 1 ? "документ" : "документа"}</b> + <b>1 вопрос</b>
          </span>
        </div>
      )}
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={editInput}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={editLoading || analyzing || !!pendingPartial}
          placeholder={
            !analysisDone ? "Дождитесь анализа..." :
            pendingPartial ? "Ответьте выше..." :
            "Опишите правку... (Ctrl+Enter)"
          }
          rows={2}
          className="flex-1 rounded-xl px-3 py-2 text-[12px] outline-none resize-none leading-relaxed disabled:opacity-40 placeholder:text-navy-500 transition-colors text-white"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            maxHeight: "80px",
          }}
          onFocus={e => { e.target.style.borderColor = "rgba(240,192,96,0.4)"; }}
          onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
        />
        <button
          onClick={onEditRequest}
          disabled={!editInput.trim() || editLoading || analyzing || !analysisDone || !!pendingPartial}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 shrink-0"
          style={{ background: "linear-gradient(135deg,#162d5a,#0f2040)", border: "1px solid rgba(240,192,96,0.35)" }}
        >
          {editLoading
            ? <Icon name="Loader" size={15} className="text-gold-400 animate-spin" />
            : <Icon name="Send" size={15} className="text-gold-400" />
          }
        </button>
      </div>
      <p className="text-[9px] text-navy-500 mt-1 text-center">
        {editCount > 0 ? `Правок: ${editCount} · изменения подсвечены в документе` : "Опишите что изменить — AI внесёт точечную правку"}
      </p>
    </div>
  );
}
