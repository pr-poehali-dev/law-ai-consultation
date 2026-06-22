import Icon from "@/components/ui/icon";
import MsgBubble from "./ExpertChatMsgBubble";
import { FunnelFreeBeforeReply, FunnelFreeAfterReply, FunnelPaidExhausted } from "./ExpertChatFunnel";
import type { ExpertChatProps } from "./ExpertChatUtils";

type Props = Pick<
  ExpertChatProps,
  | "isAdmin" | "isFreeUser" | "isBlocked" | "currentPlanId"
  | "lmsgs" | "loading"
  | "onToggleAttachPanel" | "onUpgradePlan" | "onBuyLawyerQuestions"
> & {
  bottomRef: React.RefObject<HTMLDivElement>;
  targetUserId?: number;
};

export default function ExpertChatMessages({
  isAdmin, isFreeUser = false, isBlocked = false, currentPlanId = "plan_starter",
  lmsgs, loading,
  onToggleAttachPanel, onUpgradePlan, onBuyLawyerQuestions,
  bottomRef, targetUserId,
}: Props) {
  const hasSentQuestion = isFreeUser && lmsgs.some(m => m.sender === "user");
  const hasLawyerReply = isFreeUser && lmsgs.some(m => m.sender === "admin");

  return (
    <div
      className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-border bg-gradient-to-b from-slate-50/80 to-white p-3 sm:p-5 space-y-3 sm:space-y-4"
      style={{ scrollbarWidth: "none" }}
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
        </div>
      ) : lmsgs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
          <div className="w-16 h-16 gradient-navy rounded-2xl flex items-center justify-center shadow-lg mx-auto">
            <Icon name="MessageSquarePlus" size={24} className="text-gold-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-navy-700 mb-1">Начните диалог</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Опишите вашу ситуацию, прикрепите документы или ответ AI-консультанта
            </p>
          </div>
          {!isAdmin && (
            <button
              onClick={onToggleAttachPanel}
              className="flex items-center gap-2 px-4 py-2.5 bg-navy-50 hover:bg-navy-100 rounded-xl text-xs font-medium text-navy-700 transition-colors border border-navy-200"
            >
              <Icon name="Paperclip" size={13} />
              Прикрепить файлы или материалы
            </button>
          )}
        </div>
      ) : (
        <>
          {lmsgs.map((m) => <MsgBubble key={m.id} msg={m} isAdmin={isAdmin} targetUserId={targetUserId} />)}

          {isFreeUser && hasSentQuestion && isBlocked && !hasLawyerReply && (
            <FunnelFreeBeforeReply onUpgradePlan={onUpgradePlan} />
          )}

          {isFreeUser && hasLawyerReply && isBlocked && (
            <FunnelFreeAfterReply onUpgradePlan={onUpgradePlan} onBuyLawyerQuestions={onBuyLawyerQuestions} />
          )}

          {isBlocked && !isAdmin && !isFreeUser && (
            <FunnelPaidExhausted
              currentPlanId={currentPlanId}
              onBuyLawyerQuestions={onBuyLawyerQuestions}
              onUpgradePlan={onUpgradePlan}
            />
          )}
        </>
      )}
      <div ref={bottomRef} />
    </div>
  );
}