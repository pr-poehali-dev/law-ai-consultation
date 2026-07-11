import { useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { User } from "@/lib/auth";
import PlanBanner from "@/pages/cabinet/PlanBanner";
import type { GenDoc } from "@/pages/cabinet/DocsTab";
import PWAInstallButton from "@/components/PWAInstallButton";
import DocBlockSelector from "@/pages/cabinet/DocBlockSelector";
import type { DocType } from "@/pages/cabinet/docBlocks";

const MAX_FILES = 3;
const MAX_FILE_MB = 10;

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

interface DocsFormPhaseProps {
  user: User;
  docType: DocType;
  docDetails: string;
  docGenerating: boolean;
  docErr: string;
  genDocs: GenDoc[];
  attachedFiles: { name: string; b64: string }[];
  onAttachedFilesChange: (files: { name: string; b64: string }[]) => void;
  onDocTypeChange: (dt: DocType) => void;
  onDocDetailsChange: (v: string) => void;
  onGenerate: () => void;
  onGoToChat: () => void;
  onOpenDoc: (doc: GenDoc) => void;
  onDownload: (name: string, content: string) => void;
  onSelectPlan: () => void;
}

export default function DocsFormPhase({
  user,
  docType,
  docDetails,
  docGenerating,
  docErr,
  genDocs,
  attachedFiles,
  onAttachedFilesChange,
  onDocTypeChange,
  onDocDetailsChange,
  onGenerate,
  onGoToChat,
  onOpenDoc,
  onDownload,
  onSelectPlan,
}: DocsFormPhaseProps) {
  const desktopTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    const remaining = MAX_FILES - attachedFiles.length;
    files.slice(0, remaining).forEach(file => {
      if (file.size > MAX_FILE_MB * 1024 * 1024) return;
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (!["pdf", "doc", "docx"].includes(ext)) return;
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = (reader.result as string).split(",")[1];
        onAttachedFilesChange([...attachedFiles, { name: file.name, b64 }].slice(0, MAX_FILES));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (idx: number) =>
    onAttachedFilesChange(attachedFiles.filter((_, i) => i !== idx));

  // При смене типа документа — фокус на поле ввода (только десктоп)
  useEffect(() => {
    if (window.innerWidth >= 1024) {
      desktopTextareaRef.current?.focus();
    }
  }, [docType.id]);

  return (
    <>
    {/* ── МОБИЛЬ: список типов + история + sticky-панель снизу ── */}
    <div className="lg:hidden flex flex-col pb-tab-bar">
      <div className="bg-white rounded-2xl border border-border p-4 shadow-sm mb-3">
        <PlanBanner user={user} mode="docs" onSelectPlan={onSelectPlan} />
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-cormorant font-bold text-xl text-navy-800">Создать документ</h2>
          <PWAInstallButton />
        </div>
        <p className="text-xs text-muted-foreground mb-3">Выберите тип, опишите ситуацию — AI составит документ.</p>
        <DocBlockSelector selectedId={docType.id} onSelect={onDocTypeChange} />
      </div>

      {/* История на мобиле — под списком типов */}
      <div className="space-y-3 mb-3">
        <button
          onClick={onGoToChat}
          className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-navy-700 to-navy-800 hover:from-navy-800 hover:to-navy-900 text-white rounded-2xl transition-all group"
        >
          <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
            <Icon name="MessageCircle" size={16} className="text-gold-400" />
          </div>
          <div className="text-left flex-1">
            <div className="text-sm font-semibold">Не знаете какой документ нужен?</div>
            <div className="text-xs text-white/70">Расскажите ситуацию AI и он подскажет</div>
          </div>
          <Icon name="ChevronRight" size={16} className="text-white/50 group-hover:text-white transition-colors" />
        </button>

      </div>

      {/* Sticky-панель снизу на мобиле */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border px-4 pt-3 pb-[calc(56px+env(safe-area-inset-bottom,0px))] shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <p className="text-xs text-navy-500 font-medium mb-1.5">
          <Icon name="FileText" size={11} className="inline mr-1 mb-0.5" />
          {docType.label}
        </p>
        <textarea
          value={docDetails}
          onChange={(e) => onDocDetailsChange(e.target.value)}
          disabled={docGenerating}
          placeholder={`Опишите ситуацию для «${docType.label}»...`}
          rows={3}
          className="w-full bg-slate-50 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-navy-400 transition-colors resize-none mb-2 disabled:opacity-60"
        />

        {/* Прикреплённые файлы — мобиль */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {attachedFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200">
                <Icon name="FileText" size={10} className="text-amber-600 shrink-0" />
                <span className="text-[11px] text-amber-800 font-medium truncate max-w-[100px]">{f.name}</span>
                <button onClick={() => removeFile(i)} className="shrink-0 text-amber-400 hover:text-amber-600">
                  <Icon name="X" size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 mb-2">
          {attachedFiles.length < MAX_FILES && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={docGenerating}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-border bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              <Icon name="Paperclip" size={12} />
              Файл
            </button>
          )}
          <button
            onClick={onGenerate}
            disabled={docGenerating || !docDetails.trim()}
            className="btn-gold flex-1 py-2.5 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            {docGenerating ? (
              <><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /></>
            ) : user && !user.isAdmin && user.paidDocs === 0 ? (
              <><Icon name="Lock" size={15} />Оплатить · {docType.price} ₽</>
            ) : (
              <><Icon name="Zap" size={15} />Сгенерировать</>
            )}
          </button>
        </div>

        {docErr && (
          <div className="mb-1 px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
            <Icon name="AlertCircle" size={12} className="shrink-0" />{docErr}
          </div>
        )}
      </div>
    </div>

    {/* ── ДЕСКТОП: слева — выбор типа, справа — форма + история ── */}
    <div className="hidden lg:grid lg:grid-cols-2 gap-6">
      {/* Левая колонка — только выбор типа документа */}
      <div className="bg-white rounded-3xl border border-border p-6 shadow-sm">
        <PlanBanner user={user} mode="docs" onSelectPlan={onSelectPlan} />
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-cormorant font-bold text-2xl text-navy-800" style={{ fontFamily: "'Times New Roman', Times, serif" }}>Тип документа</h2>
          <PWAInstallButton />
        </div>
        <p className="text-sm text-muted-foreground mb-4" style={{ fontFamily: "'Times New Roman', Times, serif" }}>Выберите нужный тип — справа опишите ситуацию.</p>
        <DocBlockSelector selectedId={docType.id} onSelect={onDocTypeChange} />
      </div>

      {/* Правая колонка — форма генерации + история */}
      <div className="flex flex-col gap-4">
        {/* Форма */}
        <div className="bg-white rounded-3xl border border-border p-6 shadow-sm" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
          <h3 className="font-cormorant font-bold text-2xl text-navy-800 mb-1">
            {docType.label}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">Опишите ситуацию — AI-юрист составит полный документ. Реквизиты заполните после генерации.</p>
          <textarea
            ref={desktopTextareaRef}
            value={docDetails}
            onChange={(e) => onDocDetailsChange(e.target.value)}
            disabled={docGenerating}
            placeholder={`Опишите ситуацию для «${docType.label}»...\n\nНапример: что произошло, с кем, когда, какой результат нужен. Реквизиты сторон можно добавить после генерации документа.`}
            rows={7}
            className="w-full bg-slate-50 border border-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors resize-none mb-3 disabled:opacity-60"
          />

          {/* Блок прикрепления файлов — десктоп */}
          <div className="mb-3">
            {attachedFiles.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {attachedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
                    <Icon name="FileText" size={13} className="text-amber-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-amber-900 truncate">{f.name}</p>
                      <p className="text-[10px] text-amber-600">AI прочитает и учтёт при генерации</p>
                    </div>
                    <button onClick={() => removeFile(i)} className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full hover:bg-amber-200 text-amber-400 hover:text-amber-700 transition-colors">
                      <Icon name="X" size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {attachedFiles.length < MAX_FILES && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={docGenerating}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border border-dashed border-slate-300 text-slate-400 hover:border-navy-300 hover:text-navy-600 hover:bg-slate-50 transition-colors disabled:opacity-50 w-full"
              >
                <Icon name="Paperclip" size={12} />
                Прикрепить документ (PDF, DOC, DOCX) — AI учтёт при генерации
                {attachedFiles.length > 0 && <span className="ml-auto text-[10px] text-slate-400">{attachedFiles.length}/{MAX_FILES}</span>}
              </button>
            )}
          </div>

          {docErr && (
            <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
              <Icon name="AlertCircle" size={13} className="shrink-0" />{docErr}
            </div>
          )}
          {user?.isAdmin && (
            <div className="mb-3 flex items-center gap-2 px-4 py-2 rounded-2xl bg-purple-50 border border-purple-200 text-xs text-purple-800">
              <Icon name="ShieldCheck" size={13} />
              Администратор · все функции бесплатны
            </div>
          )}
          <button
            onClick={onGenerate}
            disabled={docGenerating || !docDetails.trim()}
            className="btn-gold w-full py-3.5 rounded-2xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {docGenerating ? (
              <><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /><span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" /></>
            ) : user && !user.isAdmin && user.paidDocs === 0 ? (
              <><Icon name="Lock" size={16} />Оплатить и сгенерировать · {docType.price} ₽</>
            ) : (
              <><Icon name="Zap" size={16} />Сгенерировать документ</>
            )}
          </button>
          {docGenerating && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              AI-юрист составляет документ... После генерации вы сможете заполнить реквизиты сторон.
            </p>
          )}
        </div>

        {/* История документов */}
        <button
          onClick={onGoToChat}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-navy-700 to-navy-800 hover:from-navy-800 hover:to-navy-900 text-white rounded-2xl transition-all group"
        >
          <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
            <Icon name="MessageCircle" size={16} className="text-gold-400" />
          </div>
          <div className="text-left flex-1">
            <div className="text-sm font-semibold">Не знаете какой документ нужен?</div>
            <div className="text-xs text-white/70">Расскажите ситуацию AI и он подскажет</div>
          </div>
          <Icon name="ChevronRight" size={16} className="text-white/50 group-hover:text-white transition-colors" />
        </button>


      </div>
    </div>

    {/* Скрытый input для файлов (общий для мобиль и десктоп) */}
    <input
      ref={fileInputRef}
      type="file"
      accept=".pdf,.doc,.docx"
      multiple
      className="hidden"
      onChange={handleFileSelect}
    />
    </>
  );
}