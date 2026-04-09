import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

interface HeroSectionProps {
  onConsult: () => void;
  onDocument: () => void;
}

const TYPED_PHRASES = [
  "Как оспорить увольнение?",
  "Составьте договор аренды",
  "Претензия к подрядчику",
  "Иск о защите прав потребителей",
  "Что делать при ДТП?",
];

export default function HeroSection({ onConsult, onDocument }: HeroSectionProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  useEffect(() => {
    const phrase = TYPED_PHRASES[phraseIndex];
    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting && displayText.length < phrase.length) {
      timeout = setTimeout(() => setDisplayText(phrase.slice(0, displayText.length + 1)), 70);
    } else if (!isDeleting && displayText.length === phrase.length) {
      timeout = setTimeout(() => setIsDeleting(true), 2200);
    } else if (isDeleting && displayText.length > 0) {
      timeout = setTimeout(() => setDisplayText(displayText.slice(0, -1)), 35);
    } else if (isDeleting && displayText.length === 0) {
      setIsDeleting(false);
      setPhraseIndex((i) => (i + 1) % TYPED_PHRASES.length);
    }

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, phraseIndex]);

  const stats = [
    { value: "12 400+", label: "клиентов" },
    { value: "98%", label: "точность AI" },
    { value: "3 мин", label: "на документ" },
    { value: "24/7", label: "доступность" },
  ];

  return (
    <section className="relative min-h-screen flex items-center gradient-hero overflow-hidden noise-overlay">
      {/* Orbs */}
      <div className="orb w-[600px] h-[600px] bg-navy-500/20 top-[-100px] right-[-100px] animate-float" style={{ animationDelay: "0s" }} />
      <div className="orb w-[400px] h-[400px] bg-gold-500/10 bottom-[10%] left-[-80px] animate-float" style={{ animationDelay: "2s" }} />
      <div className="orb w-[300px] h-[300px] bg-blue-500/10 top-[30%] left-[40%] animate-float" style={{ animationDelay: "1s" }} />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="container mx-auto px-4 relative z-10 pt-28 pb-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div
            className={`inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-8 transition-all duration-700 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-white/80 font-medium tracking-wide">
              AI обучен на 50 000+ юридических дел
            </span>
          </div>

          {/* Headline */}
          <h1
            className={`font-cormorant font-bold text-5xl md:text-7xl text-white leading-[1.1] mb-6 transition-all duration-700 delay-100 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            Юридическая помощь{" "}
            <span className="text-gradient-gold italic">24/7</span>
            <br />
            <span className="text-white/90">на основе AI</span>
          </h1>

          <p
            className={`text-white/65 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed transition-all duration-700 delay-200 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            Консультации и готовые документы за минуты. AI обучен реальными юристами с многолетним опытом.
          </p>

          {/* Typing input */}
          <div
            className={`glass rounded-2xl p-1 max-w-xl mx-auto mb-10 flex items-center gap-3 transition-all duration-700 delay-300 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <div className="flex-1 flex items-center gap-3 px-4 py-3">
              <Icon name="MessageSquare" size={18} className="text-gold-400 shrink-0" />
              <span className="text-white/70 text-sm font-golos">
                {displayText}
                <span className="inline-block w-[2px] h-4 bg-gold-400 ml-0.5 animate-pulse align-middle" />
              </span>
            </div>
            <button
              onClick={onConsult}
              className="btn-gold px-5 py-3 rounded-xl text-sm shrink-0"
            >
              Спросить AI
            </button>
          </div>

          {/* CTAs */}
          <div
            className={`flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 transition-all duration-700 delay-400 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <button
              onClick={onConsult}
              className="btn-gold px-8 py-4 rounded-2xl text-base font-semibold flex items-center gap-2 min-w-[220px] justify-center"
            >
              <Icon name="Bot" size={20} />
              Получить консультацию
            </button>
            <button
              onClick={onDocument}
              className="btn-outline-white px-8 py-4 rounded-2xl text-base font-medium flex items-center gap-2 min-w-[220px] justify-center"
            >
              <Icon name="FileText" size={20} />
              Подготовить документ
            </button>
          </div>

          {/* Stats */}
          <div
            className={`grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto transition-all duration-700 delay-500 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            {stats.map((stat) => (
              <div key={stat.value} className="glass rounded-2xl p-4 text-center">
                <div className="font-cormorant font-bold text-2xl text-gradient-gold">
                  {stat.value}
                </div>
                <div className="text-xs text-white/55 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
