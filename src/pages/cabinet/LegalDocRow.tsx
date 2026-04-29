import Icon from "@/components/ui/icon";
import { type LegalDoc } from "@/lib/auth";
import { fmtSize, fmtDate } from "./legalDocsConstants";

export default function DocRow({ doc, deleting, onDelete }: {
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
