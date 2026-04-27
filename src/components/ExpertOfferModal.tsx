import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import type { ServiceType } from "@/components/PaymentModal";

interface ExpertOfferModalProps {
  onClose: () => void;
  onSelectOffer: (type: ServiceType, name: string) => void;
  /** "expert" — выбор Максимум vs 1 консультация (по умолчанию)
   *  "pro" — выбор Профи vs Максимум (для скрепочки/анализа файлов) */
  mode?: "expert" | "pro";
}

const MAX_FEATURES = [
  { text: "Консультация юриста на сайте или по телефону" },
  { text: "Подготовка 2 документов живым юристом" },
  { text: "до 300 вопросов AI-юристу" },
  { text: "50 документов AI (исковые, претензии, жалобы)" },
  { text: "Анализ нескольких документов сразу (PDF, фото)" },
  { text: "Приоритетный доступ · Всё включено" },
];

const PRO_FEATURES = [
  { text: "100 вопросов AI-юристу" },
  { text: "20 готовых документов" },
  { text: "Анализ одного документа или фото в чате" },
  { text: "Определение перспективы дела" },
  { text: "Генерация .doc из диалога · История консультаций" },
];

const EXPERT_ONLY_FEATURES = [
  { text: "Личная переписка с юристом в чате" },
  { text: "Анализ документов и ответов AI юристом" },
  { text: "Письменное заключение по вашей ситуации" },
  { text: "Ответ за 24 часа в рабочие дни" },
];

export default function ExpertOfferModal({ onClose, onSelectOffer, mode = "expert" }: ExpertOfferModalProps) {
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
              <h2 className="font-semibold text-navy-800 text-sm sm:text-base leading-tight">
                {mode === "pro" ? "Анализ документов в чате" : "Консультация юриста"}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {mode === "pro" ? "Доступно с тарифа «Профи»" : "Выберите подходящий вариант"}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-muted-foreground transition-colors">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Офферы — скролл */}
        <div className="overflow-y-auto px-4 sm:px-5 py-4 space-y-3 flex-1">

          {/* === ТАРИФ МАКСИМУМ — всегда рекомендованный === */}
          <div className="relative rounded-2xl overflow-hidden border-2 border-gold-400/60 bg-gradient-to-br from-navy-800 to-navy-900">
            <div className="h-0.5 bg-gradient-to-r from-transparent via-gold-400 to-transparent" />
            <div className="absolute top-3.5 right-3.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold-500 text-navy-900 uppercase tracking-wide">
                Рекомендуем
              </span>
            </div>
            <div className="p-4 sm:p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
                  <Icon name="Crown" size={18} className="text-gold-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base sm:text-lg leading-tight">Тариф «Максимум»</h3>
                  <p className="text-white/55 text-xs mt-0.5">
                    {mode === "pro" ? "Анализ нескольких документов + юрист" : "Всё включено · AI + живой юрист"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-4">
                {MAX_FEATURES.map((f) => (
                  <div key={f.text} className="flex items-start gap-2">
                    <Icon name="Check" size={11} className="text-gold-400 mt-0.5 shrink-0" />
                    <span className="text-[11px] sm:text-[12px] text-white/75 leading-snug">{f.text}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-white">5 990 <span className="text-sm font-normal text-white/50">₽</span></div>
                  <div className="text-[10px] sm:text-[11px] text-white/50 mt-0.5">Всё включено · без подписки</div>
                </div>
                <button
                  onClick={() => { onSelectOffer("plan_max", "Тариф «Максимум»"); handleClose(); }}
                  className="shrink-0 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-gold-500 text-navy-900 font-bold text-sm hover:bg-gold-400 active:scale-95 transition-all"
                >
                  Выбрать
                </button>
              </div>
            </div>
          </div>

          {/* === ВТОРОЙ ВАРИАНТ: Профи (для анализа) или 1 консультация (для юриста) === */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            {mode === "pro" ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                    <Icon name="Zap" size={17} className="text-navy-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-navy-800 text-base leading-tight">Тариф «Профи»</h3>
                    <p className="text-muted-foreground text-xs mt-0.5">Анализ одного документа или фото</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-4">
                  {PRO_FEATURES.map((f) => (
                    <div key={f.text} className="flex items-start gap-2">
                      <Icon name="Check" size={11} className="text-navy-400 mt-0.5 shrink-0" />
                      <span className="text-[11px] sm:text-[12px] text-muted-foreground leading-snug">{f.text}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xl font-bold text-navy-800">3 990 <span className="text-sm font-normal text-muted-foreground">₽</span></div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">100 вопросов · 20 документов</div>
                  </div>
                  <button
                    onClick={() => { onSelectOffer("plan_pro", "Тариф «Профи»"); handleClose(); }}
                    className="shrink-0 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-navy-800 text-white font-semibold text-sm hover:bg-navy-700 active:scale-95 transition-all"
                  >
                    Выбрать
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                    <Icon name="UserCheck" size={17} className="text-navy-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-navy-800 text-base leading-tight">1 консультация юриста</h3>
                    <p className="text-muted-foreground text-xs mt-0.5">Только консультация — без AI-тарифа</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">
                  {EXPERT_ONLY_FEATURES.map((f) => (
                    <div key={f.text} className="flex items-start gap-2">
                      <Icon name="Check" size={11} className="text-navy-400 mt-0.5 shrink-0" />
                      <span className="text-[11px] sm:text-[12px] text-muted-foreground leading-snug">{f.text}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xl font-bold text-navy-800">990 <span className="text-sm font-normal text-muted-foreground">₽</span></div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Только консультация юриста</div>
                  </div>
                  <button
                    onClick={() => { onSelectOffer("expert", "Консультация юриста"); handleClose(); }}
                    className="shrink-0 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-navy-800 text-white font-semibold text-sm hover:bg-navy-700 active:scale-95 transition-all"
                  >
                    Выбрать
                  </button>
                </div>
              </>
            )}
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