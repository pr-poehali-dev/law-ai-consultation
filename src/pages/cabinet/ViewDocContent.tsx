import Icon from "@/components/ui/icon";
import { parseDocBlocks } from "./ViewDocUtils";

// Рендер строки основного текста (тело, доводы, описательная часть)
function BodyLine({ line, i }: { line: string; i: number }) {
  if (!line.trim()) return <div key={i} className="h-3" />;
  // Раздел с нумерацией "1. НАЗВАНИЕ РАЗДЕЛА"
  const sectionMatch = line.trim().match(/^(\d+)\.\s+([А-ЯЁ][А-ЯЁA-Z\s,./]{3,})$/);
  if (sectionMatch) return (
    <p key={i} className="font-bold text-navy-800 mt-5 mb-1 uppercase tracking-wide">{line.trim()}</p>
  );
  // Подпункт "1.1. текст"
  const subMatch = line.trim().match(/^(\d+\.\d+\.?)\s+(.+)/);
  if (subMatch) return (
    <p key={i} className="text-navy-700 leading-relaxed pl-5">
      <span className="font-semibold text-navy-600">{subMatch[1]}</span> {subMatch[2]}
    </p>
  );
  // Тире/маркер списка
  if (/^[-•–—]\s/.test(line.trim())) return (
    <p key={i} className="text-navy-700 leading-relaxed pl-5" style={{ textAlign: "justify" }}>{line.trim()}</p>
  );
  // Обычный абзац — отступ 1.25 см, по ширине
  return (
    <p key={i} className="text-navy-700 leading-relaxed" style={{ textIndent: "1.25cm", textAlign: "justify" }}>{line.trim()}</p>
  );
}

function DocBlock({ type, lines }: { type: string; lines: string[] }) {
  const text = lines.join("\n").trim();
  if (!text) return null;

  // Не показываем служебные блоки
  if (type === "ПРИМЕЧАНИЯ" || type === "ОБОСНОВАНИЕ") return null;

  if (type === "ШАПКА") return (
    <div className="text-right mb-6 space-y-0.5 border-b border-slate-100 pb-4">
      {lines.filter(l => l.trim()).map((l, i) => (
        <p key={i} className="text-navy-700 leading-snug text-sm">{l.trim()}</p>
      ))}
    </div>
  );

  if (type === "ЗАГОЛОВОК") return (
    <div className="text-center my-6">
      <h2 className="font-bold text-navy-900 uppercase tracking-wide leading-tight">{text}</h2>
      <div className="mt-2 mx-auto w-24 h-0.5 bg-gradient-to-r from-transparent via-navy-400 to-transparent" />
    </div>
  );

  // ТЕЛО — основной текст документа (описательная часть, доводы, доказательства и т.д.)
  if (type === "ТЕЛО") return (
    <div className="my-4 space-y-1">
      {lines.map((l, i) => <BodyLine key={i} line={l} i={i} />)}
    </div>
  );

  if (type === "ТРЕБОВАНИЯ") return (
    <div className="my-4">
      {lines.filter(l => l.trim()).map((l, i) => {
        const isHeader = /^(ПРОШУ|НА ОСНОВАНИИ|ТРЕБУЮ|ОБЯЗАТЬ|ПРОШУ СУД)/i.test(l.trim());
        if (isHeader) return (
          <p key={i} className="font-bold text-navy-800 uppercase tracking-wide mt-4 mb-2">{l.trim()}</p>
        );
        const numMatch = l.trim().match(/^(\d+)[.)]\s+(.+)/);
        if (numMatch) return (
          <div key={i} className="flex gap-2 mb-2 items-start pl-2">
            <span className="font-bold text-navy-700 shrink-0">{numMatch[1]}.</span>
            <p className="text-navy-700 leading-relaxed" style={{ textAlign: "justify" }}>{numMatch[2]}</p>
          </div>
        );
        return <p key={i} className="text-navy-700 mb-1 pl-4" style={{ textAlign: "justify" }}>{l.trim()}</p>;
      })}
    </div>
  );

  if (type === "ПРИЛОЖЕНИЯ") return (
    <div className="my-4 pt-3 border-t border-slate-200">
      <p className="font-semibold text-navy-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Icon name="Paperclip" size={13} />Приложения:
      </p>
      {lines.filter(l => l.trim()).map((l, i) => {
        const numMatch = l.trim().match(/^(\d+)[.)]\s+(.+)/);
        if (numMatch) return (
          <div key={i} className="flex gap-2 py-0.5 pl-2 items-start">
            <span className="text-navy-500 shrink-0 text-sm">{numMatch[1]}.</span>
            <p className="text-navy-700 text-sm">{numMatch[2]}</p>
          </div>
        );
        return <p key={i} className="text-navy-700 text-sm py-0.5 pl-4">{l.trim()}</p>;
      })}
    </div>
  );

  if (type === "ПОДПИСЬ") return (
    <div className="mt-8 pt-4 border-t border-slate-200">
      <div className="flex flex-col items-end gap-1">
        {lines.filter(l => l.trim()).map((l, i) => (
          <p key={i} className="text-navy-700 text-sm">{l.trim()}</p>
        ))}
      </div>
    </div>
  );

  // Любой неизвестный блок — рендерим как ТЕЛО
  return (
    <div className="my-3 space-y-1">
      {lines.map((l, i) => <BodyLine key={i} line={l} i={i} />)}
    </div>
  );
}

interface ViewDocContentProps {
  docDate: string;
  docFlash: boolean;
  currentDocContent: string;
  prevDocContent: string | null;
  contentRef: React.RefObject<HTMLDivElement>;
  docScrollRef: React.RefObject<HTMLDivElement>;
  editedAt?: string;
}

export default function ViewDocContent({
  docDate,
  docFlash,
  currentDocContent,
  prevDocContent,
  contentRef,
  docScrollRef,
  editedAt,
}: ViewDocContentProps) {
  const blocks = parseDocBlocks(currentDocContent);
  const hasBlocks = blocks.some(b => b.type !== "ТЕЛО");

  return (
    <div className="flex-1 overflow-y-auto" ref={contentRef}>
      <div className={`px-6 sm:px-8 pt-6 pb-4 border-b transition-all duration-700 ${docFlash ? "bg-gradient-to-b from-emerald-50 to-white border-emerald-100" : "bg-gradient-to-b from-slate-50 to-white border-slate-100"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-1 h-8 rounded-full bg-gradient-to-b transition-all duration-700 ${docFlash ? "from-emerald-500 to-teal-400" : "from-navy-600 to-navy-400"}`} />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Юрист AI · Документ</p>
              <p className="text-xs font-semibold text-navy-700">{docDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {docFlash ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-[10px] font-medium text-emerald-600">Обновлён AI</p>
              </>
            ) : editedAt ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <p className="text-[10px] font-medium text-amber-700">ред. {editedAt}</p>
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <p className="text-[10px] font-medium text-emerald-700">Готов к использованию</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div ref={docScrollRef} className="px-6 sm:px-10 py-6 font-serif" style={{ fontFamily: "'Times New Roman', Georgia, serif", fontSize: "12pt", lineHeight: "1.5" }}>
        {hasBlocks
          ? blocks.map((block, i) => <DocBlock key={i} type={block.type} lines={block.lines} />)
          : (() => {
              const prevLines = prevDocContent ? new Set(prevDocContent.split("\n")) : null;
              const changedCount = prevLines ? currentDocContent.split("\n").filter(l => l.trim() && !prevLines.has(l)).length : 0;
              let firstMarked = false;
              return (
                <div className="space-y-1.5">
                  {changedCount > 0 && (
                    <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 sticky top-0 z-10">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <p className="text-[11px] font-semibold text-emerald-700">
                        AI внёс изменения: {changedCount} строк обновлено · подсвечено зелёным
                      </p>
                    </div>
                  )}
                  {currentDocContent.split("\n").map((line, i) => {
                    if (!line.trim()) return <div key={i} className="h-2" />;
                    const isChanged = prevLines !== null && !prevLines.has(line);
                    const isFirst = isChanged && !firstMarked;
                    if (isFirst) firstMarked = true;
                    const isTitle = /^[А-ЯA-ZЁ][А-ЯA-ZЁ\s]{4,}$/.test(line.trim());
                    const changedClass = isChanged
                      ? "bg-emerald-50/80 border-l-[3px] border-emerald-500 pl-3 rounded-r-xl relative"
                      : "";
                    return isTitle
                      ? <p key={i} {...(isFirst ? { "data-changed": "1" } : {})}
                          className={`text-center font-bold text-navy-800 uppercase my-4 ${changedClass}`}>
                          {line.trim()}
                        </p>
                      : <p key={i} {...(isFirst ? { "data-changed": "1" } : {})}
                          className={`text-navy-700 leading-relaxed ${changedClass}`}
                          style={isChanged ? {} : { textIndent: "1.25cm", textAlign: "justify" }}>
                          {line.trim()}
                        </p>;
                  })}
                </div>
              );
            })()
        }
      </div>
    </div>
  );
}