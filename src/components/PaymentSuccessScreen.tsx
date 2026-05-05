import { useState, useEffect } from "react";
import { login, register } from "@/lib/auth";
import { ymGoal } from "@/lib/metrika";
import Icon from "@/components/ui/icon";

interface Props {
  invId: string;
  onSuccess: () => void;
}

type Mode = "register" | "login";

export default function PaymentSuccessScreen({ invId, onSuccess }: Props) {
  const [mode, setMode] = useState<Mode>("register");
  const [step, setStep] = useState<"form" | "done">("form");

  // Register fields
  const [regName, setRegName]         = useState("");
  const [regEmail, setRegEmail]       = useState("");
  const [regPhone, setRegPhone]       = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPassConfirm, setRegPassConfirm] = useState("");
  const [agreed, setAgreed]           = useState(false);
  const [showPass, setShowPass]       = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail]       = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPass, setShowLoginPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  // Dots animation for success step
  const [dots, setDots] = useState(0);
  useEffect(() => {
    if (step !== "done") return;
    const t = setInterval(() => setDots(d => (d + 1) % 4), 400);
    return () => clearInterval(t);
  }, [step]);

  const handleRegister = async () => {
    setError("");
    if (!regName.trim())  { setError("Введите ваше имя"); return; }
    if (!regEmail.includes("@")) { setError("Введите корректный email"); return; }
    if (regPassword.length < 6)  { setError("Пароль — минимум 6 символов"); return; }
    if (regPassword !== regPassConfirm) { setError("Пароли не совпадают"); return; }
    if (!agreed) { setError("Необходимо согласие с условиями"); return; }

    setLoading(true);
    const res = await register({
      name: regName.trim(),
      email: regEmail.trim().toLowerCase(),
      phone: regPhone.trim(),
      password: regPassword,
      agreed_to_terms: true,
    });
    setLoading(false);

    if (res.error) { setError(res.error); return; }
    ymGoal("register_after_payment");
    localStorage.setItem("pending_inv_id", invId);
    setStep("done");
    setTimeout(onSuccess, 1800);
  };

  const handleLogin = async () => {
    setError("");
    if (!loginEmail || !loginPassword) { setError("Заполните email и пароль"); return; }
    setLoading(true);
    const res = await login(loginEmail, loginPassword);
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    ymGoal("login_after_payment");
    localStorage.setItem("pending_inv_id", invId);
    setStep("done");
    setTimeout(onSuccess, 1800);
  };

  if (step === "done") {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center px-4"
        style={{ background: "linear-gradient(135deg, #060d18 0%, #0a1628 50%, #0d1e38 100%)" }}
      >
        <div className="flex flex-col items-center gap-6 text-center max-w-sm">
          {/* Анимированная галочка */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 0 40px rgba(22,163,74,0.4)" }}
          >
            <Icon name="Check" size={36} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Входим в кабинет</h2>
            <p className="text-slate-400 text-sm">
              {"Загружаем ваши данные" + ".".repeat(dots)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: "linear-gradient(135deg, #060d18 0%, #0a1628 50%, #0d1e38 100%)" }}
    >
      <div className="min-h-screen flex flex-col items-center justify-start py-8 px-4">

        {/* Лого */}
        <div className="flex items-center gap-2.5 mb-8">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #0a1628, #162d5a)", border: "1px solid rgba(232,168,32,0.3)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e8a820" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <span className="font-bold text-white text-lg tracking-tight">ЮрИИ</span>
        </div>

        {/* Баннер успешной оплаты */}
        <div
          className="w-full max-w-md rounded-2xl p-5 mb-6 flex items-start gap-4"
          style={{
            background: "linear-gradient(135deg, rgba(22,163,74,0.15), rgba(21,128,61,0.08))",
            border: "1px solid rgba(22,163,74,0.35)",
            boxShadow: "0 0 30px rgba(22,163,74,0.1)",
          }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: "rgba(22,163,74,0.2)" }}
          >
            <Icon name="CheckCircle" size={24} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-emerald-400 font-bold text-base mb-1">Оплата прошла успешно!</p>
            <p className="text-slate-300 text-sm leading-relaxed">
              Ваш платёж подтверждён. Зарегистрируйтесь или войдите, чтобы получить доступ к кабинету — услуга будет начислена автоматически.
            </p>
          </div>
        </div>

        {/* Карточка формы */}
        <div
          className="w-full max-w-md rounded-2xl p-6"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Переключатель режима */}
          <div className="flex bg-white/5 rounded-xl p-1 mb-6">
            <button
              onClick={() => { setMode("register"); setError(""); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                mode === "register"
                  ? "text-navy-900 shadow-sm"
                  : "text-slate-400 hover:text-slate-300"
              }`}
              style={mode === "register" ? { background: "#e8a820" } : {}}
            >
              Регистрация
            </button>
            <button
              onClick={() => { setMode("login"); setError(""); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                mode === "login"
                  ? "text-navy-900 shadow-sm"
                  : "text-slate-400 hover:text-slate-300"
              }`}
              style={mode === "login" ? { background: "#e8a820" } : {}}
            >
              Уже есть аккаунт
            </button>
          </div>

          {mode === "register" ? (
            <div className="space-y-3">
              <h2 className="text-white font-bold text-lg mb-1">Создайте аккаунт</h2>
              <p className="text-slate-400 text-xs mb-4">После регистрации услуга будет начислена автоматически</p>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">Ваше имя</label>
                <input
                  value={regName} onChange={e => setRegName(e.target.value)}
                  placeholder="Иван Иванов"
                  className="w-full px-3.5 py-3 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-gold-400/50 transition-all"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Email</label>
                <input
                  type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                  placeholder="ivan@mail.ru"
                  className="w-full px-3.5 py-3 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-gold-400/50 transition-all"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Телефон <span className="text-slate-600">(необязательно)</span></label>
                <input
                  type="tel" value={regPhone} onChange={e => setRegPhone(e.target.value)}
                  placeholder="+7 900 000-00-00"
                  className="w-full px-3.5 py-3 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-gold-400/50 transition-all"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Пароль</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={regPassword} onChange={e => setRegPassword(e.target.value)}
                    placeholder="Минимум 6 символов"
                    className="w-full px-3.5 py-3 pr-10 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-gold-400/50 transition-all"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                  />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300">
                    <Icon name={showPass ? "EyeOff" : "Eye"} size={16} />
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Повторите пароль</label>
                <input
                  type={showPass ? "text" : "password"}
                  value={regPassConfirm} onChange={e => setRegPassConfirm(e.target.value)}
                  placeholder="Повторите пароль"
                  onKeyDown={e => e.key === "Enter" && handleRegister()}
                  className="w-full px-3.5 py-3 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-gold-400/50 transition-all"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                />
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer mt-1">
                <div
                  onClick={() => setAgreed(a => !a)}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all cursor-pointer ${
                    agreed ? "border-gold-400" : "border-white/20"
                  }`}
                  style={agreed ? { background: "#e8a820" } : { background: "rgba(255,255,255,0.05)" }}
                >
                  {agreed && <Icon name="Check" size={12} className="text-navy-900" />}
                </div>
                <span className="text-xs text-slate-400 leading-relaxed">
                  Я согласен с{" "}
                  <a href="/oferta.pdf" target="_blank" className="text-gold-400 hover:underline">условиями оферты</a>
                  {" "}и{" "}
                  <a href="/privacy.pdf" target="_blank" className="text-gold-400 hover:underline">политикой конфиденциальности</a>
                </span>
              </label>

              {error && (
                <div className="px-3.5 py-2.5 rounded-xl text-sm text-red-400 flex items-center gap-2"
                  style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <Icon name="AlertCircle" size={14} className="shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={handleRegister}
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-navy-900 flex items-center justify-center gap-2 disabled:opacity-60 transition-all active:scale-[0.98] mt-2"
                style={{ background: loading ? "#b8851a" : "linear-gradient(135deg, #e8a820, #d4941c)" }}
              >
                {loading
                  ? <><Icon name="Loader" size={16} className="animate-spin" />Создаём аккаунт...</>
                  : <><Icon name="UserPlus" size={16} />Зарегистрироваться и войти в кабинет</>
                }
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-white font-bold text-lg mb-1">Войдите в аккаунт</h2>
              <p className="text-slate-400 text-xs mb-4">Услуга будет начислена сразу после входа</p>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">Email</label>
                <input
                  type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                  placeholder="ivan@mail.ru"
                  className="w-full px-3.5 py-3 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-gold-400/50 transition-all"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Пароль</label>
                <div className="relative">
                  <input
                    type={showLoginPass ? "text" : "password"}
                    value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                    placeholder="Ваш пароль"
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                    className="w-full px-3.5 py-3 pr-10 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-gold-400/50 transition-all"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                  />
                  <button type="button" onClick={() => setShowLoginPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300">
                    <Icon name={showLoginPass ? "EyeOff" : "Eye"} size={16} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="px-3.5 py-2.5 rounded-xl text-sm text-red-400 flex items-center gap-2"
                  style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <Icon name="AlertCircle" size={14} className="shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-navy-900 flex items-center justify-center gap-2 disabled:opacity-60 transition-all active:scale-[0.98] mt-2"
                style={{ background: loading ? "#b8851a" : "linear-gradient(135deg, #e8a820, #d4941c)" }}
              >
                {loading
                  ? <><Icon name="Loader" size={16} className="animate-spin" />Входим...</>
                  : <><Icon name="LogIn" size={16} />Войти в кабинет</>
                }
              </button>
            </div>
          )}
        </div>

        {/* Подпись */}
        <div className="mt-6 flex items-center gap-6 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <Icon name="Lock" size={12} />
            Данные защищены
          </span>
          <span className="flex items-center gap-1.5">
            <Icon name="ShieldCheck" size={12} />
            Платёж подтверждён
          </span>
        </div>
      </div>
    </div>
  );
}
