import { useRef } from "react";
import Icon from "@/components/ui/icon";

export interface AiFillMsg { role: "user" | "ai"; text: string; }

interface ViewDocAiFillChatProps {
  docName: string;
  paidQuestions: number;
  aiFillMsgs: AiFillMsg[];
  aiFillInput: string;
  aiFillTyping: boolean;
  showEditor: boolean;
  aiFillEndRef: React.RefObject<HTMLDivElement>;
  aiFillInputRef: React.RefObject<HTMLInputElement>;
  onClose: () => void;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onPayForQuestions?: () => void;
}

export default function ViewDocAiFillChat({
  docName,
  paidQuestions,
  aiFillMsgs,
  aiFillInput,
  aiFillTyping,
  showEditor,
  aiFillEndRef,
  aiFillInputRef,
  onClose,
  onInputChange,
  onSend,
  onPayForQuestions,
}: ViewDocAiFillChatProps) {
  const inputDesktopRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) onSend();
  };

  const MsgList = ({ mobile }: { mobile: boolean }) => (
    <>
      {aiFillMsgs.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} ${mobile ? "gap-2" : "gap-1.5"}`}>
          {msg.role === "ai" && (
            <div className={`${mobile ? "w-6 h-6 rounded-lg" : "w-5 h-5 rounded-md"} flex items-center justify-center shrink-0 mt-0.5`}
              style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
              <Icon name="Bot" size={mobile ? 12 : 10} color="white" />
            </div>
          )}
          <div
            className={`max-w-[85%] ${mobile ? "px-3.5 py-2.5 rounded-2xl text-sm" : "px-3 py-2 rounded-xl text-xs"} leading-relaxed ${
              msg.role === "user" ? "rounded-tr-sm text-white" : `${mobile ? "rounded-tl-sm" : "rounded-tl-sm"} text-navy-800 bg-white border border-slate-200`
            }`}
            style={msg.role === "user" ? { background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" } : {}}
          >
            {msg.text}
          </div>
        </div>
      ))}
      {aiFillTyping && (
        <div className={`flex justify-start ${mobile ? "gap-2" : "gap-1.5"}`}>
          <div className={`${mobile ? "w-6 h-6 rounded-lg" : "w-5 h-5 rounded-md"} flex items-center justify-center shrink-0`}
            style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
            <Icon name="Bot" size={mobile ? 12 : 10} color="white" />
          </div>
          <div className={`${mobile ? "px-3.5 py-3 rounded-2xl rounded-tl-sm" : "px-3 py-2 rounded-xl rounded-tl-sm"} bg-white border border-slate-200 flex items-center gap-1`}>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      )}
      {(paidQuestions ?? 0) <= 0 && (
        <div className={`${mobile ? "rounded-2xl p-4" : "rounded-xl p-3"} border`} style={{ background: "#fff7ed", borderColor: "#fbbf24" }}>
          <p className={`${mobile ? "text-xs mb-2" : "text-[11px] mb-1"} font-bold text-amber-800`}>Вопросы закончились</p>
          <button onClick={() => onPayForQuestions?.()} className={`w-full ${mobile ? "py-2 rounded-xl text-xs" : "py-1.5 rounded-lg text-[11px]"} font-bold`}
            style={{ background: "linear-gradient(135deg,#f59e0b,#fbbf24)", color: "#0a1628" }}>
            +3 вопроса · 35 ₽
          </button>
        </div>
      )}
      <div ref={aiFillEndRef} />
    </>
  );

  return (
    <>
      {/* ── Десктоп: колонка справа ── */}
      <div className={`hidden sm:flex flex-col w-72 shrink-0 overflow-hidden`} style={{ background: "#f8fafc" }}>
        {/* Шапка */}
        <div className="flex items-center gap-2.5 px-4 py-3.5 shrink-0" style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
          <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="Bot" size={14} color="white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white">AI-юрист</p>
            <p className="text-[10px] text-white/55 truncate">по заполнению реквизитов</p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-white/15">
              <Icon name="MessageCircle" size={9} color="white" />
              <span className="text-[10px] font-semibold text-white">{paidQuestions ?? 0}</span>
            </div>
            <button onClick={onClose} className="w-6 h-6 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors">
              <Icon name="X" size={12} color="white" />
            </button>
          </div>
        </div>
        {/* Сообщения */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-2.5" style={{ minHeight: 0 }}>
          <MsgList mobile={false} />
        </div>
        {/* Ввод */}
        <div className="shrink-0 px-3 py-2.5 border-t border-slate-200 bg-white">
          <div className="flex items-center gap-1.5">
            <input
              ref={inputDesktopRef}
              type="text"
              value={aiFillInput}
              onChange={e => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Спросить по заполнению..."
              disabled={(paidQuestions ?? 0) <= 0 || aiFillTyping}
              className="flex-1 bg-slate-100 rounded-xl px-3 py-2 text-xs outline-none disabled:opacity-50 transition-colors"
              style={{ border: "1.5px solid transparent" }}
              onFocus={e => { e.target.style.borderColor = "#1a6bb5"; e.target.style.background = "white"; }}
              onBlur={e => { e.target.style.borderColor = "transparent"; e.target.style.background = "#f1f5f9"; }}
            />
            <button onClick={onSend} disabled={!aiFillInput.trim() || aiFillTyping || (paidQuestions ?? 0) <= 0}
              className="w-8 h-8 rounded-xl flex items-center justify-center disabled:opacity-40 shrink-0 transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
              {aiFillTyping
                ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Icon name="Send" size={12} color="white" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Мобиль: шторка снизу (только если редактор закрыт) ── */}
      {!showEditor && (
        <div className="sm:hidden fixed z-[85] flex items-end inset-0" onClick={onClose}>
          <div className="absolute inset-0" onClick={onClose} />
          <div className="relative w-full rounded-t-3xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "78dvh", background: "#f8fafc" }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>
            <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Icon name="Bot" size={16} color="white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">AI-юрист</p>
                <p className="text-[10px] text-white/60 truncate">По заполнению: {docName}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/15">
                  <Icon name="MessageCircle" size={10} color="white" />
                  <span className="text-[10px] font-semibold text-white">{paidQuestions ?? 0} вопр.</span>
                </div>
                <button onClick={onClose} className="w-7 h-7 rounded-xl bg-white/15 flex items-center justify-center">
                  <Icon name="X" size={14} color="white" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3" style={{ minHeight: 0 }}>
              <MsgList mobile={true} />
            </div>
            <div className="shrink-0 px-3 py-3 border-t border-slate-200 bg-white">
              <div className="flex items-center gap-2">
                <input
                  ref={aiFillInputRef}
                  type="text"
                  value={aiFillInput}
                  onChange={e => onInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Что писать в поле «ФИО»?"
                  disabled={(paidQuestions ?? 0) <= 0 || aiFillTyping}
                  className="flex-1 bg-slate-100 rounded-2xl px-4 py-2.5 text-sm outline-none disabled:opacity-50"
                  style={{ border: "1.5px solid transparent" }}
                  onFocus={e => { e.target.style.borderColor = "#1a6bb5"; e.target.style.background = "white"; }}
                  onBlur={e => { e.target.style.borderColor = "transparent"; e.target.style.background = "#f1f5f9"; }}
                />
                <button onClick={onSend} disabled={!aiFillInput.trim() || aiFillTyping || (paidQuestions ?? 0) <= 0}
                  className="w-9 h-9 rounded-2xl flex items-center justify-center disabled:opacity-40 shrink-0 active:scale-95"
                  style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
                  {aiFillTyping
                    ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : <Icon name="Send" size={14} color="white" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
