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
  const isOnExpertTab = activeTab === "expert";

  const canPoll = user && !user.isAdmin && (user.paidExpert || !!user.purchasedPlan);

  const poll = useCallback(async () => {
    if (!canPoll) return;
    const res = await lawyerMessages();
    if (!res.messages) return;

    const adminMsgs = res.messages.filter(m => m.sender === "admin");
    const unread = res.messages.filter(m => m.sender === "admin" && !m.is_read);
    const count = isOnExpertTab ? 0 : unread.length;
    setUnreadCount(count);

    if (!isOnExpertTab && adminMsgs.length > 0) {
      const latest = adminMsgs[adminMsgs.length - 1];
      // Показываем тост только для нового сообщения от юриста
      if (
        lastSeenIdRef.current !== null &&
        latest.id > lastSeenIdRef.current &&
        !latest.is_read
      ) {
        setNotification({ id: latest.id, body: latest.body });
      }
      // Инициализируем lastSeenId при первой загрузке
      if (lastSeenIdRef.current === null) {
        lastSeenIdRef.current = latest.id;
      } else {
        lastSeenIdRef.current = Math.max(lastSeenIdRef.current, latest.id);
      }
    }
  }, [canPoll, isOnExpertTab]);

  useEffect(() => {
    // Не поллим когда пользователь уже на вкладке юриста — там свой поллинг
    if (!canPoll || isOnExpertTab) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [poll, canPoll, isOnExpertTab]);

  // Когда открывают вкладку юриста — сбрасываем счётчик
  useEffect(() => {
    if (isOnExpertTab) setUnreadCount(0);
  }, [isOnExpertTab]);

  const clearNotification = useCallback(() => setNotification(null), []);

  return { unreadCount, notification, clearNotification };
}