import { useState, useEffect, useRef, useCallback } from "react";
import { lawyerMessages } from "@/lib/auth";
import type { User } from "@/lib/auth";

const POLL_INTERVAL = 10000; // 10 секунд

export interface LawyerNotification {
  id: number;
  body: string;
}

interface UseLawyerNotificationsResult {
  unreadCount: number;
  notification: LawyerNotification | null;
  clearNotification: () => void;
}

export function useLawyerNotifications(
  user: User | null,
  activeTab: string
): UseLawyerNotificationsResult {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notification, setNotification] = useState<LawyerNotification | null>(null);
  const lastSeenIdRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isStartedRef = useRef(false);

  // Вычисляем через ref — не перезапускает useEffect при каждом рендере
  const isOnExpertTabRef = useRef(activeTab === "expert");
  isOnExpertTabRef.current = activeTab === "expert";

  // Стабильный флаг — меняется только когда реально меняется доступ
  const userId = user?.id ?? null;
  const isAdmin = user?.isAdmin ?? false;
  const hasPlan = !!(user?.paidExpert || user?.purchasedPlan);
  const canPoll = !!userId && !isAdmin && hasPlan;

  const poll = useCallback(async () => {
    const res = await lawyerMessages();
    if (!res.messages) return;

    const adminMsgs = res.messages.filter(m => m.sender === "admin");
    const unread = res.messages.filter(m => m.sender === "admin" && !m.is_read);

    setUnreadCount(isOnExpertTabRef.current ? 0 : unread.length);

    if (adminMsgs.length === 0) return;

    const latest = adminMsgs[adminMsgs.length - 1];

    // Первый запуск — запоминаем id, тост не показываем
    if (lastSeenIdRef.current === null) {
      lastSeenIdRef.current = latest.id;
      return;
    }

    // Новое сообщение от юриста
    if (latest.id > lastSeenIdRef.current && !latest.is_read) {
      lastSeenIdRef.current = latest.id;
      if (!isOnExpertTabRef.current) {
        setNotification({ id: latest.id, body: latest.body });
      }
    }
  }, []); // poll не зависит ни от чего — всё через refs

  // Запускаем polling ОДИН РАЗ когда появляется доступ
  useEffect(() => {
    if (!canPoll) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      isStartedRef.current = false;
      return;
    }
    if (isStartedRef.current) return; // уже запущен — не перезапускаем
    isStartedRef.current = true;
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL);
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      isStartedRef.current = false;
    };
  }, [canPoll, poll]); // canPoll теперь стабилен — зависит только от примитивов

  // Когда открывают вкладку юриста — сбрасываем бейдж
  useEffect(() => {
    if (activeTab === "expert") setUnreadCount(0);
  }, [activeTab]);

  const clearNotification = useCallback(() => setNotification(null), []);

  return { unreadCount, notification, clearNotification };
}
