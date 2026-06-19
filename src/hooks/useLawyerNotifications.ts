import { useState, useEffect, useRef, useCallback } from "react";
import { lawyerMessages, lawyerPing } from "@/lib/auth";
import type { User, LawyerMessage, LawyerDialog } from "@/lib/auth";

// Ping каждые 3с — для получения чужих сообщений в реальном времени
const PING_INTERVAL = 3_000;

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
  refreshDialog: () => void;
  pausePing: () => void;
  resumePing: () => void;
  selectAdminDialog: (uid: number | null) => void;
  selectedAdminUserId: number | null;
  addOptimisticMsg: (msg: Omit<LawyerMessage, "id" | "created_at">) => void;
}

export function useLawyerNotifications(
  user: User | null,
  activeTab: string
): UseLawyerNotificationsResult {
  const [unreadCount, setUnreadCount]   = useState(0);
  const [notification, setNotification] = useState<LawyerNotification | null>(null);
  const [msgs, setMsgs]                 = useState<LawyerMessage[]>([]);
  const [dialogs, setDialogs]           = useState<LawyerDialog[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedAdminUserId, setSelectedAdminUserId] = useState<number | null>(null);

  const lastKnownIdRef     = useRef<number>(0);
  const pingRef            = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingPausedRef      = useRef(false);
  const isOnExpertTabRef   = useRef(activeTab === "expert");
  isOnExpertTabRef.current = activeTab === "expert";
  const selectedUidRef     = useRef<number | null>(null);
  selectedUidRef.current   = selectedAdminUserId;
  // Версия диалога — при смене uid старые ответы выбрасываются
  const dialogVerRef       = useRef(0);
  // Версия запроса сообщений пользователя — только свежий результат применяется
  const userMsgsVerRef     = useRef(0);
  const optimisticIdRef    = useRef(0);

  const userId  = user?.id  ?? null;
  const isAdmin = user?.isAdmin ?? false;
  const hasLawyerAccess = isAdmin || (user?.paidExpert ?? false) || (user?.lawyerConsultationsLeft ?? 0) > 0;
  const isOnExpertTab = activeTab === "expert";

  // ── Оптимистичное добавление ────────────────────────────────────────────────
  const addOptimisticMsg = useCallback((msg: Omit<LawyerMessage, "id" | "created_at">) => {
    optimisticIdRef.current -= 1;
    setMsgs(prev => [...prev, {
      ...msg,
      id: optimisticIdRef.current,
      created_at: new Date().toISOString(),
    }]);
  }, []);

  // ── Загрузка диалога (для админа) — без блокирующего флага ──────────────────
  // Каждый вызов создаёт свою версию. Только последний ответ применяется.
  const fetchDialog = useCallback(async (uid: number) => {
    const ver = ++dialogVerRef.current;
    try {
      const res = await lawyerMessages({ target_user_id: uid });
      // Применяем только если диалог не сменился и это свежий запрос
      if (selectedUidRef.current !== uid) return;
      if (dialogVerRef.current !== ver) return;
      if (res.messages) {
        const serverMsgs = res.messages;
        setMsgs(prev => {
          const optimistic = prev.filter(m => m.id < 0);
          if (optimistic.length === 0) return serverMsgs;
          const serverBodies = new Set(serverMsgs.map(m => m.body));
          const pendingOptimistic = optimistic.filter(m => !serverBodies.has(m.body));
          return [...serverMsgs, ...pendingOptimistic];
        });
        if (serverMsgs.length > 0) {
          const lastId = serverMsgs[serverMsgs.length - 1].id;
          lastKnownIdRef.current = Math.max(lastKnownIdRef.current, lastId);
        }
      }
    } catch { /* игнорируем ошибки запроса */ } finally {
      setLoading(false);
    }
  }, []);

  // ── Загрузка списка диалогов (для админа) ────────────────────────────────────
  const fetchDialogs = useCallback(async () => {
    if (!userId || !isAdmin) return;
    try {
      const res = await lawyerMessages({ show_closed: false });
      if (res.dialogs) {
        setDialogs(res.dialogs);
        if (res.dialogs.length > 0) {
          const maxTs = Math.max(...res.dialogs.map(d => new Date(d.last_at).getTime()));
          lastKnownIdRef.current = Math.max(lastKnownIdRef.current, maxTs);
        }
      }
    } catch { /* игнорируем */ } finally {
      setLoading(false);
    }
  }, [userId, isAdmin]);

  // ── Загрузка сообщений (для пользователя) — без блокирующего флага ──────────
  const fetchUserMsgs = useCallback(async () => {
    if (!userId || isAdmin) return;
    const ver = ++userMsgsVerRef.current;
    try {
      const res = await lawyerMessages();
      // Применяем только свежий ответ
      if (userMsgsVerRef.current !== ver) return;
      if (!res.messages) return;
      const newMsgs = res.messages;
      // Сохраняем оптимистичные сообщения (id < 0) если сервер ещё не вернул реальные
      setMsgs(prev => {
        const optimistic = prev.filter(m => m.id < 0);
        if (optimistic.length === 0) return newMsgs;
        // Убираем дубли: если тело оптимистичного совпадает с последним сервером — не добавляем
        const serverBodies = new Set(newMsgs.map(m => m.body));
        const pendingOptimistic = optimistic.filter(m => !serverBodies.has(m.body));
        return [...newMsgs, ...pendingOptimistic];
      });
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
    } catch { /* игнорируем */ } finally {
      setLoading(false);
    }
  }, [userId, isAdmin]);

  // ── Выбор диалога ─────────────────────────────────────────────────────────────
  const selectAdminDialog = useCallback((uid: number | null) => {
    setSelectedAdminUserId(uid);
    selectedUidRef.current = uid;
    // Инкрементируем версию — все незавершённые запросы к старому диалогу выбросятся
    dialogVerRef.current++;
    setMsgs([]);
    if (!uid) { setLoading(false); return; }
    setLoading(true);
    fetchDialog(uid);
  }, [fetchDialog]);

  // ── refreshDialog — немедленное обновление после отправки ────────────────────
  const refreshDialog = useCallback(() => {
    if (isAdmin) {
      const uid = selectedUidRef.current;
      if (uid) fetchDialog(uid);
    } else {
      fetchUserMsgs();
    }
  }, [isAdmin, fetchDialog, fetchUserMsgs]);

  // ── refreshLawyer — полное обновление ────────────────────────────────────────
  const refreshLawyer = useCallback(() => {
    if (isAdmin) {
      fetchDialogs();
      const uid = selectedUidRef.current;
      if (uid) fetchDialog(uid);
    } else {
      fetchUserMsgs();
    }
  }, [isAdmin, fetchDialogs, fetchDialog, fetchUserMsgs]);

  // ── Ping ──────────────────────────────────────────────────────────────────────
  const doPing = useCallback(async () => {
    if (!userId || document.visibilityState !== "visible") return;
    if (pingPausedRef.current) return;
    try {
      const res = await lawyerPing({ last_id: lastKnownIdRef.current });
      if (res.error) return;
      if (res.unread !== undefined && !isOnExpertTabRef.current) {
        setUnreadCount(res.unread);
      }
      if (res.has_new) {
        if (res.last_id) lastKnownIdRef.current = res.last_id;
        // Обновляем сообщения немедленно — без ожидания следующего tick
        if (isAdmin) {
          const uid = selectedUidRef.current;
          // Диалоги и сообщения параллельно
          fetchDialogs();
          if (uid) fetchDialog(uid);
        } else {
          fetchUserMsgs();
        }
      }
    } catch { /* игнорируем ошибки ping */ }
  }, [userId, isAdmin, fetchDialogs, fetchDialog, fetchUserMsgs]);

  // ── Polling ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    if (!hasLawyerAccess) { setLoading(false); return; }

    const stopPing  = () => { if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; } };
    const startPing = () => { if (!pingRef.current) { pingRef.current = setInterval(doPing, PING_INTERVAL); } };

    if (isOnExpertTab) {
      // Сразу загружаем данные при входе на вкладку
      if (isAdmin) { fetchDialogs(); } else { fetchUserMsgs(); }
      startPing();
    } else {
      stopPing();
      if (!isAdmin) fetchUserMsgs();
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // Сразу загружаем при возврате — не ждём следующий ping
        if (isAdmin) {
          fetchDialogs();
          const uid = selectedUidRef.current;
          if (uid) fetchDialog(uid);
        } else {
          fetchUserMsgs();
        }
        if (isOnExpertTab) startPing();
      } else {
        stopPing();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stopPing(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [userId, isOnExpertTab, isAdmin, hasLawyerAccess, fetchDialogs, fetchUserMsgs, fetchDialog, doPing]);

  useEffect(() => { if (isOnExpertTab) setUnreadCount(0); }, [isOnExpertTab]);

  const clearNotification = useCallback(() => setNotification(null), []);
  const pausePing = useCallback(() => { pingPausedRef.current = true; }, []);
  const resumePing = useCallback(() => {
    pingPausedRef.current = false;
    // После отправки — сразу проверяем есть ли новые сообщения
    doPing();
  }, [doPing]);

  return {
    unreadCount, notification, clearNotification,
    lawyerMessages: msgs, lawyerDialogs: dialogs,
    lawyerLoading: loading,
    refreshLawyer, refreshDialog,
    pausePing, resumePing,
    selectAdminDialog, selectedAdminUserId,
    addOptimisticMsg,
  };
}