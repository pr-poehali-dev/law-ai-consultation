import Icon from "@/components/ui/icon";
import { DOC_TYPES } from "@/components/landingChatUtils";

interface LandingChatInputProps {
  input: string;
  typing: boolean;
  showUpsell: boolean;
  questionsLeft: number;
  showDocMenu: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  messagesLength: number;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onAttachClick: () => void;
  onToggleDocMenu: () => void;
  onCreateDoc: (docTypeId: string) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function LandingChatInput({
  input,
  typing,
  showUpsell,
  questionsLeft,
  showDocMenu,
  fileInputRef,
  textareaRef,
  messagesLength,
  onInputChange,
  onSend,
  onKeyDown,
  onAttachClick,
  onToggleDocMenu,
  onCreateDoc,
  onFileSelect,
}: LandingChatInputProps) {
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  return (
    <>
      <div className="border-t px-3 py-2.5" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-end gap-2">
          {/* Скрепка */}
          <button
            onClick={onAttachClick}
            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 mb-0.5"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }}
            title="Анализ документа — тариф «Профи»"
          >
            <Icon name="Paperclip" size={15} />
          </button>

          {/* Меню документов */}
          <div className="relative shrink-0">
            <button
              onClick={onToggleDocMenu}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 mb-0.5"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }}
              title="Создать документ — 600 ₽"
            >
              <Icon name="FileText" size={15} />
            </button>
            {showDocMenu && (
              <div
                className="absolute bottom-12 left-0 rounded-2xl overflow-hidden shadow-2xl z-50 w-52"
                style={{ background: "#0f1f3d", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest px-3 pt-3 pb-1"
                  style={{ color: "rgba(255,255,255,0.35)" }}>Создать документ · 600 ₽</p>
                {DOC_TYPES.map(dt => (
                  <button
                    key={dt.id}
                    onClick={() => onCreateDoc(dt.id)}
                    className="w-full text-left px-3 py-2.5 text-sm transition-colors"
                    style={{ color: "rgba(255,255,255,0.8)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    {dt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => { onInputChange(e.target.value); autoResize(); }}
            onKeyDown={onKeyDown}
            placeholder={questionsLeft > 0 ? "Опишите вашу ситуацию..." : "Выберите вариант продолжения выше"}
            disabled={showUpsell || (questionsLeft === 0 && messagesLength > 1)}
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none py-2.5 text-sm font-golos leading-snug"
            style={{ color: "rgba(255,255,255,0.9)", minHeight: "40px", maxHeight: "120px" }}
          />

          {/* Отправить */}
          <button
            onClick={onSend}
            disabled={!input.trim() || typing || showUpsell}
            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 mb-0.5"
            style={{
              background: input.trim() && !typing && !showUpsell
                ? "linear-gradient(135deg, #e8a820, #f0c060)"
                : "rgba(255,255,255,0.06)",
              color: input.trim() && !typing && !showUpsell ? "#0a1628" : "rgba(255,255,255,0.3)",
            }}
          >
            <Icon name="Send" size={15} />
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.heic,.webp"
        className="hidden"
        onChange={onFileSelect}
      />
    </>
  );
}
