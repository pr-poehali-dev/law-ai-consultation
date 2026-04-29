import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { uploadLegalDoc } from "@/lib/auth";
import { YEARS, SUBCATEGORIES, fmtSize } from "./legalDocsConstants";

export default function UploadModal({ defaultCategory, defaultYear, defaultSubcategory, onClose, onDone }: {
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
  const [courtName, setCourtName] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
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
        court_name: category === "case_law" ? courtName.trim() : undefined,
        case_number: category === "case_law" ? caseNumber.trim() : undefined,
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

        {/* Суд + Номер дела (только для судебной практики) */}
        {category === "case_law" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-navy-700 mb-1.5 block">Суд <span className="text-muted-foreground font-normal">(необязательно)</span></label>
              <input
                value={courtName}
                onChange={e => setCourtName(e.target.value)}
                placeholder="Например: Мосгорсуд"
                className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-slate-50 text-navy-800 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-navy-300"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-navy-700 mb-1.5 block">Номер дела <span className="text-muted-foreground font-normal">(необязательно)</span></label>
              <input
                value={caseNumber}
                onChange={e => setCaseNumber(e.target.value)}
                placeholder="Например: А40-123456/2024"
                className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-slate-50 text-navy-800 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-navy-300"
              />
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