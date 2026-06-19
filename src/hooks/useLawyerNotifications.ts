import { useState, useEffect, useRef, useCallback } from "react";
import { lawyerMessages } from "@/lib/auth";
import type { User, LawyerMessage, LawyerDialog } from "@/lib/auth";

// Polling только для АДМИНА (видит все диалоги, ему нужна актуальность)
const POLL_ADMIN = 20000;

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
  const canLoad = !!userId && !isAdmin; // обычные пользователи — только разовая загрузка

  // ─── Разовая загрузка для обычных пользователей ─────────────────────────────
  // Push-уведомления заменяют polling: юзер получает push и открывает кабинет.
  // При открытии кабинета данные грузятся один раз. Повтор — только при явном refresh.
  const loadOnce = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const res = await lawyerMessages();
    if (!res.messages) { setLoading(false); return; }

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

  // ─── Polling для АДМИНА ──────────────────────────────────────────────────────
  const pollAdmin = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const res = await lawyerMessages({ show_closed: false });
    if (res.dialogs) setDialogs(res.dialogs);
    setLoading(false);
  }, []);

  const refresh = useCallback(() => {
    if (isAdmin) pollAdmin();
    else if (canLoad) loadOnce();
  }, [isAdmin, canLoad, loadOnce, pollAdmin]);

  // Разовая загрузка при маунте для обычных пользователей
  useEffect(() => {
    if (!canLoad) { setLoading(false); return; }
    if (isStartedRef.current) return;
    isStartedRef.current = true;

    loadOnce();

    // При возврате вкладки — тоже обновляем (мог прийти push пока вкладка была скрыта)
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadOnce();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      isStartedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [canLoad, loadOnce]);

  // Polling для админа — только на вкладке юриста, останавливается в фоне
  useEffect(() => {
    if (!isAdmin || activeTab !== "expert") return;
    setLoading(true);

    const start = () => {
      pollAdmin();
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(pollAdmin, POLL_ADMIN);
    };
    const stop = () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isAdmin, activeTab, pollAdmin]);

  // При переходе на вкладку юриста — сбрасываем бейдж и обновляем данные
  useEffect(() => {
    if (activeTab === "expert") {
      setUnreadCount(0);
      if (!isAdmin) loadOnce(); // обновить при открытии вкладки
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
