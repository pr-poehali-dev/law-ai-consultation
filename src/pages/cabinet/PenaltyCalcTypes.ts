export interface DebtChange {
  id: number;
  date: string;
  amount: string;
  type: "payment" | "increase";
}

export interface PeriodRow {
  from: string;
  to: string;
  debt: number;
  days: number;
  rate: number;
  penalty: number;
}

export interface CalcResult {
  total: number;
  capped: number | null;
  capApplied: boolean;
  periods: PeriodRow[];
}

export type CalcMode = "percent" | "cbr" | "fixed";
export type CapMode = "amount" | "percent";

export function numToWords(n: number): string {
  const r = Math.round(n * 100) / 100;
  const rub = Math.floor(r);
  const kop = Math.round((r - rub) * 100);
  const ones = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
  const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

  const say = (n: number, fem: boolean): string => {
    if (n === 0) return "";
    let s = "";
    if (n >= 100) { s += hundreds[Math.floor(n / 100)] + " "; n %= 100; }
    if (n >= 10 && n < 20) { s += teens[n - 10] + " "; return s; }
    if (n >= 20) { s += tens[Math.floor(n / 10)] + " "; n %= 10; }
    if (n > 0) {
      if (n === 1) s += (fem ? "одна" : "один") + " ";
      else if (n === 2) s += (fem ? "две" : "два") + " ";
      else s += ones[n] + " ";
    }
    return s;
  };

  const millions = Math.floor(rub / 1_000_000);
  const thousands = Math.floor((rub % 1_000_000) / 1_000);
  const rest = rub % 1_000;

  let result = "";
  if (millions > 0) {
    const w = say(millions, false);
    const m = millions % 10 === 1 && millions % 100 !== 11 ? "миллион" : millions % 10 >= 2 && millions % 10 <= 4 && (millions % 100 < 10 || millions % 100 >= 20) ? "миллиона" : "миллионов";
    result += w + m + " ";
  }
  if (thousands > 0) {
    const w = say(thousands, true);
    const t = thousands % 10 === 1 && thousands % 100 !== 11 ? "тысяча" : thousands % 10 >= 2 && thousands % 10 <= 4 && (thousands % 100 < 10 || thousands % 100 >= 20) ? "тысячи" : "тысяч";
    result += w + t + " ";
  }
  result += say(rest, false);

  const rubWord = rub % 10 === 1 && rub % 100 !== 11 ? "рубль" : rub % 10 >= 2 && rub % 10 <= 4 && (rub % 100 < 10 || rub % 100 >= 20) ? "рубля" : "рублей";
  result = (result.trim() || "ноль") + " " + rubWord;

  const kopWord = kop % 10 === 1 && kop % 100 !== 11 ? "копейка" : kop % 10 >= 2 && kop % 10 <= 4 && (kop % 100 < 10 || kop % 100 >= 20) ? "копейки" : "копеек";
  result += ` ${String(kop).padStart(2, "0")} ${kopWord}`;

  return result.trim();
}

export function fmt(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function daysBetween(a: string, b: string): number {
  const d1 = new Date(a), d2 = new Date(b);
  return Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
