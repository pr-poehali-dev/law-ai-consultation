import { useState, useEffect, useRef } from "react";
import type { User } from "@/lib/auth";
import { lawyerSend, lawyerUploadFile, lawyerCloseDialog, lawyerCompleteConsultation } from "@/lib/auth";
import type { LawyerMessage, LawyerDialog } from "@/lib/auth";
import type { ChatMsg } from "./ChatTab";
import type { GenDoc } from "./DocsTab";
import ExpertPaywall from "./ExpertPaywall";
import ExpertDialogList from "./ExpertDialogList";
import ExpertChat from "./ExpertChat";
import type { Attachment, FileAttachment, ContentAttachment } from "./ExpertAttachPanel";
import { useAttachment } from "./ExpertAttachPanel";
import { packToZipParts, totalFilesSize, ZIP_THRESHOLD_BYTES } from "./zipAttachments";

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
  const [uploadStatus, setUploadStatus] = useState("");
  const [err, setErr] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [adminAction, setAdminAction] = useState<"complete" | "hide" | null>(null);
  const [sentFreeQuestion, setSentFreeQuestion] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Ref-флаг для мгновенной блокировки повторной отправки (до ре-рендера)
  const sendingRef = useRef(false);

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
  // Бесплатная предварительная консультация доступна не только тем, кто вообще
  // не покупал тариф, но и тем, кто купил только «Пробный» (purchasedPlan === "trial") —
  // этот тариф не даёт платных консультаций юриста, поэтому такие пользователи
  // должны получить тот же 1 бесплатный вопрос, что и незарегистрированные без тарифа
  const isFreeUser = !user.isAdmin && !isPaid && (user.purchasedPlan === null || user.purchasedPlan === "trial");
  const isDialogClosed = lmsgs.length > 0 && lmsgs.every(m => (m as LawyerMessage & { is_closed?: boolean }).is_closed);
  const hasSentUserMsg = lmsgs.some(m => m.sender === "user");
  const consultationsLeft = user.lawyerConsultationsLeft ?? 0;
  const isBlocked = isFreeUser
    ? (loading || sentFreeQuestion || hasSentUserMsg)
    : (!user.isAdmin && consultationsLeft <= 0);

  useEffect(() => {
    if (lmsgs.length <= 1) bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [lmsgs.length <= 1]);

  const adjustTextarea = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  };

  const send = async () => {
    if (isBlocked || isDialogClosed) return;
    if (sendingRef.current) return; // мгновенная блокировка повторной отправки
    const text = input.trim();
    if (!text && attachments.length === 0) return;
    sendingRef.current = true;
    setSending(true);
    setErr("");
    setUploadProgress(0);
    setUploadStatus("");
    try {

    const fileAtts = attachments.filter(a => a.type === "file") as FileAttachment[];
    const contentAtts = attachments.filter(a => a.type !== "file") as ContentAttachment[];
    const uploadedUrls: { name: string; url: string }[] = [];

    if (fileAtts.length > 0) {
      const needsZip = totalFilesSize(fileAtts) > ZIP_THRESHOLD_BYTES;

      if (needsZip) {
        // Упаковываем в ZIP-части по ~3 МБ и загружаем последовательно
        setUploadProgress(10);
        setUploadStatus("Сжимаем файлы...");
        const parts = await packToZipParts(fileAtts);
        if (!parts || parts.length === 0) {
          setErr("Ошибка создания архива");
          sendingRef.current = false;
          setSending(false);
          setUploadProgress(0);
          setUploadStatus("");
          return;
        }
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          setUploadProgress(Math.round(10 + ((i / parts.length) * 80)));
          setUploadStatus(parts.length > 1 ? `Загружаем часть ${i + 1} из ${parts.length}...` : "Загружаем архив...");
          const res = await lawyerUploadFile(part.b64, part.name);
          if (res.error) {
            setErr(`Ошибка загрузки архива (часть ${i + 1}): ${res.error}`);
            sendingRef.current = false;
            setSending(false);
            setUploadProgress(0);
            setUploadStatus("");
            return;
          }
          if (res.url) uploadedUrls.push({ name: part.name, url: res.url });
        }
        setUploadProgress(90);
        setUploadStatus("Отправляем...");
      } else {
        // Загружаем файлы по одному
        for (let i = 0; i < fileAtts.length; i++) {
          const f = fileAtts[i];
          setUploadProgress(Math.round((i / fileAtts.length) * 80));
          setUploadStatus(fileAtts.length > 1 ? `Файл ${i + 1} из ${fileAtts.length}...` : "Загружаем файл...");
          const res = await lawyerUploadFile(f.b64, f.name);
          if (res.error) {
            setErr(`Ошибка загрузки ${f.name}: ${res.error}`);
            sendingRef.current = false;
            setSending(false);
            setUploadProgress(0);
            setUploadStatus("");
            return;
          }
          if (res.url) uploadedUrls.push({ name: f.name, url: res.url });
        }
        setUploadProgress(90);
        setUploadStatus("Отправляем...");
      }
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

    // 1. Очищаем форму, показываем сообщение мгновенно, паузируем polling
    setInput("");
    clearAttachments();
    setShowAttachPanel(false);
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }
    if (isFreeUser) setSentFreeQuestion(true);
    onPausePing?.();
    onAddOptimisticMsg?.({
      user_id: user.id,
      sender: user.isAdmin ? "admin" : "user",
      body: params.body,
      attachment_type: params.attachment_type,
      attachment_name: params.attachment_name,
      attachment_content: undefined,
      is_read: true,
    });

    // 2. Отправляем, потом загружаем один раз, потом возобновляем polling
    lawyerSend(params)
      .then(() => {
        sendingRef.current = false;
        setSending(false);
        setUploadProgress(0);
        setUploadStatus("");
        if (onRefreshDialog) { onRefreshDialog(); } else { onRefreshLawyer(); }
        onResumePing?.();
      })
      .catch(() => {
        sendingRef.current = false;
        setSending(false);
        setUploadProgress(0);
        setUploadStatus("");
        if (onRefreshDialog) { onRefreshDialog(); } else { onRefreshLawyer(); }
        onResumePing?.();
      });
    } catch (e) {
      sendingRef.current = false;
      setSending(false);
      setUploadProgress(0);
      setUploadStatus("");
      onResumePing?.();
      setErr("Ошибка при отправке. Попробуйте ещё раз.");
    }
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
      <ExpertDialogList
        dialogs={dialogs}
        loading={loading}
        showArchive={showArchive}
        onToggleArchive={() => { setShowArchive(v => !v); }}
        onSelect={(uid) => { onSelectAdminDialog(uid); }}
        onRefresh={onRefreshLawyer}
      />
    );
  }

  const currentDialog = user.isAdmin ? dialogs.find((d) => d.user_id === selectedAdminUserId) : null;
  const aiAnswers = messages.filter(m => m.role === "ai" && m.text.length > 30).slice(-5);
  const currentPlanId = user.purchasedPlan === "max" ? "plan_max"
    : user.purchasedPlan === "pro" ? "plan_pro"
    : "plan_starter";

  return (
    <div className="flex-1 flex flex-col min-h-0">
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
        uploadStatus={uploadStatus}
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
    </div>
  );
}