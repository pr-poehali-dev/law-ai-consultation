import { useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { BizTool } from "./BusinessSidebar";
import { TOOLS } from "./BusinessSidebar";

export interface BizMsg {
  id?: number;
  role: "user" | "ai";
  body: string;
  tool: BizTool;
  created_at?: string;
  needsExpert?: boolean;
  truncated?: boolean;
  personalDataRefused?: boolean;
}

function fmtDt(iso?: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="text-[13px] leading-relaxed font-golos whitespace-pre-wrap">
      {text.split("\n").map((line, i) => {
        if (/^#{1,3}\s/.test(line)) return <p key={i} className="font-bold text-navy-800 mt-2 mb-0.5">{line.replace(/^#+\s/, "")}</p>;
        if (/^[-*]\s/.test(line)) return <p key={i} className="pl-3">• {line.replace(/^[-*]\s/, "")}</p>;
        if (/^\d+\.\s/.test(line)) return <p key={i} className="pl-2">{line}</p>;
        if (/\|/.test(line)) return <p key={i} className="font-mono text-xs bg-slate-50 px-1 py-0.5 rounded">{line}</p>;
        if (line.includes("🟢") || line.includes("🟡") || line.includes("🔴")) return <p key={i} className="font-bold text-base mt-1">{line}</p>;
        return <span key={i}>{line}{"\n"}</span>;
      })}
    </div>
  );
}

const TOOL_COLORS: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 border-blue-100",
  purple: "bg-purple-50 text-purple-700 border-purple-100",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
  orange: "bg-orange-50 text-orange-700 border-orange-100",
  pink: "bg-pink-50 text-pink-700 border-pink-100",
  teal: "bg-teal-50 text-teal-700 border-teal-100",
  amber: "bg-amber-50 text-amber-700 border-amber-100",
};

interface BusinessMessagesProps {
  messages: BizMsg[];
  activeTool: BizTool;
  sending: boolean;
  userName?: string;
  onSetInput: (v: string) => void;
  onPayClick?: () => void;
  onContinue?: (partial: string) => void;
}

export default function BusinessMessages({ messages, activeTool, sending, userName, onSetInput, onPayClick, onContinue }: BusinessMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const currentTool = TOOLS.find(t => t.id === activeTool)!;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-border bg-gradient-to-b from-slate-50 to-white p-3 sm:p-4 space-y-3" style={{scrollbarWidth:"none"}}>
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-6">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${TOOL_COLORS[currentTool.color]}`}>
            <Icon name={currentTool.icon} size={26} />
          </div>
          <div className="max-w-xs">
            <p className="text-sm font-semibold text-navy-700 mb-1">{currentTool.label}</p>
            <p className="text-xs text-muted-foreground">{currentTool.desc}</p>
            {activeTool === "doc_compare" && (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2 px-3 py-2 bg-pink-50 border border-pink-100 rounded-xl">
                  <div className="w-5 h-5 bg-pink-100 rounded-lg flex items-center justify-center text-[10px] font-bold text-pink-600">1</div>
                  <span className="text-xs text-pink-700">Загрузите первый договор (PDF/DOC)</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl">
                  <div className="w-5 h-5 bg-blue-100 rounded-lg flex items-center justify-center text-[10px] font-bold text-blue-600">2</div>
                  <span className="text-xs text-blue-700">Загрузите второй договор (PDF/DOC)</span>
                </div>
                <p className="text-[10px] text-muted-foreground text-center pt-1">AI сравнит оба документа и выделит различия</p>
              </div>
            )}
            {activeTool === "chat" && (
              <div className="mt-3 space-y-1.5 text-left">
                <p className="text-xs text-blue-700 bg-blue-50 rounded-xl px-3 py-2">Задайте юридический вопрос или прикрепите документ / фото для анализа</p>
                <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl">
                  <Icon name="Paperclip" size={12} className="text-slate-400 shrink-0"/>
                  <span className="text-[10px] text-muted-foreground">PDF, DOC, DOCX, JPG, PNG — AI проанализирует любой документ или фото</span>
                </div>
              </div>
            )}
            {activeTool === "doc_analyze" && (
              <p className="text-xs text-orange-600 bg-orange-50 rounded-xl px-3 py-2 mt-2">Загрузите договор в формате PDF, DOC или DOCX</p>
            )}
            {activeTool === "orders" && (
              <p className="text-xs text-teal-600 bg-teal-50 rounded-xl px-3 py-2 mt-2">Опишите вид приказа и параметры — скачаете в .doc</p>
            )}
            {activeTool === "pretension" && (
              <div className="mt-3 space-y-1.5 text-left">
                <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">Опишите ситуацию — составлю претензию контрагенту или ответ на входящую претензию</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {["Нарушение сроков поставки","Некачественные услуги","Невозврат долга","Ответ на претензию покупателя"].map(ex=>(
                    <button key={ex} className="text-[10px] px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 hover:bg-amber-100 transition-colors text-left"
                      onClick={() => onSetInput(ex)}>
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : messages.map((m, i) => (
        <div key={i} className={`flex gap-2 items-end ${m.role==="user"?"justify-end":"justify-start"} animate-fade-in`}>
          {m.role === "ai" && (
            <div className="w-7 h-7 bg-gradient-to-br from-navy-700 to-navy-900 rounded-full flex items-center justify-center shrink-0 shadow-sm">
              <Icon name="Bot" size={13} className="text-gold-400" />
            </div>
          )}
          <div className={`max-w-[86%] sm:max-w-[78%] rounded-2xl px-3.5 py-2.5 shadow-sm ${m.role==="user"?"bg-gradient-to-br from-navy-700 to-navy-800 text-white rounded-br-sm":"bg-white border border-slate-100 text-navy-800 rounded-bl-sm"}`}>
            {m.role === "ai" ? <MarkdownText text={m.body}/> : <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{m.body}</p>}
            {m.role === "ai" && m.personalDataRefused && !sending && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <p className="text-[12px] text-amber-800 leading-relaxed">Опишите юридическую суть вопроса без персональных данных — и я дам развёрнутый ответ.</p>
              </div>
            )}
            {m.role === "ai" && m.truncated && i === messages.map((x,j)=>x.role==="ai"?j:-1).filter(j=>j>=0).at(-1) && !sending && onContinue && (
              <button onClick={() => onContinue(m.body)} className="mt-2 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl w-full justify-center">
                <Icon name="ChevronDown" size={12} />Читать дальше
              </button>
            )}
            {m.role === "ai" && m.needsExpert && !sending && onPayClick && (
              <button
                onClick={onPayClick}
                className="mt-3 flex items-center gap-2 px-3 py-2.5 bg-navy-700 hover:bg-navy-800 text-white text-xs font-semibold rounded-xl w-full justify-center transition-colors"
              >
                <Icon name="UserCheck" size={13} />Подключить живого юриста-эксперта
              </button>
            )}
            <p className={`text-[10px] mt-1 ${m.role==="user"?"text-white/40 text-right":"text-muted-foreground/40"}`}>{fmtDt(m.created_at)}</p>
          </div>
          {m.role === "user" && (
            <div className="w-7 h-7 bg-navy-100 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-navy-700 uppercase">
              {userName?.[0] ?? "U"}
            </div>
          )}
        </div>
      ))}
      {sending && (
        <div className="flex gap-2 items-end justify-start animate-fade-in">
          <div className="w-7 h-7 bg-gradient-to-br from-navy-700 to-navy-900 rounded-full flex items-center justify-center shrink-0 shadow-sm">
            <Icon name="Bot" size={13} className="text-gold-400" />
          </div>
          <div className="bg-white border border-navy-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm max-w-[200px]">
            <div className="flex gap-1 items-center mb-1.5">
              <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full"/>
              <span className="typing-dot w-2 h-2 bg-navy-500 rounded-full"/>
              <span className="typing-dot w-2 h-2 bg-navy-400 rounded-full"/>
            </div>
            <p className="text-[10px] text-muted-foreground animate-pulse">
              {activeTool==="counterparty"?"Проверяю контрагента..."
              :activeTool==="contract"?"Составляю договор..."
              :activeTool==="doc_analyze"?"Анализирую документ..."
              :activeTool==="doc_compare"?"Сравниваю документы..."
              :activeTool==="orders"?"Составляю приказ..."
              :"Анализирую запрос..."}
            </p>
          </div>
        </div>
      )}
      <div ref={bottomRef}/>
    </div>
  );
}