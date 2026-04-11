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
}): Promise<{ user?: User; error?: string }> {
  const res = await apiCall({ action: "register", ...params });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Ошибка регистрации" };
  setToken(data.token);
  return { user: data.user };
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

export async function canAskQuestion(): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;
  return user.freeQuestionsUsed < 30 || user.paidQuestions > 0;
}

export async function addPaidService(serviceType: string): Promise<void> {
  await apiCall({ action: "add-paid-service", service_type: serviceType });
}

export function getFreeLeft(user: User): number {
  return Math.max(0, 30 - user.freeQuestionsUsed);
}
