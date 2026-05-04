import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import PaymentModal from "@/components/PaymentModal";
import LoginModal from "@/components/LoginModal";
import { getUser } from "@/lib/auth";

interface ExpertMaxOfferModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  context?: "chat" | "doc";
}

const FEATURES = [
  { icon: "MessageCircle", label: "300 вопросов AI-юристу", sub: "Безлимитные консультации по законодательству РФ" },
  { icon: "FileText", label: "50 юридических документов AI", sub: "Исковые заявления, договоры, жалобы, претензии" },
  { icon: "UserCheck", label: "Консультация живого юриста", sub: "Личный разбор вашей ситуации экспертом" },
  { icon: "Bot", label: "Проверка ответов AI живым юристом", sub: "Юрист проверяет и комментирует ответы AI" },
  { icon: "ScanText", label: "Анализ документов AI живым юристом", sub: "Юрист проверяет сгенерированные документы" },
  { icon: "PenLine", label: "2 документа от живого юриста", sub: "Юрист составит документ с нуля под вашу ситуацию" },
  { icon: "Upload", label: "Загрузка ваших файлов для анализа", sub: "PDF, DOCX, фото — AI + юрист изучат детали" },
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
    getUser().then(u => { if (!u) setNeedsAuth(true); });
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
    if (!user) { setShowLogin(true); return; }
    setShowPayment(true);
  };

  if (showLogin) {
    return (
      <LoginModal
        onClose={() => setShowLogin(false)}
        onSuccess={() => { setShowLogin(false); setShowPayment(true); }}
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
        onSuccess={() => { setShowPayment(false); onSuccess?.(); handleClose(); }}
      />
    );
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center transition-all duration-250 ${visible ? "bg-black/70 backdrop-blur-sm" : "bg-transparent pointer-events-none"}`}
      onClick={handleClose}
    >
      {/* Контейнер модала — фиксированная высота на всех устройствах */}
      <div
        className={`w-full sm:max-w-lg shadow-2xl transition-all duration-250 ease-out rounded-t-3xl sm:rounded-3xl
          ${visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
        style={{
          background: "linear-gradient(160deg, #07112a 0%, #0d1e3d 50%, #0a1628 100%)",
          display: "flex",
          flexDirection: "column",
          height: "min(92dvh, 640px)",
          maxHeight: "92dvh",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Золотая линия */}
        <div style={{ height: 3, flexShrink: 0, background: "linear-gradient(90deg, transparent, #e8a820 20%, #f0c060 50%, #e8a820 80%, transparent)" }} />

        {/* Шапка */}
        <div style={{ flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "14px 16px 12px" }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, #e8a820, #f0c060)" }}>
                <Icon name="Crown" size={17} color="#0a1628" />
              </div>
              <div>
                <p className="font-bold text-white leading-tight" style={{ fontSize: 15 }}>Тариф «Максимум»</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
                  {context === "doc" ? "Отправьте документ живому юристу" : "Отправьте вопрос живому юристу"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-baseline gap-0.5">
                <span className="font-black text-white" style={{ fontSize: 22 }}>5 990</span>
                <span className="font-bold" style={{ fontSize: 13, color: "#e8a820" }}>₽</span>
              </div>
              <button onClick={handleClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                <Icon name="X" size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Список — занимает всё доступное пространство и скроллится */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>
            Что входит в пакет
          </p>

          {FEATURES.map((f, i) => (
            <div key={i} className="flex items-start gap-2.5"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, padding: "9px 12px" }}>
              <div className="flex items-center justify-center shrink-0"
                style={{ width: 28, height: 28, borderRadius: 10, background: "rgba(232,168,32,0.12)", border: "1px solid rgba(232,168,32,0.22)" }}>
                <Icon name={f.icon} size={13} color="#e8a820" />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", lineHeight: 1.25 }}>{f.label}</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{f.sub}</p>
              </div>
            </div>
          ))}

          {/* Баннер */}
          <div style={{ background: "rgba(232,168,32,0.08)", border: "1px solid rgba(232,168,32,0.2)", borderRadius: 14, padding: "9px 12px" }}>
            <div className="flex items-start gap-2">
              <Icon name="Info" size={12} color="#e8a820" className="shrink-0 mt-0.5" />
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
                После оплаты {context === "doc" ? "документ" : "ваш вопрос с ответом AI"} автоматически отправится юристу.
                Ответ придёт в раздел «Юрист» вашего кабинета.
              </p>
            </div>
          </div>
        </div>

        {/* Кнопка — всегда видна */}
        <div style={{ flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.08)", padding: "12px 16px 16px" }}>
          <button
            onClick={handleBuy}
            className="w-full rounded-2xl font-bold transition-all active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #e8a820, #f0c060)", color: "#0a1628", fontSize: 14, padding: "13px 16px" }}
          >
            {needsAuth ? "Зарегистрироваться и оплатить · 5 990 ₽" : "Оплатить · 5 990 ₽"}
          </button>
          <p className="text-center mt-2" style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
            Защищённая оплата · ЮКасса · Доступ сразу после оплаты
          </p>
        </div>
      </div>
    </div>
  );
}