import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";
import ImageToPdfConverter from "@/components/ImageToPdfConverter";

const MAX_FILES = 3;

interface ChatInputFieldProps {
  user: User;
  input: string;
  typing: boolean;
  fileUploading: boolean;
  totalLeft: number;
  canUploadFiles: boolean;
  hasFiles: boolean;
  canAddMore: boolean;
  attachedFilesCount: number;
  showAttachMenu: boolean;
  showConverter: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  nativeInputRef: React.RefObject<HTMLTextAreaElement>;
  onUpgradeClick?: () => void;
  onAttachClick: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFilesFromConverter?: (files: { name: string; b64: string; size: string }[]) => void;
  onSosClick?: () => void;
  onHandleSend: () => void;
  onHandleInput: (e: React.FormEvent<HTMLTextAreaElement>) => void;
  onToggleAttachMenu: (v: boolean) => void;
  onToggleConverter: (v: boolean) => void;
}

export default function ChatInputField({
  user, input, typing, fileUploading, totalLeft,
  canUploadFiles, hasFiles, canAddMore, attachedFilesCount,
  showAttachMenu, showConverter,
  fileInputRef, nativeInputRef,
  onUpgradeClick, onAttachClick, onFileSelect, onFilesFromConverter, onSosClick,
  onHandleSend, onHandleInput,
  onToggleAttachMenu, onToggleConverter,
}: ChatInputFieldProps) {
  return (
    <>
      {/* Скрытые file inputs */}
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

      <div className="mt-2 shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm mb-tab-bar md:mb-2">
        <div className="flex items-end gap-1 px-2 py-2">

          {/* Прикрепить — с меню выбора */}
          <div className="relative shrink-0">
            {showAttachMenu && canUploadFiles && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => onToggleAttachMenu(false)} />
                <div
                  className="absolute bottom-11 left-0 z-50 w-64"
                  style={{ filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.18))" }}
                >
                  <div
                    className="absolute bottom-[-6px] left-4 w-3 h-3 rotate-45 rounded-sm"
                    style={{ background: "white", borderRight: "1px solid rgba(226,232,240,0.8)", borderBottom: "1px solid rgba(226,232,240,0.8)" }}
                  />
                  <div className="rounded-2xl overflow-hidden border border-slate-200/80 bg-white">
                    <div className="px-4 pt-3 pb-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Прикрепить файлы</p>
                    </div>
                    <button
                      onClick={() => { onToggleAttachMenu(false); onAttachClick(); }}
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
                    <div className="mx-4 border-t border-slate-100" />
                    <button
                      onClick={() => { onToggleAttachMenu(false); onToggleConverter(true); }}
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
              onClick={() => { if (!canUploadFiles) { onUpgradeClick?.(); return; } onToggleAttachMenu(!showAttachMenu); }}
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
                        {attachedFilesCount}
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
            onInput={onHandleInput}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onHandleSend();
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
            onClick={onHandleSend}
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
          onClose={() => onToggleConverter(false)}
          onSendToAI={(files) => {
            onFilesFromConverter?.(files);
            onToggleConverter(false);
          }}
        />
      )}
    </>
  );
}
