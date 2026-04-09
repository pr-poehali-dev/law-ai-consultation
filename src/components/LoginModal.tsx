import { useState } from "react";
import Icon from "@/components/ui/icon";
import { login } from "@/lib/auth";

interface LoginModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function LoginModal({ onClose, onSuccess }: LoginModalProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = () => {
    if (!email || !password) return;
    setLoading(true);
    setTimeout(() => {
      login(email, name || email.split("@")[0]);
      setLoading(false);
      onSuccess();
    }, 800);
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
              <Icon name="Scale" size={24} className="text-gold-400" />
            </div>
            <h3 className="font-cormorant font-bold text-2xl text-navy-800">
              {mode === "login" ? "Вход в кабинет" : "Регистрация"}
            </h3>
            <p className="text-muted-foreground text-sm mt-1">
              {mode === "login" ? "Добро пожаловать обратно!" : "Создайте аккаунт бесплатно"}
            </p>
          </div>

          <div className="space-y-3">
            {mode === "register" && (
              <div>
                <label className="text-xs font-medium text-navy-700 mb-1.5 block">Ваше имя</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Иван Иванов"
                  className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-navy-700 mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ivan@example.ru"
                className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-navy-700 mb-1.5 block">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-navy-400 transition-colors"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!email || !password || loading}
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
                  <Icon name="LogIn" size={16} />
                  {mode === "login" ? "Войти" : "Зарегистрироваться"}
                </>
              )}
            </button>
          </div>

          <div className="mt-5 text-center">
            <button
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="text-sm text-navy-600 hover:text-navy-800 font-medium"
            >
              {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}