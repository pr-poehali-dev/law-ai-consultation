import { useState, useEffect, useRef, useCallback } from "react";
import type { User } from "@/lib/auth";
import { lawyerSend, lawyerMessages, lawyerUploadFile, lawyerCloseDialog, lawyerCompleteConsultation } from "@/lib/auth";
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
  const [showArchive, setShowArchive] = useState(false);
  const [adminAction, setAdminAction] = useState<"complete" | "hide" | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    attachments, addAttachment, addFiles, removeAttachment, clearAttachments,
    showAttachPanel, setShowAttachPanel,
    viewFullMsg, setViewFullMsg,
  } = useAttachment();

  const isPaid = user.isAdmin || user.paidExpert;
  // Пользователь без тарифа — 1 бесплатная предварительная консультация (через lawyerQuestionsLeft)
  const isFreeUser = !user.isAdmin && !isPaid && (user.purchasedPlan === null);
  // Для free-пользователей блокируем по lawyerQuestionsLeft (старая механика, только для бесплатной)
  // Для платных — не блокируем по вопросам, блокировка только через завершение консультации юристом
  const isDialogClosed = lmsgs.length > 0 && lmsgs.every(m => (m as LawyerMessage & { is_closed?: boolean }).is_closed);
  const isBlocked = isFreeUser
    ? (user.lawyerQuestionsLeft ?? 0) <= 0 && lmsgs.some(m => m.sender === "user")
    : false;

  const loadMessages = useCallback(async () => {
    if (!isPaid && !isFreeUser && !user.isAdmin) return;
    if (user.isAdmin && !selectedUserId) {
      const res = await lawyerMessages({ show_closed: showArchive });
      if (res.dialogs) setDialogs(res.dialogs);
      setLoading(false);
      return;
    }
    const params = user.isAdmin && selectedUserId ? { target_user_id: selectedUserId } : {};
    const res = await lawyerMessages(params);
    if (res.messages) setLmsgs(res.messages);
    setLoading(false);
  }, [isPaid, isFreeUser, user.isAdmin, selectedUserId, showArchive]);

  useEffect(() => {
    if (!isPaid && !isFreeUser && !user.isAdmin) { setLoading(false); return; }
    loadMessages();
    pollRef.current = setInterval(loadMessages, 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadMessages, isPaid, isFreeUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lmsgs]);

  const adjustTextarea = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  };

  const send = async () => {
    if (isBlocked || isDialogClosed) return;
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

    setInput("");
    clearAttachments();
    setShowAttachPanel(false);
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }
    await loadMessages();
    setSending(false);
    setUploadProgress(0);
  };

  // Завершить консультацию (списывает 1 консультацию + скрывает диалог)
  const handleCompleteConsultation = async () => {
    if (!selectedUserId) return;
    setAdminAction(null);
    setSending(true);
    await lawyerCompleteConsultation(selectedUserId);
    setSending(false);
    setSelectedUserId(null);
    setLmsgs([]);
    await loadMessages();
  };

  // Скрыть диалог (без списания консультации)
  const handleHideDialog = async () => {
    if (!selectedUserId) return;
    setAdminAction(null);
    await lawyerCloseDialog(selectedUserId);
    setSelectedUserId(null);
    setLmsgs([]);
    await loadMessages();
  };

  if (!isPaid && !isFreeUser && !user.isAdmin) {
    return <ExpertPaywall onPayClick={onPayClick} />;
  }

  if (user.isAdmin && !selectedUserId) {
    return (
      <ExpertDialogList
        dialogs={dialogs}
        loading={loading}
        showArchive={showArchive}
        onToggleArchive={() => { setShowArchive(v => !v); }}
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
    <>
      <ExpertChat
        isAdmin={user.isAdmin}
        isFreeUser={isFreeUser}
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
        isDialogClosed={isDialogClosed}
        lawyerQLeft={user.lawyerQuestionsLeft ?? 0}
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
        onCompleteConsultation={() => setAdminAction("complete")}
        onHideDialog={() => setAdminAction("hide")}
        textareaRef={textareaRef}
        bottomRef={bottomRef}
        adjustTextarea={adjustTextarea}
      />

      {/* Модал подтверждения для админа */}
      {adminAction && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setAdminAction(null)} />
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 z-10">
            {adminAction === "complete" ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">✅</span>
                </div>
                <h3 className="text-base font-bold text-navy-800 text-center mb-2">Завершить консультацию?</h3>
                <p className="text-sm text-slate-500 text-center mb-5 leading-relaxed">
                  Диалог будет скрыт, у пользователя спишется <strong>1 консультация</strong> из баланса.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setAdminAction(null)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                    Отмена
                  </button>
                  <button onClick={handleCompleteConsultation}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
                    style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}>
                    Завершить
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🗂</span>
                </div>
                <h3 className="text-base font-bold text-navy-800 text-center mb-2">Скрыть диалог?</h3>
                <p className="text-sm text-slate-500 text-center mb-5 leading-relaxed">
                  Диалог пропадёт из списка. Консультация <strong>не спишется</strong>. При новом сообщении от пользователя — появится снова.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setAdminAction(null)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                    Отмена
                  </button>
                  <button onClick={handleHideDialog}
                    className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-sm font-bold text-white transition-colors">
                    Скрыть
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
