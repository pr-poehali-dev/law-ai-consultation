import { useState, useEffect, useRef, useCallback } from "react";
import { lawyerMessages, lawyerPing } from "@/lib/auth";
import type { User, LawyerMessage, LawyerDialog } from "@/lib/auth";

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
  msgLoading: boolean;          // отдельный индикатор для сообщений
  refreshLawyer: () => void;
  refreshDialog: () => void;    // обновить только текущий диалог
  pausePing: () => void;
  resumePing: () => void;
  selectAdminDialog: (uid: number | null) => void;
  selectedAdminUserId: number | null;
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
  const [msgLoading, setMsgLoading]     = useState(false);
  const [selectedAdminUserId, setSelectedAdminUserId] = useState<number | null>(null);

  const lastKnownIdRef         = useRef<number>(0);
  const dialogInFlightRef      = useRef(false);
  const dialogsInFlightRef     = useRef(false);
  const userMsgsInFlightRef    = useRef(false);
  const pingRef                = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingPausedRef          = useRef(false);
  const isOnExpertTabRef       = useRef(activeTab === "expert");
  isOnExpertTabRef.current     = activeTab === "expert";
  const selectedAdminUserIdRef = useRef<number | null>(null);
  selectedAdminUserIdRef.current = selectedAdminUserId;
  // Версия диалога: при смене диалога старые ответы выбрасываются
  const dialogVersionRef       = useRef(0);

  const userId  = user?.id  ?? null;
  const isAdmin = user?.isAdmin ?? false;
  const hasLawyerAccess = isAdmin || (user?.paidExpert ?? false) || (user?.lawyerConsultationsLeft ?? 0) > 0;
  const isOnExpertTab = activeTab === "expert";

  // ── Загрузка сообщений диалога (для админа) ──────────────────────────────────
  const fetchDialog = useCallback(async (uid: number, showLoader = false) => {
    if (dialogInFlightRef.current) return;
    dialogInFlightRef.current = true;
    const ver = dialogVersionRef.current;
    if (showLoader) setMsgLoading(true);
    try {
      const res = await lawyerMessages({ target_user_id: uid });
      // Проверяем актуальность: диалог не сменился
      if (selectedAdminUserIdRef.current !== uid) return;
      if (dialogVersionRef.current !== ver) return;
      if (res.messages) {
        setMsgs(res.messages);
        if (res.messages.length > 0) {
          lastKnownIdRef.current = Math.max(
            lastKnownIdRef.current,
            res.messages[res.messages.length - 1].id
          );
        }
      }
    } finally {
      if (dialogVersionRef.current === ver) {
        dialogInFlightRef.current = false;
      }
      setMsgLoading(false);
      setLoading(false);
    }
  }, []);

  // ── Загрузка списка диалогов (для админа) ────────────────────────────────────
  const fetchDialogs = useCallback(async () => {
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

  // ── Загрузка сообщений (для обычного пользователя) ───────────────────────────
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

  // ── Полное обновление ─────────────────────────────────────────────────────────
  const fetchFull = useCallback(() => {
    if (isAdmin) {
      fetchDialogs();
      const uid = selectedAdminUserIdRef.current;
      if (uid) fetchDialog(uid);
    } else {
      fetchUserMsgs();
    }
  }, [isAdmin, fetchDialogs, fetchDialog, fetchUserMsgs]);

  // ── Обновление только текущего диалога (вызывается после отправки) ───────────
  const refreshDialog = useCallback(() => {
    if (isAdmin) {
      const uid = selectedAdminUserIdRef.current;
      if (uid) fetchDialog(uid);
    } else {
      fetchUserMsgs();
    }
  }, [isAdmin, fetchDialog, fetchUserMsgs]);

  // ── Выбор диалога ─────────────────────────────────────────────────────────────
  const selectAdminDialog = useCallback((uid: number | null) => {
    setSelectedAdminUserId(uid);
    selectedAdminUserIdRef.current = uid;
    dialogVersionRef.current++;    // старые ответы выбросим
    setMsgs([]);
    if (!uid) return;
    setLoading(true);
    fetchDialog(uid, true);
  }, [fetchDialog]);

  // ── Ping ──────────────────────────────────────────────────────────────────────
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
        fetchDialogs();
        const uid = selectedAdminUserIdRef.current;
        if (uid) fetchDialog(uid);
      } else {
        fetchUserMsgs();
      }
    }
  }, [userId, isAdmin, fetchDialogs, fetchDialog, fetchUserMsgs]);

  // ── Polling ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    if (!hasLawyerAccess) { setLoading(false); return; }

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
        doPing();
        if (isOnExpertTab) startPing();
      } else {
        stopPing();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stopPing(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [userId, isOnExpertTab, isAdmin, hasLawyerAccess, fetchDialogs, fetchUserMsgs, doPing]);

  useEffect(() => { if (isOnExpertTab) setUnreadCount(0); }, [isOnExpertTab]);

  const refreshLawyer     = useCallback(() => fetchFull(), [fetchFull]);
  const clearNotification = useCallback(() => setNotification(null), []);
  const pausePing         = useCallback(() => { pingPausedRef.current = true; }, []);
  const resumePing        = useCallback(() => { pingPausedRef.current = false; }, []);

  return {
    unreadCount, notification, clearNotification,
    lawyerMessages: msgs, lawyerDialogs: dialogs,
    lawyerLoading: loading, msgLoading,
    refreshLawyer, refreshDialog,
    pausePing, resumePing,
    selectAdminDialog, selectedAdminUserId,
  };
}