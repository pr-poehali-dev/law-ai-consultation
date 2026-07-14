import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { compressAttachmentsBatch, blobToBase64, formatFileSize, PLATFORM_TOTAL_LIMIT_MB } from "@/lib/fileCompression";

export interface DocAttachedFile {
  name: string;
  b64: string;
  size: string;
}

interface DocDetailsModalProps {
  docTypeId: string;
  docLabel: string;
  initialQuery: string;
  onProceed: (query: string, comment: string, files: DocAttachedFile[], docTypeId: string, docLabel: string) => void;
  onClose: () => void;
}

const MAX_FILES = 3;
// Принимаем файлы крупнее платформенного лимита — сжимаем их на клиенте перед отправкой,
// только если СОВОКУПНЫЙ вес вложений превышает лимит платформы.
const MAX_FILE_MB = 20;
const ALLOWED_EXTS = ["pdf", "doc", "docx"];

const formatSize = formatFileSize;

export default function DocDetailsModal({
  docTypeId,
  docLabel,
  onProceed,
  onClose,
}: DocDetailsModalProps) {
  const [situation, setSituation] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<DocAttachedFile[]>([]);
  const [fileError, setFileError] = useState("");
  const [filesProcessing, setFilesProcessing] = useState(false);
  const [compressNote, setCompressNote] = useState("");
  const [visible, setVisible] = useState(false);
  const situationRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    setTimeout(() => situationRef.current?.focus(), 300);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 260);
  };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    setFileError("");
    const remaining = MAX_FILES - attachedFiles.length;
    if (remaining <= 0) { setFileError(`Максимум ${MAX_FILES} файла`); return; }

    const candidates = files.slice(0, remaining).filter(file => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_EXTS.includes(ext)) { setFileError("Только PDF, DOC, DOCX"); return false; }
      if (file.size > MAX_FILE_MB * 1024 * 1024) { setFileError(`Файл слишком большой (макс. ${MAX_FILE_MB} МБ)`); return false; }
      return true;
    });
    if (candidates.length === 0) return;

    setFilesProcessing(true);
    setCompressNote("");
    try {
      const { results, exceeded } = await compressAttachmentsBatch(candidates);
      const newFiles = await Promise.all(
        results.map(async r => ({ name: r.name, b64: await blobToBase64(r.blob), size: formatSize(r.finalSize) }))
      );
      const compressedOnes = results.filter(r => r.wasCompressed);
      if (compressedOnes.length > 0) {
        const totalBefore = compressedOnes.reduce((s, r) => s + r.originalSize, 0);
        const totalAfter = compressedOnes.reduce((s, r) => s + r.finalSize, 0);
        setCompressNote(`Файл сжат: ${formatFileSize(totalBefore)} → ${formatFileSize(totalAfter)}, суть документа сохранена`);
        setTimeout(() => setCompressNote(""), 6000);
      }
      if (exceeded) {
        setFileError(`Размер документов превышен даже после сжатия (лимит платформы — ${PLATFORM_TOTAL_LIMIT_MB} МБ). Приложите файл меньшего размера.`);
        return;
      }
      setAttachedFiles(prev => [...prev, ...newFiles].slice(0, MAX_FILES));
    } finally {
      setFilesProcessing(false);
    }
  };

  const handleProceed = () => {
    const q = situation.trim();
    if (!q) return;
    onProceed(q, "", attachedFiles, docTypeId, docLabel);
  };

  const canProceed = situation.trim().length > 0 && !filesProcessing;

  return (
    <div className="fixed inset-0 z-[115] flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 transition-opacity duration-250"
        style={{ background: "rgba(5,12,30,0.65)", backdropFilter: "blur(3px)", opacity: visible ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full sm:max-w-lg sm:mx-4 sm:rounded-3xl rounded-t-3xl flex flex-col"
        style={{
          background: "#0a1628",
          maxHeight: "92dvh",
          boxShadow: "0 -8px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.26s cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        {/* Золотая линия */}
        <div className="shrink-0 rounded-t-3xl overflow-hidden" style={{ height: 3, background: "linear-gradient(90deg, transparent, #e8a820 30%, #f5d060 50%, #e8a820 70%, transparent)" }} />

        {/* Свайп-индикатор */}
        <div className="flex justify-center pt-2 pb-0.5 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Заголовок */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 pt-2 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(232,168,32,0.12)", border: "1px solid rgba(232,168,32,0.22)" }}>
              <Icon name="FileText" size={15} color="#e8a820" />
            </div>
            <div>
              <p className="font-bold text-white text-[14px] leading-tight">{docLabel}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Опишите ситуацию — AI подготовит документ</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <Icon name="X" size={14} color="rgba(255,255,255,0.6)" />
          </button>
        </div>

        {/* Скролл-зона */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-5 space-y-3 pb-3">

          {/* Поле описания ситуации */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>Ваша ситуация</p>
            <div
              className="rounded-2xl overflow-hidden transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: situation ? "1.5px solid rgba(232,168,32,0.4)" : "1.5px solid rgba(255,255,255,0.1)",
              }}
            >
              <textarea
                ref={situationRef}
                value={situation}
                onChange={e => { setSituation(e.target.value); autoResize(e.target); }}
                placeholder={"Опишите подробно: стороны, суммы, даты, обстоятельства…\n\nЧем детальнее — тем точнее документ."}
                rows={5}
                className="w-full bg-transparent outline-none resize-none px-4 py-3.5 text-[13px] leading-relaxed placeholder:opacity-30"
                style={{ color: "rgba(255,255,255,0.9)", minHeight: "120px", maxHeight: "180px" }}
              />
            </div>
          </div>

          {/* Блок файлов */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>Документы</p>
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>до {MAX_FILES} · PDF, DOC, DOCX</span>
              </div>
              {attachedFiles.length > 0 && attachedFiles.length < MAX_FILES && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={filesProcessing}
                  className="flex items-center gap-1 text-[11px] font-medium transition-opacity hover:opacity-70 disabled:opacity-50"
                  style={{ color: "#e8a820" }}
                >
                  {filesProcessing
                    ? <span className="w-2.5 h-2.5 border-2 border-amber-300/40 border-t-amber-400 rounded-full animate-spin" />
                    : <Icon name="Paperclip" size={10} color="#e8a820" />}
                  {filesProcessing ? "Сжимаю..." : "Ещё файл"}
                </button>
              )}
            </div>

            {compressNote && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-2" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)" }}>
                <Icon name="Sparkles" size={12} color="#60a5fa" className="shrink-0" />
                <span className="text-[11px]" style={{ color: "#93c5fd" }}>{compressNote}</span>
              </div>
            )}

            {/* Прикреплённые файлы */}
            {attachedFiles.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {attachedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ background: "rgba(232,168,32,0.07)", border: "1px solid rgba(232,168,32,0.18)" }}>
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(232,168,32,0.15)" }}>
                      <Icon name="FileText" size={11} color="#e8a820" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium truncate" style={{ color: "rgba(255,255,255,0.85)" }}>{f.name}</p>
                      <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{f.size} · AI учтёт при генерации</p>
                    </div>
                    <button
                      onClick={() => { setAttachedFiles(p => p.filter((_, j) => j !== i)); setFileError(""); }}
                      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
                      style={{ background: "rgba(255,255,255,0.08)" }}
                    >
                      <Icon name="X" size={10} color="rgba(255,255,255,0.5)" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Зона загрузки если файлов нет */}
            {attachedFiles.length === 0 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={filesProcessing}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all active:scale-[0.99] disabled:opacity-70"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)" }}
              >
                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
                  {filesProcessing
                    ? <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                    : <Icon name="Upload" size={13} color="rgba(255,255,255,0.4)" />}
                </div>
                <div className="text-left">
                  <p className="text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {filesProcessing ? "Сжимаю файл до допустимого размера..." : "Прикрепить документ"}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.22)" }}>PDF, DOC, DOCX · до {MAX_FILE_MB} МБ · AI учтёт при генерации</p>
                </div>
              </button>
            )}

            {fileError && <p className="mt-1.5 text-[11px]" style={{ color: "#f87171" }}>{fileError}</p>}

            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" multiple className="hidden" onChange={handleFileSelect} />
          </div>
        </div>

        {/* Футер */}
        <div
          className="shrink-0 px-4 sm:px-5 pt-3"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.07)",
            paddingBottom: `max(16px, env(safe-area-inset-bottom, 16px))`,
            background: "#0a1628",
          }}
        >
          <button
            onClick={handleProceed}
            disabled={!canProceed}
            className="w-full py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{
              background: canProceed ? "linear-gradient(135deg, #c97d10, #e8a820, #f5d060)" : "rgba(255,255,255,0.07)",
              color: canProceed ? "#0a1628" : "rgba(255,255,255,0.2)",
              boxShadow: canProceed ? "0 4px 20px rgba(232,168,32,0.35)" : "none",
              transition: "all 0.2s",
            }}
          >
            <Icon name="ArrowRight" size={17} color={canProceed ? "#0a1628" : "rgba(255,255,255,0.2)"} />
            Выбрать способ оплаты
            {attachedFiles.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(10,22,40,0.2)", color: "#0a1628" }}>
                +{attachedFiles.length} файл{attachedFiles.length > 1 ? "а" : ""}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}