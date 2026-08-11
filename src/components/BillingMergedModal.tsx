import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

const SEEN_KEY = "billing_merged_seen";

export function getBillingMergedSeenKey(userId?: number) {
  return userId ? `${SEEN_KEY}_${userId}` : SEEN_KEY;
}

/** Показываем только пользователям, у которых на момент объединения биллинга
 * был куплен тариф (purchasedPlan не пустой) — это они реально ощутят изменение. */
export function shouldShowBillingMerged(userId: number | undefined, hasPurchasedPlan: boolean): boolean {
  if (!hasPurchasedPlan) return false;
  return !localStorage.getItem(getBillingMergedSeenKey(userId));
}

interface BillingMergedModalProps {
  requestsLeft: number;
  onClose: () => void;
  userId?: number;
}

export default function BillingMergedModal({ requestsLeft, onClose, userId }: BillingMergedModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    document.body.style.overflow = "hidden";
    return () => { clearTimeout(t); document.body.style.overflow = ""; };
  }, []);

  const handleClose = () => {
    localStorage.setItem(getBillingMergedSeenKey(userId), "1");
    setVisible(false);
    setTimeout(onClose, 280);
  };

  return (
    <div
      className={`fixed inset-0 z-[300] flex items-end sm:items-center justify-center transition-all duration-300 ${visible ? "bg-black/70 backdrop-blur-sm" : "bg-transparent pointer-events-none"}`}
      onClick={handleClose}
    >
      <div
        className={`relative w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden transition-all duration-300 ease-out
          ${visible ? "translate-y-0 opacity-100 sm:scale-100" : "translate-y-full sm:translate-y-0 opacity-0 sm:scale-95"}`}
        style={{ background: "linear-gradient(165deg, #0d1f3c 0%, #091528 60%, #0a1830 100%)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Радужная полоска сверху */}
        <div className="shrink-0 h-[3px]" style={{ background: "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 30%, #e8a820 60%, #f0c060 80%, #e8a820 100%)" }} />

        {/* Декоративное свечение */}
        <div className="absolute top-0 right-0 w-56 h-56 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(232,168,32,0.15) 0%, transparent 70%)", transform: "translate(25%,-25%)" }} />

        {/* Свайп-хэндл (моб.) */}
        <div className="flex justify-center pt-3 pb-0 sm:hidden shrink-0 relative">
          <div className="w-10 h-[5px] rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
        </div>

        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors z-10"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <Icon name="X" size={15} color="rgba(255,255,255,0.6)" />
        </button>

        <div className="relative px-6 pt-7 pb-6">
          {/* Иконка */}
          <div className="flex justify-center mb-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: "linear-gradient(135deg,#e8a820,#f0c060)", boxShadow: "0 8px 24px rgba(232,168,32,0.35)" }}
            >
              <Icon name="Sparkles" size={28} color="#0a1628" />
            </div>
          </div>

          <h3 className="text-center font-bold text-white text-lg leading-tight mb-2">
            Мы сделали сервис ещё выгоднее!
          </h3>
          <p className="text-center text-sm leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.6)" }}>
            Для вашего удобства мы объединили «вопросы AI-юристу» и «документы»
            в единую сущность — <span style={{ color: "#f0c060", fontWeight: 600 }}>Запросы к AI</span>.
            Теперь можно свободно тратить баланс и на консультации, и на документы —
            как вам удобнее, без отдельных лимитов.
          </p>

          {/* Остаток запросов */}
          <div
            className="rounded-2xl p-4 mb-5 flex items-center justify-between"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(232,168,32,0.25)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(232,168,32,0.15)" }}>
                <Icon name="Zap" size={18} color="#f0c060" />
              </div>
              <div>
                <p className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Ваш баланс сейчас</p>
                <p className="text-white font-bold text-base leading-tight">Доступно запросов к AI</p>
              </div>
            </div>
            <p className="text-2xl font-black shrink-0 ml-2" style={{ color: "#f0c060" }}>{requestsLeft}</p>
          </div>

          {/* Плюсы */}
          <div className="space-y-2.5 mb-6">
            {[
              { icon: "CheckCircle", text: "Никто ничего не потерял — все ваши остатки сложены вместе" },
              { icon: "Sparkles", text: "Один запрос = 1 вопрос AI-юристу ИЛИ 1 документ, на ваш выбор" },
              { icon: "Heart", text: "Сделано для удобства — меньше путаницы, больше пользы" },
            ].map((item) => (
              <div key={item.text} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(74,222,128,0.15)" }}>
                  <Icon name={item.icon as Parameters<typeof Icon>[0]["name"]} size={11} color="#4ade80" />
                </div>
                <p className="text-[12.5px] leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>{item.text}</p>
              </div>
            ))}
          </div>

          <button
            onClick={handleClose}
            className="w-full py-3 rounded-2xl font-bold text-sm active:scale-[0.98] transition-transform"
            style={{ background: "linear-gradient(135deg,#e8a820,#f0c060)", color: "#0a1628" }}
          >
            Понятно, спасибо!
          </button>
        </div>
      </div>
    </div>
  );
}
