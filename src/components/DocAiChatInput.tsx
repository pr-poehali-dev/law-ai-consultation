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
      <div className="px-3 sm:px-4 py-3 border-t border-amber-200 shrink-0 bg-amber-50">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="AlertCircle" size={14} className="text-amber-600 shrink-0" />
          <p className="text-[11px] font-bold text-amber-800">Подтвердите редактирование</p>
        </div>
        <p className="text-[10px] text-slate-600 mb-2.5 leading-relaxed line-clamp-2">«{editInput}»</p>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 rounded-xl p-2 text-center border border-slate-200 bg-white">
            <p className="text-lg font-bold text-navy-800">{cost.docs}</p>
            <p className="text-[9px] text-slate-500">{cost.docs === 1 ? "документ" : "документа"}</p>
          </div>
          <Icon name="Plus" size={14} className="text-slate-400 shrink-0" />
          <div className="flex-1 rounded-xl p-2 text-center border border-slate-200 bg-white">
            <p className="text-lg font-bold text-navy-800">{cost.questions}</p>
            <p className="text-[9px] text-slate-500">{cost.questions === 1 ? "вопрос" : "вопросов"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancelConfirm}
            className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={onConfirmEdit}
            className="flex-1 py-2 rounded-xl text-xs font-bold transition-colors active:scale-95 bg-navy-800 text-white hover:bg-navy-700"
          >
            Подтвердить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 sm:px-4 py-3 border-t border-slate-200 shrink-0 bg-white">
      {editErr && (
        <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 mb-2 border border-red-200 bg-red-50">
          <Icon name="AlertCircle" size={11} className="text-red-500 shrink-0" />
          <span className="text-[10px] text-red-600">{editErr}</span>
        </div>
      )}
      {cost && (
        <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 mb-2 border border-slate-200 bg-slate-50">
          <Icon name="Banknote" size={11} className="text-slate-500 shrink-0" />
          <span className="text-[10px] text-slate-600">
            Стоимость: <b className="text-navy-700">{cost.docs} {cost.docs === 1 ? "документ" : "документа"}</b> + <b className="text-navy-700">{cost.questions} вопросов</b>
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
          className="flex-1 rounded-xl px-3 py-2 text-[12px] outline-none resize-none leading-relaxed disabled:opacity-40 placeholder:text-slate-400 transition-colors text-slate-800 bg-slate-50 border border-slate-200 focus:border-navy-400 focus:bg-white"
          style={{ maxHeight: "80px" }}
        />
        <button
          onClick={onEditRequest}
          disabled={!editInput.trim() || editLoading || analyzing || !analysisDone || !!pendingPartial}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 shrink-0 bg-navy-800 hover:bg-navy-700"
        >
          {editLoading
            ? <Icon name="Loader" size={15} className="text-gold-400 animate-spin" />
            : <Icon name="Send" size={15} className="text-gold-400" />
          }
        </button>
      </div>
      <p className="text-[9px] text-slate-400 mt-1 text-center">
        {editCount > 0 ? `Правок: ${editCount} · изменения подсвечены в документе` : "Опишите что изменить — AI внесёт точечную правку"}
      </p>
    </div>
  );
}
