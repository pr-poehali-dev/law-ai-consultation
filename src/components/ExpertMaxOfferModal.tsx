import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import PaymentModal from "@/components/PaymentModal";
import LoginModal from "@/components/LoginModal";
import { getUser } from "@/lib/auth";

interface ExpertMaxOfferModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  /** Контекст: "chat" — запрос из чата, "doc" — из документа */
  context?: "chat" | "doc";
}

const FEATURES = [
  { icon: "MessageCircle", label: "300 вопросов AI-юристу в месяц", sub: "Безлимитные консультации по законодательству РФ" },
  { icon: "FileText", label: "50 юридических документов", sub: "Исковые заявления, договоры, жалобы, претензии" },
  { icon: "UserCheck", label: "Живой юрист — проверяет ответы AI", sub: "Юрист анализирует переписку и комментирует" },
  { icon: "ScrollText", label: "Живой юрист — проверяет документы", sub: "Правовой аудит сгенерированных документов" },
  { icon: "PenLine", label: "Подготовка документов живым юристом — 2 документа", sub: "Юрист составит документ с нуля под вашу ситуацию" },
  { icon: "Upload", label: "Загрузка ваших документов для анализа", sub: "PDF, DOCX, фото — AI + юрист изучат детали" },
  { icon: "Shield", label: "Приоритетный доступ и поддержка", sub: "Первыми получаете новые функции" },
];

export default function ExpertMaxOfferModal({ onClose, onSuccess, context = "chat" }: ExpertMaxOfferModalProps) {
  const [visible, setVisible] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    getUser().then(u => {
      if (!u) setNeedsAuth(true);
    });
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const handleBuy = async () => {
    const user = await getUser();
    if (!user) {
      setShowLogin(true);
      return;
    }
    setShowPayment(true);
  };

  const handleLoginSuccess = () => {
    setShowLogin(false);
    setShowPayment(true);
  };

  const handlePaymentSuccess = () => {
    setShowPayment(false);
    onSuccess?.();
    handleClose();
  };

  if (showLogin) {
    return (
      <LoginModal
        onClose={() => setShowLogin(false)}
        onSuccess={handleLoginSuccess}
        freeTrial={false}
      />
    );
  }

  if (showPayment) {
    return (
      <PaymentModal
        serviceType="plan_max"
        serviceName="Тариф «Максимум»"
        onClose={() => setShowPayment(false)}
        onSuccess={handlePaymentSuccess}
        showRegisterPrompt={true}
        onRegisterAfterPay={handlePaymentSuccess}
      />
    );
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-250 ${visible ? "bg-black/70 backdrop-blur-sm" : "bg-transparent"}`}
      onClick={handleClose}
    >
      <div
        className={`w-full sm:max-w-lg flex flex-col shadow-2xl transition-all duration-250 ease-out
          ${visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}
          max-h-[95dvh] sm:max-h-[90vh] rounded-t-3xl sm:rounded-3xl overflow-hidden`}
        style={{ background: "linear-gradient(160deg, #07112a 0%, #0d1e3d 50%, #0a1628 100%)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Золотая линия сверху */}
        <div style={{ height: 3, background: "linear-gradient(90deg, transparent, #e8a820 20%, #f0c060 50%, #e8a820 80%, transparent)", flexShrink: 0 }} />

        {/* Шапка */}
        <div className="px-5 pt-5 pb-4 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, #e8a820, #f0c060)" }}>
                <Icon name="Crown" size={20} color="#0a1628" />
              </div>
              <div>
                <p className="text-white font-bold text-base leading-tight">Тариф «Максимум»</p>
                <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {context === "doc" ? "Отправьте документ живому юристу на проверку" : "Отправьте вопрос живому юристу на проверку"}
                </p>
              </div>
            </div>
            <button onClick={handleClose} className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
              <Icon name="X" size={16} />
            </button>
          </div>

          {/* Цена */}
          <div className="mt-4 flex items-end gap-3">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-white">5 990</span>
              <span className="text-lg font-bold" style={{ color: "#e8a820" }}>₽</span>
            </div>
            <div className="mb-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
              style={{ background: "rgba(232,168,32,0.15)", color: "#f0c060", border: "1px solid rgba(232,168,32,0.25)" }}>
              Доступ на 1 месяц
            </div>
          </div>
        </div>

        {/* Список возможностей */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
            Что входит в пакет
          </p>
          {FEATURES.map((f, i) => (
            <div key={i} className="flex items-start gap-3 px-3.5 py-3 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(232,168,32,0.12)", border: "1px solid rgba(232,168,32,0.2)" }}>
                <Icon name={f.icon} size={14} color="#e8a820" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-tight">{f.label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{f.sub}</p>
              </div>
            </div>
          ))}

          {/* Баннер «что произойдёт» */}
          <div className="mt-3 px-3.5 py-3 rounded-2xl"
            style={{ background: "rgba(232,168,32,0.08)", border: "1px solid rgba(232,168,32,0.2)" }}>
            <div className="flex items-start gap-2.5">
              <Icon name="Info" size={14} color="#e8a820" className="shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
                После оплаты {context === "doc" ? "документ" : "ваш вопрос с ответом AI"} автоматически отправится юристу.
                Ответ придёт в раздел «Юрист» вашего кабинета.
              </p>
            </div>
          </div>
        </div>

        {/* Кнопки */}
        <div className="px-5 pb-5 pt-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            onClick={handleBuy}
            className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #e8a820, #f0c060)", color: "#0a1628" }}
          >
            {needsAuth ? "Зарегистрироваться и оплатить · 5 990 ₽" : "Оплатить · 5 990 ₽"}
          </button>
          <p className="text-center text-[10px] mt-2.5" style={{ color: "rgba(255,255,255,0.25)" }}>
            Защищённая оплата · ЮКасса · Доступ сразу после оплаты
          </p>
        </div>
      </div>
    </div>
  );
}