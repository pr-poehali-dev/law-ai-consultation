import { useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";

interface ChatInputBarProps {
  user: User;
  input: string;
  typing: boolean;
  fileUploading: boolean;
  totalLeft: number;
  canUploadFiles?: boolean;
  attachedFiles: { name: string; b64: string; size: string }[];
  fileInputRef: React.RefObject<HTMLInputElement>;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onSendFile: (comment: string) => void;
  onAttachClick: () => void;
  onRemoveFile: (idx: number) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function ChatInputBar({
  user,
  input,
  typing,
  fileUploading,
  totalLeft,
  canUploadFiles = false,
  attachedFiles,
  fileInputRef,
  onInputChange,
  onSend,
  onSendFile,
  onAttachClick,
  onRemoveFile,
  onFileSelect,
}: ChatInputBarProps) {
  const nativeInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = nativeInputRef.current;
    if (!el) return;
    if (el !== document.activeElement && el.value !== input) {
      el.value = input;
    }
  }, [input]);

  useEffect(() => {
    if (input === "" && nativeInputRef.current) {
      nativeInputRef.current.value = "";
      nativeInputRef.current.style.height = "44px";
    }
  }, [input]);

  const handleSend = () => {
    const nativeVal = nativeInputRef.current?.value ?? "";
    const comment = nativeVal.trim() || input.trim();

    if (!comment && !attachedFiles.length) return;

    if (attachedFiles.length) {
      if (nativeInputRef.current) {
        nativeInputRef.current.value = "";
        nativeInputRef.current.style.height = "44px";
      }
      onInputChange("");
      onSendFile(comment);
    } else {
      if (nativeVal.trim()) onInputChange(nativeVal);
      onSend();
    }
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    onInputChange(el.value);
    el.style.height = "44px";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const hasFiles = attachedFiles.length > 0;
  const canAddMore = attachedFiles.length < 3;

  return (
    <>
      {/* Скрытые file inputs — multiple для выбора нескольких */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        multiple
        className="hidden"
        tabIndex={-1}
        onChange={onFileSelect}
      />
      <input
        id="camera-input"
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        tabIndex={-1}
        onChange={onFileSelect}
      />

      {/* Прикреплённые файлы */}
      {hasFiles && (
        <div className="mt-2 space-y-1.5">
          {attachedFiles.map((f, idx) => (
            <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-navy-50 border border-navy-200 rounded-xl">
              <div className="w-7 h-7 rounded-lg bg-navy-100 flex items-center justify-center shrink-0">
                <Icon
                  name={/\.(jpg|jpeg|png)$/i.test(f.name) ? "Image" : "FileText"}
                  size={13}
                  className="text-navy-600"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-navy-800 truncate">{f.name}</p>
                <p className="text-[10px] text-muted-foreground">{f.size}</p>
              </div>
              <button
                onClick={() => onRemoveFile(idx)}
                className="p-1 text-muted-foreground hover:text-red-500"
              >
                <Icon name="X" size={13} />
              </button>
            </div>
          ))}
          {/* Подсказка о возможности добавить ещё */}
          {canAddMore ? (
            <button
              onClick={onAttachClick}
              disabled={typing || fileUploading}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-navy-500 hover:text-navy-700 border border-dashed border-navy-200 rounded-xl hover:border-navy-400 transition-colors disabled:opacity-40"
            >
              <Icon name="Plus" size={11} />
              Добавить ещё файл ({attachedFiles.length}/3)
            </button>
          ) : (
            <p className="text-[10px] text-center text-muted-foreground py-0.5">
              Максимум 3 файла · PDF, DOCX, JPG, PNG
            </p>
          )}
          {attachedFiles.some(f => /\.(jpg|jpeg|png)$/i.test(f.name)) && (
            <p className="text-[11px] text-amber-600 px-1">⚠ Фото должны быть чёткими — плохое качество снизит точность AI</p>
          )}
        </div>
      )}

      {/* Поле ввода */}
      <div className="mt-2 shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm mb-tab-bar md:mb-2">
        <div className="flex items-end gap-1 px-2 py-2">

          {/* Прикрепить */}
          <button
            onClick={canUploadFiles ? onAttachClick : undefined}
            disabled={typing || fileUploading || !canAddMore || !canUploadFiles}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-slate-400 hover:text-navy-600 hover:bg-slate-50 disabled:opacity-40 active:bg-slate-100"
            title={canUploadFiles ? "Прикрепить до 3 файлов (PDF, DOCX, фото)" : "Доступно при наличии платного тарифа"}
          >
            {fileUploading
              ? <span className="w-4 h-4 border-2 border-navy-400 border-t-transparent rounded-full animate-spin" />
              : (
                <span className="relative">
                  <Icon name="Paperclip" size={17} className={hasFiles ? "text-navy-600" : ""} />
                  {hasFiles && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-navy-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                      {attachedFiles.length}
                    </span>
                  )}
                </span>
              )
            }
          </button>

          {/* Камера (мобайл) */}
          <button
            onClick={canUploadFiles ? () => document.getElementById("camera-input")?.click() : undefined}
            disabled={typing || fileUploading || !canAddMore || !canUploadFiles}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-slate-400 hover:text-navy-600 hover:bg-slate-50 disabled:opacity-40 active:bg-slate-100 sm:hidden"
          >
            <Icon name="Camera" size={17} />
          </button>

          {/*
            КРИТИЧНО: неконтролируемый textarea (без value prop) + ref
            Это единственный надёжный способ ввода на iOS Safari.
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
              hasFiles ? "Вопрос к документу (необязательно)..." :
              (user.isAdmin || totalLeft > 0) ? "Опишите ситуацию или прикрепите документ..." :
              "Для продолжения приобретите пакет «Старт» — 990 ₽"
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
        <div className="px-3 pb-2 pt-1 border-t border-slate-100 mt-1 flex items-center justify-between">
          <p className="text-[10px] text-slate-400">Носят информационный характер</p>
          {!hasFiles && (
            <p className="text-[10px] text-slate-300">
              {canUploadFiles ? "📎 до 3 файлов · PDF, DOCX, фото" : "🔒 файлы — в платном тарифе"}
            </p>
          )}
        </div>
      </div>
    </>
  );
}