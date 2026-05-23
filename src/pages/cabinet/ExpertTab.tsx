import { useState, useEffect, useRef, useCallback } from "react";
import type { User } from "@/lib/auth";
import { lawyerSend, lawyerMessages, lawyerUploadFile } from "@/lib/auth";
import type { LawyerMessage, LawyerDialog } from "@/lib/auth";
import type { ChatMsg } from "./ChatTab";
import type { GenDoc } from "./DocsTab";
import ExpertPaywall from "./ExpertPaywall";
import ExpertDialogList from "./ExpertDialogList";
import ExpertChat from "./ExpertChat";
import type { Attachment, FileAttachment, ContentAttachment } from "./ExpertAttachPanel";
import { useAttachment } from "./ExpertAttachPanel";

interface ExpertTabProps {
  user: User;
  messages: ChatMsg[];
  genDocs: GenDoc[];
  onPayClick?: () => void;
  onBuyLawyerQuestions?: () => void;
}

export default function ExpertTab({ user, messages, genDocs, onPayClick, onBuyLawyerQuestions }: ExpertTabProps) {
  const [lmsgs, setLmsgs] = useState<LawyerMessage[]>([]);
  const [dialogs, setDialogs] = useState<LawyerDialog[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [lawyerQLeft, setLawyerQLeft] = useState<number>(user.lawyerQuestionsLeft ?? 0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    attachments, addAttachment, addFiles, removeAttachment, clearAttachments,
    showAttachPanel, setShowAttachPanel,
    viewFullMsg, setViewFullMsg,
  } = useAttachment();

  const isPaid = user.isAdmin || user.paidExpert;
  const isBlocked = !user.isAdmin && isPaid && lawyerQLeft <= 0;

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

  useEffect(() => {
    setLawyerQLeft(user.lawyerQuestionsLeft ?? 0);
  }, [user.lawyerQuestionsLeft]);

  const adjustTextarea = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  };

  const send = async () => {
    if (isBlocked) return;
    const text = input.trim();
    if (!text && attachments.length === 0) return;
    setSending(true);
    setErr("");
    setUploadProgress(0);

    const fileAtts = attachments.filter(a => a.type === "file") as FileAttachment[];
    const contentAtts = attachments.filter(a => a.type !== "file") as ContentAttachment[];
    const uploadedUrls: { name: string; url: string }[] = [];

    if (fileAtts.length > 0) {
      for (let i = 0; i < fileAtts.length; i++) {
        const f = fileAtts[i];
        setUploadProgress(Math.round(((i) / fileAtts.length) * 80));
        const res = await lawyerUploadFile(f.b64, f.name);
        if (res.error) {
          setErr(`Ошибка загрузки ${f.name}: ${res.error}`);
          setSending(false);
          setUploadProgress(0);
          return;
        }
        if (res.url) uploadedUrls.push({ name: f.name, url: res.url });
      }
      setUploadProgress(90);
    }

    const bodyParts: string[] = [];
    if (text) bodyParts.push(text);
    if (uploadedUrls.length > 0) {
      const fileLinks = uploadedUrls.map(f => `📎 ${f.name}: ${f.url}`).join("\n");
      bodyParts.push(`[Прикреплённые файлы]\n${fileLinks}`);
    }
    const bodyText = bodyParts.join("\n").trim() || (contentAtts[0] ? `Прикрепляю: ${contentAtts[0].name}` : "");

    const firstContent = contentAtts[0] || null;
    const params: Parameters<typeof lawyerSend>[0] = {
      body: bodyText,
      ...(user.isAdmin && selectedUserId ? { target_user_id: selectedUserId } : {}),
      ...(firstContent ? {
        attachment_type: firstContent.type,
        attachment_name: firstContent.name,
        attachment_content: firstContent.content || firstContent.name,
      } : {}),
    };

    if (contentAtts.length > 1) {
      const extra = contentAtts.slice(1).map(a => `📄 ${a.name}`).join("\n");
      params.body = params.body + `\n\nТакже прикреплено:\n${extra}`;
    }

    const res = await lawyerSend(params);
    setUploadProgress(100);
    if (res.error) { setErr(res.error); setSending(false); setUploadProgress(0); return; }

    if (!user.isAdmin && res.lawyer_questions_left !== undefined) {
      setLawyerQLeft(res.lawyer_questions_left);
    } else if (!user.isAdmin) {
      setLawyerQLeft(prev => Math.max(0, prev - 1));
    }

    setInput("");
    clearAttachments();
    setShowAttachPanel(false);
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }
    await loadMessages();
    setSending(false);
    setUploadProgress(0);
  };

  if (!isPaid && !user.isAdmin) {
    return <ExpertPaywall onPayClick={onPayClick} />;
  }

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

  const currentDialog = user.isAdmin ? dialogs.find((d) => d.user_id === selectedUserId) : null;
  const aiAnswers = messages.filter(m => m.role === "ai" && m.text.length > 30).slice(-5);

  const currentPlanId = (user.paidQuestions ?? 0) >= 300 ? "plan_max"
    : (user.paidQuestions ?? 0) >= 100 ? "plan_pro"
    : "plan_starter";

  return (
    <ExpertChat
      isAdmin={user.isAdmin}
      selectedUserId={selectedUserId}
      currentDialog={currentDialog}
      lmsgs={lmsgs}
      loading={loading}
      input={input}
      sending={sending}
      uploadProgress={uploadProgress}
      err={err}
      attachments={attachments}
      showAttachPanel={showAttachPanel}
      viewFullMsg={viewFullMsg}
      aiAnswers={aiAnswers}
      genDocs={genDocs}
      isBlocked={isBlocked}
      lawyerQLeft={lawyerQLeft}
      currentPlanId={currentPlanId}
      onBack={() => { setSelectedUserId(null); setLmsgs([]); }}
      onRefresh={loadMessages}
      onInputChange={setInput}
      onSend={send}
      onToggleAttachPanel={() => setShowAttachPanel(p => !p)}
      onHideAttachPanel={() => setShowAttachPanel(false)}
      onAddAttachment={addAttachment}
      onAddFiles={addFiles}
      onRemoveAttachment={removeAttachment}
      onViewFullMsg={setViewFullMsg}
      onCloseFullMsg={() => setViewFullMsg(null)}
      onBuyLawyerQuestions={onBuyLawyerQuestions}
      onUpgradePlan={onPayClick}
      textareaRef={textareaRef}
      bottomRef={bottomRef}
      adjustTextarea={adjustTextarea}
    />
  );
}
