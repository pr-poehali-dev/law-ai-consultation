import { useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";

interface ChatInputBarProps {
  user: User;
  input: string;
  typing: boolean;
  fileUploading: boolean;
  totalLeft: number;
  attachedFile: { name: string; b64: string; size: string } | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onSendFile: (comment: string) => void;
  onAttachClick: () => void;
  onClearFile: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function ChatInputBar({
  user,
  input,
  typing,
  fileUploading,
  totalLeft,
  attachedFile,
  fileInputRef,
  onInputChange,
  onSend,
  onSendFile,
  onAttachClick,
  onClearFile,
  onFileSelect,
}: ChatInputBarProps) {
  // Неконтролируемый ref для textarea — решает проблему iOS Safari desync
  const nativeInputRef = useRef<HTMLTextAreaElement>(null);

  // Синхронизируем внешний input state → native textarea
  useEffect(() => {
    const el = nativeInputRef.current;
    if (!el) return;
    // Обновляем только если значение реально отличается (не трогаем при фокусе)
    if (el !== document.activeElement && el.value !== input) {
      el.value = input;
    }
  }, [input]);

  // Сброс textarea после отправки
  useEffect(() => {
    if (input === "" && nativeInputRef.current) {
      nativeInputRef.current.value = "";
      nativeInputRef.current.style.height = "44px";
    }
  }, [input]);

  // Отправка — читаем из native ref, не из state (важно для iOS Safari)
  const handleSend = () => {
    // Берём текст ВСЕГДА из native ref — он актуальнее React-стейта на iOS
    const nativeVal = nativeInputRef.current?.value ?? "";
    const comment = nativeVal.trim() || input.trim();

    if (!comment && !attachedFile) return;

    if (attachedFile) {
      // Очищаем textarea немедленно через ref (до async setState)
      if (nativeInputRef.current) {
        nativeInputRef.current.value = "";
        nativeInputRef.current.style.height = "44px";
      }
      onInputChange(""); // синхронизируем стейт
      onSendFile(comment); // передаём комментарий явно — без race condition
    } else {
      if (nativeVal.trim()) {
        onInputChange(nativeVal); // синхронизируем стейт перед отправкой
      }
      onSend();
    }
  };

  // Автовысота textarea
  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    // Обновляем React state
    onInputChange(el.value);
    // Авто-высота
    el.style.height = "44px";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  return (
    <>
      {/* Скрытые file inputs */}
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" tabIndex={-1} onChange={onFileSelect} />
      <input id="camera-input" type="file" accept="image/*" capture="environment" className="hidden" tabIndex={-1} onChange={onFileSelect} />

      {/* Прикреплённый файл */}
      {attachedFile && (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2 px-3 py-2 bg-navy-50 border border-navy-200 rounded-xl">
            <div className="w-7 h-7 rounded-lg bg-navy-100 flex items-center justify-center shrink-0">
              <Icon name={/\.(jpg|jpeg|png)$/i.test(attachedFile.name) ? "Image" : "FileText"} size={13} className="text-navy-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-navy-800 truncate">{attachedFile.name}</p>
              <p className="text-[10px] text-muted-foreground">{attachedFile.size}</p>
            </div>
            <button onClick={onClearFile} className="p-1 text-muted-foreground hover:text-red-500">
              <Icon name="X" size={13} />
            </button>
          </div>
          {/\.(jpg|jpeg|png)$/i.test(attachedFile.name) && (
            <p className="text-[11px] text-amber-600 px-1">⚠ Фото должно быть чётким — плохое качество снизит точность AI</p>
          )}
        </div>
      )}

      {/* Поле ввода */}
      <div className="mt-2 shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm mb-tab-bar md:mb-2">
        <div className="flex items-end gap-1 px-2 py-2">

          {/* Прикрепить */}
          <button onClick={onAttachClick} disabled={typing || fileUploading}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-slate-400 hover:text-navy-600 hover:bg-slate-50 disabled:opacity-40 active:bg-slate-100">
            {fileUploading
              ? <span className="w-4 h-4 border-2 border-navy-400 border-t-transparent rounded-full animate-spin" />
              : <Icon name="Paperclip" size={17} className={attachedFile ? "text-navy-600" : ""} />
            }
          </button>

          {/* Камера (мобайл) */}
          <button onClick={() => document.getElementById("camera-input")?.click()} disabled={typing || fileUploading}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-slate-400 hover:text-navy-600 hover:bg-slate-50 disabled:opacity-40 active:bg-slate-100 sm:hidden">
            <Icon name="Camera" size={17} />
          </button>

          {/*
            КРИТИЧНО: неконтролируемый textarea (без value prop) + ref
            Это единственный надёжный способ ввода на iOS Safari.
            value prop вызывает desync: iOS обновляет DOM, React перезаписывает → текст исчезает.
          */}
          <textarea
            ref={nativeInputRef}
            rows={1}
            defaultValue=""
            onInput={handleInput}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={typing}
            autoCorrect="on"
            autoCapitalize="sentences"
            placeholder={
              attachedFile ? "Вопрос к документу..." :
              (user.isAdmin || totalLeft > 0) ? "Опишите ситуацию или задайте вопрос..." :
              "Оплатите консультацию — 350 ₽ / 3 вопроса"
            }
            className="flex-1 bg-transparent text-navy-800 placeholder:text-slate-400 outline-none resize-none py-2.5 font-golos"
            style={{ fontSize: "16px", lineHeight: "1.4", minHeight: "44px", maxHeight: "120px" }}
          />

          {/* Отправить */}
          <button
            onClick={handleSend}
            disabled={typing}
            className="w-9 h-9 rounded-xl gradient-navy flex items-center justify-center shrink-0 disabled:opacity-30 active:scale-95 shadow-sm"
          >
            <Icon name="Send" size={14} className="text-white ml-0.5" />
          </button>
        </div>
        <div className="px-3 pb-2 pt-1 border-t border-slate-100 mt-1">
          <p className="text-[10px] text-slate-400">Носят информационный характер</p>
        </div>
      </div>
    </>
  );
}