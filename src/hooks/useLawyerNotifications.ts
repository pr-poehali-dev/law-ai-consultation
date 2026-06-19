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
  refreshLawyer: () => void;
  refreshDialog: () => void;
  pausePing: () => void;
  resumePing: () => void;
  selectAdminDialog: (uid: number | null) => void;
  selectedAdminUserId: number | null;
  // Добавить сообщение мгновенно (до ответа сервера)
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

  const lastKnownIdRef         = useRef<number>(0);
  // Простой флаг — занят ли канал загрузки диалога
  const fetchingRef            = useRef(false);
  const pingRef                = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingPausedRef          = useRef(false);
  const isOnExpertTabRef       = useRef(activeTab === "expert");
  isOnExpertTabRef.current     = activeTab === "expert";
  const selectedUidRef         = useRef<number | null>(null);
  selectedUidRef.current       = selectedAdminUserId;
  // Версия диалога — при смене uid инкрементируется, старые ответы игнорируются
  const dialogVerRef           = useRef(0);
  // Счётчик для оптимистичных сообщений (отрицательные id)
  const optimisticCountRef     = useRef(0);

  const userId  = user?.id  ?? null;
  const isAdmin = user?.isAdmin ?? false;
  const hasLawyerAccess = isAdmin || (user?.paidExpert ?? false) || (user?.lawyerConsultationsLeft ?? 0) > 0;
  const isOnExpertTab = activeTab === "expert";

  // ── Оптимистичное добавление — сообщение сразу в UI ──────────────────────────
  const addOptimisticMsg = useCallback((msg: Omit<LawyerMessage, "id" | "created_at">) => {
    optimisticCountRef.current -= 1;
    const m: LawyerMessage = {
      ...msg,
      id: optimisticCountRef.current,  // временный отрицательный id
      created_at: new Date().toISOString(),
    };
    setMsgs(prev => [...prev, m]);
  }, []);

  // ── Загрузка сообщений диалога (для админа) ──────────────────────────────────
  const fetchDialog = useCallback(async (uid: number) => {
    // Не блокируем если занято — просто пробуем
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    const ver = dialogVerRef.current;
    try {
      const res = await lawyerMessages({ target_user_id: uid });
      // Игнорируем устаревший ответ
      if (selectedUidRef.current !== uid) return;
      if (dialogVerRef.current !== ver) return;
      if (res.messages) {
        // Убираем оптимистичные (id < 0) и ставим серверные
        setMsgs(res.messages);
        if (res.messages.length > 0) {
          lastKnownIdRef.current = Math.max(
            lastKnownIdRef.current,
            res.messages[res.messages.length - 1].id
          );
        }
      }
    } finally {
      fetchingRef.current = false;  // ВСЕГДА сбрасываем
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
    } finally {
      setLoading(false);
    }
  }, [userId, isAdmin]);

  // ── Загрузка сообщений (для пользователя) ────────────────────────────────────
  const fetchUserMsgs = useCallback(async () => {
    if (!userId || isAdmin) return;
    if (fetchingRef.current) return;
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
      const unread    = newMsgs.filter(m => m.sender === "admin" && !m.is_read);
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

  // ── Выбор диалога (сбрасывает версию, грузит сразу) ─────────────────────────
  const selectAdminDialog = useCallback((uid: number | null) => {
    setSelectedAdminUserId(uid);
    selectedUidRef.current = uid;
    dialogVerRef.current++;
    fetchingRef.current = false;  // сбрасываем флаг при смене диалога
    setMsgs([]);
    if (!uid) { setLoading(false); return; }
    setLoading(true);
    fetchDialog(uid);
  }, [fetchDialog]);

  // ── refreshDialog — обновить текущий диалог после отправки ───────────────────
  const refreshDialog = useCallback(() => {
    fetchingRef.current = false;  // принудительно разблокируем перед обновлением
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
      fetchingRef.current = false;
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

  const clearNotification = useCallback(() => setNotification(null), []);
  const pausePing         = useCallback(() => { pingPausedRef.current = true; }, []);
  const resumePing        = useCallback(() => { pingPausedRef.current = false; }, []);

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
