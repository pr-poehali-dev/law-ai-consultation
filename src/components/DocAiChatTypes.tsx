export type AiMsg = {
  role: "ai" | "user";
  text: string;
  isEdited?: boolean;
  editNum?: number;
  partialNote?: string;
};

// 1 правка = 1 вопрос + 1 документ / 2500 символов
export function calcEditCost(docContent: string, instruction: string) {
  const docs = Math.max(1, Math.ceil((docContent.length + instruction.length) / 2500));
  return { docs, questions: 1 };
}

// Парсим текст анализа AI на секции по двойному переносу
export function renderAnalysisText(text: string): React.ReactNode {
  const sections = text.split("\n\n").filter(Boolean);
  if (sections.length <= 1) {
    return <p className="text-[12.5px] text-navy-200 leading-relaxed whitespace-pre-wrap">{text}</p>;
  }
  return (
    <div className="space-y-2.5">
      {sections.map((sec, i) => {
        const lines = sec.trim().split("\n");
        const head = lines[0];
        const body = lines.slice(1).join("\n").trim();
        const cp = head.codePointAt(0) ?? 0;
        const isEmoji = (cp >= 0x2600 && cp <= 0x27FF) || (cp >= 0x1F300 && cp <= 0x1FAFF);
        return (
          <div key={i} className={isEmoji ? "rounded-xl bg-navy-700/60 border border-navy-600/40 px-3 py-2" : ""}>
            {isEmoji && <p className="text-[11px] font-bold text-gold-400 mb-1">{head}</p>}
            {body
              ? <p className="text-[12px] text-navy-200 leading-relaxed whitespace-pre-wrap">{body}</p>
              : !isEmoji && <p className="text-[12.5px] text-navy-200 leading-relaxed">{head}</p>
            }
          </div>
        );
      })}
    </div>
  );
}
