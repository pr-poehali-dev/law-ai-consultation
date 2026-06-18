import { useState, useEffect, useRef, useCallback } from "react";
import { lawyerMessages } from "@/lib/auth";
import type { User, LawyerMessage, LawyerDialog } from "@/lib/auth";

const POLL_INTERVAL = 20000; // 20 секунд

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
  // Поллим для платных и free-пользователей (без тарифа — 1 бесплатная консультация)
  const isFreeUser = !isAdmin && !hasPlan;
  const canPoll = !!userId && !isAdmin && (hasPlan || isFreeUser);

  const poll = useCallback(async () => {
    const res = await lawyerMessages();
    if (!res.messages) return;

    setMsgs(res.messages);

    const adminMsgs = res.messages.filter(m => m.sender === "admin");
    const unread = res.messages.filter(m => m.sender === "admin" && !m.is_read);

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
    const res = await lawyerMessages({ show_closed: false });
    if (res.dialogs) setDialogs(res.dialogs);
    setLoading(false);
  }, []);

  const refresh = useCallback(() => {
    if (isAdmin) {
      pollAdmin();
    } else if (canPoll) {
      poll();
    }
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
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL);
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      isStartedRef.current = false;
    };
  }, [canPoll, poll]);

  // Polling для админа — только когда на вкладке юриста
  useEffect(() => {
    if (!isAdmin || activeTab !== "expert") return;
    setLoading(true);
    pollAdmin();
    const iv = setInterval(pollAdmin, POLL_INTERVAL);
    return () => clearInterval(iv);
  }, [isAdmin, activeTab, pollAdmin]);

  // Когда открывают вкладку юриста — немедленно обновляем и сбрасываем бейдж
  useEffect(() => {
    if (activeTab === "expert") {
      setUnreadCount(0);
      refresh();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

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
