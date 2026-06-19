import { useState, useEffect, useRef, useCallback } from "react";
import { lawyerMessages } from "@/lib/auth";
import type { User, LawyerMessage, LawyerDialog } from "@/lib/auth";

// Polling только пока пользователь активно смотрит на вкладку «Юрист»
// На других вкладках кабинета и в фоне — 0 запросов, push уведомит
const POLL_INTERVAL = 15_000;

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
  // Защита от двойного вызова — если запрос уже идёт, новый не стартуем
  const fetchingRef = useRef(false);
  const isOnExpertTabRef = useRef(activeTab === "expert");
  isOnExpertTabRef.current = activeTab === "expert";

  const userId = user?.id ?? null;
  const isAdmin = user?.isAdmin ?? false;
  const isOnExpertTab = activeTab === "expert";

  // ─── Единая функция загрузки (дедуплицированная) ────────────────────────────
  const fetchData = useCallback(async () => {
    if (fetchingRef.current) return;           // запрос уже в процессе — пропускаем
    if (document.visibilityState !== "visible") return;
    if (!userId) return;

    fetchingRef.current = true;
    try {
      if (isAdmin) {
        const res = await lawyerMessages({ show_closed: false });
        if (res.dialogs) setDialogs(res.dialogs);
      } else {
        const res = await lawyerMessages();
        if (!res.messages) return;

        const newMsgs = res.messages;
        setMsgs(newMsgs);

        const adminMsgs = newMsgs.filter(m => m.sender === "admin");
        const unread = newMsgs.filter(m => m.sender === "admin" && !m.is_read);
        setUnreadCount(isOnExpertTabRef.current ? 0 : unread.length);

        if (adminMsgs.length > 0) {
          const latest = adminMsgs[adminMsgs.length - 1];
          if (lastSeenIdRef.current === null) {
            lastSeenIdRef.current = latest.id;
          } else if (latest.id > lastSeenIdRef.current && !latest.is_read) {
            lastSeenIdRef.current = latest.id;
            if (!isOnExpertTabRef.current) {
              setNotification({ id: latest.id, body: latest.body });
            }
          }
        }
      }
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [userId, isAdmin]);

  // ─── Управление polling ──────────────────────────────────────────────────────
  // Правило: polling активен ТОЛЬКО когда вкладка «Юрист» открыта И браузер виден.
  // При переходе на другую вкладку кабинета — останавливается немедленно.
  useEffect(() => {
    if (!userId) { setLoading(false); return; }

    const stopPoll = () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
    const startPoll = () => {
      if (pollRef.current) return; // уже запущен, не дублируем
      pollRef.current = setInterval(() => {
        if (document.visibilityState === "visible") fetchData();
      }, POLL_INTERVAL);
    };

    if (isOnExpertTab) {
      fetchData();   // немедленная загрузка при входе на вкладку
      startPoll();   // и запускаем 15-сек polling
    } else {
      stopPoll();    // ушли с вкладки — останавливаем
      fetchData();   // разовая загрузка для бейджа непрочитанных
    }

    // Браузер сворачивается / разворачивается
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchData();
        if (isOnExpertTab) startPoll();
      } else {
        stopPoll();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopPoll();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [userId, isOnExpertTab, fetchData]);

  // Сброс бейджа при переходе на вкладку юриста
  useEffect(() => {
    if (isOnExpertTab) setUnreadCount(0);
  }, [isOnExpertTab]);

  const refresh = useCallback(() => fetchData(), [fetchData]);
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
