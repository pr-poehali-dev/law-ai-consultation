import { useState, useEffect, useRef, useCallback } from "react";
import { lawyerMessages } from "@/lib/auth";
import type { User, LawyerMessage, LawyerDialog } from "@/lib/auth";

// Polling только когда пользователь АКТИВНО смотрит на вкладку «Юрист»
// На других вкладках / в фоне — не тратим запросы, push всё равно уведомит
const POLL_ON_EXPERT_TAB = 15_000; // 15 сек — пользователь ждёт ответа и смотрит в экран
const POLL_ADMIN_ON_TAB  = 15_000; // для админа аналогично

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
  const isStartedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isOnExpertTabRef = useRef(activeTab === "expert");
  isOnExpertTabRef.current = activeTab === "expert";

  const userId = user?.id ?? null;
  const isAdmin = user?.isAdmin ?? false;
  const canLoad = !!userId && !isAdmin;

  // ─── Загрузка для обычного пользователя ────────────────────────────────────
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

  // ─── Загрузка для админа ───────────────────────────────────────────────────
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

  // ─── Обычный пользователь: разовая загрузка + visibilitychange ────────────
  // Когда НЕ на вкладке «Юрист» — polling не нужен, push уведомит.
  // Когда на вкладке «Юрист» — polling ниже подхватит.
  useEffect(() => {
    if (!canLoad) { setLoading(false); return; }
    if (isStartedRef.current) return;
    isStartedRef.current = true;

    loadOnce();

    const onVisibility = () => {
      if (document.visibilityState === "visible") loadOnce();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      isStartedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [canLoad, loadOnce]);

  // ─── Polling ТОЛЬКО на вкладке «Юрист» (для обоих: юзер и админ) ──────────
  // Логика: пользователь открыл вкладку «Юрист» и ждёт ответа — опрашиваем каждые 15 сек.
  // Ушёл на другую вкладку кабинета или свернул браузер — останавливаем немедленно.
  const isOnExpertTab = activeTab === "expert";

  useEffect(() => {
    if (!userId) return;
    if (!isOnExpertTab) {
      // Не на вкладке юриста — убиваем polling если был
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }

    const poll = isAdmin ? pollAdmin : loadOnce;
    const interval = isAdmin ? POLL_ADMIN_ON_TAB : POLL_ON_EXPERT_TAB;

    const start = () => {
      if (pollRef.current) return; // уже запущен
      pollRef.current = setInterval(() => {
        if (document.visibilityState === "visible") poll();
      }, interval);
    };

    const stop = () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };

    // Запускаем немедленно при входе на вкладку
    poll();
    start();

    // Пауза когда браузер уходит в фон, возобновление когда возвращается
    const onVisibility = () => {
      if (document.visibilityState === "visible") { poll(); start(); }
      else stop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isOnExpertTab, userId, isAdmin, pollAdmin, loadOnce]);

  // При переходе на вкладку юриста — сбрасываем бейдж
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
