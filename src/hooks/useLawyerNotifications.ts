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

  // Стабильные примитивы — не пересоздают замыкания при каждом рендере
  const canPoll = !!(user && !user.isAdmin && (user.paidExpert || !!user.purchasedPlan));
  const isOnExpertTab = activeTab === "expert";

  // Ref для текущего значения вкладки — чтобы poll не захватывал устаревшее значение
  const isOnExpertTabRef = useRef(isOnExpertTab);
  isOnExpertTabRef.current = isOnExpertTab;

  const poll = useCallback(async () => {
    const res = await lawyerMessages();
    if (!res.messages) return;

    const adminMsgs = res.messages.filter(m => m.sender === "admin");
    const unread = res.messages.filter(m => m.sender === "admin" && !m.is_read);

    // Бейдж — всегда обновляем (даже на вкладке юриста сбросится через отдельный effect)
    setUnreadCount(isOnExpertTabRef.current ? 0 : unread.length);

    if (adminMsgs.length === 0) return;

    const latest = adminMsgs[adminMsgs.length - 1];

    // При первой загрузке просто запоминаем последний id — тост не показываем
    if (lastSeenIdRef.current === null) {
      lastSeenIdRef.current = latest.id;
      return;
    }

    // Новое сообщение от юриста — показываем тост только если не на вкладке юриста
    if (latest.id > lastSeenIdRef.current && !latest.is_read) {
      lastSeenIdRef.current = latest.id;
      if (!isOnExpertTabRef.current) {
        setNotification({ id: latest.id, body: latest.body });
      }
    }
  }, []); // пустые зависимости — poll стабилен, читает всё через refs

  // Запускаем/останавливаем polling
  useEffect(() => {
    if (!canPoll) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    // Сразу первый запрос
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [canPoll, poll]);

  // Когда открывают вкладку юриста — сбрасываем бейдж
  useEffect(() => {
    if (isOnExpertTab) setUnreadCount(0);
  }, [isOnExpertTab]);

  const clearNotification = useCallback(() => setNotification(null), []);

  return { unreadCount, notification, clearNotification };
}
