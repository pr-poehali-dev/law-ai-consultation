import { useState } from "react";
import Icon from "@/components/ui/icon";
import DocPickerSheet from "@/components/DocPickerSheet";

interface LandingChatInputProps {
  input: string;
  typing: boolean;
  showUpsell: boolean;
  questionsLeft: number;
  showDocMenu: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  messagesLength: number;
  attachedFile?: { name: string } | null;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onAttachClick: () => void;
  onToggleDocMenu: () => void;
  onCreateDoc: (docTypeId: string) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile?: () => void;
}

export default function LandingChatInput({
  input,
  typing,
  showUpsell,
  questionsLeft,
  showDocMenu: _showDocMenu,
  fileInputRef,
  textareaRef,
  messagesLength,
  attachedFile,
  onInputChange,
  onSend,
  onKeyDown,
  onAttachClick,
  onToggleDocMenu: _onToggleDocMenu,
  onCreateDoc,
  onFileSelect,
  onRemoveFile,
}: LandingChatInputProps) {
  const [showPicker, setShowPicker] = useState(false);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const canSend = input.trim() && !typing && !showUpsell;

  return (
    <>
      {/* Файл прикреплён */}
      {attachedFile && (
        <div className="px-4 pt-2 pb-0" style={{ borderTop: "1px solid #edf0f7" }}>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: "rgba(232,168,32,0.07)", border: "1px solid rgba(232,168,32,0.2)" }}>
            <Icon name="Paperclip" size={11} color="#b45309" className="shrink-0" />
            <span className="flex-1 text-[11px] font-medium truncate" style={{ color: "#6b7280" }}>{attachedFile.name}</span>
            <span className="text-[10px] font-semibold shrink-0" style={{ color: "#b45309" }}>Отправить</span>
            {onRemoveFile && (
              <button onClick={onRemoveFile} className="shrink-0 ml-0.5 w-4 h-4 flex items-center justify-center rounded" style={{ color: "#9ca3af" }}>
                <Icon name="X" size={10} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Инпут */}
      <div className="px-4 pb-4 pt-3" style={{ borderTop: "1px solid #edf0f7", background: "#ffffff" }}>
        <div className="flex items-end gap-2">

          {/* Прикрепить файл */}
          <button
            onClick={onAttachClick}
            className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 mb-0.5"
            style={{ background: "#f1f4f9", color: "#94a3b8" }}
            title="Анализ документа — тариф Профи"
          >
            <Icon name="Paperclip" size={14} />
          </button>

          {/* Кнопка выбора документа */}
          <button
            onClick={() => setShowPicker(true)}
            className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 mb-0.5"
            style={{ background: "#f1f4f9", color: "#94a3b8" }}
            title="Создать документ · 290 ₽"
          >
            <Icon name="FileText" size={14} />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => { onInputChange(e.target.value); autoResize(); }}
            onKeyDown={onKeyDown}
            placeholder="Опишите вашу ситуацию…"
            disabled={showUpsell || (questionsLeft === 0 && messagesLength > 1)}
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none py-2 text-[13px] font-golos leading-snug placeholder:text-slate-400"
            style={{ color: "#1e293b", minHeight: "38px", maxHeight: "120px" }}
          />

          {/* Кнопка отправки */}
          <button
            onClick={onSend}
            disabled={!canSend}
            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 mb-0.5"
            style={{
              background: canSend ? "linear-gradient(135deg, #e8a820, #f0c060)" : "#f1f4f9",
              boxShadow: canSend ? "0 4px 14px rgba(232,168,32,0.4)" : "none",
              color: canSend ? "#0a1628" : "#c4ced9",
              transition: "all 0.2s ease",
            }}
          >
            <Icon name="Send" size={15} />
          </button>
        </div>
      </div>

      <input ref={fileInputRef} type="file"
        accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.heic,.webp"
        className="hidden" onChange={onFileSelect} />

      {/* DocPickerSheet */}
      {showPicker && (
        <DocPickerSheet
          onSelect={id => { setShowPicker(false); onCreateDoc(id); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}
