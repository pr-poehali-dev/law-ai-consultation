import { useRef } from "react";
import Icon from "@/components/ui/icon";
import type { BizTool } from "./BusinessSidebar";

const ALLOWED_DOC_EXTS = [".pdf", ".doc", ".docx"];
const ALLOWED_ALL_EXTS = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];

interface BusinessInputProps {
  activeTool: BizTool;
  input: string;
  sending: boolean;
  err: string;
  attachedFile: { name: string; b64: string } | null;
  attachedFile2: { name: string; b64: string } | null;
  fileUploading: boolean;
  fillMode: boolean;
  fillValues: Record<string, string>;
  filledDoc: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onSetAttachedFile: (f: { name: string; b64: string } | null) => void;
  onSetAttachedFile2: (f: { name: string; b64: string } | null) => void;
  onSetFileUploading: (v: boolean) => void;
  onSetErr: (v: string) => void;
  onSetFillMode: (v: boolean) => void;
  onSetFillValues: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  onApplyFillValues: () => void;
  adjustTextarea: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

export function downloadAsDoc(text: string, filename: string) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${filename}</title>
<style>
  body { font-family: "Times New Roman", serif; font-size: 14pt; margin: 2cm 1.5cm 2cm 3cm; line-height: 1.0; }
  h1, h2, h3 { font-family: Arial, sans-serif; font-size: 16pt; font-weight: bold; text-align: center; text-transform: uppercase; }
  p { text-indent: 1.25cm; margin: 0 0 6pt 0; text-align: justify; }
  .no-indent { text-indent: 0; }
</style></head><body>
${text.split("\n").map(line => {
  if (!line.trim()) return "<p>&nbsp;</p>";
  if (/^\[ЗАГОЛОВОК\]|^\[СТОРОНЫ\]/.test(line)) return `<h2>${line.replace(/^\[.+\]\s*/, "")}</h2>`;
  if (/^#{1,3}\s/.test(line)) return `<h2>${line.replace(/^#+\s/, "")}</h2>`;
  return `<p>${line}</p>`;
}).join("")}
</body></html>`;
  const blob = new Blob(["\ufeff" + html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${filename}.doc`; a.click();
  URL.revokeObjectURL(url);
}

export default function BusinessInput({
  activeTool, input, sending, err,
  attachedFile, attachedFile2, fileUploading,
  fillMode, fillValues, filledDoc,
  onInputChange, onSend,
  onSetAttachedFile, onSetAttachedFile2, onSetFileUploading, onSetErr,
  onSetFillMode, onSetFillValues, onApplyFillValues,
  adjustTextarea, textareaRef,
}: BusinessInputProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const fileRef2 = useRef<HTMLInputElement>(null);

  const needsFile1 = activeTool === "doc_analyze" || activeTool === "doc_compare" || activeTool === "chat";
  const needsFile2 = activeTool === "doc_compare";
  const isDocOnly = activeTool === "doc_analyze" || activeTool === "doc_compare";

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, which: 1 | 2) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    const allowed = isDocOnly ? ALLOWED_DOC_EXTS : ALLOWED_ALL_EXTS;
    if (!allowed.includes(ext)) {
      onSetErr(`Допустимые форматы: ${allowed.join(", ")}`);
      return;
    }
    onSetFileUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(",")[1];
      if (which === 1) onSetAttachedFile({ name: file.name, b64 });
      else onSetAttachedFile2({ name: file.name, b64 });
      onSetFileUploading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const placeholder =
    activeTool === "counterparty" ? "Введите ИНН или название компании для проверки..."
    : activeTool === "contract" ? "Опишите стороны и условия договора..."
    : activeTool === "doc_analyze" ? "Что именно проверить? (необязательно)"
    : activeTool === "doc_compare" ? "На что обратить особое внимание при сравнении?"
    : activeTool === "orders" ? "Вид приказа/документа и ключевые параметры..."
    : activeTool === "pretension" ? "Опишите нарушение или вид претензии (получили/направляем)..."
    : "Задайте юридический вопрос для вашего бизнеса...";

  return (
    <>
      {err && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2 shrink-0">
          <Icon name="AlertCircle" size={12} className="shrink-0"/>{err}
        </div>
      )}

      {/* Файловые кнопки */}
      {needsFile1 && (
        <div className="flex gap-2 flex-wrap shrink-0">
          <input ref={fileRef} type="file"
            accept={isDocOnly ? ".pdf,.doc,.docx" : ".pdf,.doc,.docx,.jpg,.jpeg,.png"}
            className="hidden" onChange={e => handleFile(e, 1)}/>
          {attachedFile ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
              <Icon name="FileCheck" size={12}/>
              <span className="truncate max-w-32">{attachedFile.name}</span>
              <button onClick={() => onSetAttachedFile(null)} className="text-emerald-500 hover:text-red-500 ml-1"><Icon name="X" size={11}/></button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={fileUploading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-border hover:border-navy-300 rounded-xl text-xs text-navy-600 transition-all disabled:opacity-50">
              <Icon name="Upload" size={12}/>
              {isDocOnly ? "Загрузить PDF/DOC" : "Загрузить документ или фото"}
            </button>
          )}
          {needsFile2 && (
            <>
              <input ref={fileRef2} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => handleFile(e, 2)}/>
              {attachedFile2 ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
                  <Icon name="FileCheck" size={12}/>
                  <span className="truncate max-w-32">{attachedFile2.name}</span>
                  <button onClick={() => onSetAttachedFile2(null)} className="text-emerald-500 hover:text-red-500 ml-1"><Icon name="X" size={11}/></button>
                </div>
              ) : (
                <button onClick={() => fileRef2.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-border hover:border-navy-300 rounded-xl text-xs text-navy-600 transition-all">
                  <Icon name="Upload" size={12}/>Второй документ (PDF/DOC)
                </button>
              )}
            </>
          )}
          {isDocOnly && <span className="text-[10px] text-muted-foreground self-center">· только PDF, DOC, DOCX</span>}
        </div>
      )}

      {/* Режим дозаполнения плейсхолдеров */}
      {fillMode && (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 shrink-0 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="PenLine" size={14} className="text-teal-700" />
              <span className="text-sm font-semibold text-teal-800">Заполните реквизиты</span>
            </div>
            <button onClick={() => onSetFillMode(false)} className="text-teal-500 hover:text-teal-700 transition-colors">
              <Icon name="X" size={14}/>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {Object.keys(fillValues).map(key => (
              <div key={key}>
                <label className="text-[10px] font-medium text-teal-700 uppercase tracking-wide block mb-0.5">{key.replace(/_/g," ")}</label>
                <input value={fillValues[key]}
                  onChange={e => onSetFillValues(p => ({...p, [key]: e.target.value}))}
                  placeholder={`{{${key}}}`}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-teal-200 bg-white outline-none focus:border-teal-500 transition-colors"/>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={onApplyFillValues}
              className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition-colors">
              Применить и обновить
            </button>
            <button onClick={() => downloadAsDoc(filledDoc, activeTool === "orders" ? "Приказ" : "Договор")}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-teal-300 text-teal-700 text-xs font-semibold rounded-xl hover:bg-teal-50 transition-colors">
              <Icon name="Download" size={12}/>Скачать .doc
            </button>
          </div>
        </div>
      )}

      {/* Поле ввода */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm shrink-0 overflow-hidden">
        <div className="flex items-end gap-2 px-3 py-2.5">
          <textarea ref={textareaRef} rows={1} value={input}
            onChange={e => { onInputChange(e.target.value); adjustTextarea(); }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            disabled={sending}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-navy-800 placeholder:text-slate-400 text-sm outline-none resize-none leading-relaxed py-1"
            style={{minHeight:"24px", maxHeight:"130px"}}/>
          <button onClick={onSend} disabled={sending || (!input.trim() && !attachedFile)}
            className="w-9 h-9 bg-navy-700 hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all shrink-0 shadow-sm">
            {sending
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
              : <Icon name="Send" size={15} className="text-white"/>}
          </button>
        </div>
        <div className="px-4 pb-2 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground/50">Enter — отправить · Shift+Enter — новая строка</p>
          <p className="text-[10px] text-muted-foreground/40">История: 24 часа</p>
        </div>
      </div>
    </>
  );
}
