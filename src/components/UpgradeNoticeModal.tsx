import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";

interface UpgradeNoticeModalProps {
  feature: string;        // Название функции
  description?: string;   // Описание
  requiredPlan?: string;  // Минимальный тариф
  onClose: () => void;
  onViewPlans: (minPlanId?: string) => void;
}

const FEATURE_INFO: Record<string, { icon: string; plan: string; desc: string; minPlanId?: string }> = {
  lawyer: {
    icon: "UserCheck",
    plan: "Старт",
    desc: "Отправка документа живому юристу доступна с тарифа «Старт» и выше.",
  },
  ai_editor: {
    icon: "BrainCircuit",
    plan: "Профи",
    desc: "Редактирование документов с помощью AI доступно с тарифа «Профи» и выше.",
    minPlanId: "plan_pro",
  },
  file_analysis: {
    icon: "FileSearch",
    plan: "Профи",
    desc: "Анализ документов и файлов доступен с тарифа «Профи» и выше.",
    minPlanId: "plan_pro",
  },
  ai_fill_chat: {
    icon: "MessagesSquare",
    plan: "Профи",
    desc: "AI-консультант по заполнению реквизитов доступен с тарифа «Профи» и выше.",
    minPlanId: "plan_pro",
  },
  default: {
    icon: "Lock",
    plan: "Профи",
    desc: "Эта функция доступна с более высокого тарифа.",
  },
};

export default function UpgradeNoticeModal({
  feature,
  onClose,
  onViewPlans,
}: UpgradeNoticeModalProps) {
  const [visible, setVisible] = useState(false);
  const info = FEATURE_INFO[feature] ?? FEATURE_INFO.default;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    document.body.style.overflow = "hidden";
    return () => { clearTimeout(t); document.body.style.overflow = ""; };
  }, []);

  const handleClose = () => { setVisible(false); setTimeout(onClose, 220); };
  const handlePlans = () => { setVisible(false); setTimeout(() => onViewPlans(info.minPlanId), 220); };

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-220 ${visible ? "bg-black/50 backdrop-blur-sm" : "bg-transparent"}`}
      onClick={handleClose}
    >
      <div
        className={`bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl shadow-2xl transition-all duration-220 ease-out ${visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Драг-хэндл */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="px-5 pt-4 pb-5 sm:px-6 sm:pt-6">
          {/* Иконка */}
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg,#0a1628,#162d5a)" }}>
              <Icon name={info.icon as Parameters<typeof Icon>[0]["name"]} size={22} color="#e8a820" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-navy-800 text-base leading-tight">Требуется тариф</p>
              <p className="text-sm text-muted-foreground mt-0.5">{info.desc}</p>
            </div>
          </div>

          {/* Плашка тарифа */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-5"
            style={{ background: "linear-gradient(135deg,rgba(232,168,32,0.08),rgba(232,168,32,0.04))", border: "1px solid rgba(232,168,32,0.3)" }}>
            <Icon name="Zap" size={16} color="#e8a820" />
            <div>
              <p className="text-xs font-semibold text-navy-700">Минимальный тариф: <span className="text-gold-600">«{info.plan}»</span></p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Вопросы юристу · Документы · AI-функции</p>
            </div>
          </div>

          {/* Кнопки */}
          <button
            onClick={handlePlans}
            className="w-full py-3 rounded-2xl text-sm font-bold mb-2.5 transition-all active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg,#e8a820,#f0c060)", color: "#0a1628" }}
          >
            Посмотреть тарифы
          </button>
          <button
            onClick={handleClose}
            className="w-full py-2.5 rounded-2xl text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}