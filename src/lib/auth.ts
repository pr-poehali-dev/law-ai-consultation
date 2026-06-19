import func2url from "../../backend/func2url.json";

const _f = func2url as Record<string, string>;

// Маршруты к функциям
const AUTH_URL = _f["gigachat-proxy"];         // авторизация, регистрация, профиль, business
const LAWYER_URL = _f["lawyer-service"];        // переписка с юристом
const LEGAL_DOCS_URL = _f["legal-docs"];        // управление правовой базой
const AI_CHAT_URL = _f["ai-chat"];
const AI_DOCS_URL = _f["ai-docs"];
const TOKEN_KEY = "yurist_ai_token";

// Keep-alive: греем ai-chat и ai-docs — только когда вкладка активна
export function startKeepAlive(): () => void {
  const ping = () => {
    if (document.visibilityState !== "visible") return; // не пингуем в фоне
    fetch(AI_CHAT_URL, { method: "GET" }).catch(() => {});
    fetch(AI_DOCS_URL, { method: "GET" }).catch(() => {});
  };
  const id = setInterval(ping, 9 * 60 * 1000);
  ping(); // сразу при входе в кабинет
  return () => clearInterval(id);
}

export interface User {
  id: number;
  email: string;
  name: string;
  phone: string;
  freeQuestionsUsed: number;
  paidQuestions: number;
  paidDocs: number;
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
  purchasedPlan: "starter" | "pro" | "max" | null;
  lawyerConsultationsLeft: number;
}

/** Купил ли пользователь хотя бы тариф Старт или выше (независимо от остатков) */
export function hasPurchasedPlan(user: User): boolean {
  return !!user.purchasedPlan;
}

/** Оба счётчика на нуле — функции недоступны, нужно продление */
export function isPlanExhausted(user: User): boolean {
  if (user.isAdmin) return false;
  if (hasActiveSubscription(user, "consult") || hasActiveSubscription(user, "docs")) return false;
  return user.paidQuestions <= 0 && user.paidDocs <= 0;
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

// Lawyer actions → lawyer-service
const LAWYER_ACTIONS = new Set([
  "lawyer-send", "lawyer-messages", "lawyer-ping", "lawyer-close-dialog",
  "lawyer-complete-service", "lawyer-upload-file", "lawyer-cleanup-files",
]);

// Actions которые могут занять больше 10с (email, БД + pending orders, SMTP)
const SLOW_ACTIONS = new Set([
  "register", "send-otp", "add-paid-service",
]);

async function apiCall(body: object, timeoutMs = 45000): Promise<Response> {
  const token = getToken();
  const controller = new AbortController();
  const action = (body as Record<string, unknown>).action as string | undefined;
  const url = LAWYER_ACTIONS.has(action ?? "") ? LAWYER_URL : AUTH_URL;
  // Медленные actions — 25с, юрист — 30с, остальные — 10с
  let cap = 10000;
  if (LAWYER_ACTIONS.has(action ?? "")) cap = 30000;
  else if (SLOW_ACTIONS.has(action ?? "")) cap = 25000;
  const effectiveTimeout = Math.min(timeoutMs, cap);
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
    return res;
  } finally {
    clearTimeout(tid);
  }
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

export async function consumeQuestion(): Promise<{ ok: boolean; isLastQuestion: boolean }> {
  const res = await apiCall({ action: "consume-question" });
  if (!res.ok) return { ok: false, isLastQuestion: false };
  try {
    const data = await res.json();
    return { ok: true, isLastQuestion: !!data.is_last_question };
  } catch {
    return { ok: true, isLastQuestion: false };
  }
}

export async function consumeDoc(): Promise<boolean> {
  const res = await apiCall({ action: "consume-doc" });
  return res.ok;
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
    || user.paidQuestions >= 30 || user.paidDocs >= 5;
  if (!isActive) return { ok: false, reason: "not_pro" };
  return { ok: true };
}

/** Проверить и списать 5 вопросов за правку AI (документы не списываются) */
export async function checkAndConsumeEditResources(_docsNeeded: number): Promise<{ ok: boolean; reason?: string }> {
  invalidateUserCache();
  const user = await getUser();
  if (!user) return { ok: false, reason: "auth" };
  if (user.isAdmin) return { ok: true };
  const QUESTIONS_PER_EDIT = 5;
  // Проверяем что достаточно вопросов
  const hasQ = hasActiveSubscription(user, "consult") || user.paidQuestions >= QUESTIONS_PER_EDIT;
  if (!hasQ) return { ok: false, reason: "insufficient" };
  // Списываем 5 вопросов поштучно
  for (let i = 0; i < QUESTIONS_PER_EDIT; i++) {
    const { ok } = await consumeQuestion();
    if (!ok) return { ok: false, reason: "insufficient" };
  }
  return { ok: true };
}

export async function refundDoc(): Promise<boolean> {
  const res = await apiCall({ action: "refund-doc" });
  return res.ok;
}

// ── Дневной лимит бесплатных вопросов (1/день, только для пользователей без тарифа) ──────
const FREE_DAILY_KEY = "landing_daily_questions";
const FREE_DAILY_LIMIT = 1;

function getTodayStr(): string {
  return new Date().toLocaleDateString("ru-RU");
}

export function getDailyFreeCount(): number {
  try {
    const raw = localStorage.getItem(FREE_DAILY_KEY);
    if (!raw) return 0;
    const d = JSON.parse(raw);
    if (d.date !== getTodayStr()) return 0;
    return d.count || 0;
  } catch { return 0; }
}

export function incrementDailyFreeCount(): number {
  const count = getDailyFreeCount() + 1;
  localStorage.setItem(FREE_DAILY_KEY, JSON.stringify({ date: getTodayStr(), count }));
  return count;
}

export function getDailyFreeLeft(): number {
  return Math.max(0, FREE_DAILY_LIMIT - getDailyFreeCount());
}

export async function canAskQuestion(): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;
  if (user.isAdmin) return true;
  if (hasActiveSubscription(user, "consult")) return true;
  // Бесплатные дневные вопросы — только для пользователей без купленного тарифа
  if (!user.purchasedPlan && getDailyFreeLeft() > 0) return true;
  return user.paidQuestions > 0;
}

export async function getQuestionsLeft(): Promise<number> {
  const user = await getUser();
  if (!user) return 0;
  if (user.isAdmin) return 999;
  if (hasActiveSubscription(user, "consult")) return 999;
  const paid = user.paidQuestions ?? 0;
  // Бесплатный дневной лимит — только для пользователей без купленного тарифа
  const dailyFree = user.purchasedPlan ? 0 : getDailyFreeLeft();
  return dailyFree + paid;
}

export async function canUseDoc(): Promise<boolean> {
  invalidateUserCache();
  const user = await getUser();
  if (!user) return false;
  if (user.isAdmin) return true;
  if (hasActiveSubscription(user, "docs")) return true;
  return user.paidDocs > 0;
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
  return user.isAdmin ? 999 : user.paidQuestions;
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
  const res = await apiCall({ action: "lawyer-send", ...params });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Ошибка отправки" };
  return { ok: true };
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
  const res = await apiCall({ action: "lawyer-ping", ...(params || {}) }, 8000);
  const data = await res.json();
  if (!res.ok) return { error: data.error };
  return data;
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
  const res = await apiCall({ action: "lawyer-upload-file", file, filename }, 30000);
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
  paid_questions: number;
  paid_docs: number;
  is_admin: boolean;
}

export async function getNewUsers(opts?: { seen_ids?: number[] }): Promise<{ users: AdminUserEntry[]; total: number }> {
  const res = await apiCall({ action: "get-new-users", limit: 50, seen_ids: opts?.seen_ids ?? [] });
  const data = await res.json();
  return { users: data.users || [], total: data.total || 0 };
}

export async function adminGrant(params: {
  target_user_id: number;
  questions?: number;
  docs?: number;
  lawyer_questions?: number;
  set_questions?: number;
  set_docs?: number;
  set_lawyer_questions?: number;
  grant_service?: string;
  comment?: string;
}): Promise<{ ok?: boolean; changes?: string[]; paid_questions?: number; paid_docs?: number; paid_expert?: boolean; lawyer_questions_left?: number; error?: string }> {
  const res = await apiCall({ action: "admin-grant", ...params });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Ошибка начисления" };
  return data;
}

export interface AdminUserFull {
  id: number;
  email: string;
  name: string;
  phone: string;
  paid_questions: number;
  paid_docs: number;
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