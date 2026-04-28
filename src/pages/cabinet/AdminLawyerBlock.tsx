import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { lawyerMessages, lawyerSend, type LawyerMessage, type LawyerDialog } from "@/lib/auth";

export default function AdminLawyerBlock() {
  const [dialogs, setDialogs] = useState<LawyerDialog[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [messages, setMessages] = useState<LawyerMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [viewAtt, setViewAtt] = useState<{ title: string; content: string; type: string } | null>(null);

  const loadDialogs = useCallback(async () => {
    setLoading(true);
    const res = await lawyerMessages();
    if (res.dialogs) setDialogs(res.dialogs);
    setLoading(false);
  }, []);

  const loadMessages = useCallback(async (userId: number) => {
    setMsgLoading(true);
    const res = await lawyerMessages({ target_user_id: userId });
    if (res.messages) setMessages(res.messages);
    setMsgLoading(false);
  }, []);

  useEffect(() => { loadDialogs(); }, [loadDialogs]);

  useEffect(() => {
    if (!selectedUserId) return;
    loadMessages(selectedUserId);
    const iv = setInterval(() => loadMessages(selectedUserId), 8000);
    return () => clearInterval(iv);
  }, [selectedUserId, loadMessages]);

  const handleSendReply = async () => {
    if (!reply.trim() || !selectedUserId) return;
    setSending(true);
    await lawyerSend({ body: reply.trim(), target_user_id: selectedUserId });
    setReply("");
    await loadMessages(selectedUserId);
    setSending(false);
  };

  const currentDialog = dialogs.find(d => d.user_id === selectedUserId);

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm overflow-hidden">
      {/* Заголовок */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-border">
        <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
          <Icon name="UserCheck" size={16} className="text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-navy-800 text-sm">Раздел Юрист</h3>
          <p className="text-[11px] text-muted-foreground">Запросы от клиентов</p>
        </div>
        <button onClick={loadDialogs} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors" title="Обновить">
          <Icon name="RefreshCw" size={14} className="text-muted-foreground" />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row" style={{ minHeight: 340 }}>
        {/* Список диалогов */}
        <div className={`${selectedUserId ? "hidden sm:flex" : "flex"} flex-col border-r border-border`} style={{ width: "100%", maxWidth: 280, flexShrink: 0 }}>
          {loading ? (
            <div className="flex items-center justify-center py-8 flex-1">
              <div className="w-5 h-5 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
            </div>
          ) : dialogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 flex-1 px-4">
              <Icon name="MessageSquare" size={28} className="text-slate-200 mb-2" />
              <p className="text-xs text-muted-foreground text-center">Нет запросов от клиентов</p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              {dialogs.map(d => (
                <button
                  key={d.user_id}
                  onClick={() => setSelectedUserId(d.user_id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-50 transition-colors ${selectedUserId === d.user_id ? "bg-navy-50 border-l-2 border-l-navy-600" : "hover:bg-slate-50"}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-navy-100 flex items-center justify-center shrink-0 text-xs font-bold text-navy-700 uppercase">
                      {d.name?.[0] || d.email[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-semibold text-navy-800 truncate">{d.name || d.email}</p>
                        {d.unread > 0 && (
                          <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0">{d.unread}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{d.email}</p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{d.last_message?.slice(0, 40)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Диалог */}
        {selectedUserId ? (
          <div className="flex flex-col flex-1 min-w-0">
            {/* Шапка диалога */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-slate-50/60">
              <button onClick={() => setSelectedUserId(null)} className="sm:hidden p-1 hover:bg-slate-100 rounded-lg mr-1">
                <Icon name="ChevronLeft" size={16} className="text-navy-600" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-navy-800 truncate">{currentDialog?.name || currentDialog?.email}</p>
                <p className="text-[10px] text-muted-foreground truncate">{currentDialog?.email}</p>
              </div>
            </div>

            {/* Сообщения */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50/30" style={{ maxHeight: 340 }}>
              {msgLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
                </div>
              ) : messages.map(msg => {
                const isAdmin = msg.sender === "admin";
                const hasAtt = !!(msg.attachment_name && msg.attachment_content && msg.attachment_content.length > 5);
                return (
                  <div key={msg.id} className={`flex gap-2 items-end ${isAdmin ? "justify-end" : "justify-start"}`}>
                    {!isAdmin && (
                      <div className="w-7 h-7 rounded-full bg-navy-100 flex items-center justify-center shrink-0 text-xs font-bold text-navy-700">
                        {currentDialog?.name?.[0] || "U"}
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                      isAdmin ? "bg-navy-700 text-white rounded-br-sm" : "bg-white border border-slate-100 text-navy-800 rounded-bl-sm shadow"
                    }`}>
                      {msg.attachment_name && (
                        <button
                          onClick={() => hasAtt && setViewAtt({ title: msg.attachment_name!, content: msg.attachment_content!, type: msg.attachment_type || "text" })}
                          className={`flex items-center gap-2 mb-2 px-3 py-2 rounded-xl text-xs font-medium w-full text-left transition-colors ${
                            msg.attachment_type === "document"
                              ? isAdmin ? "bg-white/15 text-white/80" : "bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100"
                              : isAdmin ? "bg-white/15 text-white/80" : "bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100"
                          } ${hasAtt ? "cursor-pointer" : "cursor-default opacity-60"}`}
                        >
                          <Icon name={msg.attachment_type === "document" ? "FileText" : "Bot"} size={12} className="shrink-0" />
                          <span className="flex-1 truncate">
                            {msg.attachment_type === "document" ? "Документ" : "Ответ AI"}: {msg.attachment_name.slice(0, 45)}
                          </span>
                          {hasAtt && <Icon name="ExternalLink" size={10} className="shrink-0 opacity-50" />}
                        </button>
                      )}
                      {msg.body && <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.body}</p>}
                      <p className={`text-[9px] mt-1 ${isAdmin ? "text-white/40" : "text-slate-400"}`}>
                        {new Date(msg.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0 text-xs font-bold text-purple-700">
                        Ю
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Поле ответа */}
            <div className="flex items-end gap-2 px-3 py-2.5 border-t border-border bg-white">
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                placeholder="Ответ клиенту..."
                rows={1}
                className="flex-1 bg-slate-50 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-navy-400 resize-none transition-colors"
                style={{ maxHeight: 80 }}
              />
              <button
                onClick={handleSendReply}
                disabled={!reply.trim() || sending}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 shrink-0"
                style={{ background: reply.trim() ? "linear-gradient(135deg, #162d5a, #0a1628)" : "#f1f5f9" }}
              >
                {sending ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon name="Send" size={14} color={reply.trim() ? "white" : "#94a3b8"} />}
              </button>
            </div>
          </div>
        ) : (
          <div className="hidden sm:flex flex-col items-center justify-center flex-1 text-center p-8">
            <Icon name="UserCheck" size={32} className="text-slate-200 mb-3" />
            <p className="text-sm text-muted-foreground">Выберите клиента слева<br/>для просмотра переписки</p>
          </div>
        )}
      </div>

      {/* Предпросмотр вложения */}
      {viewAtt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setViewAtt(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: viewAtt.type === "document" ? "#ecfdf5" : "#eff6ff" }}>
                <Icon name={viewAtt.type === "document" ? "FileText" : "Bot"} size={14} color={viewAtt.type === "document" ? "#059669" : "#2563eb"} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-navy-800 truncate">{viewAtt.title}</p>
                <p className="text-[11px] text-muted-foreground">{viewAtt.type === "document" ? "Юридический документ" : "Ответ AI-юриста"}</p>
              </div>
              <button onClick={() => setViewAtt(null)} className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400">
                <Icon name="X" size={15} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <pre className="text-sm text-navy-700 leading-relaxed whitespace-pre-wrap font-sans">{viewAtt.content}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
