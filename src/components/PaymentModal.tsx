import { useState } from "react";
import Icon from "@/components/ui/icon";

interface PaymentModalProps {
  planName: string;
  planPrice: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentModal({ planName, planPrice, onClose, onSuccess }: PaymentModalProps) {
  const [step, setStep] = useState<"form" | "processing" | "success">("form");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [name, setName] = useState("");

  const formatCard = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 2) return digits.slice(0, 2) + "/" + digits.slice(2);
    return digits;
  };

  const handlePay = () => {
    setStep("processing");
    setTimeout(() => {
      setStep("success");
      setTimeout(() => {
        onSuccess();
      }, 2000);
    }, 2000);
  };

  const isValid = cardNumber.replace(/\s/g, "").length === 16 && expiry.length === 5 && cvv.length === 3 && name.length > 2;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-md animate-scale-in">
        {step !== "success" && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors z-10"
          >
            <Icon name="X" size={15} className="text-navy-600" />
          </button>
        )}

        {step === "form" && (
          <div className="p-8">
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 bg-navy-50 rounded-xl px-3 py-1.5 mb-4">
                <Icon name="Shield" size={14} className="text-navy-600" />
                <span className="text-xs text-navy-600 font-medium">Защищённая оплата</span>
              </div>
              <h3 className="font-cormorant font-bold text-2xl text-navy-800">Оплата тарифа</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {planName} — <span className="font-semibold text-navy-700">{planPrice} ₽</span>
              </p>
            </div>

            {/* Card preview */}
            <div className="gradient-navy rounded-2xl p-5 mb-6 relative overflow-hidden">
              <div className="orb w-40 h-40 bg-white/5 -top-10 -right-10" />
              <div className="flex justify-between items-start mb-8">
                <Icon name="CreditCard" size={28} className="text-white/70" />
                <div className="text-white/50 text-xs font-medium">
                  {cardNumber.slice(0, 4) || "****"}
                </div>
              </div>
              <div className="text-white font-mono text-lg tracking-widest mb-3">
                {cardNumber || "**** **** **** ****"}
              </div>
              <div className="flex justify-between text-white/60 text-xs">
                <span>{name || "CARDHOLDER NAME"}</span>
                <span>{expiry || "MM/YY"}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-navy-700 mb-1.5 block">Номер карты</label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCard(e.target.value))}
                  placeholder="0000 0000 0000 0000"
                  className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-sm font-mono outline-none focus:border-navy-400 transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-navy-700 mb-1.5 block">Срок действия</label>
                  <input
                    type="text"
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    placeholder="MM/YY"
                    className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-sm font-mono outline-none focus:border-navy-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-navy-700 mb-1.5 block">CVV</label>
                  <input
                    type="password"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                    placeholder="•••"
                    className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-sm font-mono outline-none focus:border-navy-400 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-navy-700 mb-1.5 block">Имя на карте</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase())}
                  placeholder="IVAN IVANOV"
                  className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-sm font-mono uppercase outline-none focus:border-navy-400 transition-colors"
                />
              </div>

              <button
                onClick={handlePay}
                disabled={!isValid}
                className="btn-gold w-full py-4 rounded-2xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Icon name="Lock" size={16} />
                Оплатить {planPrice} ₽
              </button>
              <p className="text-center text-xs text-muted-foreground">
                Тестовая оплата — данные не передаются
              </p>
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 gradient-navy rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Icon name="CreditCard" size={28} className="text-gold-400" />
            </div>
            <h3 className="font-cormorant font-bold text-2xl text-navy-800 mb-3">Обрабатываем платёж...</h3>
            <p className="text-muted-foreground text-sm">Подождите несколько секунд</p>
            <div className="flex justify-center gap-2 mt-6">
              <span className="typing-dot w-2.5 h-2.5 bg-navy-400 rounded-full inline-block" />
              <span className="typing-dot w-2.5 h-2.5 bg-navy-400 rounded-full inline-block" />
              <span className="typing-dot w-2.5 h-2.5 bg-navy-400 rounded-full inline-block" />
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-scale-in">
              <Icon name="CheckCircle" size={40} className="text-emerald-500" />
            </div>
            <h3 className="font-cormorant font-bold text-3xl text-navy-800 mb-3">Оплачено!</h3>
            <p className="text-muted-foreground mb-2">Тариф <span className="font-semibold text-navy-700">{planName}</span> активирован.</p>
            <p className="text-sm text-muted-foreground">Доступ открыт в личном кабинете</p>
          </div>
        )}
      </div>
    </div>
  );
}
