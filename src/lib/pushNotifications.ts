import func2url from "../../backend/func2url.json";
import { getToken } from "@/lib/auth";

const AUTH_URL = (func2url as Record<string, string>)["gigachat-proxy"];
const PUSH_ASKED_KEY = "push_permission_asked";

async function apiCall(body: object): Promise<Response> {
  const token = getToken();
  return fetch(AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Auth-Token": token } : {}),
    },
    body: JSON.stringify(body),
  });
}

/** Получает VAPID публичный ключ с сервера */
async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await apiCall({ action: "vapid-public-key" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.publicKey || null;
  } catch {
    return null;
  }
}

/** Конвертирует base64url строку в Uint8Array для applicationServerKey */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

/** Отправляет подписку на сервер */
async function sendSubscriptionToServer(sub: PushSubscription): Promise<boolean> {
  const key = sub.getKey("p256dh");
  const auth = sub.getKey("auth");
  if (!key || !auth) return false;

  const p256dh = btoa(String.fromCharCode(...new Uint8Array(key)));
  const authStr = btoa(String.fromCharCode(...new Uint8Array(auth)));

  const action = getToken() ? "push-subscribe" : "push-subscribe-anon";
  try {
    const res = await apiCall({
      action,
      endpoint: sub.endpoint,
      p256dh,
      auth: authStr,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Подписывает пользователя на Web Push уведомления.
 * Если есть старая подписка — отписываем и создаём новую с актуальным VAPID ключом.
 */
export async function subscribeToPush(force = false): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  const alreadyAsked = localStorage.getItem(PUSH_ASKED_KEY);
  if (alreadyAsked && !force) return false;

  localStorage.setItem(PUSH_ASKED_KEY, "1");

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) return false;

    const reg = await navigator.serviceWorker.ready;

    // Всегда отписываем старую и создаём новую — гарантируем правильный VAPID ключ
    const existing = await reg.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
    await sendSubscriptionToServer(sub);
    return true;
  } catch (err) {
    console.warn("[Push] Ошибка подписки:", err);
    return false;
  }
}

/**
 * При входе в кабинет: если уведомления разрешены — переподписываем с актуальным VAPID ключом
 * и сохраняем на сервере (привязывает к user_id).
 */
export async function refreshPushSubscription(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!getToken()) return;

  try {
    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) return;

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    // Если подписка есть — просто шлём на сервер (привязка к user_id)
    // Если нет — создаём новую с правильным ключом
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    await sendSubscriptionToServer(sub);
  } catch {
    // не критично
  }
}

/** Проверяет, разрешены ли уведомления */
export function isPushGranted(): boolean {
  return "Notification" in window && Notification.permission === "granted";
}

/** Проверяет поддержку push в браузере */
export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}
