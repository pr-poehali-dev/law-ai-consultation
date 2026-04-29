export const YEARS = [2027, 2026, 2025, 2024];

export const SUBCATEGORIES = [
  { id: "civil", label: "Гражданские дела", icon: "Scale", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  { id: "criminal", label: "Уголовные дела", icon: "AlertTriangle", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
  { id: "administrative", label: "Административные дела", icon: "FileText", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
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
