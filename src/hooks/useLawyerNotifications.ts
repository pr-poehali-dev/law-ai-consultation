import { useState, useEffect, useRef, useCallback } from "react";
import { lawyerMessages, lawyerPing } from "@/lib/auth";
import type { User, LawyerMessage, LawyerDialog } from "@/lib/auth";

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
  const dialogVerRef       = useRef(0);
  const fetchingRef        = useRef(false); // единый флаг для user msgs
  const optimisticIdRef    = useRef(0);

  const userId  = user?.id  ?? null;
  const isAdmin = user?.isAdmin ?? false;
  const hasLawyerAccess = !!userId;
  const isOnExpertTab = activeTab === "expert";

  // ── Мгновенное отображение своего сообщения ──────────────────────────────────
  const addOptimisticMsg = useCallback((msg: Omit<LawyerMessage, "id" | "created_at">) => {
    optimisticIdRef.current -= 1;
    setMsgs(prev => [...prev.filter(m => m.id >= 0), {
      ...msg,
      id: optimisticIdRef.current,
      created_at: new Date().toISOString(),
    }]);
  }, []);

  // ── Загрузка диалога (для админа) ────────────────────────────────────────────
  const fetchDialog = useCallback(async (uid: number) => {
    const ver = ++dialogVerRef.current;
    try {
      const res = await lawyerMessages({ target_user_id: uid });
      if (selectedUidRef.current !== uid) return;
      if (dialogVerRef.current !== ver) return;
      if (res.messages) {
        setMsgs(res.messages);
        if (res.messages.length > 0) {
          lastKnownIdRef.current = Math.max(
            lastKnownIdRef.current,
            res.messages[res.messages.length - 1].id
          );
        }
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  // ── Загрузка диалогов (для админа) ───────────────────────────────────────────
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
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [userId, isAdmin]);

  // ── Загрузка сообщений пользователя — с дедупликацией ────────────────────────
  const fetchUserMsgs = useCallback(async (force = false) => {
    if (!userId || isAdmin) return;
    if (fetchingRef.current && !force) return; // пропускаем параллельный вызов
    fetchingRef.current = true;
    try {
      const res = await lawyerMessages();
      if (!res.messages) return;
      const newMsgs = res.messages;
      // Заменяем полностью (убираем оптимистичные id<0 и старые)
      setMsgs(newMsgs);
      if (newMsgs.length > 0) {
        lastKnownIdRef.current = newMsgs[newMsgs.length - 1].id;
      }
      const unread = newMsgs.filter(m => m.sender === "admin" && !m.is_read);
      setUnreadCount(isOnExpertTabRef.current ? 0 : unread.length);
      const adminMsgs = newMsgs.filter(m => m.sender === "admin");
      if (adminMsgs.length > 0) {
        const latest = adminMsgs[adminMsgs.length - 1];
        if (!isOnExpertTabRef.current && latest.id > lastKnownIdRef.current) {
          setNotification({ id: latest.id, body: latest.body });
        }
      }
    } catch { /* ignore */ } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [userId, isAdmin]);

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

  // ── refreshDialog — принудительное обновление после отправки ─────────────────
  const refreshDialog = useCallback(() => {
    if (isAdmin) {
      const uid = selectedUidRef.current;
      if (uid) fetchDialog(uid);
    } else {
      fetchUserMsgs(true); // force=true — всегда обновляем, даже если уже идёт запрос
    }
  }, [isAdmin, fetchDialog, fetchUserMsgs]);

  // ── refreshLawyer ─────────────────────────────────────────────────────────────
  const refreshLawyer = useCallback(() => {
    if (isAdmin) {
      fetchDialogs();
      const uid = selectedUidRef.current;
      if (uid) fetchDialog(uid);
    } else {
      fetchUserMsgs(true);
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
        if (isAdmin) {
          fetchDialogs();
          const uid = selectedUidRef.current;
          if (uid) fetchDialog(uid);
        } else {
          fetchUserMsgs(); // без force — пропустит если уже идёт refreshDialog
        }
      }
    } catch { /* ignore */ }
  }, [userId, isAdmin, fetchDialogs, fetchDialog, fetchUserMsgs]);

  // ── Polling ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !hasLawyerAccess) { setLoading(false); return; }

    const stopPing  = () => { if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; } };
    const startPing = () => { if (!pingRef.current) { pingRef.current = setInterval(doPing, PING_INTERVAL); } };

    if (isOnExpertTab) {
      if (isAdmin) { fetchDialogs(); } else { fetchUserMsgs(); }
      startPing();
    } else {
      stopPing();
      if (!isAdmin) fetchUserMsgs();
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
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
  const pausePing  = useCallback(() => { pingPausedRef.current = true; }, []);
  const resumePing = useCallback(() => { pingPausedRef.current = false; }, []);

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
