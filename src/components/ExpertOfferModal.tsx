import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import type { ServiceType } from "@/components/PaymentModal";

interface ExpertOfferModalProps {
  onClose: () => void;
  onSelectOffer: (type: ServiceType, name: string) => void;
}

const MAX_EXPERT_FEATURES = [
  { icon: "UserCheck", text: "Консультация юриста на сайте или по телефону" },
  { icon: "FileCheck", text: "Подготовка 2 документов живым юристом" },
  { icon: "MessageCircle", text: "до 300 вопросов AI-юристу" },
  { icon: "FileText", text: "50 документов AI (исковые, претензии, жалобы)" },
  { icon: "Search", text: "Анализ нескольких документов сразу (PDF, фото)" },
  { icon: "Star", text: "Приоритетный доступ · Всё из тарифа «Максимум»" },
];

const EXPERT_ONLY_FEATURES = [
  { icon: "MessageCircle", text: "Личная переписка с юристом в чате" },
  { icon: "FileSearch", text: "Анализ документов и ответов AI юристом" },
  { icon: "FileCheck", text: "Письменное заключение по вашей ситуации" },
  { icon: "Clock", text: "Ответ за 24 часа в рабочие дни" },
];

export default function ExpertOfferModal({ onClose, onSelectOffer }: ExpertOfferModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    document.body.style.overflow = "hidden";
    return () => { clearTimeout(t); document.body.style.overflow = ""; };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-250 ${visible ? "bg-black/60 backdrop-blur-sm" : "bg-transparent"}`}
      onClick={handleClose}
    >
      <div
        className={`bg-white w-full sm:rounded-3xl sm:max-w-2xl flex flex-col shadow-2xl transition-all duration-250 ease-out rounded-t-3xl
          ${visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}
          max-h-[92dvh] sm:max-h-[90vh]`}
        onClick={e => e.stopPropagation()}
      >
        {/* Драг-хэндл мобайл */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 pt-4 sm:pt-5 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 gradient-navy rounded-xl flex items-center justify-center shrink-0">
              <Icon name="UserCheck" size={17} className="text-gold-400" />
            </div>
            <div>
              <h2 className="font-semibold text-navy-800 text-sm sm:text-base leading-tight">Консультация юриста</h2>
              <p className="text-[11px] text-muted-foreground">Выберите подходящий вариант</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-muted-foreground transition-colors">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Офферы — скролл */}
        <div className="overflow-y-auto px-4 sm:px-5 py-4 space-y-3 flex-1">

          {/* === Максимум + Юрист — рекомендованный === */}
          <div className="relative rounded-2xl overflow-hidden border-2 border-gold-400/60 bg-gradient-to-br from-navy-800 to-navy-900">
            <div className="h-0.5 bg-gradient-to-r from-transparent via-gold-400 to-transparent" />

            {/* Бейдж Рекомендуем */}
            <div className="absolute top-3.5 right-3.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold-500 text-navy-900 uppercase tracking-wide">
                Рекомендуем · Выгодно
              </span>
            </div>

            <div className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
                  <Icon name="Crown" size={20} className="text-gold-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg leading-tight">Максимум + Юрист</h3>
                  <p className="text-white/60 text-xs mt-0.5">Тариф «Максимум» и консультация живого юриста</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-5">
                {MAX_EXPERT_FEATURES.map((f) => (
                  <div key={f.text} className="flex items-start gap-2">
                    <Icon name="Check" size={12} className="text-gold-400 mt-0.5 shrink-0" />
                    <span className="text-[12px] text-white/75 leading-snug">{f.text}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-white">6 990 <span className="text-sm font-normal text-white/50">₽</span></div>
                  <div className="text-[11px] text-white/50 mt-0.5">Сэкономьте 990 ₽ vs покупки по отдельности</div>
                </div>
                <button
                  onClick={() => { onSelectOffer("plan_max_expert", "Максимум + Юрист"); handleClose(); }}
                  className="px-5 py-3 rounded-xl bg-gold-500 text-navy-900 font-bold text-sm hover:bg-gold-400 active:scale-95 transition-all"
                >
                  Выбрать
                </button>
              </div>
            </div>
          </div>

          {/* === Только юрист === */}
          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <Icon name="UserCheck" size={18} className="text-navy-600" />
              </div>
              <div>
                <h3 className="font-bold text-navy-800 text-base leading-tight">1 консультация юриста</h3>
                <p className="text-muted-foreground text-xs mt-0.5">Личная консультация без AI-тарифа</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-4">
              {EXPERT_ONLY_FEATURES.map((f) => (
                <div key={f.text} className="flex items-start gap-2">
                  <Icon name="Check" size={12} className="text-navy-400 mt-0.5 shrink-0" />
                  <span className="text-[12px] text-muted-foreground leading-snug">{f.text}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-bold text-navy-800">990 <span className="text-sm font-normal text-muted-foreground">₽</span></div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Только консультация юриста</div>
              </div>
              <button
                onClick={() => { onSelectOffer("expert", "Консультация юриста"); handleClose(); }}
                className="px-5 py-3 rounded-xl bg-navy-800 text-white font-semibold text-sm hover:bg-navy-700 active:scale-95 transition-all"
              >
                Выбрать
              </button>
            </div>
          </div>

        </div>

        {/* Футер */}
        <div className="px-5 pb-4 sm:pb-5 pt-2 shrink-0 border-t border-slate-50">
          <p className="text-[10px] sm:text-[11px] text-center text-muted-foreground">
            Защищённая оплата · Доступ сразу после оплаты · Без автосписаний
          </p>
        </div>
      </div>
    </div>
  );
}
