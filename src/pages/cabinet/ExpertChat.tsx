import { useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { ExpertChatProps } from "./ExpertChatUtils";
import ExpertChatHeader from "./ExpertChatHeader";
import ExpertChatMessages from "./ExpertChatMessages";
import ExpertChatInput from "./ExpertChatInput";

// Таймаут бездействия: 5 мин → автопереход на Chat AI
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export default function ExpertChat({
  isAdmin, isFreeUser = false, isDialogClosed = false, selectedUserId, currentDialog, lmsgs, loading,
  input, sending, uploadProgress, err, attachments, showAttachPanel, viewFullMsg,
  aiAnswers, genDocs, isBlocked = false, lawyerQLeft = 0, currentPlanId = "plan_starter",
  onBack, onRefresh, onInputChange, onSend,
  onToggleAttachPanel, onHideAttachPanel,
  onAddAttachment, onAddFiles, onRemoveAttachment,
  onViewFullMsg, onCloseFullMsg,
  onBuyLawyerQuestions, onUpgradePlan,
  onCompleteConsultation, onHideDialog, onGoToChat,
  textareaRef, bottomRef, adjustTextarea,
}: ExpertChatProps) {
  const hasSentQuestion = isFreeUser && lmsgs.some(m => m.sender === "user");

  // Баннер: 1 бесплатный вопрос (только для free-пользователей до отправки)
  const showFreeBanner = isFreeUser && !hasSentQuestion;

  // Автопереход на Chat AI через 5 мин бездействия
  useEffect(() => {
    if (!onGoToChat) return;
    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        onGoToChat();
      }, IDLE_TIMEOUT_MS);
    };

    const events = ["mousemove", "keydown", "touchstart", "click", "scroll"];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [onGoToChat]);

  return (
    <div className="max-w-3xl w-full mx-auto flex flex-col gap-2 sm:gap-3 flex-1 min-h-0 pb-tab-bar md:pb-4 overflow-hidden">

      <ExpertChatHeader
        isAdmin={isAdmin}
        isFreeUser={isFreeUser}
        selectedUserId={selectedUserId}
        currentDialog={currentDialog}
        lawyerQLeft={lawyerQLeft}
        onBack={onBack}
        onRefresh={onRefresh}
        onCompleteConsultation={onCompleteConsultation}
        onHideDialog={onHideDialog}
      />

      {showFreeBanner && (
        <div className="shrink-0 rounded-2xl overflow-hidden border border-amber-200/60 bg-gradient-to-r from-amber-50 to-orange-50 shadow-sm">
          <div className="px-4 py-3 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="Gift" size={15} className="text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">1 бесплатный вопрос юристу</p>
              <p className="text-xs text-amber-700/80 mt-1 leading-relaxed">
                Опишите вашу ситуацию как можно подробнее — юрист ответит в течение 1–3 часов.
              </p>
            </div>
          </div>
        </div>
      )}

      <ExpertChatMessages
        isAdmin={isAdmin}
        isFreeUser={isFreeUser}
        isBlocked={isBlocked}
        currentPlanId={currentPlanId}
        lmsgs={lmsgs}
        loading={loading}
        onToggleAttachPanel={onToggleAttachPanel}
        onUpgradePlan={onUpgradePlan}
        onBuyLawyerQuestions={onBuyLawyerQuestions}
        bottomRef={bottomRef}
      />

      <ExpertChatInput
        isAdmin={isAdmin}
        isBlocked={isBlocked}
        isDialogClosed={isDialogClosed}
        input={input}
        sending={sending}
        uploadProgress={uploadProgress}
        err={err}
        attachments={attachments}
        showAttachPanel={showAttachPanel}
        viewFullMsg={viewFullMsg}
        aiAnswers={aiAnswers}
        genDocs={genDocs}
        onInputChange={onInputChange}
        onSend={onSend}
        onToggleAttachPanel={onToggleAttachPanel}
        onHideAttachPanel={onHideAttachPanel}
        onAddAttachment={onAddAttachment}
        onAddFiles={onAddFiles}
        onRemoveAttachment={onRemoveAttachment}
        onViewFullMsg={onViewFullMsg}
        onCloseFullMsg={onCloseFullMsg}
        textareaRef={textareaRef}
        adjustTextarea={adjustTextarea}
      />
    </div>
  );
}