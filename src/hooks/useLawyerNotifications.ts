import { useState, useEffect, useRef, useCallback } from "react";
import { lawyerMessages } from "@/lib/auth";
import type { User, LawyerMessage, LawyerDialog } from "@/lib/auth";

// Интервалы polling в зависимости от типа пользователя
const POLL_PAID = 20000;  // 20 сек — платный пользователь (активная переписка)
const POLL_FREE = 60000;  // 60 сек — бесплатный (1 вопрос, нечасто меняется)

export interface LawyerNotification {
  id: number;
  body: string;
}

interface UseLawyerNotificationsResult {
  unreadCount: number;
  notification: LawyerNotification | null;
  clearNotification: () => void;
  lawyerMessages: LawyerMessage[];
  lawyerDialogs: LawyerDialog[];
  lawyerLoading: boolean;
  refreshLawyer: () => void;
}

export function useLawyerNotifications(
  user: User | null,
  activeTab: string
): UseLawyerNotificationsResult {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notification, setNotification] = useState<LawyerNotification | null>(null);
  const [msgs, setMsgs] = useState<LawyerMessage[]>([]);
  const [dialogs, setDialogs] = useState<LawyerDialog[]>([]);
  const [loading, setLoading] = useState(true);
  const lastSeenIdRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isStartedRef = useRef(false);
  const isOnExpertTabRef = useRef(activeTab === "expert");
  isOnExpertTabRef.current = activeTab === "expert";

  const userId = user?.id ?? null;
  const isAdmin = user?.isAdmin ?? false;
  const hasPlan = !!(user?.paidExpert || user?.purchasedPlan);
  // Polling запускаем для всех авторизованных не-админов
  const canPoll = !!userId && !isAdmin;

  // Платный — 20 сек, бесплатный — 60 сек (1 вопрос, меняется редко)
  const getPollInterval = () => hasPlan ? POLL_PAID : POLL_FREE;

  const poll = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const res = await lawyerMessages();
    if (!res.messages) return;

    const newMsgs = res.messages;
    setMsgs(newMsgs);

    const adminMsgs = newMsgs.filter(m => m.sender === "admin");
    const unread = newMsgs.filter(m => m.sender === "admin" && !m.is_read);

    setUnreadCount(isOnExpertTabRef.current ? 0 : unread.length);
    setLoading(false);

    if (adminMsgs.length === 0) return;
    const latest = adminMsgs[adminMsgs.length - 1];

    if (lastSeenIdRef.current === null) {
      lastSeenIdRef.current = latest.id;
      return;
    }
    if (latest.id > lastSeenIdRef.current && !latest.is_read) {
      lastSeenIdRef.current = latest.id;
      if (!isOnExpertTabRef.current) {
        setNotification({ id: latest.id, body: latest.body });
      }
    }
  }, []);

  const pollAdmin = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const res = await lawyerMessages({ show_closed: false });
    if (res.dialogs) setDialogs(res.dialogs);
    setLoading(false);
  }, []);

  const refresh = useCallback(() => {
    if (isAdmin) pollAdmin();
    else if (canPoll) poll();
  }, [isAdmin, canPoll, poll, pollAdmin]);

  // Polling для обычных пользователей
  useEffect(() => {
    if (!canPoll) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      isStartedRef.current = false;
      setLoading(false);
      return;
    }
    if (isStartedRef.current) return;
    isStartedRef.current = true;

    const startPolling = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(poll, getPollInterval());
    };

    const stopPolling = () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        poll(); // немедленный запрос при возврате
        startPolling();
      } else {
        stopPolling();
      }
    };

    // Первый запрос сразу, потом интервал
    poll().then(() => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(poll, getPollInterval());
    });

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopPolling();
      isStartedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPoll, poll]);

  // Polling для админа — только на вкладке юриста, останавливается в фоне
  useEffect(() => {
    if (!isAdmin || activeTab !== "expert") return;
    setLoading(true);

    const startAdminPolling = () => {
      pollAdmin();
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(pollAdmin, POLL_PAID);
    };

    const stopAdminPolling = () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") startAdminPolling();
      else stopAdminPolling();
    };

    startAdminPolling();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopAdminPolling();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isAdmin, activeTab, pollAdmin]);

  // При переходе на вкладку юриста — сбрасываем бейдж (НЕ делаем лишний refresh,
  // т.к. polling уже идёт и следующий tick обновит данные)
  useEffect(() => {
    if (activeTab === "expert") {
      setUnreadCount(0);
    }
  }, [activeTab]);

  const clearNotification = useCallback(() => setNotification(null), []);

  return {
    unreadCount,
    notification,
    clearNotification,
    lawyerMessages: msgs,
    lawyerDialogs: dialogs,
    lawyerLoading: loading,
    refreshLawyer: refresh,
  };
}