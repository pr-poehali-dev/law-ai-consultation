import Icon from "@/components/ui/icon";
import type { PdfResult, FileItem } from "./imageToPdfUtils";

interface Props {
  pdfResults: PdfResult[];
  docxFiles: FileItem[];
  sendingToAI: boolean;
  totalOut: number;
  filesCount: number;
  onDownloadOne: (blob: Blob, name: string) => void;
  onDownloadAll: () => void;
  onSendToAI: () => void;
}

export default function ImageToPdfResults({
  pdfResults, docxFiles, sendingToAI, totalOut, filesCount,
  onDownloadOne, onDownloadAll, onSendToAI,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <Icon name="Check" size={12} className="text-emerald-600" />
        </div>
        <p className="text-xs font-semibold text-navy-800">
          Готово — все {filesCount} файлов упакованы в {totalOut} пакета. AI прочитает всё содержимое.
        </p>
      </div>

      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2 text-slate-500 font-medium">Пакет</th>
              <th className="text-center px-2 py-2 text-slate-500 font-medium">Файлов</th>
              <th className="text-center px-2 py-2 text-slate-500 font-medium">Размер</th>
              <th className="text-center px-2 py-2 text-slate-500 font-medium">Статус</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {pdfResults.map((r, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="px-3 py-2.5 font-medium text-navy-800 max-w-[140px]">
                  <span className="flex items-center gap-1.5 truncate">
                    <Icon name="FileText" size={11} color="#dc2626" />{r.name}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-center text-slate-600">{r.pageCount}</td>
                <td className="px-2 py-2.5 text-center text-slate-600">{r.sizeMb} МБ</td>
                <td className="px-2 py-2.5 text-center"><span className="text-emerald-600 font-medium">✅ готов</span></td>
                <td className="px-2 py-2.5 text-right">
                  <button onClick={() => onDownloadOne(r.blob, r.name)} className="text-navy-600 hover:text-navy-800">
                    <Icon name="Download" size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {docxFiles.map((f, i) => (
              <tr key={`dx-${i}`} className={i < docxFiles.length - 1 ? "border-b border-slate-100" : ""}>
                <td className="px-3 py-2.5 font-medium text-navy-800 max-w-[140px]">
                  <span className="flex items-center gap-1.5 truncate">
                    <Icon name="FileSpreadsheet" size={11} color="#7c3aed" />{f.file.name}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-center text-slate-400">—</td>
                <td className="px-2 py-2.5 text-center text-slate-600">{Math.round(f.file.size / 1024 / 102.4) / 10} МБ</td>
                <td className="px-2 py-2.5 text-center"><span className="text-emerald-600 font-medium">✅ готов</span></td>
                <td className="px-2 py-2.5" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={onDownloadAll}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)", color: "white" }}
        >
          <Icon name="Download" size={14} />
          {totalOut === 1 ? "Скачать PDF" : "Скачать все (ZIP)"}
        </button>
        <button
          onClick={onSendToAI}
          disabled={sendingToAI}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#e8a820,#f5cc5a)", color: "#0a1628" }}
        >
          {sendingToAI
            ? <><span className="w-4 h-4 border-2 border-navy-800/30 border-t-navy-800 rounded-full animate-spin" />Отправляю...</>
            : <><Icon name="Upload" size={14} color="#0a1628" />Загрузить в чат</>}
        </button>
      </div>
    </div>
  );
}
