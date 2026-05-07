import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { type GenDoc } from "@/pages/cabinet/DocsTab";
import { downloadDoc } from "@/lib/docUtils";
import { sendReport, getUser, lawyerSend } from "@/lib/auth";
import ExpertMaxOfferModal from "@/components/ExpertMaxOfferModal";
import DocAssistantPanel from "@/components/DocAssistantPanel";

interface ViewDocModalProps {
  doc: GenDoc;
  onClose: () => void;
}

// Парсим блоки [БЛОК] из содержимого документа для красивого отображения
function parseDocBlocks(content: string): { type: string; lines: string[] }[] {
  const result: { type: string; lines: string[] }[] = [];
  let current: { type: string; lines: string[] } = { type: "ТЕЛО", lines: [] };

  for (const raw of content.split("\n")) {
    const match = raw.match(/^\[([А-ЯA-Z_]+)\]$/);
    if (match) {
      if (current.lines.some(l => l.trim())) result.push(current);
      current = { type: match[1], lines: [] };
    } else {
      current.lines.push(raw);
    }
  }
  if (current.lines.some(l => l.trim())) result.push(current);
  return result;
}

function DocBlock({ type, lines }: { type: string; lines: string[] }) {
  const text = lines.join("\n").trim();
  if (!text) return null;

  if (type === "ШАПКА") {
    return (
      <div className="text-right mb-6 space-y-0.5">
        {lines.filter(l => l.trim()).map((l, i) => (
          <p key={i} className="text-sm text-navy-700 leading-relaxed">{l.trim()}</p>
        ))}
      </div>
    );
  }

  if (type === "ЗАГОЛОВОК") {
    return (
      <div className="text-center my-8">
        <h2 className="font-cormorant font-bold text-2xl text-navy-900 uppercase tracking-wide leading-tight">
          {text}
        </h2>
        <div className="mt-3 mx-auto w-24 h-0.5 bg-gradient-to-r from-transparent via-navy-400 to-transparent" />
      </div>
    );
  }

  if (type === "ТРЕБОВАНИЯ") {
    return (
      <div className="my-5">
        {lines.filter(l => l.trim()).map((l, i) => {
          const isHeader = /^(ПРОШУ|НА ОСНОВАНИИ|ТРЕБУЮ)/i.test(l.trim());
          if (isHeader) return (
            <p key={i} className="font-bold text-navy-800 text-sm uppercase tracking-wide mb-2">{l.trim()}</p>
          );
          const numMatch = l.trim().match(/^(\d+)\.\s+(.+)/);
          if (numMatch) return (
            <div key={i} className="flex gap-3 mb-2 items-start pl-2">
              <span className="w-5 h-5 rounded-full bg-navy-700 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{numMatch[1]}</span>
              <p className="text-sm text-navy-700 leading-relaxed">{numMatch[2]}</p>
            </div>
          );
          return <p key={i} className="text-sm text-navy-700 mb-1 pl-2">{l.trim()}</p>;
        })}
      </div>
    );
  }

  if (type === "ПРИЛОЖЕНИЯ") {
    return (
      <div className="my-5 p-4 bg-slate-50 rounded-2xl border border-slate-200">
        <p className="text-xs font-semibold text-navy-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Icon name="Paperclip" size={12} />Приложения
        </p>
        {lines.filter(l => l.trim()).map((l, i) => (
          <p key={i} className="text-sm text-navy-700 py-0.5">{l.trim()}</p>
        ))}
      </div>
    );
  }

  if (type === "ПОДПИСЬ") {
    return (
      <div className="mt-10 pt-6 border-t border-slate-200">
        <div className="flex flex-col items-end gap-1">
          {lines.filter(l => l.trim()).map((l, i) => (
            <p key={i} className="text-sm text-navy-700">{l.trim()}</p>
          ))}
        </div>
      </div>
    );
  }

  if (type === "ОБОСНОВАНИЕ") {
    return (
      <div className="mt-6 p-4 bg-navy-50 rounded-2xl border border-navy-100">
        <p className="text-xs font-semibold text-navy-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Icon name="BookOpen" size={12} />Правовое обоснование
        </p>
        {lines.filter(l => l.trim()).map((l, i) => (
          <p key={i} className="text-xs text-navy-600 leading-relaxed">{l.trim()}</p>
        ))}
      </div>
    );
  }

  if (type === "ПРИМЕЧАНИЯ") {
    return (
      <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Icon name="AlertCircle" size={12} />Примечания
        </p>
        {lines.filter(l => l.trim()).map((l, i) => (
          <p key={i} className="text-xs text-amber-700 leading-relaxed italic">{l.trim()}</p>
        ))}
      </div>
    );
  }

  // ТЕЛО — основной текст
  return (
    <div className="my-4 space-y-2">
      {lines.map((l, i) => {
        if (!l.trim()) return <div key={i} className="h-2" />;
        // Заголовки разделов (1. ПРЕДМЕТ ДОГОВОРА)
        const sectionMatch = l.trim().match(/^(\d+)\.\s+([А-ЯA-ZЁ][А-ЯA-ZЁ\s,/]{3,})$/);
        if (sectionMatch) return (
          <p key={i} className="font-bold text-navy-800 text-sm mt-4 mb-1 uppercase tracking-wide">{l.trim()}</p>
        );
        // Подпункты (1.1.)
        const subMatch = l.trim().match(/^(\d+\.\d+\.?)\s+(.+)/);
        if (subMatch) return (
          <p key={i} className="text-sm text-navy-700 leading-relaxed pl-4">
            <span className="font-semibold text-navy-600">{subMatch[1]}</span> {subMatch[2]}
          </p>
        );
        return <p key={i} className="text-sm text-navy-700 leading-relaxed indent-6">{l.trim()}</p>;
      })}
    </div>
  );
}

export default function ViewDocModal({ doc, onClose }: ViewDocModalProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [showExpertOffer, setShowExpertOffer] = useState(false);
  const [sendingToLawyer, setSendingToLawyer] = useState(false);
  const [sentToLawyer, setSentToLawyer] = useState(false);
  // DocAssistantPanel: показывать рекомендации при наличии, AI-помощник по кнопке
  const hasRecs = (doc.recommendations?.length ?? 0) > 0;
  const [showAssistant, setShowAssistant] = useState(hasRecs);
  const [assistantMode, setAssistantMode] = useState<"recs" | "ai">("recs");
  const [currentDocContent, setCurrentDocContent] = useState(doc.content);

  const handleSendReport = async () => {
    if (!reportText.trim()) return;
    setReportLoading(true);
    await sendReport(reportText.trim());
    setReportLoading(false);
    setReportSent(true);
    setReportText("");
  };

  const handleCloseReport = () => {
    setReportOpen(false);
    setReportSent(false);
    setReportText("");
  };

  const handleSendToLawyer = async () => {
    const user = await getUser();
    if (!user || !user.paidExpert) {
      setShowExpertOffer(true);
      return;
    }
    setSendingToLawyer(true);
    await lawyerSend({
      body: `Прошу проверить документ: ${doc.name}`,
      attachment_type: "document",
      attachment_name: doc.name,
      attachment_content: doc.content,
    });
    setSendingToLawyer(false);
    setSentToLawyer(true);
  };

  const handleExpertOfferSuccess = async () => {
    setShowExpertOffer(false);
    await handleSendToLawyer();
  };

  const blocks = parseDocBlocks(currentDocContent);
  const hasBlocks = blocks.some(b => b.type !== "ТЕЛО");

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(doc.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Блокируем прокрутку body
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-250 ${visible ? "bg-black/60 backdrop-blur-sm" : "bg-transparent"}`}
      onClick={handleClose}
    >
      <div
        className={`bg-white w-full sm:rounded-3xl sm:max-w-2xl flex flex-col shadow-2xl transition-all duration-250 ease-out
          ${visible ? "translate-y-0 opacity-100 scale-100" : "translate-y-8 opacity-0 scale-[0.97]"}
          max-h-[95dvh] sm:max-h-[88vh] rounded-t-3xl`}
        onClick={e => e.stopPropagation()}
      >
        {/* Шапка модального окна */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="w-9 h-9 gradient-navy rounded-xl flex items-center justify-center shrink-0">
            <Icon name="FileText" size={16} className="text-gold-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-navy-800 text-sm truncate">{doc.name}</p>
            <p className="text-[11px] text-muted-foreground">{doc.date} · Предпросмотр документа</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleCopy}
              title="Копировать текст"
              className="h-8 px-3 rounded-xl text-xs font-medium text-navy-600 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
            >
              <Icon name={copied ? "Check" : "Copy"} size={13} className={copied ? "text-emerald-500" : ""} />
              <span className="hidden sm:inline">{copied ? "Скопировано" : "Копировать"}</span>
            </button>
            <button
              onClick={() => downloadDoc(doc.name, doc.content)}
              className="h-8 px-3 rounded-xl text-xs font-medium bg-navy-700 hover:bg-navy-800 text-white transition-colors flex items-center gap-1.5"
            >
              <Icon name="Download" size={13} />
              <span className="hidden sm:inline">Скачать .docx</span>
            </button>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-muted-foreground hover:text-navy-700 transition-colors"
            >
              <Icon name="X" size={16} />
            </button>
          </div>
        </div>

        {/* Контент документа */}
        <div className="flex-1 overflow-y-auto" ref={contentRef}>
          {/* Деловая шапка документа */}
          <div className="bg-gradient-to-b from-slate-50 to-white px-8 pt-8 pb-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-1 h-8 rounded-full bg-gradient-to-b from-navy-600 to-navy-400" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Юрист AI · Документ</p>
                  <p className="text-xs font-semibold text-navy-700">{doc.date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground">Статус</p>
                <div className="flex items-center gap-1 justify-end">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <p className="text-[10px] font-medium text-emerald-700">Готов к использованию</p>
                </div>
              </div>
            </div>
          </div>

          {/* Сам документ */}
          <div className="px-6 sm:px-10 py-6 font-serif" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
            {hasBlocks ? (
              blocks.map((block, i) => (
                <DocBlock key={i} type={block.type} lines={block.lines} />
              ))
            ) : (
              // Fallback — красивый рендер без блоков
              <div className="space-y-2">
                {currentDocContent.split("\n").map((line, i) => {
                  if (!line.trim()) return <div key={i} className="h-2" />;
                  const isTitle = /^[А-ЯA-ZЁ][А-ЯA-ZЁ\s]{4,}$/.test(line.trim());
                  if (isTitle) return (
                    <p key={i} className="text-center font-bold text-navy-800 text-lg uppercase my-4">{line.trim()}</p>
                  );
                  return (
                    <p key={i} className="text-sm text-navy-700 leading-relaxed indent-6">{line.trim()}</p>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Нижняя панель */}
        <div className="border-t border-slate-100 px-4 sm:px-5 py-3 shrink-0 bg-slate-50/80 rounded-b-3xl space-y-2">
          {/* Кнопка отправки юристу */}
          {sentToLawyer ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-emerald-50 border border-emerald-200">
              <Icon name="CheckCircle" size={14} className="text-emerald-600 shrink-0" />
              <p className="text-xs font-medium text-emerald-700">Отправлен юристу — ответ в разделе «Юрист»</p>
            </div>
          ) : (
            <button
              onClick={handleSendToLawyer}
              disabled={sendingToLawyer}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #0a1628, #162d5a)", border: "1px solid rgba(232,168,32,0.3)", color: "#f0c060" }}
            >
              {sendingToLawyer
                ? <><span className="w-3.5 h-3.5 border-2 border-gold-400/40 border-t-gold-400 rounded-full animate-spin" />Отправляю...</>
                : <><Icon name="UserCheck" size={13} color="#f0c060" />Отправить на проверку юристу</>
              }
            </button>
          )}

          {/* Кнопка AI-помощника */}
          <button
            onClick={() => { setAssistantMode("ai"); setShowAssistant(true); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white transition-all active:scale-95 shadow-sm"
          >
            <Icon name="BrainCircuit" size={13} />
            Подключить AI-помощника
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-[9px] font-bold">Профи+</span>
          </button>
          <p className="text-[10px] text-slate-400 text-center leading-snug px-2">
            Анализ документа · Оценка перспективы · Судебная практика · Редактирование
          </p>

          <div className="flex items-center justify-between gap-2 pt-1">
            <button onClick={() => setReportOpen(true)} className="text-[10px] text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors">
              <Icon name="AlertTriangle" size={10} />Проблема
            </button>
            <div className="flex gap-2">
              {hasRecs && (
                <button
                  onClick={() => { setAssistantMode("recs"); setShowAssistant(v => !v); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors"
                >
                  <Icon name="Sparkles" size={11} />
                  Рекомендации{doc.recommendations?.length ? ` (${doc.recommendations.length})` : ""}
                </button>
              )}
              <button onClick={handleClose} className="text-xs text-navy-600 hover:text-navy-800 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-navy-200 hover:bg-white transition-colors font-medium">Закрыть</button>
              <button onClick={() => downloadDoc(doc.name, currentDocContent)} className="btn-gold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-semibold">
                <Icon name="Download" size={12} />Скачать
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DocAssistantPanel — всплывает снизу-справа внутри модалки */}
      {showAssistant && (
        <DocAssistantPanel
          doc={{ name: doc.name, content: currentDocContent, recommendations: doc.recommendations }}
          initialMode={assistantMode}
          onClose={() => setShowAssistant(false)}
          onPaymentRequired={() => {}}
          onDocUpdated={(newContent) => setCurrentDocContent(newContent)}
        />
      )}

      {/* Модалка: оффер Максимум */}
      {showExpertOffer && (
        <ExpertMaxOfferModal
          context="doc"
          onClose={() => setShowExpertOffer(false)}
          onSuccess={handleExpertOfferSuccess}
        />
      )}

      {/* Модалка: Сообщить о проблеме */}
      {reportOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={handleCloseReport}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            {reportSent ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icon name="CheckCircle" size={28} className="text-emerald-600" />
                </div>
                <h3 className="font-semibold text-navy-800 text-lg mb-2">Сообщение получено</h3>
                <p className="text-sm text-muted-foreground mb-1">Мы рассмотрим обращение в течение 24 часов.</p>
                <p className="text-sm text-muted-foreground mb-6">Отслеживайте ответ в разделе <span className="font-medium text-navy-700">«Профиль»</span>.</p>
                <button onClick={handleCloseReport} className="btn-gold px-6 py-2.5 rounded-xl text-sm font-medium">Закрыть</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                      <Icon name="AlertTriangle" size={17} className="text-red-500" />
                    </div>
                    <h3 className="font-semibold text-navy-800">Сообщить о проблеме</h3>
                  </div>
                  <button onClick={handleCloseReport} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors">
                    <Icon name="X" size={16} className="text-muted-foreground" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Опишите что не так с документом — мы разберёмся и ответим в течение 24 часов.</p>
                <textarea
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="Например: неверно указан тип иска, отсутствует раздел о судебных расходах..."
                  rows={4}
                  className="w-full bg-slate-50 border border-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors resize-none mb-4"
                />
                <div className="flex gap-2">
                  <button onClick={handleCloseReport} className="flex-1 py-2.5 rounded-xl text-sm text-navy-600 border border-border hover:bg-slate-50 transition-colors">
                    Отмена
                  </button>
                  <button
                    onClick={handleSendReport}
                    disabled={!reportText.trim() || reportLoading}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-navy-800 text-white hover:bg-navy-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {reportLoading ? <Icon name="Loader" size={15} className="animate-spin" /> : <Icon name="Send" size={15} />}
                    {reportLoading ? "Отправка..." : "Отправить"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}