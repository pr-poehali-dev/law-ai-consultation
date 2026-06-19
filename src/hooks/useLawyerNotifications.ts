import { useState, useEffect, useRef, useCallback } from "react";
import { lawyerMessages } from "@/lib/auth";
import type { User, LawyerMessage, LawyerDialog } from "@/lib/auth";

const POLL_INTERVAL = 3_000;

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

  const pollRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef        = useRef(false);
  const fetchingRef      = useRef(false);
  const isOnExpertTabRef = useRef(activeTab === "expert");
  isOnExpertTabRef.current = activeTab === "expert";
  const selectedUidRef   = useRef<number | null>(null);
  selectedUidRef.current = selectedAdminUserId;
  const dialogVerRef     = useRef(0);
  const optimisticIdRef  = useRef(0);

  const userId  = user?.id  ?? null;
  const isAdmin = user?.isAdmin ?? false;
  const isOnExpertTab = activeTab === "expert";

  // ── Оптимистичное сообщение ───────────────────────────────────────────────────
  const addOptimisticMsg = useCallback((msg: Omit<LawyerMessage, "id" | "created_at">) => {
    optimisticIdRef.current -= 1;
    setMsgs(prev => [
      ...prev.filter(m => m.id >= 0),
      { ...msg, id: optimisticIdRef.current, created_at: new Date().toISOString() },
    ]);
  }, []);

  // ── Загрузка сообщений пользователя ──────────────────────────────────────────
  const fetchUserMsgs = useCallback(async () => {
    if (!userId || isAdmin) return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const res = await lawyerMessages();
      if (!res.messages) return;
      setMsgs(res.messages);
      const unread = res.messages.filter(m => m.sender === "admin" && !m.is_read);
      setUnreadCount(isOnExpertTabRef.current ? 0 : unread.length);
      const adminMsgs = res.messages.filter(m => m.sender === "admin");
      if (adminMsgs.length > 0 && !isOnExpertTabRef.current) {
        const latest = adminMsgs[adminMsgs.length - 1];
        setNotification(prev => prev?.id === latest.id ? prev : { id: latest.id, body: latest.body });
      }
    } catch { /* ignore */ } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [userId, isAdmin]);

  // ── Загрузка диалогов (для админа) ───────────────────────────────────────────
  const fetchDialogs = useCallback(async () => {
    if (!userId || !isAdmin) return;
    try {
      const res = await lawyerMessages({ show_closed: false });
      if (res.dialogs) setDialogs(res.dialogs);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [userId, isAdmin]);

  // ── Загрузка диалога (для админа) ────────────────────────────────────────────
  const fetchDialog = useCallback(async (uid: number) => {
    const ver = ++dialogVerRef.current;
    try {
      const res = await lawyerMessages({ target_user_id: uid });
      if (selectedUidRef.current !== uid || dialogVerRef.current !== ver) return;
      if (res.messages) setMsgs(res.messages);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  // ── Выбор диалога ─────────────────────────────────────────────────────────────
  const selectAdminDialog = useCallback((uid: number | null) => {
    setSelectedAdminUserId(uid);
    selectedUidRef.current = uid;
    dialogVerRef.current++;
    setMsgs([]);
    if (!uid) { setLoading(false); return; }
    setLoading(true);
    fetchDialog(uid);
  }, [fetchDialog]);

  // ── Обновление после отправки ─────────────────────────────────────────────────
  const refreshDialog = useCallback(() => {
    if (isAdmin) {
      const uid = selectedUidRef.current;
      if (uid) fetchDialog(uid);
    } else {
      fetchingRef.current = false; // сбрасываем блокировку
      fetchUserMsgs();
    }
  }, [isAdmin, fetchDialog, fetchUserMsgs]);

  const refreshLawyer = useCallback(() => {
    if (isAdmin) {
      fetchDialogs();
      const uid = selectedUidRef.current;
      if (uid) fetchDialog(uid);
    } else {
      fetchingRef.current = false;
      fetchUserMsgs();
    }
  }, [isAdmin, fetchDialogs, fetchDialog, fetchUserMsgs]);

  // ── Polling (без ping — только прямые запросы каждые 3с) ─────────────────────
  useEffect(() => {
    if (!userId) { setLoading(false); return; }

    const doPoll = () => {
      if (pausedRef.current) return;
      if (isAdmin) {
        fetchDialogs();
        const uid = selectedUidRef.current;
        if (uid) fetchDialog(uid);
      } else {
        fetchUserMsgs();
      }
    };

    const stop  = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
    const start = () => { if (!pollRef.current) pollRef.current = setInterval(doPoll, POLL_INTERVAL); };

    // Первичная загрузка сразу
    doPoll();
    if (isOnExpertTab) start();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        doPoll();
        if (isOnExpertTab) start();
      } else {
        stop();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [userId, isOnExpertTab, isAdmin, fetchDialogs, fetchDialog, fetchUserMsgs]);

  useEffect(() => { if (isOnExpertTab) setUnreadCount(0); }, [isOnExpertTab]);

  const clearNotification = useCallback(() => setNotification(null), []);
  const pausePing  = useCallback(() => { pausedRef.current = true; }, []);
  const resumePing = useCallback(() => { pausedRef.current = false; }, []);

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
