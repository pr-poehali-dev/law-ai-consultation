export type AiMsg = {
  role: "ai" | "user";
  text: string;
  isEdited?: boolean;
  editNum?: number;
  partialNote?: string;
  changesSummary?: string;
  stages?: number;
  isStageStatus?: boolean;
};

// 1 правка = 5 вопросов (документы не списываются)
export function calcEditCost(_docContent: string, _instruction: string) {
  return { docs: 0, questions: 5 };
}

// Парсим текст анализа AI на секции по двойному переносу
export function renderAnalysisText(text: string): React.ReactNode {
  const sections = text.split("\n\n").filter(Boolean);
  if (sections.length <= 1) {
    return <p className="text-[12.5px] text-slate-700 leading-relaxed whitespace-pre-wrap">{text}</p>;
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
          <div key={i} className={isEmoji ? "rounded-xl bg-slate-50 border border-slate-200 px-3 py-2" : ""}>
            {isEmoji && <p className="text-[11px] font-bold text-navy-700 mb-1">{head}</p>}
            {body
              ? <p className="text-[12px] text-slate-700 leading-relaxed whitespace-pre-wrap">{body}</p>
              : !isEmoji && <p className="text-[12.5px] text-slate-700 leading-relaxed">{head}</p>
            }
          </div>
        );
      })}
    </div>
  );
}
