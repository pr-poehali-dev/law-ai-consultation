import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { getLegalDocs, uploadLegalDoc, deleteLegalDoc, type LegalDoc } from "@/lib/auth";

const YEARS = [2027, 2026, 2025, 2024];

const SUBCATEGORIES = [
  { id: "civil", label: "Гражданские дела", icon: "Scale", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  { id: "criminal", label: "Уголовные дела", icon: "AlertTriangle", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
  { id: "administrative", label: "Административные дела", icon: "FileText", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
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
  const [activeTab, setActiveTab] = useState<"case_law" | "state_duty">("case_law");
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set([YEARS[0]]));
  const [expandedSubcats, setExpandedSubcats] = useState<Set<string>>(new Set(["civil"]));
  const [showUpload, setShowUpload] = useState(false);
  const [uploadDefaults, setUploadDefaults] = useState<{ year?: number; subcategory?: string }>({});
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const all = await getLegalDocs();
    setDocs(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleYear = (year: number) => {
    setExpandedYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) { next.delete(year); } else { next.add(year); }
      return next;
    });
  };

  const toggleSubcat = (key: string) => {
    setExpandedSubcats(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };

  const openUpload = (year?: number, subcategory?: string) => {
    setUploadDefaults({ year, subcategory });
    setShowUpload(true);
  };

  const caseLawDocs = docs.filter(d => d.category === "case_law");
  const stateDutyDocs = docs.filter(d => d.category === "state_duty");

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
          onClick={() => openUpload()}
          className="flex items-center gap-1.5 px-3 py-1.5 btn-gold rounded-xl text-xs font-semibold"
        >
          <Icon name="Upload" size={13} />Загрузить
        </button>
      </div>

      {/* Табы */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("case_law")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
            activeTab === "case_law"
              ? "bg-purple-50 border-purple-200 text-purple-600"
              : "bg-slate-50 border-border text-muted-foreground hover:bg-slate-100"
          }`}
        >
          <Icon name="Gavel" size={12} />
          Судебная практика
          <span className="ml-0.5 bg-white/60 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
            {caseLawDocs.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("state_duty")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
            activeTab === "state_duty"
              ? "bg-blue-50 border-blue-200 text-blue-600"
              : "bg-slate-50 border-border text-muted-foreground hover:bg-slate-100"
          }`}
        >
          <Icon name="Receipt" size={12} />
          Госпошлины
          <span className="ml-0.5 bg-white/60 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
            {stateDutyDocs.length}
          </span>
        </button>
      </div>

      {loading ? (
        <div className="py-6 text-center">
          <Icon name="Loader" size={20} className="animate-spin text-muted-foreground mx-auto" />
        </div>
      ) : activeTab === "case_law" ? (
        <CaseLawTree
          docs={caseLawDocs}
          expandedYears={expandedYears}
          expandedSubcats={expandedSubcats}
          deleting={deleting}
          onToggleYear={toggleYear}
          onToggleSubcat={toggleSubcat}
          onUpload={openUpload}
          onDelete={async (doc) => {
            if (!confirm(`Удалить «${doc.title}»?`)) return;
            setDeleting(doc.id);
            await deleteLegalDoc(doc.id);
            await load();
            setDeleting(null);
          }}
        />
      ) : (
        <StateDutyList
          docs={stateDutyDocs}
          deleting={deleting}
          onUpload={() => openUpload(undefined, "")}
          onDelete={async (doc) => {
            if (!confirm(`Удалить «${doc.title}»?`)) return;
            setDeleting(doc.id);
            await deleteLegalDoc(doc.id);
            await load();
            setDeleting(null);
          }}
        />
      )}

      {/* Статус AI */}
      <div className="pt-2 border-t border-border">
        <div className="flex items-start gap-2">
          <Icon name="Info" size={13} className="text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            AI читает последние 3 файла из категории при каждом запросе. Более свежие файлы имеют приоритет.
            Судебная практика — для всех документов. Госпошлины — для исков и жалоб.
          </p>
        </div>
      </div>

      {showUpload && (
        <UploadModal
          defaultCategory={activeTab}
          defaultYear={uploadDefaults.year}
          defaultSubcategory={uploadDefaults.subcategory}
          onClose={() => setShowUpload(false)}
          onDone={() => { setShowUpload(false); load(); }}
        />
      )}
    </div>
  );
}

// ─── Дерево судебной практики ───────────────────────────────────────────────

function CaseLawTree({
  docs, expandedYears, expandedSubcats, deleting,
  onToggleYear, onToggleSubcat, onUpload, onDelete,
}: {
  docs: LegalDoc[];
  expandedYears: Set<number>;
  expandedSubcats: Set<string>;
  deleting: number | null;
  onToggleYear: (y: number) => void;
  onToggleSubcat: (k: string) => void;
  onUpload: (year: number, subcategory: string) => void;
  onDelete: (doc: LegalDoc) => void;
}) {
  const totalCount = docs.length;

  if (totalCount === 0) {
    return (
      <div className="py-8 text-center">
        <Icon name="Gavel" size={32} className="text-purple-400 mx-auto mb-2 opacity-40" />
        <p className="text-sm text-muted-foreground">Нет файлов судебной практики</p>
        <button onClick={() => onUpload(YEARS[0], "civil")}
          className="mt-3 text-xs px-4 py-2 rounded-xl btn-gold font-semibold">
          Загрузить первый файл
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {YEARS.map(year => {
        const yearDocs = docs.filter(d => d.doc_year === year);
        const isExpanded = expandedYears.has(year);

        return (
          <div key={year} className="border border-border rounded-xl overflow-hidden">
            {/* Год-заголовок */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => onToggleYear(year)}>
              <div className="flex items-center gap-2">
                <Icon name={isExpanded ? "ChevronDown" : "ChevronRight"} size={14} className="text-muted-foreground" />
                <Icon name="FolderOpen" size={14} className="text-navy-500" />
                <span className="text-xs font-bold text-navy-700">{year} год</span>
                <span className="text-[10px] text-muted-foreground bg-white border border-border rounded-full px-1.5 py-0.5 font-medium">
                  {yearDocs.length} файлов
                </span>
              </div>
              <button
                onClick={e => { e.stopPropagation(); onUpload(year, "civil"); }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200 transition-colors"
              >
                <Icon name="Plus" size={10} />
                Добавить
              </button>
            </div>

            {/* Подкатегории */}
            {isExpanded && (
              <div className="divide-y divide-border">
                {SUBCATEGORIES.map(subcat => {
                  const subcatDocs = yearDocs.filter(d => d.subcategory === subcat.id);
                  const treeKey = `${year}-${subcat.id}`;
                  const isSubExpanded = expandedSubcats.has(treeKey);

                  return (
                    <div key={subcat.id}>
                      {/* Подкатегория-заголовок */}
                      <div
                        className={`flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-slate-50 transition-colors`}
                        onClick={() => onToggleSubcat(treeKey)}
                      >
                        <div className="flex items-center gap-2">
                          <Icon name={isSubExpanded ? "ChevronDown" : "ChevronRight"} size={12} className="text-muted-foreground" />
                          <div className={`w-5 h-5 rounded-md ${subcat.bg} flex items-center justify-center`}>
                            <Icon name={subcat.icon as Parameters<typeof Icon>[0]["name"]} size={11} className={subcat.color} />
                          </div>
                          <span className="text-[11px] font-semibold text-navy-700">{subcat.label}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${subcat.bg} ${subcat.color} border ${subcat.border}`}>
                            {subcatDocs.length}
                          </span>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); onUpload(year, subcat.id); }}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold ${subcat.bg} ${subcat.color} border ${subcat.border} hover:opacity-80 transition-opacity`}
                        >
                          <Icon name="Plus" size={9} />
                          Загрузить
                        </button>
                      </div>

                      {/* Файлы подкатегории */}
                      {isSubExpanded && (
                        <div className="px-4 pb-2 space-y-1.5">
                          {subcatDocs.length === 0 ? (
                            <div className="py-3 text-center">
                              <p className="text-[11px] text-muted-foreground">Нет файлов</p>
                              <button
                                onClick={() => onUpload(year, subcat.id)}
                                className={`mt-1.5 text-[10px] px-3 py-1 rounded-lg font-semibold ${subcat.bg} ${subcat.color} border ${subcat.border}`}
                              >
                                Добавить первый
                              </button>
                            </div>
                          ) : (
                            subcatDocs.map(doc => (
                              <DocRow key={doc.id} doc={doc} deleting={deleting} onDelete={onDelete} />
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Файлы без подкатегории */}
                {yearDocs.filter(d => !d.subcategory).length > 0 && (
                  <div className="px-4 py-2">
                    <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider font-medium">Без подкатегории</p>
                    <div className="space-y-1.5">
                      {yearDocs.filter(d => !d.subcategory).map(doc => (
                        <DocRow key={doc.id} doc={doc} deleting={deleting} onDelete={onDelete} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Файлы без года */}
      {docs.filter(d => !d.doc_year).length > 0 && (
        <div className="border border-dashed border-border rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Без года</p>
          <div className="space-y-1.5">
            {docs.filter(d => !d.doc_year).map(doc => (
              <DocRow key={doc.id} doc={doc} deleting={deleting} onDelete={onDelete} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Список госпошлин ────────────────────────────────────────────────────────

function StateDutyList({ docs, deleting, onUpload, onDelete }: {
  docs: LegalDoc[];
  deleting: number | null;
  onUpload: () => void;
  onDelete: (doc: LegalDoc) => void;
}) {
  if (docs.length === 0) {
    return (
      <div className="py-8 text-center">
        <Icon name="Receipt" size={32} className="text-blue-400 mx-auto mb-2 opacity-40" />
        <p className="text-sm text-muted-foreground">Нет файлов госпошлин</p>
        <button onClick={onUpload} className="mt-3 text-xs px-4 py-2 rounded-xl btn-gold font-semibold">
          Загрузить первый файл
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {docs.map(doc => (
        <DocRow key={doc.id} doc={doc} deleting={deleting} onDelete={onDelete} />
      ))}
    </div>
  );
}

// ─── Строка документа ────────────────────────────────────────────────────────

function DocRow({ doc, deleting, onDelete }: {
  doc: LegalDoc;
  deleting: number | null;
  onDelete: (doc: LegalDoc) => void;
}) {
  return (
    <div className="flex items-start gap-2.5 p-2.5 rounded-xl border border-border bg-slate-50 hover:bg-white transition-colors">
      <div className="shrink-0 w-7 h-7 rounded-lg bg-white flex items-center justify-center border border-border">
        <Icon name={doc.mime_type.includes("pdf") ? "FileText" : "FileType"} size={13} className="text-navy-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-navy-800 leading-tight truncate">{doc.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground">{fmtSize(doc.file_size)}</span>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="text-[10px] text-muted-foreground">{fmtDate(doc.created_at)}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <a href={doc.download_url} target="_blank" rel="noreferrer"
          className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-border transition-colors"
          title="Скачать">
          <Icon name="Download" size={12} className="text-muted-foreground" />
        </a>
        <button
          onClick={() => onDelete(doc)}
          disabled={deleting === doc.id}
          className="p-1.5 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
          title="Удалить"
        >
          {deleting === doc.id
            ? <Icon name="Loader" size={12} className="animate-spin text-red-400" />
            : <Icon name="Trash2" size={12} className="text-red-400" />}
        </button>
      </div>
    </div>
  );
}

// ─── Модал загрузки ───────────────────────────────────────────────────────────

function UploadModal({ defaultCategory, defaultYear, defaultSubcategory, onClose, onDone }: {
  defaultCategory: "case_law" | "state_duty";
  defaultYear?: number;
  defaultSubcategory?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [category, setCategory] = useState<"case_law" | "state_duty">(defaultCategory);
  const [subcategory, setSubcategory] = useState(defaultSubcategory ?? "civil");
  const [docYear, setDocYear] = useState<number | "">(defaultYear ?? YEARS[0]);
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
      const res = await uploadLegalDoc({
        category,
        subcategory: category === "case_law" ? subcategory : "",
        doc_year: category === "case_law" && docYear ? Number(docYear) : null,
        title: title.trim(),
        description: description.trim(),
        file: b64,
        filename: file.name,
      });
      if (res.error) { setError(res.error); setUploading(false); return; }
      onDone();
    } catch {
      setError("Ошибка загрузки");
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-navy-800">Загрузить документ</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center">
            <Icon name="X" size={14} className="text-muted-foreground" />
          </button>
        </div>

        {/* Категория */}
        <div>
          <label className="text-[11px] font-semibold text-navy-700 mb-1.5 block">Раздел</label>
          <div className="flex gap-2">
            {[
              { id: "case_law" as const, label: "Судебная практика", icon: "Gavel" },
              { id: "state_duty" as const, label: "Госпошлины", icon: "Receipt" },
            ].map(c => (
              <button key={c.id} onClick={() => setCategory(c.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                  category === c.id
                    ? "bg-navy-50 border-navy-300 text-navy-700"
                    : "bg-slate-50 border-border text-muted-foreground hover:bg-slate-100"
                }`}>
                <Icon name={c.icon as Parameters<typeof Icon>[0]["name"]} size={12} />
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Год + подкатегория (только для судебной практики) */}
        {category === "case_law" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-navy-700 mb-1.5 block">Год практики</label>
              <select
                value={docYear}
                onChange={e => setDocYear(Number(e.target.value))}
                className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-slate-50 text-navy-800 font-medium focus:outline-none focus:ring-2 focus:ring-navy-300"
              >
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-navy-700 mb-1.5 block">Вид дела</label>
              <select
                value={subcategory}
                onChange={e => setSubcategory(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-slate-50 text-navy-800 font-medium focus:outline-none focus:ring-2 focus:ring-navy-300"
              >
                {SUBCATEGORIES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Название */}
        <div>
          <label className="text-[11px] font-semibold text-navy-700 mb-1.5 block">Название</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Например: Решение ВС РФ по трудовым спорам"
            className="w-full text-xs px-3 py-2.5 rounded-xl border border-border bg-slate-50 text-navy-800 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-navy-300"
          />
        </div>

        {/* Описание */}
        <div>
          <label className="text-[11px] font-semibold text-navy-700 mb-1.5 block">Описание <span className="text-muted-foreground font-normal">(необязательно)</span></label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Краткое описание содержания"
            rows={2}
            className="w-full text-xs px-3 py-2.5 rounded-xl border border-border bg-slate-50 text-navy-800 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-navy-300 resize-none"
          />
        </div>

        {/* Файл */}
        <div>
          <label className="text-[11px] font-semibold text-navy-700 mb-1.5 block">Файл (PDF, DOCX — до 10 МБ)</label>
          <div
            onClick={() => fileRef.current?.click()}
            className={`cursor-pointer flex items-center gap-3 px-3 py-3 rounded-xl border-2 border-dashed transition-colors ${
              file ? "border-green-300 bg-green-50" : "border-border bg-slate-50 hover:bg-slate-100"
            }`}
          >
            <Icon name={file ? "CheckCircle" : "Upload"} size={16} className={file ? "text-green-500" : "text-muted-foreground"} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-navy-700 truncate">{file ? file.name : "Нажмите для выбора"}</p>
              {file && <p className="text-[10px] text-muted-foreground mt-0.5">{fmtSize(file.size)}</p>}
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFile} />
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
            <Icon name="AlertCircle" size={13} className="text-red-500 shrink-0" />
            <p className="text-[11px] text-red-600">{error}</p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-border text-muted-foreground hover:bg-slate-50 transition-colors">
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploading}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold btn-gold flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {uploading
              ? <><Icon name="Loader" size={12} className="animate-spin" /> Загрузка...</>
              : <><Icon name="Upload" size={12} /> Загрузить</>}
          </button>
        </div>
      </div>
    </div>
  );
}