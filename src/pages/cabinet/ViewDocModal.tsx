import Icon from "@/components/ui/icon";
import { type GenDoc } from "@/pages/cabinet/DocsTab";
import { downloadDoc } from "@/lib/docUtils";

interface ViewDocModalProps {
  doc: GenDoc;
  onClose: () => void;
}

export default function ViewDocModal({ doc, onClose }: ViewDocModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="FileText" size={18} className="text-navy-600" />
            <span className="font-semibold text-navy-800">{doc.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadDoc(doc.name, doc.content)}
              className="flex items-center gap-1.5 text-sm text-navy-600 hover:text-navy-800 font-medium px-3 py-1.5 rounded-xl hover:bg-navy-50 transition-colors"
            >
              <Icon name="Download" size={15} />
              Скачать .docx
            </button>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-muted-foreground hover:text-navy-700">
              <Icon name="X" size={16} />
            </button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <pre className="text-sm text-navy-700 leading-relaxed whitespace-pre-wrap font-sans">{doc.content}</pre>
        </div>
      </div>
    </div>
  );
}
