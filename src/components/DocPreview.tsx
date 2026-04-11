const SECTION_LABELS: Record<string, string> = {
  ШАПКА: "", ЗАГОЛОВОК: "", ТЕЛО: "Обстоятельства дела",
  ТРЕБОВАНИЯ: "Просительная часть", ПРИЛОЖЕНИЯ: "Приложения",
  ПОДПИСЬ: "", ОБОСНОВАНИЕ: "Правовое обоснование", ПРИМЕЧАНИЯ: "Примечания",
};

export default function DocPreview({ content, fillValues }: { content: string; fillValues: Record<string, string> }) {
  const rendered = content.replace(/\{\{([^}]+)\}\}/g, (_, k) =>
    fillValues[k]?.trim() ? fillValues[k].trim() : `▢ ${k.replace(/_/g, " ")}`
  );

  const sections: { tag: string; text: string }[] = [];
  let cur = { tag: "RAW", text: "" };
  for (const line of rendered.split("\n")) {
    const m = line.match(/^\[([А-ЯA-Z_]+)\]$/);
    if (m) { sections.push(cur); cur = { tag: m[1], text: "" }; }
    else { cur.text += line + "\n"; }
  }
  sections.push(cur);

  const hasTags = sections.some((s) => s.tag !== "RAW");

  if (!hasTags) {
    return (
      <div className="font-serif text-[13px] leading-6 text-gray-800 space-y-1">
        {rendered.split("\n").map((line, i) => {
          if (!line.trim()) return <div key={i} className="h-2" />;
          const isSectionHead = /^[-─═]{3,}|^[А-Я\s]{5,}:?\s*$/.test(line.trim());
          return isSectionHead
            ? <p key={i} className="font-bold text-navy-700 mt-3 mb-1 uppercase tracking-wide text-[11px]">{line.trim()}</p>
            : <p key={i} className="text-justify indent-6">{line.trim()}</p>;
        })}
      </div>
    );
  }

  return (
    <div className="font-serif text-[13px] leading-6 text-gray-800 space-y-4">
      {sections.map((sec, idx) => {
        if (!sec.text.trim() && sec.tag === "RAW") return null;
        const lines = sec.text.trim().split("\n").filter(Boolean);

        if (sec.tag === "ШАПКА") return (
          <div key={idx} className="text-right text-[12px] text-gray-700 leading-5 space-y-0.5 border-r-2 border-navy-200 pr-3">
            {lines.map((l, i) => <p key={i}>{l}</p>)}
          </div>
        );

        if (sec.tag === "ЗАГОЛОВОК") return (
          <div key={idx} className="text-center py-3">
            <p className="font-bold text-[15px] text-navy-900 uppercase tracking-widest">{lines.join(" ")}</p>
            <div className="mt-2 h-0.5 bg-navy-700 mx-8" />
          </div>
        );

        if (sec.tag === "ТЕЛО") return (
          <div key={idx} className="space-y-2">
            {lines.map((l, i) => <p key={i} className="text-justify indent-8">{l}</p>)}
          </div>
        );

        if (sec.tag === "ТРЕБОВАНИЯ") return (
          <div key={idx}>
            <p className="font-bold text-navy-800 mb-1">ПРОШУ:</p>
            <ol className="list-decimal list-inside space-y-1 pl-2">
              {lines.map((l, i) => <li key={i} className="text-justify">{l.replace(/^\d+\.\s*/, "")}</li>)}
            </ol>
          </div>
        );

        if (sec.tag === "ПРИЛОЖЕНИЯ") return (
          <div key={idx} className="border-t border-dashed border-gray-300 pt-3">
            <p className="font-bold text-navy-800 mb-1 text-[11px] uppercase tracking-wide">Приложения:</p>
            <ul className="space-y-0.5 pl-2">
              {lines.map((l, i) => <li key={i} className="text-[12px] text-gray-700">• {l}</li>)}
            </ul>
          </div>
        );

        if (sec.tag === "ПОДПИСЬ") return (
          <div key={idx} className="text-right text-[12px] text-gray-700 mt-4 space-y-1 border-t border-gray-200 pt-3">
            {lines.map((l, i) => <p key={i}>{l}</p>)}
          </div>
        );

        if (sec.tag === "ОБОСНОВАНИЕ") return (
          <div key={idx} className="bg-blue-50 rounded-xl p-3 mt-2">
            <p className="font-bold text-navy-700 text-[11px] uppercase tracking-wide mb-1">Правовое обоснование</p>
            {lines.map((l, i) => <p key={i} className="text-[12px] text-gray-600 leading-5">{l}</p>)}
          </div>
        );

        if (sec.tag === "ПРИМЕЧАНИЯ") return (
          <div key={idx} className="bg-amber-50 rounded-xl p-3">
            <p className="font-bold text-amber-800 text-[11px] uppercase tracking-wide mb-1">Примечания</p>
            {lines.map((l, i) => <p key={i} className="text-[12px] text-amber-900 italic leading-5">{l}</p>)}
          </div>
        );

        return (
          <div key={idx} className="space-y-1">
            {sec.tag !== "RAW" && SECTION_LABELS[sec.tag] && (
              <p className="font-bold text-navy-700 text-[11px] uppercase tracking-wide">{SECTION_LABELS[sec.tag]}</p>
            )}
            {lines.map((l, i) => <p key={i} className="text-justify indent-6">{l}</p>)}
          </div>
        );
      })}
    </div>
  );
}
