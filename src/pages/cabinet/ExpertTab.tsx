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

// ─── Форматирование времени ────────────────────
function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ─── Компонент пузырька сообщения ─────────────
function MsgBubble({ msg, isAdmin }: { msg: LawyerMessage; isAdmin: boolean }) {
  const isMe = isAdmin ? msg.sender === "admin" : msg.sender === "user";
  return (
    <div className={`flex gap-3 items-end ${isMe ? "justify-end" : "justify-start"} animate-fade-in`}>
      {!isMe && (
        <div className="w-8 h-8 gradient-navy rounded-xl flex items-center justify-center shrink-0">
          <Icon name="UserCheck" size={14} className="text-gold-400" />
        </div>
      )}
      <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {!isMe && (
          <p className="text-[10.5px] font-semibold text-navy-600 ml-1">{EXPERT_NAME}</p>
        )}
        <div className={`rounded-2xl px-4 py-3 shadow-sm ${
          isMe
            ? "bg-navy-700 text-white rounded-br-sm"
            : "bg-white border border-navy-100 text-navy-800 rounded-bl-sm"
        }`}>
          {msg.attachment_type === "chat_answer" && msg.attachment_name && (
            <div className={`flex items-center gap-2 mb-2 px-3 py-2 rounded-xl text-xs font-medium ${
              isMe ? "bg-white/10 text-white/80" : "bg-navy-50 text-navy-600"
            }`}>
              <Icon name="MessageCircle" size={12} />
              <span>Ответ AI: {msg.attachment_name.slice(0, 60)}{msg.attachment_name.length > 60 ? "..." : ""}</span>
            </div>
          )}
          {msg.attachment_type === "document" && msg.attachment_name && (
            <div className={`flex items-center gap-2 mb-2 px-3 py-2 rounded-xl text-xs font-medium ${
              isMe ? "bg-white/10 text-white/80" : "bg-navy-50 text-navy-600"
            }`}>
              <Icon name="FileText" size={12} />
              <span>Документ: {msg.attachment_name}</span>
            </div>
          )}
          <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap font-golos">{msg.body}</p>
        </div>
        <p className={`text-[10px] text-muted-foreground/50 ${isMe ? "text-right" : "text-left"} ml-1`}>
          {fmtTime(msg.created_at)}
          {isMe && msg.is_read && <span className="ml-1 text-gold-400">✓✓</span>}
        </p>
      </div>
      {isMe && (
        <div className="w-8 h-8 bg-navy-100 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold text-navy-700 uppercase">
          {isAdmin ? "A" : (user?.name?.[0] ?? "U")}
        </div>
      )}
    </div>
  );
}

// Компонент нужен в scope где user доступен — выносим логику в основной компонент

// ─── Основной компонент ────────────────────────
export default function ExpertTab({ user, messages, genDocs, onPayClick }: ExpertTabProps) {
  const [lmsgs, setLmsgs] = useState<LawyerMessage[]>([]);
  const [dialogs, setDialogs] = useState<LawyerDialog[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [attachment, setAttachment] = useState<{ type: string; name: string; content?: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canUse = user.isAdmin || user.paidExpert;

  const loadMessages = useCallback(async () => {
    if (!canUse) return;
    const params = user.isAdmin && selectedUserId
      ? { target_user_id: selectedUserId }
      : user.isAdmin ? undefined : {};
    if (user.isAdmin && !selectedUserId) {
      const res = await lawyerMessages();
      if (res.dialogs) setDialogs(res.dialogs);
      setLoading(false);
      return;
    }
    const res = await lawyerMessages(params);
    if (res.messages) setLmsgs(res.messages);
    setLoading(false);
  }, [canUse, user.isAdmin, selectedUserId]);

  useEffect(() => {
    loadMessages();
    // Полинг каждые 8 секунд
    pollRef.current = setInterval(loadMessages, 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lmsgs]);

  const send = async () => {
    if (!input.trim() && !attachment) return;
    setSending(true);
    setErr("");
    const params: Parameters<typeof lawyerSend>[0] = {
      body: input.trim() || (attachment ? `[${attachment.name}]` : ""),
      ...(user.isAdmin && selectedUserId ? { target_user_id: selectedUserId } : {}),
      ...(attachment ? {
        attachment_type: attachment.type,
        attachment_name: attachment.name,
        attachment_content: attachment.content,
      } : {}),
    };
    const res = await lawyerSend(params);
    if (res.error) { setErr(res.error); setSending(false); return; }
    setInput("");
    setAttachment(null);
    await loadMessages();
    setSending(false);
  };

  // ── Не оплачено ────────────────────────────
  if (!canUse) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl border border-border shadow-sm p-8 text-center">
          <div className="w-16 h-16 gradient-navy rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
            <Icon name="UserCheck" size={28} className="text-gold-400" />
          </div>
          <h2 className="font-cormorant font-bold text-2xl text-navy-800 mb-2">Проверка юристом</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Получите персональную проверку документа или ответа AI от <strong>Эксперта-юриста Поварчук И.В.</strong><br/>
            Задайте вопрос по вашей ситуации, прикрепите ответ AI или документ — юрист ответит лично.
          </p>
          <div className="grid grid-cols-1 gap-3 mb-6 text-left">
            {[
              { icon: "MessageCircle", text: "Личная переписка с профессиональным юристом" },
              { icon: "FileCheck", text: "Проверка и комментарий к вашим документам" },
              { icon: "Scale", text: "Разбор ответов AI с профессиональной точки зрения" },
              { icon: "Shield", text: "Конфиденциальность и защита ваших данных" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 bg-navy-50 rounded-2xl">
                <Icon name={f.icon} size={16} className="text-navy-600 shrink-0" />
                <span className="text-sm text-navy-700">{f.text}</span>
              </div>
            ))}
          </div>
          <button
            onClick={onPayClick}
            className="btn-gold w-full py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 text-sm"
          >
            <Icon name="UserCheck" size={16} />
            Подключить тариф «Проверка юристом»
          </button>
          <p className="text-xs text-muted-foreground mt-3">Оплата безопасна · доступ сразу после оплаты</p>
        </div>
      </div>
    );
  }

  // ── Список диалогов для админа ───────────────
  if (user.isAdmin && !selectedUserId) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-3">
            <div className="w-9 h-9 gradient-navy rounded-xl flex items-center justify-center shadow-sm">
              <Icon name="MessageSquare" size={16} className="text-gold-400" />
            </div>
            <div>
              <h2 className="font-semibold text-navy-800">Диалоги с клиентами</h2>
              <p className="text-xs text-muted-foreground">Входящие обращения</p>
            </div>
            <button onClick={loadMessages} className="ml-auto p-2 hover:bg-slate-100 rounded-xl transition-colors">
              <Icon name="RefreshCw" size={15} className="text-muted-foreground" />
            </button>
          </div>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Загрузка...</div>
          ) : dialogs.length === 0 ? (
            <div className="p-8 text-center">
              <Icon name="Inbox" size={32} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Нет обращений</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {dialogs.map((d) => (
                <button
                  key={d.user_id}
                  onClick={() => setSelectedUserId(d.user_id)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-navy-100 rounded-xl flex items-center justify-center font-bold text-navy-700 text-sm uppercase shrink-0">
                    {d.name?.[0] ?? "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-semibold text-navy-800 truncate">{d.name}</span>
                      <span className="text-[10.5px] text-muted-foreground shrink-0 ml-2">{fmtTime(d.last_at)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground truncate">{d.last_message?.slice(0, 60)}</span>
                      {d.unread > 0 && (
                        <span className="shrink-0 ml-2 w-5 h-5 bg-gold-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {d.unread}
                        </span>
                      )}
                    </div>
                  </div>
                  <Icon name="ChevronRight" size={14} className="text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Диалог ────────────────────────────────────
  const currentDialog = user.isAdmin
    ? dialogs.find((d) => d.user_id === selectedUserId)
    : null;

  return (
    <div className="max-w-3xl mx-auto flex flex-col" style={{ height: "calc(100vh - 140px)" }}>

      {/* Шапка */}
      <div className="flex items-center gap-3 mb-3 px-1">
        {user.isAdmin && (
          <button
            onClick={() => { setSelectedUserId(null); setLmsgs([]); }}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <Icon name="ArrowLeft" size={16} className="text-navy-700" />
          </button>
        )}
        <div className="w-10 h-10 gradient-navy rounded-xl flex items-center justify-center shadow-sm">
          <Icon name="UserCheck" size={16} className="text-gold-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-navy-800">
            {user.isAdmin
              ? (currentDialog?.name ?? `Клиент #${selectedUserId}`)
              : EXPERT_NAME}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {user.isAdmin
              ? currentDialog?.email
              : "Профессиональный юрист · ответ в течение 24 часов"}
          </p>
        </div>
        <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full" />
      </div>

      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto rounded-3xl border border-border shadow-sm bg-gradient-to-b from-slate-50/80 to-white p-5 space-y-5 scrollbar-hide">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-8">Загрузка переписки...</div>
        ) : lmsgs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 bg-navy-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Icon name="MessageCircle" size={24} className="text-navy-300" />
            </div>
            <p className="text-sm font-medium text-navy-700 mb-1">Начните диалог</p>
            <p className="text-xs text-muted-foreground">Опишите вашу ситуацию или прикрепите документ / ответ AI</p>
          </div>
        ) : (
          lmsgs.map((m) => (
            <MsgBubble key={m.id} msg={m} isAdmin={user.isAdmin} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Прикреплённый материал */}
      {attachment && (
        <div className="mt-2 flex items-center gap-2.5 px-4 py-2.5 bg-navy-50 border border-navy-200 rounded-2xl">
          <Icon name={attachment.type === "document" ? "FileText" : "MessageCircle"} size={15} className="text-navy-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-navy-800 truncate">
              {attachment.type === "document" ? "Документ" : "Ответ AI"}: {attachment.name}
            </p>
          </div>
          <button onClick={() => setAttachment(null)} className="text-muted-foreground hover:text-red-500 transition-colors p-1">
            <Icon name="X" size={13} />
          </button>
        </div>
      )}

      {/* Выбор материала для прикрепления */}
      {!attachment && !user.isAdmin && (messages.filter(m => m.role === "ai").length > 0 || genDocs.length > 0) && (
        <div className="mt-2 px-1">
          <p className="text-[10.5px] text-muted-foreground mb-1.5">Прикрепить к сообщению:</p>
          <div className="flex gap-2 flex-wrap">
            {messages.filter(m => m.role === "ai" && m.text.length > 30).slice(-3).map((m, i) => (
              <button
                key={i}
                onClick={() => setAttachment({ type: "chat_answer", name: m.text.slice(0, 60) + "...", content: m.text })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-navy-200 hover:border-navy-400 rounded-xl text-[11px] text-navy-700 transition-all"
              >
                <Icon name="MessageCircle" size={11} />
                Ответ AI {messages.filter(m => m.role === "ai").indexOf(m) + 1}
              </button>
            ))}
            {genDocs.slice(0, 3).map((doc) => (
              <button
                key={doc.id}
                onClick={() => setAttachment({ type: "document", name: doc.name, content: doc.filled })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-navy-200 hover:border-navy-400 rounded-xl text-[11px] text-navy-700 transition-all"
              >
                <Icon name="FileText" size={11} />
                {doc.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {err && (
        <div className="mt-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
          <Icon name="AlertCircle" size={13} className="shrink-0" />{err}
        </div>
      )}

      {/* Поле ввода */}
      <div className="mt-3 bg-white border border-border rounded-2xl shadow-sm overflow-hidden focus-within:border-navy-300 focus-within:ring-2 focus-within:ring-navy-100 transition-all">
        <div className="flex items-end gap-2 px-3 py-2.5">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }}}
            disabled={sending}
            placeholder={user.isAdmin ? "Ответить клиенту..." : "Опишите вопрос для юриста..."}
            className="flex-1 bg-transparent text-[13.5px] text-navy-800 placeholder-muted-foreground outline-none resize-none py-1.5 leading-relaxed font-golos disabled:opacity-50"
            style={{ minHeight: "36px", maxHeight: "120px" }}
          />
          <button
            onClick={send}
            disabled={(!input.trim() && !attachment) || sending}
            className="w-9 h-9 rounded-xl gradient-navy flex items-center justify-center shrink-0 disabled:opacity-30 transition-all hover:shadow-md hover:scale-105 active:scale-95"
          >
            {sending
              ? <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              : <Icon name="Send" size={15} className="text-white ml-0.5" />
            }
          </button>
        </div>
        <div className="px-4 pb-2">
          <p className="text-[10.5px] text-muted-foreground/60">Юрист отвечает в течение 24 часов · Enter — отправить</p>
        </div>
      </div>
    </div>
  );
}