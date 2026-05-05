import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

const TOTAL_COMPUTE = 3_000_000;
const USED_COMPUTE = 1_180_000;
const RESET_DATE = new Date("2026-06-16");
const FUNCTION_TIMEOUT = 60;

const DAILY_TARGET = 70_000;

function getDaysLeft(): number {
  const now = new Date();
  const diff = RESET_DATE.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function ComputeStatsBlock() {
  const [expanded, setExpanded] = useState(false);

  const remaining = TOTAL_COMPUTE - USED_COMPUTE;
  const daysLeft = getDaysLeft();
  const availablePerDay = daysLeft > 0 ? Math.floor(remaining / daysLeft) : 0;
  const usedPct = Math.round((USED_COMPUTE / TOTAL_COMPUTE) * 100);

  // Запасов хватит при текущей активности
  const chatRequestsPerDay = Math.floor(availablePerDay / 2.5);
  const docRequestsPerDay = Math.floor(availablePerDay / 20);

  const statusColor =
    availablePerDay >= DAILY_TARGET
      ? "text-emerald-600"
      : availablePerDay >= DAILY_TARGET * 0.7
      ? "text-amber-600"
      : "text-red-600";

  const barColor =
    usedPct < 50
      ? "bg-emerald-500"
      : usedPct < 75
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm p-4 sm:p-6">
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center shrink-0">
          <Icon name="Cpu" size={16} className="text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-navy-800 text-sm">Вычислительный ресурс</h3>
          <p className="text-[11px] text-muted-foreground">
            Использовано{" "}
            <span className="font-semibold text-navy-700">
              {USED_COMPUTE.toLocaleString("ru-RU")}
            </span>{" "}
            из {TOTAL_COMPUTE.toLocaleString("ru-RU")} сек
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${statusColor}`}>
            {availablePerDay.toLocaleString("ru-RU")} сек/день
          </span>
          <Icon
            name={expanded ? "ChevronUp" : "ChevronDown"}
            size={14}
            className="text-muted-foreground"
          />
        </div>
      </div>

      {/* Прогресс-бар */}
      <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${usedPct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-muted-foreground">{usedPct}% использовано</span>
        <span className="text-[10px] text-muted-foreground">
          До 16 июня: {daysLeft} дн.
        </span>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">Остаток</p>
              <p className="text-sm font-bold text-navy-800">
                {remaining.toLocaleString("ru-RU")} сек
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">Доступно в день</p>
              <p className={`text-sm font-bold ${statusColor}`}>
                {availablePerDay.toLocaleString("ru-RU")} сек
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">Цель в день</p>
              <p className="text-sm font-bold text-navy-800">
                {DAILY_TARGET.toLocaleString("ru-RU")} сек
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">Таймаут функции</p>
              <p className="text-sm font-bold text-navy-800">{FUNCTION_TIMEOUT} сек</p>
            </div>
          </div>

          <div className="bg-violet-50 rounded-xl p-3 space-y-1.5">
            <p className="text-[11px] font-semibold text-violet-800">Запасов хватает на:</p>
            <div className="flex items-center gap-2">
              <Icon name="MessageCircle" size={12} className="text-violet-500 shrink-0" />
              <span className="text-[11px] text-violet-700">
                ~{chatRequestsPerDay.toLocaleString("ru-RU")} чат-запросов в день
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="FileText" size={12} className="text-violet-500 shrink-0" />
              <span className="text-[11px] text-violet-700">
                ~{docRequestsPerDay.toLocaleString("ru-RU")} генераций документов в день
              </span>
            </div>
          </div>

          {availablePerDay >= DAILY_TARGET ? (
            <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-2">
              <Icon name="CheckCircle2" size={14} className="text-emerald-500 shrink-0" />
              <p className="text-[11px] text-emerald-700">
                До 16 июня ресурса хватает с запасом
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-amber-50 rounded-xl px-3 py-2">
              <Icon name="AlertTriangle" size={14} className="text-amber-500 shrink-0" />
              <p className="text-[11px] text-amber-700">
                Ресурс ограничен — рекомендуется снизить таймаут функции
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
