import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { EXPERT_NAME } from "./ExpertChatUtils";
import type { ExpertChatProps } from "./ExpertChatUtils";
import { subscribeToPush, isPushSupported, isPushGranted } from "@/lib/pushNotifications";

type Props = Pick<
  ExpertChatProps,
  | "isAdmin" | "isFreeUser" | "selectedUserId" | "currentDialog"
  | "lawyerQLeft" | "onBack" | "onRefresh" | "onCompleteConsultation" | "onHideDialog"
>;

export default function ExpertChatHeader({
  isAdmin, isFreeUser = false, selectedUserId, currentDialog,
  lawyerQLeft = 0, onBack, onRefresh, onCompleteConsultation, onHideDialog,
}: Props) {
  const [pushNeedsSetup, setPushNeedsSetup] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushDone, setPushDone] = useState(false);

  useEffect(() => {
    if (!isPushSupported() || isAdmin) return;
    if (!isPushGranted()) {
      setPushNeedsSetup(true);
      return;
    }
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => {
        if (!sub) setPushNeedsSetup(true);
      })
    ).catch(() => {});
  }, [isAdmin]);

  const handleEnablePush = useCallback(async () => {
    setPushLoading(true);
    const ok = await subscribeToPush(true);
    setPushLoading(false);
    if (ok) {
      setPushDone(true);
      setPushNeedsSetup(false);
    }
  }, []);

  return (
    <div className="flex items-center gap-2 sm:gap-3 bg-white rounded-2xl border border-border px-3 sm:px-4 py-3 shadow-sm shrink-0">
      {isAdmin && (
        <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors shrink-0">
          <Icon name="ArrowLeft" size={16} className="text-navy-600" />
        </button>
      )}
      <div className="relative shrink-0">
        <div className="w-9 h-9 sm:w-10 sm:h-10 gradient-navy rounded-xl flex items-center justify-center shadow-sm">
          <Icon name="UserCheck" size={15} className="text-gold-400" />
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-navy-800 truncate">
          {isAdmin ? (currentDialog?.name ?? `Клиент #${selectedUserId}`) : EXPERT_NAME}
        </p>
        <p className="text-[11px] font-medium truncate" style={{ color: isAdmin ? "#64748b" : "#059669" }}>
          {isAdmin
            ? (currentDialog?.email ?? "")
            : "Онлайн · ответит в течение 1–3 ч"}
        </p>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onCompleteConsultation}
            title="Завершить консультацию (списать 1 консультацию)"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:shadow-sm active:scale-95"
            style={{ background: "rgba(5,150,105,0.1)", color: "#059669", border: "1px solid rgba(5,150,105,0.2)" }}
          >
            <Icon name="CheckCircle" size={13} />
            <span className="hidden sm:inline">Завершить</span>
          </button>
          <button
            onClick={onHideDialog}
            title="Скрыть диалог (без списания)"
            className="p-2 rounded-xl transition-colors hover:bg-slate-100"
          >
            <Icon name="EyeOff" size={14} className="text-slate-400" />
          </button>
          <button onClick={onRefresh} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <Icon name="RefreshCw" size={14} className="text-muted-foreground" />
          </button>
        </div>
      )}

      {!isAdmin && (
        <>
          {isFreeUser ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shrink-0 bg-amber-50 border border-amber-200">
              <Icon name="Gift" size={11} className="text-amber-500" />
              <span className="text-[11px] font-bold text-amber-700">Бесплатно</span>
            </div>
          ) : (
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shrink-0 ${
              lawyerQLeft === 0
                ? "bg-red-50 border border-red-200"
                : lawyerQLeft <= 2
                  ? "bg-amber-50 border border-amber-200"
                  : "bg-emerald-50 border border-emerald-200"
            }`}>
              <Icon
                name="UserCheck"
                size={11}
                className={lawyerQLeft === 0 ? "text-red-500" : lawyerQLeft <= 2 ? "text-amber-500" : "text-emerald-600"}
              />
              <span className={`text-[11px] font-bold ${lawyerQLeft === 0 ? "text-red-600" : lawyerQLeft <= 2 ? "text-amber-700" : "text-emerald-700"}`}>
                {lawyerQLeft}
              </span>
              <span className={`text-[10px] font-medium ${lawyerQLeft === 0 ? "text-red-400" : lawyerQLeft <= 2 ? "text-amber-500" : "text-emerald-500"}`}>
                конс.
              </span>
            </div>
          )}
          {pushNeedsSetup && !pushDone && (
            <button
              onClick={handleEnablePush}
              disabled={pushLoading}
              title="Включить уведомления о новых сообщениях от юриста"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all active:scale-95 shrink-0"
              style={{ background: "rgba(15,76,129,0.08)", color: "#0f4c81", border: "1px solid rgba(15,76,129,0.2)" }}
            >
              {pushLoading
                ? <span className="w-3 h-3 border-2 border-navy-400 border-t-transparent rounded-full animate-spin" />
                : <Icon name="Bell" size={12} />}
              <span className="hidden sm:inline">Уведомления</span>
            </button>
          )}
          {pushDone && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold px-2">
              <Icon name="BellRing" size={12} />
              <span className="hidden sm:inline">Включены</span>
            </span>
          )}
          <button onClick={onRefresh} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <Icon name="RefreshCw" size={14} className="text-muted-foreground" />
          </button>
        </>
      )}
    </div>
  );
}
