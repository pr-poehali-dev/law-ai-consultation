export interface User {
  email: string;
  name: string;
  freeQuestionsUsed: number;
  paidQuestions: number;
  paidDocs: number;
  paidExpert: boolean;
  paidBusiness: number;
}

const KEY = "yurist_ai_user";

export function getUser(): User | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveUser(user: User): void {
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function login(email: string, name: string): User {
  const existing = getUser();
  if (existing && existing.email === email) return existing;
  const user: User = {
    email,
    name: name || email.split("@")[0],
    freeQuestionsUsed: 0,
    paidQuestions: 0,
    paidDocs: 0,
    paidExpert: false,
    paidBusiness: 0,
  };
  saveUser(user);
  return user;
}

export function logout(): void {
  localStorage.removeItem(KEY);
}

export function addPaidService(serviceType: string): void {
  const user = getUser();
  if (!user) return;
  if (serviceType === "consultation") user.paidQuestions += 3;
  if (serviceType === "document") user.paidDocs += 1;
  if (serviceType === "expert") user.paidExpert = true;
  if (serviceType === "business") user.paidBusiness += 1;
  saveUser(user);
}

export function consumeQuestion(): boolean {
  const user = getUser();
  if (!user) return false;
  if (user.freeQuestionsUsed < 3) {
    user.freeQuestionsUsed += 1;
    saveUser(user);
    return true;
  }
  if (user.paidQuestions > 0) {
    user.paidQuestions -= 1;
    saveUser(user);
    return true;
  }
  return false;
}

export function canAskQuestion(): boolean {
  const user = getUser();
  if (!user) return false;
  return user.freeQuestionsUsed < 3 || user.paidQuestions > 0;
}

export function getFreeLeft(): number {
  const user = getUser();
  if (!user) return 3;
  return Math.max(0, 3 - user.freeQuestionsUsed);
}