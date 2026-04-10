import { useState } from "react";
import Icon from "@/components/ui/icon";
import { sendOtp, verifyOtp } from "@/lib/auth";

interface LoginModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "email" | "code";

export default function LoginModal({ onClose, onSuccess }: LoginModalProps) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isNew, setIsNew] = useState(false);

  const handleSendCode = async () => {
    if (!email.includes("@")) {
      setError("Введите корректный email");
      return;
    }
    setLoading(true);
    setError("");
    const result = await sendOtp(email);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setStep("code");
  };

  const handleVerify = async () => {
    if (code.length < 4) {
      setError("Введите код из письма");
      return;
    }
    setLoading(true);
    setError("");
    const result = await verifyOtp(email, code, name || undefined);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-sm animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
        >
          <Icon name="X" size={15} className="text-navy-600" />
        </button>

        <div className="p-8">
          <div className="text-center mb-7">
            <div className="w-14 h-14 gradient-navy rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Icon name={step === "email" ? "Scale" : "Mail"} size={24} className="text-gold-400" />
            </div>
            <h3 className="font-cormorant font-bold text-2xl text-navy-800">
              {step === "email" ? "Вход в кабинет" : "Код подтверждения"}
            </h3>
            <p className="text-muted-foreground text-sm mt-1">
              {step === "email"
                ? "Введите email — пришлём код для входа"
                : `Код отправлен на ${email}`}
            </p>
          </div>

          {step === "email" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-navy-700 mb-1.5 block">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                  placeholder="ivan@example.ru"
                  className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-medium text-navy-700 mb-1.5 block">
                  Ваше имя <span className="text-muted-foreground font-normal">(необязательно)</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Иван Иванов"
                  className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors"
                />
              </div>

              {error && (
                <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                  {error}
                </div>
              )}

              <button
                onClick={handleSendCode}
                disabled={!email || loading}
                className="btn-gold w-full py-3.5 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
              >
                {loading ? (
                  <>
                    <span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" />
                    <span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" />
                    <span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" />
                  </>
                ) : (
                  <>
                    <Icon name="Send" size={16} />
                    Получить код
                  </>
                )}
              </button>
            </div>
          )}

          {step === "code" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-navy-700 mb-1.5 block">Код из письма</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  placeholder="123456"
                  className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors text-center tracking-widest text-lg font-bold"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1.5">Проверьте папку «Спам», если письмо не пришло</p>
              </div>

              {error && (
                <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                  {error}
                </div>
              )}

              <button
                onClick={handleVerify}
                disabled={code.length < 4 || loading}
                className="btn-gold w-full py-3.5 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" />
                    <span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" />
                    <span className="typing-dot w-2 h-2 bg-navy-800 rounded-full" />
                  </>
                ) : (
                  <>
                    <Icon name="LogIn" size={16} />
                    Войти
                  </>
                )}
              </button>

              <button
                onClick={() => { setStep("email"); setCode(""); setError(""); }}
                className="w-full text-sm text-navy-600 hover:text-navy-800 font-medium py-2"
              >
                Изменить email
              </button>

              <button
                onClick={handleSendCode}
                disabled={loading}
                className="w-full text-xs text-muted-foreground hover:text-navy-600 transition-colors py-1"
              >
                Отправить код повторно
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
