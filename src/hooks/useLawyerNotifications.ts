import { useState, useEffect, useRef, useCallback } from "react";
import { lawyerMessages, lawyerPing } from "@/lib/auth";
import type { User, LawyerMessage, LawyerDialog } from "@/lib/auth";

// Ping каждые 10с — при таймауте платформы 10с это 60с/мин биллинга (разумно)
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
  selectAdminDialog: (uid: number | null) => void;
  selectedAdminUserId: number | null;
  // Оптимистичное добавление — сообщение показывается сразу без ожидания сервера
  addOptimisticMessage: (msg: Omit<LawyerMessage, "id" | "created_at">) => void;
}

export function useLawyerNotifications(
  user: User | null,
  activeTab: string
): UseLawyerNotificationsResult {
  const [unreadCount, setUnreadCount]               = useState(0);
  const [notification, setNotification]             = useState<LawyerNotification | null>(null);
  const [msgs, setMsgs]                             = useState<LawyerMessage[]>([]);
  const [dialogs, setDialogs]                       = useState<LawyerDialog[]>([]);
  const [loading, setLoading]                       = useState(true);
  const [selectedAdminUserId, setSelectedAdminUserId] = useState<number | null>(null);

  // ── Refs (не вызывают ре-рендер, безопасны в коллбэках) ──────────────────────
  const lastKnownIdRef         = useRef<number>(0);
  const lastDialogMsgIdRef     = useRef<number>(0);
  // Единый флаг "идёт запрос диалога" — защита от параллельных вызовов
  const dialogInFlightRef      = useRef(false);
  // Единый флаг "идёт запрос списка диалогов"
  const dialogsInFlightRef     = useRef(false);
  // Единый флаг "идёт запрос пользовательских сообщений"
  const userMsgsInFlightRef    = useRef(false);
  const pingRef                = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingPausedRef          = useRef(false);
  const isOnExpertTabRef       = useRef(activeTab === "expert");
  isOnExpertTabRef.current     = activeTab === "expert";
  const selectedAdminUserIdRef = useRef<number | null>(null);
  selectedAdminUserIdRef.current = selectedAdminUserId;
  // Счётчик запроса — если сменился диалог, старый ответ выбрасываем
  const dialogFetchVersionRef  = useRef(0);

  const userId  = user?.id  ?? null;
  const isAdmin = user?.isAdmin ?? false;
  const hasLawyerAccess = isAdmin || (user?.paidExpert ?? false) || (user?.lawyerConsultationsLeft ?? 0) > 0;
  const isOnExpertTab = activeTab === "expert";

  // ── Оптимистичное добавление сообщения (мгновенно в UI) ──────────────────────
  const addOptimisticMessage = useCallback((msg: Omit<LawyerMessage, "id" | "created_at">) => {
    const optimistic: LawyerMessage = {
      ...msg,
      id: Date.now() * -1,                        // временный отрицательный id
      created_at: new Date().toISOString(),
    };
    setMsgs(prev => [...prev, optimistic]);
  }, []);

  // ── Загрузка сообщений открытого диалога (админ) ─────────────────────────────
  const fetchAdminDialog = useCallback(async (uid: number, force = false) => {
    if (dialogInFlightRef.current && !force) return; // уже идёт — пропускаем
    dialogInFlightRef.current = true;
    const version = ++dialogFetchVersionRef.current;
    try {
      const res = await lawyerMessages({ target_user_id: uid });
      // Если диалог сменился или пришёл устаревший ответ — выбрасываем
      if (selectedAdminUserIdRef.current !== uid) return;
      if (version !== dialogFetchVersionRef.current) return;
      if (res.messages) {
        setMsgs(res.messages);
        if (res.messages.length > 0) {
          lastDialogMsgIdRef.current = res.messages[res.messages.length - 1].id;
          // Обновляем lastKnownId чтобы ping не думал что есть новые
          lastKnownIdRef.current = Math.max(
            lastKnownIdRef.current,
            res.messages[res.messages.length - 1].id,
          );
        }
      }
    } finally {
      if (version === dialogFetchVersionRef.current) {
        dialogInFlightRef.current = false;
      }
      setLoading(false);
    }
  }, []);

  // ── Загрузка списка диалогов (админ) ─────────────────────────────────────────
  const fetchAdminDialogs = useCallback(async () => {
    if (dialogsInFlightRef.current) return;
    if (!userId || !isAdmin) return;
    dialogsInFlightRef.current = true;
    try {
      const res = await lawyerMessages({ show_closed: false });
      if (res.dialogs) {
        setDialogs(res.dialogs);
        if (res.dialogs.length > 0) {
          const maxTs = Math.max(...res.dialogs.map(d => new Date(d.last_at).getTime()));
          lastKnownIdRef.current = Math.max(lastKnownIdRef.current, maxTs);
        }
      }
    } finally {
      dialogsInFlightRef.current = false;
      setLoading(false);
    }
  }, [userId, isAdmin]);

  // ── Загрузка сообщений (обычный пользователь) ────────────────────────────────
  const fetchUserMsgs = useCallback(async () => {
    if (userMsgsInFlightRef.current) return;
    if (!userId || isAdmin) return;
    userMsgsInFlightRef.current = true;
    try {
      const res = await lawyerMessages();
      if (!res.messages) return;
      const newMsgs = res.messages;
      setMsgs(newMsgs);

      if (newMsgs.length > 0) {
        lastKnownIdRef.current = newMsgs[newMsgs.length - 1].id;
      }

      const adminMsgs = newMsgs.filter(m => m.sender === "admin");
      const unread    = newMsgs.filter(m => m.sender === "admin" && !m.is_read);
      setUnreadCount(isOnExpertTabRef.current ? 0 : unread.length);

      if (adminMsgs.length > 0) {
        const latest = adminMsgs[adminMsgs.length - 1];
        if (!isOnExpertTabRef.current && latest.id > lastKnownIdRef.current) {
          setNotification({ id: latest.id, body: latest.body });
        }
      }
    } finally {
      userMsgsInFlightRef.current = false;
      setLoading(false);
    }
  }, [userId, isAdmin]);

  // ── Полное обновление (refresh + ping result) ─────────────────────────────────
  const fetchFull = useCallback(async () => {
    if (isAdmin) {
      fetchAdminDialogs(); // не ждём, параллельно
      const uid = selectedAdminUserIdRef.current;
      if (uid) fetchAdminDialog(uid);
    } else {
      fetchUserMsgs();
    }
  }, [isAdmin, fetchAdminDialogs, fetchAdminDialog, fetchUserMsgs]);

  // ── Выбор диалога (единственная точка входа для админа) ──────────────────────
  const selectAdminDialog = useCallback((uid: number | null) => {
    setSelectedAdminUserId(uid);
    selectedAdminUserIdRef.current = uid;
    dialogFetchVersionRef.current++;   // обнуляем версию — старые ответы выбросим
    if (!uid) {
      setMsgs([]);
      lastDialogMsgIdRef.current = 0;
      return;
    }
    setMsgs([]);
    lastDialogMsgIdRef.current = 0;
    setLoading(true);
    fetchAdminDialog(uid, true); // force=true — игнорируем in-flight флаг
  }, [fetchAdminDialog]);

  // ── Ping — лёгкий, только MAX(id), без загрузки тела ─────────────────────────
  const doPing = useCallback(async () => {
    if (!userId || document.visibilityState !== "visible") return;
    if (pingPausedRef.current) return;

    const res = await lawyerPing({ last_id: lastKnownIdRef.current });
    if (res.error) return;

    if (res.unread !== undefined && !isOnExpertTabRef.current) {
      setUnreadCount(res.unread);
    }

    if (res.has_new) {
      if (res.last_id) lastKnownIdRef.current = res.last_id;
      if (isAdmin) {
        fetchAdminDialogs();
        const uid = selectedAdminUserIdRef.current;
        if (uid) fetchAdminDialog(uid); // in-flight защита внутри fetchAdminDialog
      } else {
        fetchUserMsgs();
      }
    }
  }, [userId, isAdmin, fetchAdminDialogs, fetchAdminDialog, fetchUserMsgs]);

  // ── Управление polling'ом ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    if (!hasLawyerAccess) { setLoading(false); return; }

    const stopPing  = () => {
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
    };
    const startPing = () => {
      if (pingRef.current) return;
      pingRef.current = setInterval(doPing, PING_INTERVAL);
    };

    if (isOnExpertTab) {
      if (isAdmin) fetchAdminDialogs();
      else         fetchUserMsgs();
      startPing();
    } else {
      stopPing();
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

  useEffect(() => {
    if (isOnExpertTab) setUnreadCount(0);
  }, [isOnExpertTab]);

  const refresh           = useCallback(() => fetchFull(), [fetchFull]);
  const clearNotification = useCallback(() => setNotification(null), []);
  const pausePing         = useCallback(() => { pingPausedRef.current = true; }, []);
  const resumePing        = useCallback(() => { pingPausedRef.current = false; }, []);

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
    addOptimisticMessage,
  };
}
