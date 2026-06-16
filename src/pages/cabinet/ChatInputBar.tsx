import { useRef, useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";
import ImageToPdfConverter from "@/components/ImageToPdfConverter";

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
  onSosClick?: () => void;
  onFilesFromConverter?: (files: { name: string; b64: string; size: string }[]) => void;
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
  onSosClick,
  onFilesFromConverter,
}: ChatInputBarProps) {
  const nativeInputRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showToolsSheet, setShowToolsSheet] = useState(false);
  const [showConverter, setShowConverter] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
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
                <p className="text-xs font-semibold text-navy-800 truncate">
                  {/^package(_\d+)?\.pdf$/i.test(f.name) ? `📦 Запакованные документы${f.name.includes("_") ? ` (часть ${f.name.match(/\d+/)?.[0]})` : ""}` : f.name}
                </p>
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

      {/* Быстрые действия */}
      {!hasFiles && (
        <>
          {/* Desktop: pill buttons */}
          <div className="hidden md:flex items-center gap-2 mt-2 flex-wrap">
            {[
              { icon: "Calculator", label: "Калькулятор неустойки", text: "__penalty__" },
              { icon: "Landmark",   label: "Госпошлина",            text: "__duty__" },
              { icon: "BookOpen",   label: "Судебная практика",     text: "__case_law__" },
              { icon: "MapPin",     label: "Подсудность",           text: "__jurisdiction__" },
            ].map(({ icon, label, text }) => (
              <button
                key={label}
                onClick={() => onQuickAction?.(text)}
                disabled={typing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all active:scale-95 disabled:opacity-40 hover:shadow-sm"
                style={{
                  background: "rgba(255,255,255,0.95)",
                  border: "1.5px solid rgba(203,213,225,0.8)",
                  color: "#475569",
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                }}
              >
                <Icon name={icon as Parameters<typeof Icon>[0]["name"]} size={12} color="#64748b" />
                {label}
              </button>
            ))}
          </div>

          {/* Mobile: компактная строка инструментов */}
          <div className="md:hidden mt-1.5 flex items-center gap-1.5 flex-wrap">
            {[
              { icon: "Calculator", label: "Неустойка", text: "__penalty__",     color: "#f59e0b" },
              { icon: "Landmark",   label: "Пошлина",   text: "__duty__",         color: "#0f4c81" },
              { icon: "BookOpen",   label: "Практика",  text: "__case_law__",     color: "#059669" },
              { icon: "MapPin",     label: "Суд",       text: "__jurisdiction__", color: "#7c3aed" },
            ].map(({ icon, label, text, color }) => (
              <button
                key={text}
                onClick={() => onQuickAction?.(text)}
                disabled={typing}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 disabled:opacity-40"
                style={{ background: `${color}12`, border: `1px solid ${color}28`, color }}
              >
                <Icon name={icon as Parameters<typeof Icon>[0]["name"]} size={11} color={color} />
                {label}
              </button>
            ))}
          </div>

          {/* Bottom sheet — работает на всех устройствах */}
          {showToolsSheet && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-[60]"
                style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
                onClick={() => setShowToolsSheet(false)}
              />
              {/* Sheet */}
              <div
                className="fixed bottom-0 left-0 right-0 z-[61] bg-white"
                style={{
                  borderRadius: "24px 24px 0 0",
                  paddingBottom: "max(env(safe-area-inset-bottom, 0px), 20px)",
                  boxShadow: "0 -12px 48px rgba(0,0,0,0.18)",
                  animation: "slideUp 0.28s cubic-bezier(0.32,0.72,0,1)",
                }}
              >
                <style>{`
                  @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to   { transform: translateY(0); }
                  }
                `}</style>
                {/* Ручка */}
                <div className="flex justify-center pt-3 pb-0.5">
                  <div className="w-9 h-1 rounded-full bg-slate-200" />
                </div>
                {/* Заголовок */}
                <div className="flex items-center justify-between px-5 pt-3 pb-2">
                  <div>
                    <p className="text-[17px] font-bold text-navy-900">Инструменты юриста</p>
                    <p className="text-[12px] text-slate-400 mt-0.5">Списывается 1 вопрос за использование</p>
                  </div>
                  <button
                    onClick={() => setShowToolsSheet(false)}
                    className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center active:bg-slate-200 transition-colors"
                  >
                    <Icon name="X" size={17} color="#64748b" />
                  </button>
                </div>
                {/* Карточки 2×2 */}
                <div className="grid grid-cols-2 gap-3 px-4 pt-2 pb-2">
                  {[
                    { icon: "Calculator", label: "Калькулятор\nнеустойки",       sub: "По ГК РФ · договорная и законная", text: "__penalty__",     color: "#f59e0b", bg: "#fffbeb", border: "#f59e0b30" },
                    { icon: "Landmark",   label: "Госпошлина",                    sub: "По НК РФ · все виды судов",        text: "__duty__",         color: "#0f4c81", bg: "#eff6ff", border: "#0f4c8128" },
                    { icon: "BookOpen",   label: "Судебная\nпрактика",            sub: "Поиск по базе и интернету",        text: "__case_law__",     color: "#059669", bg: "#f0fdf4", border: "#05966928" },
                    { icon: "MapPin",     label: "Подсудность",                   sub: "Определить нужный суд",            text: "__jurisdiction__", color: "#7c3aed", bg: "#faf5ff", border: "#7c3aed28" },
                  ].map(({ icon, label, sub, text, color, bg, border }) => (
                    <button
                      key={text}
                      onClick={() => { setShowToolsSheet(false); setTimeout(() => onQuickAction?.(text), 80); }}
                      disabled={typing}
                      className="flex flex-col items-start p-4 rounded-2xl transition-all active:scale-[0.96] text-left"
                      style={{ background: bg, border: `1.5px solid ${border}` }}
                    >
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3 shrink-0"
                        style={{ background: color, boxShadow: `0 4px 12px ${color}40` }}>
                        <Icon name={icon as Parameters<typeof Icon>[0]["name"]} size={20} color="#fff" />
                      </div>
                      <p className="text-[14px] font-bold leading-snug whitespace-pre-line" style={{ color: "#0f172a" }}>{label}</p>
                      <p className="text-[11px] mt-1 leading-snug" style={{ color: "#94a3b8" }}>{sub}</p>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Поле ввода */}
      <div className="mt-2 shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm mb-tab-bar md:mb-2">
        <div className="flex items-end gap-1 px-2 py-2">

          {/* Прикрепить — с меню выбора */}
          <div className="relative shrink-0">
            {showAttachMenu && canUploadFiles && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAttachMenu(false)} />
                <div className="absolute bottom-11 left-0 z-50 w-64"
                  style={{ filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.18))" }}>
                  {/* Треугольник */}
                  <div className="absolute bottom-[-6px] left-4 w-3 h-3 rotate-45 rounded-sm"
                    style={{ background: "white", borderRight: "1px solid rgba(226,232,240,0.8)", borderBottom: "1px solid rgba(226,232,240,0.8)" }} />
                  <div className="rounded-2xl overflow-hidden border border-slate-200/80 bg-white">
                    {/* Заголовок */}
                    <div className="px-4 pt-3 pb-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Прикрепить файлы</p>
                    </div>
                    {/* Вариант 1: обычная загрузка */}
                    <button
                      onClick={() => { setShowAttachMenu(false); onAttachClick(); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left group"
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all"
                        style={{ background: "rgba(15,76,129,0.08)" }}>
                        <Icon name="Paperclip" size={16} className="text-navy-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-navy-900 leading-tight">Загрузить файлы</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">PDF, DOCX, фото · до 3 файлов</p>
                      </div>
                      <Icon name="ChevronRight" size={14} className="text-slate-300 group-hover:text-slate-400 shrink-0" />
                    </button>
                    {/* Разделитель */}
                    <div className="mx-4 border-t border-slate-100" />
                    {/* Вариант 2: конвертор */}
                    <button
                      onClick={() => { setShowAttachMenu(false); setShowConverter(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-navy-50/60 transition-colors text-left group"
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
                        <Icon name="FileImage" size={16} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-navy-900 leading-tight">Массовая загрузка</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md text-white"
                            style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>NEW</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">До 20 файлов (фото, PDF, DOCX) → анализ AI <span className="text-amber-500">* тестовый режим</span></p>
                      </div>
                      <Icon name="ChevronRight" size={14} className="text-slate-300 group-hover:text-navy-400 shrink-0" />
                    </button>
                    <div className="pb-1" />
                  </div>
                </div>
              </>
            )}
            <button
              onClick={() => { if (!canUploadFiles) { onUpgradeClick?.(); return; } setShowAttachMenu(v => !v); }}
              disabled={typing || fileUploading || (!canUploadFiles && !onUpgradeClick)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center active:bg-slate-100 transition-colors ${showAttachMenu ? "bg-navy-100 text-navy-700" : canUploadFiles ? "text-slate-400 hover:text-navy-600 hover:bg-slate-50 disabled:opacity-40" : "text-slate-300 hover:text-amber-500 hover:bg-amber-50"}`}
              title={canUploadFiles ? "Прикрепить файлы" : "Анализ документов — доступен с тарифа «Старт»"}
            >
              {fileUploading
                ? <span className="w-4 h-4 border-2 border-navy-400 border-t-transparent rounded-full animate-spin" />
                : (
                  <span className="relative">
                    <Icon name="Paperclip" size={17} className={hasFiles || showAttachMenu ? "text-navy-600" : ""} />
                    {hasFiles && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-navy-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                        {attachedFiles.length}
                      </span>
                    )}
                  </span>
                )
              }
            </button>
          </div>

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
          <p className="text-[10px] text-slate-400 leading-tight hidden sm:block">
            {canUploadFiles
              ? `Перетащите файлы или нажмите скрепку · до ${MAX_FILES} файлов по 5МБ (суммарно до 7МБ)`
              : "AI-юрист обучен на судебной практике РФ · Не является официальной консультацией"
            }
          </p>
          {/* SOS — только мобиле, под полем ввода */}
          {onSosClick && (
            <button
              onClick={onSosClick}
              className="sm:hidden ml-auto text-[10px] text-slate-400 hover:text-orange-500 transition-colors flex items-center gap-1 active:scale-95"
            >
              <Icon name="AlertTriangle" size={10} color="currentColor" />
              Сообщить о проблеме
            </button>
          )}
        </div>
      </div>

      {showConverter && (
        <ImageToPdfConverter
          onClose={() => setShowConverter(false)}
          onSendToAI={(files) => {
            onFilesFromConverter?.(files);
            setShowConverter(false);
          }}
        />
      )}
    </div>
  );
}