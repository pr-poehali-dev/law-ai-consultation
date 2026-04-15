import func2url from "../../backend/func2url.json";

const API_URL = func2url["gigachat-proxy"];
const TOKEN_KEY = "yurist_ai_token";

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

async function apiCall(body: object): Promise<Response> {
  const token = getToken();
  return fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Auth-Token": token } : {}),
    },
    body: JSON.stringify(body),
  });
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
  const res = await apiCall({ action: "register", ...params });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Ошибка регистрации" };
  setToken(data.token);
  return { user: data.user, free_trial_granted: data.free_trial_granted, ref_bonus_granted: data.ref_bonus_granted };
}

export async function login(
  email: string,
  password: string
): Promise<{ user?: User; error?: string }> {
  const res = await apiCall({ action: "login", email, password });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Неверный email или пароль" };
  setToken(data.token);
  return { user: data.user };
}

export async function getUser(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await apiCall({ action: "me" });
    if (!res.ok) {
      clearToken();
      return null;
    }
    const data = await res.json();
    return data.user || null;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await apiCall({ action: "logout" });
  clearToken();
}

export async function updateProfile(name: string, phone?: string): Promise<User | null> {
  const res = await apiCall({ action: "update-profile", name, phone });
  if (!res.ok) return null;
  const data = await res.json();
  return data.user || null;
}

export async function consumeQuestion(): Promise<boolean> {
  const res = await apiCall({ action: "consume-question" });
  return res.ok;
}

export async function consumeDoc(): Promise<boolean> {
  const res = await apiCall({ action: "consume-doc" });
  return res.ok;
}

export async function canAskQuestion(): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;
  if (user.isAdmin) return true;
  if (hasActiveSubscription(user, "consult")) return true;
  return user.paidQuestions > 0;
}

export async function getQuestionsLeft(): Promise<number> {
  const user = await getUser();
  if (!user) return 0;
  if (user.isAdmin) return 999;
  if (hasActiveSubscription(user, "consult")) return 999;
  return user.paidQuestions ?? 0;
}

export async function canUseDoc(): Promise<boolean> {
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
}

export async function getMyReports(): Promise<Report[]> {
  const res = await apiCall({ action: "my-reports" });
  const data = await res.json();
  return data.reports || [];
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
}): Promise<{ messages?: LawyerMessage[]; dialogs?: LawyerDialog[]; error?: string }> {
  const res = await apiCall({ action: "lawyer-messages", ...(params || {}) });
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
  comment?: string;
}): Promise<{ ok?: boolean; questions_added?: number; docs_added?: number; error?: string }> {
  const res = await apiCall({ action: "admin-grant", ...params });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Ошибка начисления" };
  return data;
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

export async function businessMessageSave(role: "user" | "ai", body: string): Promise<void> {
  await apiCall({ action: "business-messages-save", role, body });
}