import { useState, useEffect, useRef, useCallback } from "react";
import type { User } from "@/lib/auth";
import { lawyerSend, lawyerMessages } from "@/lib/auth";
import type { LawyerMessage, LawyerDialog } from "@/lib/auth";
import type { ChatMsg } from "./ChatTab";
import type { GenDoc } from "./DocsTab";
import ExpertPaywall from "./ExpertPaywall";
import ExpertDialogList from "./ExpertDialogList";
import ExpertChat from "./ExpertChat";

interface ExpertTabProps {
  user: User;
  messages: ChatMsg[];
  genDocs: GenDoc[];
  onPayClick?: () => void;
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
  const [viewFullMsg, setViewFullMsg] = useState<{ title: string; content: string; type: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isPaid = user.isAdmin || user.paidExpert;

  const loadMessages = useCallback(async () => {
    if (!isPaid) return;
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
  }, [isPaid, user.isAdmin, selectedUserId]);

  useEffect(() => {
    if (!isPaid) { setLoading(false); return; }
    loadMessages();
    pollRef.current = setInterval(loadMessages, 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadMessages, isPaid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lmsgs]);

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

  // ── Не оплачено ──────────────────────────────────────────────────────
  if (!isPaid && !user.isAdmin) {
    return <ExpertPaywall onPayClick={onPayClick} />;
  }

  // ── Список диалогов для админа ────────────────────────────────────────
  if (user.isAdmin && !selectedUserId) {
    return (
      <ExpertDialogList
        dialogs={dialogs}
        loading={loading}
        onSelect={(userId) => { setSelectedUserId(userId); setLmsgs([]); setLoading(true); }}
        onRefresh={loadMessages}
      />
    );
  }

  // ── Диалог ───────────────────────────────────────────────────────────
  const currentDialog = user.isAdmin ? dialogs.find((d) => d.user_id === selectedUserId) : null;
  const aiAnswers = messages.filter(m => m.role === "ai" && m.text.length > 30).slice(-5);

  return (
    <ExpertChat
      isAdmin={user.isAdmin}
      selectedUserId={selectedUserId}
      currentDialog={currentDialog}
      lmsgs={lmsgs}
      loading={loading}
      input={input}
      sending={sending}
      err={err}
      attachment={attachment}
      showAttachPanel={showAttachPanel}
      viewFullMsg={viewFullMsg}
      aiAnswers={aiAnswers}
      genDocs={genDocs}
      onBack={() => { setSelectedUserId(null); setLmsgs([]); }}
      onRefresh={loadMessages}
      onInputChange={setInput}
      onSend={send}
      onToggleAttachPanel={() => setShowAttachPanel(p => !p)}
      onShowAttachPanel={() => setShowAttachPanel(true)}
      onHideAttachPanel={() => setShowAttachPanel(false)}
      onSelectAttachment={setAttachment}
      onRemoveAttachment={() => setAttachment(null)}
      onViewFullMsg={setViewFullMsg}
      onCloseFullMsg={() => setViewFullMsg(null)}
      textareaRef={textareaRef}
      bottomRef={bottomRef}
      adjustTextarea={adjustTextarea}
    />
  );
}
