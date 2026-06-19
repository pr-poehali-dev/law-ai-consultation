import { useState, useEffect, useRef, useCallback } from "react";
import { lawyerMessages, lawyerPing } from "@/lib/auth";
import type { User, LawyerMessage, LawyerDialog } from "@/lib/auth";

// Стратегия двухуровневого polling:
// 1. FAST: ping каждые 3с — только MAX(id) и unread (~10-20мс, почти бесплатно)
// 2. FULL: полная загрузка только если ping вернул has_new=true (~250мс)
// Итого: 1 полный запрос при изменении + 19 лёгких пингов в минуту
const PING_INTERVAL = 3_000;   // ping каждые 3 сек — пока на вкладке юриста
const SLOW_INTERVAL = 15_000;  // когда НЕ на вкладке — не пингуем (0 запросов)

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

  const lastKnownIdRef = useRef<number>(0);   // last_id из последнего ping/fetch
  const fetchingRef = useRef(false);           // защита от параллельных полных запросов
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isOnExpertTabRef = useRef(activeTab === "expert");
  isOnExpertTabRef.current = activeTab === "expert";

  const userId = user?.id ?? null;
  const isAdmin = user?.isAdmin ?? false;
  const isOnExpertTab = activeTab === "expert";

  // ─── Полная загрузка данных ─────────────────────────────────────────────────
  const fetchFull = useCallback(async (adminTarget?: number) => {
    if (fetchingRef.current) return;
    if (!userId) return;
    fetchingRef.current = true;
    try {
      if (isAdmin) {
        const params = adminTarget ? { target_user_id: adminTarget } : { show_closed: false };
        const res = await lawyerMessages(params);
        if (res.dialogs) {
          setDialogs(res.dialogs);
          // Обновляем last_id по максимальной дате из диалогов
          if (res.dialogs.length > 0) {
            const maxTs = Math.max(...res.dialogs.map(d => new Date(d.last_at).getTime()));
            lastKnownIdRef.current = maxTs;
          }
        }
        if (res.messages) setMsgs(res.messages);
      } else {
        const res = await lawyerMessages();
        if (!res.messages) return;
        const newMsgs = res.messages;
        setMsgs(newMsgs);

        if (newMsgs.length > 0) {
          lastKnownIdRef.current = newMsgs[newMsgs.length - 1].id;
        }

        const adminMsgs = newMsgs.filter(m => m.sender === "admin");
        const unread = newMsgs.filter(m => m.sender === "admin" && !m.is_read);
        setUnreadCount(isOnExpertTabRef.current ? 0 : unread.length);

        if (adminMsgs.length > 0) {
          const latest = adminMsgs[adminMsgs.length - 1];
          if (!isOnExpertTabRef.current && latest.id > lastKnownIdRef.current) {
            setNotification({ id: latest.id, body: latest.body });
          }
        }
      }
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [userId, isAdmin]);

  // ─── Лёгкий ping — только MAX(id), не тянем тело сообщений ────────────────
  const doPing = useCallback(async () => {
    if (!userId || document.visibilityState !== "visible") return;
    const res = await lawyerPing({ last_id: lastKnownIdRef.current });
    if (res.error) return;

    // Обновляем счётчик непрочитанных даже без полной загрузки
    if (res.unread !== undefined && !isOnExpertTabRef.current) {
      setUnreadCount(res.unread);
    }

    // Новые сообщения появились — делаем полную загрузку
    if (res.has_new) {
      if (res.last_id) lastKnownIdRef.current = res.last_id;
      fetchFull();
    }
  }, [userId, fetchFull]);

  // ─── Управление ping-интервалом ────────────────────────────────────────────
  useEffect(() => {
    if (!userId) { setLoading(false); return; }

    const stopPing = () => {
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
    };
    const startPing = () => {
      if (pingRef.current) return;
      pingRef.current = setInterval(doPing, PING_INTERVAL);
    };

    if (isOnExpertTab) {
      // На вкладке юриста: полная загрузка сразу + быстрый ping каждые 3с
      fetchFull();
      startPing();
    } else {
      // Ушли с вкладки юриста — останавливаем ping полностью
      stopPing();
      // Разовая загрузка для бейджа (только при смене вкладки)
      fetchFull();
    }

    // Браузер уходит в фон — ping паузируем; возвращается — возобновляем
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        doPing(); // немедленная проверка при возврате
        if (isOnExpertTab) startPing();
      } else {
        stopPing();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopPing();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [userId, isOnExpertTab, fetchFull, doPing]);

  // Сброс бейджа при переходе на вкладку юриста
  useEffect(() => {
    if (isOnExpertTab) setUnreadCount(0);
  }, [isOnExpertTab]);

  const refresh = useCallback(() => fetchFull(), [fetchFull]);
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
