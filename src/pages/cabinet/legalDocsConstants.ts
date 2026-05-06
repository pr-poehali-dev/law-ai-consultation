export const YEARS = [2027, 2026, 2025, 2024];

export const SUBCATEGORIES = [
  { id: "civil", label: "Гражданские дела", icon: "Scale", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  { id: "criminal", label: "Уголовные дела", icon: "AlertTriangle", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
  { id: "administrative", label: "Административные дела", icon: "FileText", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
];

export type LegalCategory = "case_law" | "state_duty" | "court_definitions" | "codex";

export const CATEGORIES: { id: LegalCategory; label: string; shortLabel: string; icon: string; color: string; bg: string; border: string; description: string }[] = [
  {
    id: "case_law",
    label: "Судебная практика",
    shortLabel: "Практика",
    icon: "Gavel",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    description: "Решения, постановления и определения судов по конкретным делам",
  },
  {
    id: "state_duty",
    label: "Госпошлины",
    shortLabel: "Пошлины",
    icon: "Receipt",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    description: "Ставки государственных пошлин 2024–2027",
  },
  {
    id: "court_definitions",
    label: "Разъяснения судов",
    shortLabel: "Разъяснения",
    icon: "BookOpen",
    color: "text-violet-700",
    bg: "bg-violet-50",
    border: "border-violet-200",
    description: "Постановления Пленумов ВС РФ, обзоры практики, разъяснения",
  },
  {
    id: "codex",
    label: "Кодексы РФ",
    shortLabel: "Кодексы",
    icon: "Library",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    description: "Действующие кодексы РФ: ГК, ТК, УК, ГПК, АПК, НК и другие",
  },
];

export function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export function fmtDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}