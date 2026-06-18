import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";

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
const MAX_FILE_MB = 10;
const ALLOWED_EXTS = ["pdf", "doc", "docx"];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export default function DocDetailsModal({
  docTypeId,
  docLabel,
  onProceed,
  onClose,
}: DocDetailsModalProps) {
  const [situation, setSituation] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<DocAttachedFile[]>([]);
  const [fileError, setFileError] = useState("");
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    setFileError("");
    const remaining = MAX_FILES - attachedFiles.length;
    if (remaining <= 0) { setFileError(`Максимум ${MAX_FILES} файла`); return; }
    files.slice(0, remaining).forEach(file => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_EXTS.includes(ext)) { setFileError("Только PDF, DOC, DOCX"); return; }
      if (file.size > MAX_FILE_MB * 1024 * 1024) { setFileError(`Файл слишком большой (макс. ${MAX_FILE_MB} МБ)`); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = (reader.result as string).split(",")[1];
        setAttachedFiles(prev => prev.length >= MAX_FILES ? prev : [...prev, { name: file.name, b64, size: formatSize(file.size) }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleProceed = () => {
    const q = situation.trim();
    if (!q) return;
    onProceed(q, "", attachedFiles, docTypeId, docLabel);
  };

  const canProceed = situation.trim().length > 0;

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
                  className="flex items-center gap-1 text-[11px] font-medium transition-opacity hover:opacity-70"
                  style={{ color: "#e8a820" }}
                >
                  <Icon name="Paperclip" size={10} color="#e8a820" />
                  Ещё файл
                </button>
              )}
            </div>

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
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all active:scale-[0.99]"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)" }}
              >
                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <Icon name="Upload" size={13} color="rgba(255,255,255,0.4)" />
                </div>
                <div className="text-left">
                  <p className="text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Прикрепить документ</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.22)" }}>PDF, DOC, DOCX · до 10 МБ · AI учтёт при генерации</p>
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
