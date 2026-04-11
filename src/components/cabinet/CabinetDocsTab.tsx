import Icon from "@/components/ui/icon";

interface DocType {
  id: string;
  label: string;
  icon: string;
  price: number;
}

interface Document {
  id: number;
  name: string;
  date: string;
  type: "PDF" | "DOCX";
  content?: string;
}

interface CabinetDocsTabProps {
  docType: DocType;
  docTypes: DocType[];
  docDetails: string;
  generatingDoc: boolean;
  generatedDoc: string | null;
  docError: string | null;
  documents: Document[];
  onDocTypeChange: (dt: DocType) => void;
  onDocDetailsChange: (value: string) => void;
  onGenerate: () => void;
  onDownload: (name: string, content: string) => void;
}

export default function CabinetDocsTab({
  docType,
  docTypes,
  docDetails,
  generatingDoc,
  generatedDoc,
  docError,
  documents,
  onDocTypeChange,
  onDocDetailsChange,
  onGenerate,
  onDownload,
}: CabinetDocsTabProps) {
  return (
    <div className="max-w-3xl space-y-6">
      {/* Doc generator */}
      <div className="bg-card rounded-3xl border border-border p-6">
        <h3 className="font-cormorant font-bold text-2xl text-navy-800 mb-1">Создать документ</h3>
        <p className="text-sm text-muted-foreground mb-5">AI сформирует готовый юридический документ по вашим данным</p>

        {/* Type selector */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-5">
          {docTypes.map((dt) => (
            <button
              key={dt.id}
              onClick={() => onDocTypeChange(dt)}
              className={`flex items-center gap-2 p-3 rounded-2xl border text-left transition-all ${
                docType.id === dt.id ? "border-navy-600 bg-navy-50" : "border-border hover:border-navy-200"
              }`}
            >
              <Icon name={dt.icon} size={16} className={docType.id === dt.id ? "text-navy-700" : "text-muted-foreground"} />
              <div>
                <div className={`text-xs font-medium leading-tight ${docType.id === dt.id ? "text-navy-800" : "text-navy-700"}`}>{dt.label}</div>
                <div className="text-[10px] text-muted-foreground">{dt.price} ₽</div>
              </div>
            </button>
          ))}
        </div>

        <textarea
          value={docDetails}
          onChange={(e) => onDocDetailsChange(e.target.value)}
          placeholder={`Опишите ситуацию для составления документа «${docType.label}»...\n\nНапример: Иванов И.И. должен мне 50 000 рублей по договору займа от 01.01.2025, срок возврата прошёл, на звонки не отвечает.`}
          rows={4}
          className="w-full bg-slate-50 border border-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors resize-none mb-4"
        />

        {docError && (
          <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">{docError}</div>
        )}

        <button
          onClick={onGenerate}
          disabled={generatingDoc || !docDetails.trim()}
          className="btn-gold w-full py-3.5 rounded-2xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {generatingDoc ? (
            <>
              <span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" />
              <span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" />
              <span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" />
            </>
          ) : (
            <>
              <Icon name="Zap" size={16} />
              Создать бесплатно
            </>
          )}
        </button>
      </div>

      {/* Generated doc */}
      {generatedDoc && (
        <div className="bg-card rounded-3xl border border-emerald-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Icon name="CheckCircle" size={18} className="text-emerald-500" />
              <span className="font-semibold text-navy-800">{docType.label} — готов!</span>
            </div>
            <button
              onClick={() => onDownload(docType.label, generatedDoc)}
              className="flex items-center gap-2 text-sm text-navy-600 hover:text-navy-800 font-medium px-3 py-1.5 rounded-xl hover:bg-navy-50 transition-colors"
            >
              <Icon name="Download" size={15} />
              Скачать .docx
            </button>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 text-sm text-navy-700 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto scrollbar-hide font-mono text-xs">
            {generatedDoc}
          </div>
        </div>
      )}

      {/* Doc history */}
      {documents.length > 0 && (
        <div>
          <h4 className="font-semibold text-navy-800 mb-3 text-sm">Ранее созданные документы</h4>
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="bg-card rounded-2xl border border-border p-4 flex items-center justify-between hover:border-navy-200 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${doc.type === "PDF" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                    {doc.type}
                  </div>
                  <div>
                    <div className="font-medium text-navy-800 text-sm">{doc.name}</div>
                    <div className="text-xs text-muted-foreground">{doc.date}</div>
                  </div>
                </div>
                <button
                  onClick={() => doc.content && onDownload(doc.name, doc.content)}
                  className="flex items-center gap-2 text-sm text-navy-600 hover:text-navy-800 font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-navy-50"
                >
                  <Icon name="Download" size={15} />
                  Скачать .docx
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}