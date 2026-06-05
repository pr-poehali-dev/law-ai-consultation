import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";

const GEN_STATUSES = [
  "Анализирую запрос...",
  "Изучаю судебную практику...",
  "Подбираю нормы законодательства...",
  "Формирую структуру документа...",
  "Составляю текст...",
  "Проверяю соответствие нормам РФ...",
  "Финальная проверка...",
];

export default function DocsGeneratingOverlay({ docLabel, retrying }: { docLabel: string; retrying?: boolean }) {
  const [statusIdx, setStatusIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIdx((i) => (i + 1) % GEN_STATUSES.length);
    }, 4000);
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 1.2, 92));
    }, 600);
    return () => { clearInterval(interval); clearInterval(progressInterval); };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
        {/* Иконка */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className={`absolute inset-0 rounded-full ${retrying ? "bg-amber-400/20" : "bg-gold-400/20"} animate-ping`} />
          <div className={`absolute inset-2 rounded-full ${retrying ? "bg-amber-400/30" : "bg-gold-400/30"} animate-pulse`} />
          <div className="relative w-20 h-20 gradient-navy rounded-full flex items-center justify-center shadow-lg">
            <Icon name={retrying ? "RefreshCw" : "FileText"} size={32} className={`text-gold-400 ${retrying ? "animate-spin" : ""}`} />
          </div>
        </div>

        <h3 className="font-cormorant font-bold text-xl text-navy-800 mb-1">
          {retrying ? "Переподключаемся..." : "Составляю документ"}
        </h3>
        <p className="text-xs text-muted-foreground mb-6">
          {retrying ? "Соединение прервалось — повторная попытка" : "AI-юрист работает над документом"}
        </p>

        {/* Прогресс-бар */}
        <div className="w-full bg-slate-100 rounded-full h-2 mb-3 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-700 ease-out ${retrying ? "bg-gradient-to-r from-amber-400 to-amber-500 animate-pulse" : "bg-gradient-to-r from-navy-600 to-gold-400"}`}
            style={{ width: retrying ? "60%" : `${progress}%` }}
          />
        </div>

        {/* Статус */}
        <p className="text-[12.5px] text-navy-600 font-medium min-h-[20px] transition-all duration-500">
          {retrying ? "Пожалуйста, подождите..." : GEN_STATUSES[statusIdx]}
        </p>

        {/* Точки */}
        <div className="flex justify-center gap-1.5 mt-4">
          <span className={`typing-dot w-2 h-2 rounded-full ${retrying ? "bg-amber-300" : "bg-navy-300"}`} />
          <span className={`typing-dot w-2 h-2 rounded-full ${retrying ? "bg-amber-400" : "bg-navy-400"}`} />
          <span className={`typing-dot w-2 h-2 rounded-full ${retrying ? "bg-amber-300" : "bg-navy-300"}`} />
        </div>

        <p className="text-[11px] text-muted-foreground/60 mt-4">
          {retrying ? "Обычно занимает несколько секунд" : "Обычно занимает 20–60 секунд"}
        </p>
      </div>
    </div>
  );
}