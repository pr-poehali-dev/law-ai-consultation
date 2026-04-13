import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import type { User, LawyerMessage, LawyerDialog } from "@/lib/auth";
import { lawyerSend, lawyerMessages } from "@/lib/auth";
import type { ChatMsg } from "./ChatTab";
import type { GenDoc } from "./DocsTab";

const EXPERT_NAME = "Эксперт-юрист Поварчук И.В.";

interface ExpertTabProps {
  user: User;
  messages: ChatMsg[];
  genDocs: GenDoc[];
  onPayClick?: () => void;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function MsgBubble({ msg, isAdmin }: { msg: LawyerMessage; isAdmin: boolean }) {
  const isMe = isAdmin ? msg.sender === "admin" : msg.sender === "user";
  return (
    <div className={`flex gap-2 sm:gap-3 items-end ${isMe ? "justify-end" : "justify-start"} animate-fade-in`}>
      {!isMe && (
        <div className="w-8 h-8 gradient-navy rounded-full flex items-center justify-center shrink-0 shadow-md">
          <Icon name="UserCheck" size={14} className="text-gold-400" />
        </div>
      )}
      <div className={`max-w-[85%] sm:max-w-[72%] flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}>
        {!isMe && (
          <p className="text-[10.5px] font-semibold text-navy-500 ml-1">{EXPERT_NAME}</p>
        )}
        <div className={`rounded-2xl px-4 py-3 shadow-sm transition-all ${
          isMe
            ? "bg-gradient-to-br from-navy-700 to-navy-800 text-white rounded-br-sm"
            : "bg-white border border-slate-100 text-navy-800 rounded-bl-sm shadow"
        }`}>
          {msg.attachment_type === "chat_answer" && msg.attachment_name && (
            <div className={`flex items-center gap-2 mb-2.5 px-3 py-2 rounded-xl text-xs font-medium ${
              isMe ? "bg-white/15 text-white/80" : "bg-blue-50 text-blue-700 border border-blue-100"
            }`}>
              <Icon name="Bot" size={12} />
              <span className="truncate">Ответ AI: {msg.attachment_name.slice(0, 55)}{msg.attachment_name.length > 55 ? "…" : ""}</span>
            </div>
          )}
          {msg.attachment_type === "document" && msg.attachment_name && (
            <div className={`flex items-center gap-2 mb-2.5 px-3 py-2 rounded-xl text-xs font-medium ${
              isMe ? "bg-white/15 text-white/80" : "bg-emerald-50 text-emerald-700 border border-emerald-100"
            }`}>
              <Icon name="FileText" size={12} />
              <span className="truncate">Документ: {msg.attachment_name}</span>
            </div>
          )}
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap font-golos">{msg.body}</p>
        </div>
        <div className={`flex items-center gap-1 ${isMe ? "flex-row-reverse" : ""}`}>
          <p className="text-[10px] text-muted-foreground/50">{fmtTime(msg.created_at)}</p>
          {isMe && msg.is_read && <Icon name="CheckCheck" size={12} className="text-gold-400" />}
        </div>
      </div>
      {isMe && (
        <div className="w-8 h-8 bg-navy-100 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-navy-700 uppercase shadow-sm">
          {isAdmin ? "A" : (msg.body?.[0]?.toUpperCase() ?? "U")}
        </div>
      )}
    </div>
  );
}

export default function ExpertTab({ user, messages, genDocs, onPayClick }: ExpertTabProps) {
  const [lmsgs, setLmsgs] = useState<LawyerMessage[]>([]);
  const [dialogs, setDialogs] = useState<LawyerDialog[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [attachment, setAttachment] = useState<{ type: string; name: string; content?: string } | null>(null);
  const [showAttachPanel, setShowAttachPanel] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canUse = user.isAdmin || user.paidExpert;

  const loadMessages = useCallback(async () => {
    if (!canUse) return;
    if (user.isAdmin && !selectedUserId) {
      const res = await lawyerMessages();
      if (res.dialogs) setDialogs(res.dialogs);
      setLoading(false);
      return;
    }
    const params = user.isAdmin && selectedUserId ? { target_user_id: selectedUserId } : {};
    const res = await lawyerMessages(params);
    if (res.messages) setLmsgs(res.messages);
    setLoading(false);
  }, [canUse, user.isAdmin, selectedUserId]);

  useEffect(() => {
    loadMessages();
    pollRef.current = setInterval(loadMessages, 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lmsgs]);

  // Авто-resize textarea
  const adjustTextarea = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  };

  const send = async () => {
    const text = input.trim();
    if (!text && !attachment) return;
    setSending(true);
    setErr("");
    const bodyText = text || (attachment ? `Прикрепляю: ${attachment.name}` : "");
    const params: Parameters<typeof lawyerSend>[0] = {
      body: bodyText,
      ...(user.isAdmin && selectedUserId ? { target_user_id: selectedUserId } : {}),
      ...(attachment ? {
        attachment_type: attachment.type,
        attachment_name: attachment.name,
        attachment_content: attachment.content || attachment.name,
      } : {}),
    };
    const res = await lawyerSend(params);
    if (res.error) { setErr(res.error); setSending(false); return; }
    setInput("");
    setAttachment(null);
    setShowAttachPanel(false);
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }
    await loadMessages();
    setSending(false);
  };

  // ── Не оплачено ────────────────────────────
  if (!canUse) {
    return (
      <div className="max-w-2xl mx-auto px-1">
        <div className="relative overflow-hidden bg-white rounded-3xl border border-border shadow-sm">
          {/* Декор */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-navy-50 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="relative p-6 sm:p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-14 h-14 sm:w-16 sm:h-16 gradient-navy rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                <Icon name="UserCheck" size={26} className="text-gold-400" />
              </div>
              <div>
                <h2 className="font-cormorant font-bold text-xl sm:text-2xl text-navy-800">Проверка живым юристом</h2>
                <p className="text-sm text-muted-foreground mt-1">Эксперт-юрист проанализирует ответ AI или ваш документ</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6">
              {[
                { icon: "MessageCircle", title: "Личная переписка", desc: "Чат с экспертом-юристом" },
                { icon: "Bot", title: "3 вопроса к AI", desc: "Включены в тариф при отсутствии подписки" },
                { icon: "FileCheck", title: "Анализ документов", desc: "Ответ AI или готовый документ" },
                { icon: "Clock", title: "Ответ за 24 часа", desc: "В рабочие дни" },
              ].map((f, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 bg-slate-50 rounded-2xl border border-border/50">
                  <div className="w-8 h-8 bg-navy-100 rounded-xl flex items-center justify-center shrink-0">
                    <Icon name={f.icon} size={14} className="text-navy-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-navy-800">{f.title}</p>
                    <p className="text-[11px] text-muted-foreground">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={onPayClick}
              className="btn-gold w-full py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 text-sm"
            >
              <Icon name="UserCheck" size={16} />
              Подключить — 1 500 ₽
            </button>
            <p className="text-xs text-muted-foreground mt-3 text-center">Защищённая оплата · доступ сразу после оплаты</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Список диалогов для админа ───────────────
  if (user.isAdmin && !selectedUserId) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-3 bg-gradient-to-r from-navy-800 to-navy-700">
            <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
              <Icon name="MessageSquare" size={16} className="text-gold-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Диалоги с клиентами</h2>
              <p className="text-xs text-white/60">Входящие обращения</p>
            </div>
            <button onClick={loadMessages} className="ml-auto p-2 hover:bg-white/10 rounded-xl transition-colors">
              <Icon name="RefreshCw" size={15} className="text-white/60" />
            </button>
          </div>
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin mx-auto" />
            </div>
          ) : dialogs.length === 0 ? (
            <div className="p-10 text-center">
              <Icon name="Inbox" size={36} className="text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Нет обращений</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {dialogs.map((d) => (
                <button
                  key={d.user_id}
                  onClick={() => setSelectedUserId(d.user_id)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left group"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-navy-100 to-navy-200 rounded-xl flex items-center justify-center font-bold text-navy-700 text-sm uppercase shrink-0">
                    {d.name?.[0] ?? "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-semibold text-navy-800 truncate">{d.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{fmtTime(d.last_at)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground truncate">{d.last_message?.slice(0, 55)}</span>
                      {d.unread > 0 && (
                        <span className="shrink-0 min-w-5 h-5 px-1.5 bg-gold-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {d.unread}
                        </span>
                      )}
                    </div>
                  </div>
                  <Icon name="ChevronRight" size={14} className="text-slate-300 group-hover:text-navy-400 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Диалог ────────────────────────────────────
  const currentDialog = user.isAdmin ? dialogs.find((d) => d.user_id === selectedUserId) : null;
  const aiAnswers = messages.filter(m => m.role === "ai" && m.text.length > 30).slice(-4);

  return (
    <div className="max-w-3xl w-full mx-auto flex flex-col gap-3" style={{ height: "clamp(480px, calc(100svh - 190px), 720px)" }}>

      {/* Шапка */}
      <div className="flex items-center gap-2 sm:gap-3 bg-white rounded-2xl border border-border px-4 py-3 shadow-sm shrink-0">
        {user.isAdmin && (
          <button
            onClick={() => { setSelectedUserId(null); setLmsgs([]); }}
            className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <Icon name="ArrowLeft" size={16} className="text-navy-600" />
          </button>
        )}
        <div className="relative">
          <div className="w-10 h-10 gradient-navy rounded-xl flex items-center justify-center shadow-sm">
            <Icon name="UserCheck" size={16} className="text-gold-400" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-navy-800 truncate">
            {user.isAdmin ? (currentDialog?.name ?? `Клиент #${selectedUserId}`) : EXPERT_NAME}
          </p>
          <p className="text-[11px] text-emerald-600 font-medium">
            {user.isAdmin ? currentDialog?.email : "Онлайн · ответит в течение 24 ч"}
          </p>
        </div>
        <button onClick={loadMessages} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <Icon name="RefreshCw" size={14} className="text-muted-foreground" />
        </button>
      </div>

      {/* Сообщения */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-border bg-gradient-to-b from-slate-50 to-white p-4 sm:p-5 space-y-4 sm:space-y-5" style={{ scrollbarWidth: "none" }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
          </div>
        ) : lmsgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <div className="w-16 h-16 bg-navy-50 rounded-2xl flex items-center justify-center">
              <Icon name="MessageCircle" size={28} className="text-navy-200" />
            </div>
            <div>
              <p className="text-sm font-semibold text-navy-700 mb-1">Начните диалог</p>
              <p className="text-xs text-muted-foreground max-w-xs">Опишите вашу ситуацию, прикрепите ответ AI или документ для анализа</p>
            </div>
            {!user.isAdmin && (aiAnswers.length > 0 || genDocs.length > 0) && (
              <button
                onClick={() => setShowAttachPanel(true)}
                className="mt-1 flex items-center gap-2 px-4 py-2 bg-navy-50 hover:bg-navy-100 rounded-xl text-xs font-medium text-navy-700 transition-colors"
              >
                <Icon name="Paperclip" size={13} />
                Прикрепить ответ AI или документ
              </button>
            )}
          </div>
        ) : (
          lmsgs.map((m) => <MsgBubble key={m.id} msg={m} isAdmin={user.isAdmin} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Прикреплённый материал */}
      {attachment && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-navy-50 border border-navy-200 rounded-2xl shrink-0 animate-fade-in">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${attachment.type === "document" ? "bg-emerald-100" : "bg-blue-100"}`}>
            <Icon name={attachment.type === "document" ? "FileText" : "Bot"} size={13} className={attachment.type === "document" ? "text-emerald-600" : "text-blue-600"} />
          </div>
          <p className="text-xs font-medium text-navy-800 flex-1 truncate">
            {attachment.type === "document" ? "Документ" : "Ответ AI"}: {attachment.name}
          </p>
          <button onClick={() => setAttachment(null)} className="p-1 text-muted-foreground hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
            <Icon name="X" size={13} />
          </button>
        </div>
      )}

      {/* Панель выбора материала */}
      {showAttachPanel && !user.isAdmin && (
        <div className="bg-white border border-border rounded-2xl p-3 shrink-0 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-navy-700">Выберите что прикрепить:</p>
            <button onClick={() => setShowAttachPanel(false)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
              <Icon name="X" size={13} className="text-muted-foreground" />
            </button>
          </div>
          <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto">
            {aiAnswers.map((m, i) => (
              <button
                key={i}
                onClick={() => { setAttachment({ type: "chat_answer", name: m.text.slice(0, 80) + "…", content: m.text }); setShowAttachPanel(false); }}
                className="flex items-start gap-2.5 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-xl text-left transition-all"
              >
                <div className="w-6 h-6 bg-blue-200 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <Icon name="Bot" size={12} className="text-blue-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-blue-800">Ответ AI #{i + 1}</p>
                  <p className="text-[11px] text-blue-600 truncate">{m.text.slice(0, 60)}…</p>
                </div>
              </button>
            ))}
            {genDocs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => { setAttachment({ type: "document", name: doc.name, content: doc.filled || doc.content }); setShowAttachPanel(false); }}
                className="flex items-start gap-2.5 px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-xl text-left transition-all"
              >
                <div className="w-6 h-6 bg-emerald-200 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <Icon name="FileText" size={12} className="text-emerald-700" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-emerald-800">{doc.name}</p>
                  <p className="text-[11px] text-emerald-600">{doc.date}</p>
                </div>
              </button>
            ))}
            {aiAnswers.length === 0 && genDocs.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">Нет доступных материалов</p>
            )}
          </div>
        </div>
      )}

      {err && (
        <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2 shrink-0">
          <Icon name="AlertCircle" size={13} className="shrink-0" />{err}
        </div>
      )}

      {/* Поле ввода */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm shrink-0 overflow-hidden">
        <div className="flex items-end gap-2 px-3 py-2.5">
          {!user.isAdmin && (
            <button
              onClick={() => setShowAttachPanel(!showAttachPanel)}
              className={`p-2 rounded-xl transition-colors shrink-0 ${showAttachPanel ? "bg-navy-100 text-navy-700" : "hover:bg-slate-100 text-muted-foreground hover:text-navy-600"}`}
              title="Прикрепить материал"
            >
              <Icon name="Paperclip" size={16} />
            </button>
          )}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => { setInput(e.target.value); adjustTextarea(); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            disabled={sending}
            placeholder={user.isAdmin ? "Ответить клиенту..." : "Опишите вопрос для юриста..."}
            className="flex-1 bg-transparent text-navy-800 placeholder:text-slate-400 text-sm outline-none resize-none leading-relaxed py-1"
            style={{ minHeight: "24px", maxHeight: "120px" }}
          />
          <button
            onClick={send}
            disabled={sending || (!input.trim() && !attachment)}
            className="w-9 h-9 bg-navy-700 hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all shrink-0 shadow-sm"
          >
            {sending
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Icon name="Send" size={15} className="text-white" />
            }
          </button>
        </div>
        <div className="px-4 pb-2 flex items-center gap-2">
          <p className="text-[10px] text-muted-foreground/50">Enter — отправить · Shift+Enter — новая строка</p>
        </div>
      </div>
    </div>
  );
}
