import { useRef, useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";
import { hasPurchasedPlan } from "@/lib/auth";

interface ChatInputBarProps {
  user: User;
  input: string;
  typing: boolean;
  fileUploading: boolean;
  totalLeft: number;
  canUploadFiles?: boolean;
  onUpgradeClick?: () => void;
  attachedFiles: { name: string; b64: string; size: string }[];
  fileInputRef: React.RefObject<HTMLInputElement>;
  onInputChange: (v: string) => void;
  onSend: (text?: string) => void;
  onSendFile: (comment: string) => void;
  onAttachClick: () => void;
  onRemoveFile: (idx: number) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileDrop?: (files: FileList) => void;
  onQuickAction?: (text: string) => void;
}

export default function ChatInputBar({
  user,
  input,
  typing,
  fileUploading,
  totalLeft,
  canUploadFiles = false,
  onUpgradeClick,
  attachedFiles,
  fileInputRef,
  onInputChange,
  onSend,
  onSendFile,
  onAttachClick,
  onRemoveFile,
  onFileSelect,
  onFileDrop,
  onQuickAction,
}: ChatInputBarProps) {
  const nativeInputRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

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

  // ── Drag-and-drop ─────────────────────────────────────────────────────
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (canUploadFiles && e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, [canUploadFiles]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    if (!canUploadFiles) {
      onUpgradeClick?.();
      return;
    }
    const files = e.dataTransfer.files;
    if (files && files.length > 0 && onFileDrop) {
      onFileDrop(files);
    }
  }, [canUploadFiles, onFileDrop, onUpgradeClick]);

  const MAX_FILES = 3;
  const hasFiles = attachedFiles.length > 0;
  const canAddMore = attachedFiles.length < MAX_FILES;

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative"
    >
      {/* Скрытые file inputs — multiple для выбора нескольких */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
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

      {/* Drag-and-drop оверлей */}
      {isDragging && (
        <div className="absolute inset-0 z-10 rounded-2xl border-2 border-dashed border-navy-400 bg-navy-50/95 flex flex-col items-center justify-center gap-2 pointer-events-none">
          <div className="w-12 h-12 rounded-2xl bg-navy-100 flex items-center justify-center">
            <Icon name="Upload" size={22} className="text-navy-600" />
          </div>
          <p className="text-sm font-semibold text-navy-700">Отпустите файлы для загрузки</p>
          <p className="text-[11px] text-navy-500">PDF, DOCX, JPG, PNG · до {MAX_FILES} файлов</p>
        </div>
      )}

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
                className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                title="Удалить файл"
              >
                <Icon name="X" size={13} />
              </button>
            </div>
          ))}
          {canAddMore ? (
            <button
              onClick={onAttachClick}
              disabled={typing || fileUploading}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-navy-500 hover:text-navy-700 border border-dashed border-navy-200 rounded-xl hover:border-navy-400 transition-colors disabled:opacity-40"
            >
              <Icon name="Plus" size={11} />
              Добавить ещё файл ({attachedFiles.length}/{MAX_FILES})
            </button>
          ) : (
            <p className="text-[10px] text-center text-muted-foreground py-0.5">
              Максимум {MAX_FILES} файлов · до 5МБ каждый (суммарно до 7МБ)
            </p>
          )}
          {attachedFiles.some(f => /\.(jpg|jpeg|png)$/i.test(f.name)) && (
            <p className="text-[11px] text-amber-600 px-1">⚠ Фото должны быть чёткими — плохое качество снизит точность AI</p>
          )}
        </div>
      )}

      {/* Быстрые действия — облачки */}
      {!hasFiles && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {[
            { icon: "Calculator", label: "Калькулятор неустойки",       text: "__penalty__",      premium: false },
            { icon: "Landmark",   label: "Госпошлина",                  text: "__duty__",         premium: false },
            { icon: "BookOpen",   label: "Судебная практика",           text: "__case_law__",     premium: true  },
            { icon: "MapPin",     label: "Территориальная подсудность", text: "__jurisdiction__", premium: true  },
          ].map(({ icon, label, text, premium }) => {
            const locked = premium && !user.isAdmin && !hasPurchasedPlan(user);
            return (
              <button
                key={label}
                onClick={() => locked ? onUpgradeClick?.() : onQuickAction?.(text)}
                disabled={typing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all active:scale-95 disabled:opacity-40 hover:shadow-sm relative"
                style={{
                  background: locked ? "rgba(245,158,11,0.06)" : "rgba(255,255,255,0.95)",
                  border: locked ? "1.5px solid rgba(245,158,11,0.35)" : "1.5px solid rgba(203,213,225,0.8)",
                  color: locked ? "#92400e" : "#475569",
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                }}
              >
                <Icon name={icon as Parameters<typeof Icon>[0]["name"]} size={12} color={locked ? "#d97706" : "#64748b"} />
                {label}
                {locked && <Icon name="Lock" size={10} color="#d97706" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Поле ввода */}
      <div className="mt-2 shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm mb-tab-bar md:mb-2">
        <div className="flex items-end gap-1 px-2 py-2">

          {/* Прикрепить */}
          <button
            onClick={canUploadFiles ? onAttachClick : onUpgradeClick}
            disabled={typing || fileUploading || (!canUploadFiles && !onUpgradeClick) || (canUploadFiles && !canAddMore)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 active:bg-slate-100 transition-colors ${canUploadFiles ? "text-slate-400 hover:text-navy-600 hover:bg-slate-50 disabled:opacity-40" : "text-slate-300 hover:text-amber-500 hover:bg-amber-50"}`}
            title={canUploadFiles ? `Прикрепить до ${MAX_FILES} файлов (PDF, DOCX, фото) или перетащите` : "Анализ документов — доступен с тарифа «Старт»"}
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
            onClick={canUploadFiles ? () => document.getElementById("camera-input")?.click() : onUpgradeClick}
            disabled={typing || fileUploading || (!canUploadFiles && !onUpgradeClick) || (canUploadFiles && !canAddMore)}
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
              "Для продолжения приобретите пакет «Старт» — 1 490 ₽"
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
        <div className="px-3 pb-2 flex items-center justify-between gap-2">
          <p className="text-[10px] text-slate-400 leading-tight">
            {canUploadFiles
              ? `Перетащите файлы или нажмите скрепку · до ${MAX_FILES} файлов по 5МБ (суммарно до 7МБ)`
              : "AI-юрист обучен на судебной практике РФ · Не является официальной консультацией"
            }
          </p>
        </div>
      </div>
    </div>
  );
}