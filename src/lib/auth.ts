import func2url from "../../backend/func2url.json";

const _f = func2url as Record<string, string>;

// Маршруты к функциям
const AUTH_URL = _f["gigachat-proxy"];         // авторизация, регистрация, профиль, business
const LAWYER_URL = _f["lawyer-service"];        // переписка с юристом
const LAWYER_UPLOAD_URL = _f["lawyer-upload"];  // загрузка файлов (таймаут 30с)
const LEGAL_DOCS_URL = _f["legal-docs"];        // управление правовой базой
const AI_CHAT_URL = _f["ai-chat"];
const AI_DOCS_URL = _f["ai-docs"];
const TOKEN_KEY = "yurist_ai_token";

// Keep-alive: греем ai-chat и ai-docs — только когда вкладка активна
// Запоминаем какими сервисами пользователь реально пользовался в сессии
const _usedServices = new Set<string>();
export function markServiceUsed(service: "chat" | "docs") { _usedServices.add(service); }

export function startKeepAlive(): () => void {
  // Пингуем только те сервисы которыми пользовались — ai-chat всегда (основной), ai-docs только если открывали вкладку Документы
  const ping = () => {
    if (document.visibilityState !== "visible") return;
    fetch(AI_CHAT_URL, { method: "GET" }).catch(() => {});
    if (_usedServices.has("docs")) {
      fetch(AI_DOCS_URL, { method: "GET" }).catch(() => {});
    }
  };
  const id = setInterval(ping, 9 * 60 * 1000);
  ping();
  return () => clearInterval(id);
}

export interface User {
  id: number;
  email: string;
  name: string;
  phone: string;
  freeQuestionsUsed: number;
  /** Единый счётчик запросов к AI (объединяет прежние "вопросы" и "документы") */
  paidRequests: number;
  paidExpert: boolean;
  paidBusiness: number;
  isAdmin: boolean;
  subscriptionConsultUntil: string | null;
  subscriptionDocsUntil: string | null;
  businessSubscriptionUntil: string | null;
  businessActionsLeft: number;
  businessOrgName: string;
  referralCode: string;
  lawyerQuestionsLeft: number;
  hasFileAnalysis: boolean;
  purchasedPlan: "trial" | "starter" | "pro" | "max" | null;
  lawyerConsultationsLeft: number;
  /** Дневной бесплатный лимит запросов (3/24ч), хранится на сервере — общий для всех устройств */
  dailyFreeLeft: number;
  dailyFreeResetAt: string | null;
}

/** Купил ли пользователь хотя бы тариф Старт или выше (независимо от остатков) */
export function hasPurchasedPlan(user: User): boolean {
  return !!user.purchasedPlan;
}

/** Счётчик запросов на нуле — функции недоступны, нужно продление */
export function isPlanExhausted(user: User): boolean {
  if (user.isAdmin) return false;
  if (hasActiveSubscription(user, "consult") || hasActiveSubscription(user, "docs")) return false;
  return user.paidRequests <= 0;
}

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * fetch с таймаутом + автоматическая retry при сетевой ошибке (мобильные сети, нестабильный 4G).
 * При AbortError/TypeError — понятное сообщение пользователю.
 */
export async function fetchSafe(
  url: string,
  options: RequestInit,
  timeoutMs: number,
  retries = 1,
  onRetry?: () => void
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(tid);
      return res;
    } catch (err) {
      clearTimeout(tid);
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      const isNetwork = err instanceof TypeError;
      if ((isAbort || isNetwork) && attempt < retries) {
        onRetry?.();
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      if (isAbort) throw new Error("Превышено время ожидания. Проверьте интернет и попробуйте ещё раз.");
      if (isNetwork) throw new Error("Нет соединения с сервером. Проверьте интернет и попробуйте ещё раз.");
      throw err;
    }
  }
  throw new Error("Нет соединения с сервером. Попробуйте ещё раз.");
}

// Lawyer actions → lawyer-service (переписка, быстрые операции)
const LAWYER_ACTIONS = new Set([
  "lawyer-send", "lawyer-messages", "lawyer-ping", "lawyer-close-dialog",
  "lawyer-complete-consultation", "lawyer-complete-service", "lawyer-cleanup-files",
]);

// Actions которые могут занять больше 10с (email, БД + pending orders, SMTP)
const SLOW_ACTIONS = new Set([
  "register", "send-otp", "add-paid-service",
]);

async function apiCall(body: object, timeoutMs = 45000, noRetry = false): Promise<Response> {
  const token = getToken();
  const action = (body as Record<string, unknown>).action as string | undefined;
  const url = LAWYER_ACTIONS.has(action ?? "") ? LAWYER_URL : AUTH_URL;
  // Юрист — 20с (таймаут платформы 20с, push+email синхронно), остальные — 10с
  let cap = 10000;
  if (LAWYER_ACTIONS.has(action ?? "")) cap = 20000;
  else if (SLOW_ACTIONS.has(action ?? "")) cap = 25000;
  const effectiveTimeout = Math.min(timeoutMs, cap);

  // При 502 (перегрузка/холодный старт) — до 3 попыток с паузой 1с, 2с (если не noRetry)
  const retryDelays = noRetry ? [] : [1000, 2000];
  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), effectiveTimeout);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Auth-Token": token } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(tid);
      if (res.status === 502 && attempt < retryDelays.length) {
        await new Promise(r => setTimeout(r, retryDelays[attempt]));
        continue;
      }
      return res;
    } catch (e) {
      clearTimeout(tid);
      if (attempt < retryDelays.length) {
        await new Promise(r => setTimeout(r, retryDelays[attempt]));
        continue;
      }
      throw e;
    }
  }
  throw new Error("Нет соединения");
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ ok?: boolean; error?: string }> {
  try {
    const res = await apiCall({ action: "change-password", current_password: currentPassword, new_password: newPassword });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Ошибка. Попробуйте ещё раз." };
    return { ok: true };
  } catch {
    return { error: "Нет соединения. Проверьте интернет." };
  }
}

export async function forgotPassword(email: string): Promise<{ ok?: boolean; error?: string }> {
  try {
    const res = await apiCall({ action: "forgot-password", email });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Ошибка. Попробуйте ещё раз." };
    return { ok: true };
  } catch {
    return { error: "Нет соединения. Проверьте интернет." };
  }
}

export async function register(params: {
  name: string;
  email: string;
  phone: string;
  password: string;
  agreed_to_terms: boolean;
  otp_code?: string;
  free_trial?: boolean;
  ref_code?: string;
}): Promise<{ user?: User; error?: string; free_trial_granted?: boolean; ref_bonus_granted?: boolean }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await apiCall({ action: "register", ...params });
      const data = await res.json();
      if (!res.ok) return { error: data.error || "Ошибка регистрации" };
      setToken(data.token);
      invalidateUserCache();
      return { user: data.user, free_trial_granted: data.free_trial_granted, ref_bonus_granted: data.ref_bonus_granted };
    } catch (e) {
      if (attempt === 1) {
        if (e instanceof Error && e.name === "AbortError") {
          return { error: "Сервер не отвечает. Попробуйте ещё раз через несколько секунд." };
        }
        return { error: "Ошибка соединения. Проверьте интернет." };
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return { error: "Ошибка соединения." };
}

export async function login(
  email: string,
  password: string
): Promise<{ user?: User; error?: string; require_otp?: boolean; hint?: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await apiCall({ action: "login", email, password });
      const data = await res.json();
      if (!res.ok) return { error: data.error || "Неверный email или пароль" };
      // Для администратора бэкенд требует OTP
      if (data.require_otp) return { require_otp: true, hint: data.hint };
      setToken(data.token);
      invalidateUserCache();
      return { user: data.user };
    } catch (e) {
      const isLast = attempt === 1;
      if (isLast) {
        if (e instanceof Error && e.name === "AbortError") {
          return { error: "Сервер не отвечает. Попробуйте ещё раз через несколько секунд." };
        }
        return { error: "Ошибка соединения. Проверьте интернет." };
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return { error: "Ошибка соединения." };
}

export async function adminLoginOtp(
  email: string,
  code: string
): Promise<{ user?: User; error?: string }> {
  try {
    const res = await apiCall({ action: "admin-login-otp", email, code });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Неверный код" };
    setToken(data.token);
    invalidateUserCache();
    return { user: data.user };
  } catch {
    return { error: "Ошибка соединения. Проверьте интернет." };
  }
}

// Кэш пользователя — один запрос в 60 сек вместо многократных дублей
let _userCache: { user: User | null; ts: number } | null = null;
const USER_CACHE_TTL = 60_000;
let _userPromise: Promise<{ user: User | null; unauthorized: boolean }> | null = null;

// Внутренняя функция — возвращает user + флаг unauthorized (true только при 401, не при сетевых ошибках)
async function _fetchUser(): Promise<{ user: User | null; unauthorized: boolean }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await apiCall({ action: "me" }, 20000);
      if (!res.ok) {
        if (res.status === 401) {
          // 401 — токен точно невалиден, чистим и разлогиниваем
          clearToken();
          _userCache = { user: null, ts: Date.now() };
          return { user: null, unauthorized: true };
        }
        // 500, 502 и пр. — проблема сервера, НЕ разлогиниваем
        // Возвращаем кэш если есть, иначе null без разлогина
        return { user: _userCache?.user ?? null, unauthorized: false };
      }
      const data = await res.json();
      const user = data.user || null;
      _userCache = { user, ts: Date.now() };
      return { user, unauthorized: false };
    } catch {
      // Сетевая ошибка — если есть кэш (даже устаревший), держим пользователя
      if (_userCache?.user) return { user: _userCache.user, unauthorized: false };
      // Первая попытка — ждём и повторяем (холодный старт PWA, iOS после сна)
      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 2500));
        continue;
      }
      // Обе попытки упали, кэша нет — токен есть, но сеть недоступна.
      // НЕ разлогиниваем — покажем экран "нет соединения"
      return { user: null, unauthorized: false };
    }
  }
  return { user: null, unauthorized: false };
}

export async function getUser(): Promise<User | null> {
  const token = getToken();
  if (!token) { _userCache = null; _userPromise = null; return null; }
  // Отдаём кэш если свежий
  if (_userCache && Date.now() - _userCache.ts < USER_CACHE_TTL) return _userCache.user;
  // Дедупликация — если запрос уже летит, ждём его
  if (_userPromise) return (await _userPromise).user;
  _userPromise = _fetchUser();
  const result = await _userPromise;
  _userPromise = null;
  return result.user;
}

// Расширенная версия — для Cabinet, где нужно знать причину null
export async function getUserWithStatus(): Promise<{ user: User | null; unauthorized: boolean }> {
  const token = getToken();
  if (!token) { _userCache = null; _userPromise = null; return { user: null, unauthorized: true }; }
  if (_userCache && Date.now() - _userCache.ts < USER_CACHE_TTL) {
    return { user: _userCache.user, unauthorized: _userCache.user === null };
  }
  if (_userPromise) return _userPromise;
  _userPromise = _fetchUser();
  const result = await _userPromise;
  _userPromise = null;
  return result;
}

export function invalidateUserCache() {
  _userCache = null;
  _userPromise = null;
}

export async function logout(): Promise<void> {
  await apiCall({ action: "logout" });
  clearToken();
  invalidateUserCache();
}

export async function updateProfile(name: string, phone?: string): Promise<User | null> {
  const res = await apiCall({ action: "update-profile", name, phone });
  if (!res.ok) return null;
  const data = await res.json();
  return data.user || null;
}

/** Списывает 1 запрос к AI (единая сущность — раньше были отдельно "вопрос" и "документ") */
export async function consumeRequest(): Promise<{ ok: boolean; isLastQuestion: boolean }> {
  const res = await apiCall({ action: "consume-request" });
  if (!res.ok) return { ok: false, isLastQuestion: false };
  try {
    const data = await res.json();
    return { ok: true, isLastQuestion: !!data.is_last_question };
  } catch {
    return { ok: true, isLastQuestion: false };
  }
}

/** Проверить доступ к AI-функциям (Старт и выше, независимо от остатков) */
export async function checkProAccess(): Promise<{ ok: boolean; reason?: string }> {
  invalidateUserCache();
  const user = await getUser();
  if (!user) return { ok: false, reason: "auth" };
  if (user.isAdmin) return { ok: true };
  // Купленный тариф — доступ сохраняется даже при нулевых счётчиках
  if (user.purchasedPlan) return { ok: true };
  const isActive = hasActiveSubscription(user, "consult") || hasActiveSubscription(user, "docs")
    || user.paidRequests >= 35;
  if (!isActive) return { ok: false, reason: "not_pro" };
  return { ok: true };
}

/** Проверить доступ к AI-редактору документа. Сама правка запросы не списывает —
 * платным является только обращение в чат с AI внутри редактора (1 запрос за сообщение). */
export async function checkEditorAccess(): Promise<{ ok: boolean; reason?: string }> {
  invalidateUserCache();
  const user = await getUser();
  if (!user) return { ok: false, reason: "auth" };
  if (user.isAdmin) return { ok: true };
  const hasAccess = hasActiveSubscription(user, "consult") || hasActiveSubscription(user, "docs")
    || user.paidRequests > 0 || getDailyFreeLeft(user) > 0;
  if (!hasAccess) return { ok: false, reason: "insufficient" };
  return { ok: true };
}

export async function refundRequest(): Promise<boolean> {
  const res = await apiCall({ action: "refund-request" });
  return res.ok;
}

// ── Дневной лимит бесплатных вопросов (3/24ч, только для пользователей без тарифа) ──────
// Хранится на сервере (users.daily_free_left/daily_free_reset_at) — общий для всех устройств
// и браузеров пользователя, сгорает и обновляется на бэкенде при каждом обращении к профилю.

/** Оставшиеся бесплатные запросы за текущие 24 часа (0 для пользователей с тарифом) */
export function getDailyFreeLeft(user: User | null): number {
  if (!user || user.purchasedPlan) return 0;
  return Math.max(0, user.dailyFreeLeft ?? 0);
}

/** Оставшиеся запросы к AI: подписка = 999 (безлимит), иначе дневной бесплатный + платные */
export async function getRequestsLeft(): Promise<number> {
  const user = await getUser();
  if (!user) return 0;
  if (user.isAdmin) return 999;
  if (hasActiveSubscription(user, "consult") || hasActiveSubscription(user, "docs")) return 999;
  const paid = user.paidRequests ?? 0;
  return getDailyFreeLeft(user) + paid;
}

/** Доступен ли хотя бы 1 запрос к AI (для генерации документа) */
export async function canUseRequest(): Promise<boolean> {
  invalidateUserCache();
  const user = await getUser();
  if (!user) return false;
  if (user.isAdmin) return true;
  if (hasActiveSubscription(user, "consult") || hasActiveSubscription(user, "docs")) return true;
  return user.paidRequests > 0 || getDailyFreeLeft(user) > 0;
}

export async function addPaidService(serviceType: string, invId?: number): Promise<void> {
  await apiCall({ action: "add-paid-service", service_type: serviceType, inv_id: invId });
}

export async function sendOtp(email: string): Promise<{ ok?: boolean; error?: string }> {
  const res = await apiCall({ action: "send-otp", email });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Ошибка отправки кода" };
  return { ok: true };
}

export async function verifyOtp(email: string, code: string): Promise<{ ok?: boolean; error?: string }> {
  const res = await apiCall({ action: "verify-otp", email, code });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Неверный код" };
  return { ok: true };
}

export async function sendReport(message: string): Promise<{ ok?: boolean; error?: string }> {
  const res = await apiCall({ action: "report", message });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Ошибка отправки" };
  return { ok: true };
}

export interface Report {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  message: string;
  status: "new" | "replied" | "closed";
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
  reply_seen?: boolean;
}

export async function getMyReports(): Promise<{ reports: Report[]; unseen_count: number }> {
  const res = await apiCall({ action: "my-reports" });
  const data = await res.json();
  return { reports: data.reports || [], unseen_count: data.unseen_count || 0 };
}

export async function getUnseenRepliesCount(): Promise<number> {
  try {
    const res = await apiCall({ action: "my-reports" });
    const data = await res.json();
    return data.unseen_count || 0;
  } catch {
    return 0;
  }
}

export async function getAdminReports(statusFilter = "all"): Promise<Report[]> {
  const res = await apiCall({ action: "admin-reports", sub_action: "list", status_filter: statusFilter });
  const data = await res.json();
  return data.reports || [];
}

export async function replyToReport(reportId: number, reply: string): Promise<{ ok?: boolean; error?: string }> {
  const res = await apiCall({ action: "admin-reports", sub_action: "reply", report_id: reportId, reply });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Ошибка ответа" };
  return { ok: true };
}

export async function closeReport(reportId: number): Promise<void> {
  await apiCall({ action: "admin-reports", sub_action: "close", report_id: reportId });
}

export interface LegalDoc {
  id: number;
  category: "case_law" | "state_duty";
  subcategory: string;
  doc_year: number | null;
  title: string;
  filename: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  description: string;
  download_url: string;
  court_name: string;
  case_number: string;
}

async function legalDocsCall(body: object, timeoutMs = 30000): Promise<Response> {
  const token = getToken();
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(LEGAL_DOCS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(tid);
  }
}

export async function getLegalDocs(category?: string): Promise<LegalDoc[]> {
  const res = await legalDocsCall({ action_sub: "list", category: category || "" });
  const data = await res.json();
  return data.docs || [];
}

export async function uploadLegalDoc(params: {
  category: "case_law" | "state_duty";
  subcategory?: string;
  doc_year?: number | null;
  title: string;
  description: string;
  file: string;
  filename: string;
  court_name?: string;
  case_number?: string;
}): Promise<{ ok?: boolean; id?: number; error?: string }> {
  const res = await legalDocsCall({ action_sub: "upload", ...params }, 60000);
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Ошибка загрузки" };
  return { ok: true, id: data.id };
}

export async function requestLegalDocDeleteOtp(docId: number): Promise<{ ok?: boolean; error?: string }> {
  const res = await legalDocsCall({ action_sub: "delete-request-otp", doc_id: docId });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Ошибка отправки кода" };
  return { ok: true };
}

export async function deleteLegalDoc(docId: number, otpCode: string): Promise<{ ok?: boolean; error?: string }> {
  const res = await legalDocsCall({ action_sub: "delete", doc_id: docId, otp_code: otpCode });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Ошибка удаления" };
  return { ok: true };
}

export async function reindexLegalDocs(category: string, docId?: number): Promise<{
  ok?: boolean; reindexed?: number; docs?: { id: number; title: string; chunks: number }[]; errors?: string[]; error?: string;
}> {
  const res = await legalDocsCall({ action_sub: "reindex", category, ...(docId ? { doc_id: docId } : {}) }, 120000);
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Ошибка переиндексации" };
  return { ok: true, reindexed: data.reindexed, docs: data.docs, errors: data.errors };
}

export function getFreeLeft(user: User): number {
  return user.isAdmin ? 999 : user.paidRequests;
}

export interface LawyerMessage {
  id: number;
  user_id: number;
  sender: "user" | "admin";
  body: string;
  attachment_type?: string;
  attachment_name?: string;
  attachment_content?: string;
  is_read: boolean;
  created_at: string;
  edited_content?: string;
  edited_at?: string;
}

export interface LawyerDialog {
  user_id: number;
  name: string;
  email: string;
  last_message: string;
  last_sender: string;
  last_at: string;
  unread: number;
  is_closed?: boolean;
  lawyer_consultations_left?: number;
  purchased_plan?: string | null;
}

export async function lawyerSend(params: {
  body: string;
  target_user_id?: number;
  attachment_type?: string;
  attachment_name?: string;
  attachment_content?: string;
}): Promise<{ ok?: boolean; error?: string }> {
  // noRetry=true — повтор отправки сообщения недопустим (создаёт дубли в БД)
  const res = await apiCall({ action: "lawyer-send", ...params }, 20000, true);
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Ошибка отправки" };
  return { ok: true };
}

export async function lawyerEditDoc(params: {
  target_user_id: number;
  msg_id: number;
  edited_content: string;
  attachment_name?: string;
}): Promise<{ ok?: boolean; edited_at?: string; error?: string }> {
  const res = await apiCall({ action: "lawyer-edit-doc", ...params }, 10000, true);
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Ошибка сохранения" };
  return { ok: true, edited_at: data.edited_at };
}

export async function lawyerMessages(params?: {
  target_user_id?: number;
  limit?: number;
  show_closed?: boolean;
}): Promise<{ messages?: LawyerMessage[]; dialogs?: LawyerDialog[]; error?: string }> {
  const res = await apiCall({ action: "lawyer-messages", ...(params || {}) });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Ошибка загрузки" };
  return data;
}

// Лёгкий ping — только last_id и unread, без тела сообщений (~10мс vs ~250мс)
export async function lawyerPing(params?: {
  last_id?: number;
  target_user_id?: number;
}): Promise<{ last_id?: number; unread?: number; has_new?: boolean; error?: string }> {
  try {
    const res = await apiCall({ action: "lawyer-ping", ...(params || {}) }, 5000, true); // noRetry=true — ping не критичен
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    return data;
  } catch {
    return { error: "ping failed" };
  }
}

export async function lawyerCloseDialog(targetUserId: number): Promise<{ ok?: boolean; error?: string }> {
  const res = await apiCall({ action: "lawyer-close-dialog", target_user_id: targetUserId });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Ошибка" };
  return { ok: true };
}

export async function lawyerCompleteConsultation(targetUserId: number): Promise<{ ok?: boolean; consultations_left?: number; error?: string }> {
  const res = await apiCall({ action: "lawyer-complete-consultation", target_user_id: targetUserId });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Ошибка" };
  return { ok: true, consultations_left: data.consultations_left };
}

export async function lawyerCompleteService(targetUserId: number, serviceType = "paid_expert"): Promise<{ ok?: boolean; error?: string }> {
  const res = await apiCall({ action: "lawyer-complete-service", target_user_id: targetUserId, service_type: serviceType });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Ошибка" };
  return { ok: true };
}

export async function lawyerUploadFile(file: string, filename: string): Promise<{ url?: string; key?: string; filename?: string; expires_at?: number; error?: string }> {
  const token = getToken();
  const res = await fetchSafe(
    LAWYER_UPLOAD_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
      body: JSON.stringify({ file, filename }),
    },
    28000,
  );
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Ошибка загрузки" };
  return data;
}

/** Проверяет активную подписку на стороне клиента */
export function hasActiveSubscription(user: User, kind: "consult" | "docs"): boolean {
  const until = kind === "consult" ? user.subscriptionConsultUntil : user.subscriptionDocsUntil;
  if (!until) return false;
  return new Date(until) > new Date();
}

/** Проверяет активную бизнес-подписку */
export function hasBusinessSubscription(user: User): boolean {
  if (user.isAdmin) return true;
  if (!user.businessSubscriptionUntil) return false;
  return new Date(user.businessSubscriptionUntil) > new Date();
}

export async function businessUpdateOrg(orgName: string): Promise<{ ok?: boolean; error?: string }> {
  const res = await apiCall({ action: "business-update-org", org_name: orgName });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Ошибка" };
  return { ok: true };
}

export interface BillingLogEntry {
  id: number;
  service_type: string;
  amount: number;
  description: string;
  source: string;
  payment_id: string | null;
  created_at: string;
}

export async function getBillingLog(targetUserId: number): Promise<BillingLogEntry[]> {
  const res = await apiCall({ action: "get-billing-log", target_user_id: targetUserId });
  const data = await res.json();
  return data.logs || [];
}

export async function listUsers(): Promise<{ id: number; email: string; name: string }[]> {
  const res = await apiCall({ action: "list-users" });
  const data = await res.json();
  return data.users || [];
}

export interface AllBillingLogEntry extends BillingLogEntry {
  user_id: number;
  user_email: string;
  user_name: string;
}

export async function getAllBillingLog(opts?: { seen_ids?: number[]; offset?: number }): Promise<{ logs: AllBillingLogEntry[]; total: number }> {
  const res = await apiCall({ action: "get-all-billing-log", limit: 100, offset: opts?.offset ?? 0, seen_ids: opts?.seen_ids ?? [] });
  const data = await res.json();
  return { logs: data.logs || [], total: data.total || 0 };
}

export interface AdminUserEntry {
  id: number;
  email: string;
  name: string;
  phone: string;
  created_at: string;
  paid_requests: number;
  is_admin: boolean;
}

export async function getNewUsers(opts?: { seen_ids?: number[] }): Promise<{ users: AdminUserEntry[]; total: number }> {
  const res = await apiCall({ action: "get-new-users", limit: 50, seen_ids: opts?.seen_ids ?? [] });
  const data = await res.json();
  return { users: data.users || [], total: data.total || 0 };
}

export async function adminGrant(params: {
  target_user_id: number;
  requests?: number;
  lawyer_questions?: number;
  set_requests?: number;
  set_lawyer_questions?: number;
  grant_service?: string;
  comment?: string;
}): Promise<{ ok?: boolean; changes?: string[]; paid_requests?: number; paid_expert?: boolean; lawyer_questions_left?: number; error?: string }> {
  const res = await apiCall({
    action: "admin-grant",
    target_user_id: params.target_user_id,
    questions: params.requests,
    set_questions: params.set_requests,
    lawyer_questions: params.lawyer_questions,
    set_lawyer_questions: params.set_lawyer_questions,
    grant_service: params.grant_service,
    comment: params.comment,
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Ошибка начисления" };
  return data;
}

export interface AdminUserFull {
  id: number;
  email: string;
  name: string;
  phone: string;
  paid_requests: number;
  paid_expert: boolean;
  lawyer_questions_left: number;
  paid_business: number;
  is_admin: boolean;
  created_at: string | null;
  last_login_at: string | null;
  subscription_consult_until: string | null;
  subscription_docs_until: string | null;
  business_subscription_until: string | null;
  business_actions_left: number;
  orders: Array<{
    inv_id: number; service_type: string; amount: number;
    status: string; credited: boolean; created_at: string | null;
  }>;
  billing: Array<{
    service_type: string; amount: number; description: string;
    source: string; created_at: string | null;
  }>;
}

export async function adminSearchUser(email: string): Promise<{ users: AdminUserFull[]; error?: string }> {
  const res = await apiCall({ action: "admin-search-user", email });
  const data = await res.json();
  if (!res.ok) return { users: [], error: data.error || "Ошибка поиска" };
  return { users: data.users || [] };
}

export async function businessConsumeAction(): Promise<{ ok?: boolean; error?: string }> {
  const res = await apiCall({ action: "business-consume-action" });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Нет действий в пакете" };
  return { ok: true };
}

export async function businessMessagesGet(): Promise<{ id: number; role: string; body: string; created_at: string }[]> {
  const res = await apiCall({ action: "business-messages-get" });
  const data = await res.json();
  return data.messages || [];
}

export interface ComputeStats {
  last_hour_sec: number;
  today_sec: number;
  week_sec: number;
  today_requests: number;
  today_docs: number;
  today_chats: number;
  days: { day: string; total_sec: number; requests: number; docs: number; chats: number }[];
  by_mode: { mode: string; count: number; avg_sec: number }[];
  online_users: { email: string; user_id: number | null; last_active: string; today_sec: number; today_requests: number; online_requests: number }[];
  top_users: { email: string; user_id: number | null; today_sec: number; requests: number; chats: number; docs: number; files: number }[];
}

export async function getComputeStats(): Promise<ComputeStats | null> {
  const res = await apiCall({ action: "get-compute-stats" });
  if (!res.ok) return null;
  return await res.json();
}

export async function businessMessageSave(role: "user" | "ai", body: string): Promise<void> {
  await apiCall({ action: "business-messages-save", role, body });
}