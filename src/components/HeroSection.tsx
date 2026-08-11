import { useState, useEffect, memo } from "react";
import Icon from "@/components/ui/icon";
import LandingChat from "@/components/LandingChat";

interface HeroSectionProps {
  onConsult: () => void;
  onDocument: () => void;
  onPricingClick?: () => void;
  onRegister?: () => void;
  onOpenLogin?: (opts?: { freeTrial?: boolean; pendingTab?: string }) => void;
}

const stats = [
  { value: "12 400+", label: "клиентов" },
  { value: "98%", label: "точность AI" },
  { value: "3 мин", label: "на документ" },
  { value: "24/7", label: "доступность" },
];

function HeroSection({ onConsult, onDocument, onPricingClick, onRegister, onOpenLogin }: HeroSectionProps) {
  const scrollToPricing = onPricingClick ?? (() => {
    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const handleOpenLogin = onOpenLogin ?? ((opts?: { freeTrial?: boolean; pendingTab?: string }) => {
    if (opts?.freeTrial !== false) {
      onRegister?.();
    } else {
      onConsult();
    }
  });

  return (
    <section className="relative min-h-screen flex items-start gradient-hero overflow-hidden noise-overlay">
      {/* Orbs — will-change для GPU */}
      <div className="orb w-[500px] h-[500px] bg-navy-500/20 top-[-80px] right-[-80px] animate-float" style={{ animationDelay: "0s", willChange: "transform" }} />
      <div className="orb w-[350px] h-[350px] bg-gold-500/10 bottom-[10%] left-[-60px] animate-float" style={{ animationDelay: "2s", willChange: "transform" }} />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="container mx-auto px-4 relative z-10 pt-20 pb-12 sm:pt-24 sm:pb-16">
        <div className="max-w-5xl mx-auto">

          {/* Badge */}
          <div className={`flex justify-center mb-5 transition-all duration-600 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <div className="inline-flex items-center gap-2 glass rounded-full px-3 py-1.5">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0" />
              <span className="text-[11px] text-white/80 font-medium tracking-wide">
                50 000+ судебных дел и нормативных актов в базе знаний
              </span>
            </div>
          </div>

          {/* Headline */}
          <h1 className={`font-cormorant font-bold text-4xl sm:text-5xl md:text-6xl text-white leading-[1.1] mb-3 text-center transition-all duration-600 delay-100 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            Юридический помощник{" "}
            <span className="text-gradient-gold italic">24/7</span>
            <br className="hidden sm:block" />
            <span className="text-white/90"> на основе AI</span>
          </h1>

          <div className={`max-w-lg mx-auto mb-5 transition-all duration-600 delay-150 px-2 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            {/* Главный текст */}
            <p className="text-center text-white/70 text-[13px] sm:text-[15px] leading-relaxed mb-4">
              Нейросеть, знающая законы и практику РФ.{" "}
              <span className="text-white/90">Генерация исков за минуту</span>,
              умные калькуляторы, определение подсудности, поиск решений.
              Подключите живого юриста для сложных кейсов.
            </p>
            {/* Разделитель с подписью */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.12))" }} />
              <span className="text-[11px] font-semibold tracking-widest uppercase"
                style={{ color: "#e8a820", letterSpacing: "0.16em" }}>
                Всё в личном кабинете
              </span>
              <div className="flex-1 h-px" style={{ background: "linear-gradient(to left, transparent, rgba(255,255,255,0.12))" }} />
            </div>
          </div>

          {/* ── Главный чат ─────────────────────────────────────── */}
          <div className={`transition-all duration-600 delay-250 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <LandingChat onOpenLogin={handleOpenLogin} />
          </div>

          {/* Stats */}
          <div className={`relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto mt-10 transition-all duration-600 delay-300 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            {stats.map((stat) => (
              <div key={stat.value} className="glass rounded-2xl p-3 text-center">
                <div className="font-cormorant font-bold text-xl text-gradient-gold">{stat.value}</div>
                <div className="text-[10px] text-white/60 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* CTA кнопки */}
          <div className={`flex flex-col sm:flex-row items-center justify-center gap-3 mt-8 transition-all duration-600 delay-350 px-4 sm:px-0 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <button
              onClick={() => handleOpenLogin({ freeTrial: false })}
              className="btn-gold px-6 py-3.5 rounded-2xl text-sm font-semibold flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              <Icon name="LogIn" size={16} />
              Войти в личный кабинет
            </button>
            <button
              onClick={onDocument}
              className="btn-outline-white px-6 py-3.5 rounded-2xl text-sm font-medium flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              <Icon name="FileText" size={16} />
              Подготовить документ
            </button>
          </div>



        </div>
      </div>
    </section>
  );
}

export default memo(HeroSection);