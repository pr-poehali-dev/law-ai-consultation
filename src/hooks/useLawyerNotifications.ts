import { useState, useEffect, useRef, useCallback } from "react";
import { lawyerMessages, lawyerPing } from "@/lib/auth";
import type { User, LawyerMessage, LawyerDialog } from "@/lib/auth";

// Интервал ping. При таймауте платформы 10с каждый вызов биллится как 10с.
// 10с интервал = 6 вызовов/мин × 10с = 60с/мин (разумно).
const PING_INTERVAL = 10_000;

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
  pausePing: () => void;
  resumePing: () => void;
  // Для админа — выбор диалога через хук (единственный источник сообщений)
  selectAdminDialog: (uid: number | null) => void;
  selectedAdminUserId: number | null;
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
  // Выбранный диалог для админа — хранится в хуке, не в ExpertTab
  const [selectedAdminUserId, setSelectedAdminUserId] = useState<number | null>(null);

  const lastKnownIdRef = useRef<number>(0);
  // Хранит ID последнего загруженного сообщения в открытом диалоге
  const lastDialogMsgIdRef = useRef<number>(0);
  const fetchingRef = useRef(false);
  const fetchingDialogRef = useRef(false);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingPausedRef = useRef(false);
  const isOnExpertTabRef = useRef(activeTab === "expert");
  isOnExpertTabRef.current = activeTab === "expert";
  // Ref для selectedAdminUserId чтобы использовать в колбэках без re-bind
  const selectedAdminUserIdRef = useRef<number | null>(null);
  selectedAdminUserIdRef.current = selectedAdminUserId;

  const userId = user?.id ?? null;
  const isAdmin = user?.isAdmin ?? false;
  const hasLawyerAccess = isAdmin || (user?.paidExpert ?? false) || (user?.lawyerConsultationsLeft ?? 0) > 0;
  const isOnExpertTab = activeTab === "expert";

  // ─── Загрузка сообщений открытого диалога (только для админа) ───────────────
  const fetchAdminDialog = useCallback(async (uid: number) => {
    if (fetchingDialogRef.current) return;
    fetchingDialogRef.current = true;
    try {
      const res = await lawyerMessages({ target_user_id: uid });
      // Проверяем что пользователь не сменил диалог пока шёл запрос
      if (selectedAdminUserIdRef.current !== uid) return;
      if (res.messages) {
        setMsgs(res.messages);
        if (res.messages.length > 0) {
          lastDialogMsgIdRef.current = res.messages[res.messages.length - 1].id;
        }
      }
    } finally {
      fetchingDialogRef.current = false;
      setLoading(false);
    }
  }, []);

  // ─── Загрузка списка диалогов (только для админа) ────────────────────────────
  const fetchAdminDialogs = useCallback(async () => {
    if (fetchingRef.current) return;
    if (!userId || !isAdmin) return;
    fetchingRef.current = true;
    try {
      const res = await lawyerMessages({ show_closed: false });
      if (res.dialogs) {
        setDialogs(res.dialogs);
        if (res.dialogs.length > 0) {
          const maxTs = Math.max(...res.dialogs.map(d => new Date(d.last_at).getTime()));
          lastKnownIdRef.current = maxTs;
        }
      }
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [userId, isAdmin]);

  // ─── Загрузка данных для обычного пользователя ──────────────────────────────
  const fetchUserMsgs = useCallback(async () => {
    if (fetchingRef.current) return;
    if (!userId || isAdmin) return;
    fetchingRef.current = true;
    try {
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
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [userId, isAdmin]);

  // ─── Единая функция обновления (вызывается ping'ом и refresh'ем) ─────────────
  const fetchFull = useCallback(async () => {
    if (isAdmin) {
      // Для админа: обновляем список диалогов + если открыт диалог — его сообщения
      await fetchAdminDialogs();
      const uid = selectedAdminUserIdRef.current;
      if (uid) await fetchAdminDialog(uid);
    } else {
      await fetchUserMsgs();
    }
  }, [isAdmin, fetchAdminDialogs, fetchAdminDialog, fetchUserMsgs]);

  // ─── Выбор диалога админом (единственная точка) ──────────────────────────────
  const selectAdminDialog = useCallback((uid: number | null) => {
    setSelectedAdminUserId(uid);
    selectedAdminUserIdRef.current = uid;
    if (!uid) {
      setMsgs([]);
      lastDialogMsgIdRef.current = 0;
      return;
    }
    setMsgs([]);
    lastDialogMsgIdRef.current = 0;
    setLoading(true);
    fetchAdminDialog(uid);
  }, [fetchAdminDialog]);

  // ─── Ping — только проверка наличия новых, без загрузки тела ────────────────
  const doPing = useCallback(async () => {
    if (!userId || document.visibilityState !== "visible") return;
    if (pingPausedRef.current) return;

    // Для админа пингуем по max timestamp диалогов
    const res = await lawyerPing({ last_id: lastKnownIdRef.current });
    if (res.error) return;

    if (res.unread !== undefined && !isOnExpertTabRef.current) {
      setUnreadCount(res.unread);
    }

    if (res.has_new) {
      if (res.last_id) lastKnownIdRef.current = res.last_id;
      // Обновляем диалоги; если открыт диалог — обновляем его сообщения
      if (isAdmin) {
        fetchAdminDialogs();
        const uid = selectedAdminUserIdRef.current;
        if (uid) fetchAdminDialog(uid);
      } else {
        fetchUserMsgs();
      }
    }
  }, [userId, isAdmin, fetchAdminDialogs, fetchAdminDialog, fetchUserMsgs]);

  // ─── Управление polling'ом ──────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    if (!hasLawyerAccess) { setLoading(false); return; }

    const stopPing = () => {
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
    };
    const startPing = () => {
      if (pingRef.current) return;
      pingRef.current = setInterval(doPing, PING_INTERVAL);
    };

    if (isOnExpertTab) {
      // Первичная загрузка при входе на вкладку
      if (isAdmin) {
        fetchAdminDialogs();
      } else {
        fetchUserMsgs();
      }
      startPing();
    } else {
      stopPing();
      // Разовая загрузка для бейджа
      if (!isAdmin) fetchUserMsgs();
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        doPing();
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
  }, [userId, isOnExpertTab, isAdmin, hasLawyerAccess, fetchAdminDialogs, fetchUserMsgs, doPing]);

  // Сброс бейджа при переходе на вкладку юриста
  useEffect(() => {
    if (isOnExpertTab) setUnreadCount(0);
  }, [isOnExpertTab]);

  const refresh = useCallback(() => fetchFull(), [fetchFull]);
  const clearNotification = useCallback(() => setNotification(null), []);
  const pausePing = useCallback(() => { pingPausedRef.current = true; }, []);
  const resumePing = useCallback(() => { pingPausedRef.current = false; }, []);

  return {
    unreadCount,
    notification,
    clearNotification,
    lawyerMessages: msgs,
    lawyerDialogs: dialogs,
    lawyerLoading: loading,
    refreshLawyer: refresh,
    pausePing,
    resumePing,
    selectAdminDialog,
    selectedAdminUserId,
  };
}
