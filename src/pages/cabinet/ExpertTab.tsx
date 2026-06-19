import { useState, useEffect, useRef } from "react";
import type { User } from "@/lib/auth";
import { lawyerSend, lawyerUploadFile, lawyerCloseDialog, lawyerCompleteConsultation } from "@/lib/auth";
import type { LawyerMessage, LawyerDialog } from "@/lib/auth";
import type { ChatMsg } from "./ChatTab";
import type { GenDoc } from "./DocsTab";
import ExpertPaywall from "./ExpertPaywall";
import ExpertDialogList from "./ExpertDialogList";
import ExpertChat from "./ExpertChat";
import EndConsultationModal from "./EndConsultationModal";
import LawyerDashboard from "./LawyerDashboard";
import type { Attachment, FileAttachment, ContentAttachment } from "./ExpertAttachPanel";
import { useAttachment } from "./ExpertAttachPanel";

interface ExpertTabProps {
  user: User;
  messages: ChatMsg[];
  genDocs: GenDoc[];
  lawyerMsgs: LawyerMessage[];
  lawyerDialogs: LawyerDialog[];
  lawyerLoading: boolean;
  selectedAdminUserId: number | null;
  onSelectAdminDialog: (uid: number | null) => void;
  onRefreshLawyer: () => void;
  onRefreshDialog?: () => void;
  onAddOptimisticMsg?: (msg: Omit<LawyerMessage, "id" | "created_at">) => void;
  onPausePing?: () => void;
  onResumePing?: () => void;
  onGoToChat?: () => void;
  onPayClick?: () => void;
  onBuyLawyerQuestions?: () => void;
  onRefreshUser?: () => Promise<void>;
}

export default function ExpertTab({
  user, messages, genDocs,
  lawyerMsgs, lawyerDialogs, lawyerLoading,
  selectedAdminUserId, onSelectAdminDialog,
  onRefreshLawyer, onRefreshDialog, onAddOptimisticMsg,
  onPausePing, onResumePing,
  onGoToChat, onPayClick, onBuyLawyerQuestions,
}: ExpertTabProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [err, setErr] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [adminAction, setAdminAction] = useState<"complete" | "hide" | null>(null);
  const [sentFreeQuestion, setSentFreeQuestion] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    attachments, addAttachment, addFiles, removeAttachment, clearAttachments,
    showAttachPanel, setShowAttachPanel,
    viewFullMsg, setViewFullMsg,
  } = useAttachment();

  // Данные приходят прямо из пропов (из хука) — никаких локальных fetch
  const lmsgs = lawyerMsgs;
  const dialogs = lawyerDialogs;
  const loading = lawyerLoading;

  const isPaid = user.isAdmin || user.paidExpert;
  const isFreeUser = !user.isAdmin && !isPaid && (user.purchasedPlan === null);
  const isDialogClosed = lmsgs.length > 0 && lmsgs.every(m => (m as LawyerMessage & { is_closed?: boolean }).is_closed);
  const hasSentUserMsg = lmsgs.some(m => m.sender === "user");
  const consultationsLeft = user.lawyerConsultationsLeft ?? 0;
  const isBlocked = isFreeUser
    ? (loading || sentFreeQuestion || hasSentUserMsg)
    : (!user.isAdmin && consultationsLeft <= 0);

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
      ...(user.isAdmin && selectedAdminUserId ? { target_user_id: selectedAdminUserId } : {}),
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

    // 1. Показываем сообщение МГНОВЕННО в UI
    onAddOptimisticMsg?.({
      user_id: user.id,
      sender: user.isAdmin ? "admin" : "user",
      body: params.body,
      attachment_type: params.attachment_type,
      attachment_name: params.attachment_name,
      attachment_content: undefined,
      is_read: true,
    });

    // 2. Очищаем форму сразу — не ждём ответа сервера
    setInput("");
    clearAttachments();
    setShowAttachPanel(false);
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }
    if (isFreeUser) setSentFreeQuestion(true);

    // 3. Отправляем на сервер
    lawyerSend(params)
      .then(() => {
        setSending(false);
        setUploadProgress(0);
        if (onRefreshDialog) { onRefreshDialog(); } else { onRefreshLawyer(); }
      })
      .catch(() => {
        setSending(false);
        setUploadProgress(0);
        if (onRefreshDialog) { onRefreshDialog(); } else { onRefreshLawyer(); }
      });
  };

  const handleCompleteConsultation = async () => {
    if (!selectedAdminUserId) return;
    setAdminAction(null);
    setSending(true);
    await lawyerCompleteConsultation(selectedAdminUserId);
    setSending(false);
    onSelectAdminDialog(null);
    onRefreshLawyer();
  };

  const handleHideDialog = async () => {
    if (!selectedAdminUserId) return;
    setAdminAction(null);
    await lawyerCloseDialog(selectedAdminUserId);
    onSelectAdminDialog(null);
    onRefreshLawyer();
  };

  if (!isPaid && !isFreeUser && !user.isAdmin) {
    return <ExpertPaywall onPayClick={onPayClick} />;
  }

  if (user.isAdmin && !selectedAdminUserId) {
    return (
      <LawyerDashboard
        dialogs={dialogs}
        onSelectDialog={(uid) => { onSelectAdminDialog(uid); }}
      />
    );
  }

  const currentDialog = user.isAdmin ? dialogs.find((d) => d.user_id === selectedAdminUserId) : null;
  const aiAnswers = messages.filter(m => m.role === "ai" && m.text.length > 30).slice(-5);
  const currentPlanId = user.purchasedPlan === "max" ? "plan_max"
    : user.purchasedPlan === "pro" ? "plan_pro"
    : "plan_starter";

  return (
    <>
      <ExpertChat
        isAdmin={user.isAdmin}
        isFreeUser={isFreeUser}
        selectedUserId={selectedAdminUserId}
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
        lawyerQLeft={user.lawyerConsultationsLeft ?? 0}
        currentPlanId={currentPlanId}
        onBack={() => { onSelectAdminDialog(null); }}
        onRefresh={onRefreshLawyer}
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
        onGoToChat={onGoToChat}
        textareaRef={textareaRef}
        bottomRef={bottomRef}
        adjustTextarea={adjustTextarea}
      />

      {adminAction === "complete" && (
        <EndConsultationModal
          clientName={currentDialog?.name || `Клиент #${selectedAdminUserId}`}
          clientBalance={currentDialog?.lawyer_consultations_left ?? 1}
          messageCount={lmsgs.length}
          fileCount={lmsgs.filter(m => m.body?.includes("[Прикреплённые файлы]")).length}
          durationMin={lmsgs.length > 0
            ? Math.round((Date.now() - new Date(lmsgs[0].created_at).getTime()) / 60000)
            : 0}
          loading={sending}
          onConfirm={handleCompleteConsultation}
          onCancel={() => setAdminAction(null)}
        />
      )}

      {adminAction === "hide" && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAdminAction(null)} />
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-xs w-full p-5 z-10">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🗂</span>
            </div>
            <h3 className="text-base font-bold text-navy-800 text-center mb-2">Скрыть диалог?</h3>
            <p className="text-sm text-slate-500 text-center mb-5 leading-relaxed">
              Диалог пропадёт из списка. Консультация <strong>не спишется</strong>.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setAdminAction(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                Отмена
              </button>
              <button onClick={handleHideDialog}
                className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-sm font-bold text-white transition-colors">
                Скрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}