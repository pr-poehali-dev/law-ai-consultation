import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { DOC_BLOCKS } from "@/pages/cabinet/docBlocks";

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

const ALL_DOCS = DOC_BLOCKS.flatMap(b => b.types.map(t => ({ id: t.id, label: t.label, group: b.label })));

const MAX_FILES = 3;
const MAX_FILE_MB = 10;
const ALLOWED_EXTS = ["pdf", "doc", "docx"];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export default function DocDetailsModal({
  docTypeId: initialDocTypeId,
  docLabel: initialDocLabel,
  initialQuery,
  onProceed,
  onClose,
}: DocDetailsModalProps) {
  const [selectedDocId, setSelectedDocId] = useState(initialDocTypeId);
  const [selectedDocLabel, setSelectedDocLabel] = useState(initialDocLabel);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [docSearch, setDocSearch] = useState("");
  const [query, setQuery] = useState(initialQuery);
  const [comment, setComment] = useState("");
  const [editingQuery, setEditingQuery] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<DocAttachedFile[]>([]);
  const [fileError, setFileError] = useState("");
  const queryRef = useRef<HTMLTextAreaElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredDocs = docSearch.trim()
    ? ALL_DOCS.filter(d => d.label.toLowerCase().includes(docSearch.toLowerCase()) || d.group.toLowerCase().includes(docSearch.toLowerCase()))
    : ALL_DOCS;

  useEffect(() => {
    if (editingQuery && queryRef.current) {
      queryRef.current.focus();
      const len = queryRef.current.value.length;
      queryRef.current.setSelectionRange(len, len);
    }
  }, [editingQuery]);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    setFileError("");

    const remaining = MAX_FILES - attachedFiles.length;
    if (remaining <= 0) {
      setFileError(`Максимум ${MAX_FILES} файла`);
      return;
    }

    const toAdd = files.slice(0, remaining);
    toAdd.forEach(file => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_EXTS.includes(ext)) {
        setFileError("Только PDF, DOC, DOCX");
        return;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setFileError(`Файл слишком большой (макс. ${MAX_FILE_MB} МБ)`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = (reader.result as string).split(",")[1];
        setAttachedFiles(prev => {
          if (prev.length >= MAX_FILES) return prev;
          return [...prev, { name: file.name, b64, size: formatSize(file.size) }];
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (idx: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== idx));
    setFileError("");
  };

  const handleProceed = () => {
    const q = query.trim();
    if (!q) return;
    onProceed(q, comment.trim(), attachedFiles, selectedDocId, selectedDocLabel);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: "rgba(5,12,30,0.7)" }}
        onClick={onClose}
      />

      <div
        className="relative w-full sm:max-w-lg sm:mx-4 sm:rounded-3xl rounded-t-3xl flex flex-col"
        style={{
          background: "#0a1628",
          maxHeight: "92dvh",
          boxShadow: "0 -8px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        {/* Золотая линия */}
        <div
          className="shrink-0 rounded-t-3xl overflow-hidden"
          style={{ height: 3, background: "linear-gradient(90deg, transparent, #e8a820 30%, #f5d060 50%, #e8a820 70%, transparent)" }}
        />

        {/* Свайп */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Кнопка закрыть */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center z-10 transition-opacity hover:opacity-70"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <Icon name="X" size={14} color="rgba(255,255,255,0.6)" />
        </button>

        {/* Заголовок */}
        <div className="flex items-center gap-3 px-5 pt-1 pb-3 shrink-0">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(232,168,32,0.12)", border: "1px solid rgba(232,168,32,0.25)" }}
          >
            <Icon name="FileText" size={18} color="#e8a820" />
          </div>
          <div>
            <h3 className="font-bold text-white text-[15px] leading-tight">{selectedDocLabel}</h3>
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              Уточните детали для точной генерации
            </p>
          </div>
        </div>

        {/* Выбор типа документа */}
        <div className="px-4 sm:px-5 pb-3 shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>Тип документа</p>
          <button
            onClick={() => { setShowDocPicker(v => !v); setDocSearch(""); }}
            className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl transition-all"
            style={{ background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(232,168,32,0.3)" }}
          >
            <span className="text-[13px] font-medium text-left flex-1 truncate" style={{ color: "rgba(255,255,255,0.9)" }}>{selectedDocLabel}</span>
            <Icon name={showDocPicker ? "ChevronUp" : "ChevronDown"} size={14} color="rgba(255,255,255,0.4)" />
          </button>

          {showDocPicker && (
            <div className="mt-1.5 rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <input
                  autoFocus
                  value={docSearch}
                  onChange={e => setDocSearch(e.target.value)}
                  placeholder="Поиск документа…"
                  className="w-full bg-transparent outline-none text-[12px]"
                  style={{ color: "rgba(255,255,255,0.8)", caretColor: "#e8a820" }}
                />
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
                {filteredDocs.map(d => (
                  <button
                    key={d.id}
                    onClick={() => { setSelectedDocId(d.id); setSelectedDocLabel(d.label); setShowDocPicker(false); }}
                    className="w-full text-left px-3 py-2 transition-colors"
                    style={{
                      background: d.id === selectedDocId ? "rgba(232,168,32,0.1)" : "transparent",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <p className="text-[12px] leading-snug" style={{ color: d.id === selectedDocId ? "#e8a820" : "rgba(255,255,255,0.75)" }}>{d.label}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{d.group}</p>
                  </button>
                ))}
                {filteredDocs.length === 0 && (
                  <p className="px-3 py-3 text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>Ничего не найдено</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Скролл-зона */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-5 space-y-3.5 pb-3">

          {/* Блок запроса */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>
                Ваш запрос
              </span>
              {!editingQuery ? (
                <button
                  onClick={() => setEditingQuery(true)}
                  className="flex items-center gap-1 text-[11px] font-medium transition-opacity hover:opacity-70"
                  style={{ color: "#e8a820" }}
                >
                  <Icon name="Pencil" size={10} color="#e8a820" />
                  Изменить
                </button>
              ) : (
                <button
                  onClick={() => setEditingQuery(false)}
                  className="flex items-center gap-1 text-[11px] font-medium transition-opacity hover:opacity-70"
                  style={{ color: "#4ade80" }}
                >
                  <Icon name="Check" size={10} color="#4ade80" />
                  Готово
                </button>
              )}
            </div>

            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: editingQuery ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.04)",
                border: editingQuery ? "1.5px solid rgba(232,168,32,0.35)" : "1px solid rgba(255,255,255,0.08)",
                transition: "border-color 0.2s, background 0.2s",
              }}
            >
              {editingQuery ? (
                <textarea
                  ref={queryRef}
                  value={query}
                  onChange={e => { setQuery(e.target.value); autoResize(e.target); }}
                  rows={3}
                  className="w-full bg-transparent outline-none resize-none px-4 py-3 text-[13px] leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.9)", minHeight: "72px", maxHeight: "160px" }}
                />
              ) : (
                <p
                  className="px-4 py-3 text-[13px] leading-relaxed"
                  style={{ color: query ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                >
                  {query || "Запрос не указан"}
                </p>
              )}
            </div>
          </div>

          {/* Блок дополнений */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>
                Дополнения
              </span>
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>необязательно</span>
            </div>

            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", transition: "border-color 0.2s" }}
            >
              <textarea
                ref={commentRef}
                value={comment}
                onChange={e => { setComment(e.target.value); autoResize(e.target); }}
                placeholder="ФИО сторон, суммы, даты, адреса, обстоятельства…"
                rows={3}
                className="w-full bg-transparent outline-none resize-none px-4 py-3 text-[13px] leading-relaxed placeholder:text-[rgba(255,255,255,0.22)]"
                style={{ color: "rgba(255,255,255,0.85)", minHeight: "72px", maxHeight: "140px" }}
                onFocus={e => {
                  (e.target.closest("div") as HTMLElement).style.borderColor = "rgba(232,168,32,0.35)";
                  (e.target.closest("div") as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                }}
                onBlur={e => {
                  (e.target.closest("div") as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
                  (e.target.closest("div") as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                }}
              />
            </div>
          </div>

          {/* Блок документов */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Документы
                </span>
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>до {MAX_FILES} файлов · PDF, DOC, DOCX</span>
              </div>
              {attachedFiles.length < MAX_FILES && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 text-[11px] font-medium transition-opacity hover:opacity-70"
                  style={{ color: "#e8a820" }}
                >
                  <Icon name="Paperclip" size={10} color="#e8a820" />
                  Прикрепить
                </button>
              )}
            </div>

            {/* Прикреплённые файлы */}
            {attachedFiles.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {attachedFiles.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                    style={{ background: "rgba(232,168,32,0.07)", border: "1px solid rgba(232,168,32,0.18)" }}
                  >
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(232,168,32,0.15)" }}>
                      <Icon name="FileText" size={11} color="#e8a820" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium truncate" style={{ color: "rgba(255,255,255,0.85)" }}>{f.name}</p>
                      <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{f.size} · AI прочитает и учтёт</p>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
                      style={{ background: "rgba(255,255,255,0.08)" }}
                    >
                      <Icon name="X" size={10} color="rgba(255,255,255,0.5)" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Зона добавления если файлов нет */}
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

            {fileError && (
              <p className="mt-1.5 text-[11px]" style={{ color: "#f87171" }}>{fileError}</p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </div>

        {/* Липкий футер */}
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
            disabled={!query.trim()}
            className="w-full py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{
              background: query.trim() ? "linear-gradient(135deg, #c97d10, #e8a820, #f5d060)" : "rgba(255,255,255,0.07)",
              color: query.trim() ? "#0a1628" : "rgba(255,255,255,0.2)",
              boxShadow: query.trim() ? "0 4px 20px rgba(232,168,32,0.35)" : "none",
              transition: "all 0.2s",
            }}
          >
            <Icon name="ArrowRight" size={17} color={query.trim() ? "#0a1628" : "rgba(255,255,255,0.2)"} />
            Выбрать способ оплаты
            {attachedFiles.length > 0 && (
              <span
                className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: "rgba(10,22,40,0.2)", color: "#0a1628" }}
              >
                +{attachedFiles.length} файл{attachedFiles.length > 1 ? "а" : ""}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}