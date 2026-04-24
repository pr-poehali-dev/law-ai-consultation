import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { getLegalDocs, uploadLegalDoc, deleteLegalDoc, type LegalDoc } from "@/lib/auth";

const CATEGORIES = [
  { id: "case_law" as const, label: "Судебная практика", icon: "Gavel", color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
  { id: "state_duty" as const, label: "Госпошлины", icon: "Receipt", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
];

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function fmtDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AdminLegalDocs() {
  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<"case_law" | "state_duty">("case_law");
  const [showUpload, setShowUpload] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const all = await getLegalDocs();
    setDocs(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = docs.filter(d => d.category === activeCategory);
  const catInfo = CATEGORIES.find(c => c.id === activeCategory)!;

  return (
    <div className="bg-white rounded-2xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-navy-50 border border-navy-200 flex items-center justify-center">
            <Icon name="FolderOpen" size={18} className="text-navy-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-navy-800">Правовая база</h3>
            <p className="text-[11px] text-muted-foreground">Файлы для AI-консультаций</p>
          </div>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 btn-gold rounded-xl text-xs font-semibold"
        >
          <Icon name="Upload" size={13} />Загрузить
        </button>
      </div>

      {/* Табы категорий */}
      <div className="flex gap-2">
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              activeCategory === cat.id ? `${cat.bg} ${cat.border} ${cat.color}` : "bg-slate-50 border-border text-muted-foreground hover:bg-slate-100"
            }`}>
            <Icon name={cat.icon as Parameters<typeof Icon>[0]["name"]} size={12} />
            {cat.label}
            <span className="ml-0.5 bg-white/60 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
              {docs.filter(d => d.category === cat.id).length}
            </span>
          </button>
        ))}
      </div>

      {/* Список файлов */}
      {loading ? (
        <div className="py-6 text-center">
          <Icon name="Loader" size={20} className="animate-spin text-muted-foreground mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center">
          <Icon name="FolderOpen" size={32} className={`${catInfo.color} mx-auto mb-2 opacity-40`} />
          <p className="text-sm text-muted-foreground">Файлов нет</p>
          <p className="text-xs text-muted-foreground mt-1">Загрузите PDF или DOCX с {catInfo.label.toLowerCase()}</p>
          <button onClick={() => setShowUpload(true)}
            className="mt-3 text-xs px-4 py-2 rounded-xl btn-gold font-semibold">
            Загрузить первый файл
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => (
            <div key={doc.id} className={`flex items-start gap-3 p-3 rounded-xl border ${catInfo.border} ${catInfo.bg}`}>
              <div className={`shrink-0 w-8 h-8 rounded-lg bg-white flex items-center justify-center border ${catInfo.border}`}>
                <Icon name={doc.mime_type.includes("pdf") ? "FileText" : "FileType"} size={15} className={catInfo.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-navy-800 leading-tight">{doc.title}</p>
                {doc.description && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{doc.description}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground">{doc.filename}</span>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] text-muted-foreground">{fmtSize(doc.file_size)}</span>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] text-muted-foreground">{fmtDate(doc.created_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <a href={doc.download_url} target="_blank" rel="noreferrer"
                  className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-border transition-colors"
                  title="Скачать">
                  <Icon name="Download" size={13} className="text-muted-foreground" />
                </a>
                <button
                  onClick={async () => {
                    if (!confirm(`Удалить «${doc.title}»?`)) return;
                    setDeleting(doc.id);
                    await deleteLegalDoc(doc.id);
                    await load();
                    setDeleting(null);
                  }}
                  disabled={deleting === doc.id}
                  className="p-1.5 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                  title="Удалить">
                  {deleting === doc.id
                    ? <Icon name="Loader" size={13} className="animate-spin text-red-400" />
                    : <Icon name="Trash2" size={13} className="text-red-400" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Статус AI */}
      <div className="pt-2 border-t border-border">
        <div className="flex items-start gap-2">
          <Icon name="Info" size={13} className="text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            AI автоматически читает загруженные файлы при ответах в чате и генерации документов.
            Судебная практика — для всех документов. Госпошлины — для исков, жалоб, претензий.
          </p>
        </div>
      </div>

      {/* Модал загрузки */}
      {showUpload && (
        <UploadModal
          defaultCategory={activeCategory}
          onClose={() => setShowUpload(false)}
          onDone={() => { setShowUpload(false); load(); }}
        />
      )}
    </div>
  );
}

function UploadModal({ defaultCategory, onClose, onDone }: {
  defaultCategory: "case_law" | "state_duty";
  onClose: () => void;
  onDone: () => void;
}) {
  const [category, setCategory] = useState<"case_law" | "state_duty">(defaultCategory);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setError("Файл больше 10 МБ"); return; }
    setFile(f);
    setError("");
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setError("Укажите название"); return; }
    if (!file) { setError("Выберите файл"); return; }
    setUploading(true);
    setError("");
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await uploadLegalDoc({
        category, title: title.trim(), description: description.trim(),
        file: b64, filename: file.name,
      });
      if (result.error) { setError(result.error); setUploading(false); return; }
      onDone();
    } catch {
      setError("Ошибка загрузки");
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-navy-800">Загрузить документ</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-navy-700">
            <Icon name="X" size={16} />
          </button>
        </div>

        <div className="space-y-3">
          {/* Категория */}
          <div>
            <label className="text-xs font-semibold text-navy-700 block mb-1.5">Категория</label>
            <div className="flex gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setCategory(cat.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    category === cat.id ? `${cat.bg} ${cat.border} ${cat.color}` : "bg-slate-50 border-border text-muted-foreground"
                  }`}>
                  <Icon name={cat.icon as Parameters<typeof Icon>[0]["name"]} size={12} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Название */}
          <div>
            <label className="text-xs font-semibold text-navy-700 block mb-1">Название документа</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Постановление Пленума ВС РФ № 25..."
              className="w-full px-3 py-2 text-sm border border-border rounded-xl outline-none focus:border-navy-400 bg-slate-50" />
          </div>

          {/* Описание */}
          <div>
            <label className="text-xs font-semibold text-navy-700 block mb-1">Описание (необязательно)</label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              placeholder="О применении норм раздела I ГК РФ..."
              className="w-full px-3 py-2 text-sm border border-border rounded-xl outline-none focus:border-navy-400 bg-slate-50" />
          </div>

          {/* Файл */}
          <div>
            <label className="text-xs font-semibold text-navy-700 block mb-1">Файл (PDF, DOC, DOCX · до 10 МБ)</label>
            <div
              onClick={() => fileRef.current?.click()}
              className={`cursor-pointer border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
                file ? "border-emerald-300 bg-emerald-50" : "border-border hover:border-navy-300 bg-slate-50"
              }`}>
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <Icon name="FileCheck" size={16} className="text-emerald-500" />
                  <span className="text-xs font-medium text-emerald-700">{file.name}</span>
                  <span className="text-[11px] text-muted-foreground">({fmtSize(file.size)})</span>
                </div>
              ) : (
                <>
                  <Icon name="Upload" size={20} className="text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Нажмите или перетащите файл</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={handleFile} className="hidden" />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button onClick={handleSubmit} disabled={uploading || !file || !title.trim()}
            className="w-full py-2.5 btn-gold rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {uploading ? <><Icon name="Loader" size={14} className="animate-spin" />Загрузка...</> : <><Icon name="Upload" size={14} />Загрузить</>}
          </button>
        </div>
      </div>
    </div>
  );
}
