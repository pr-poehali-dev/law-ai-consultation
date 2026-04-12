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

      <div className="container mx-auto px-4 relative z-10 pt-24 pb-16 sm:pt-28 sm:pb-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div
            className={`inline-flex items-center gap-2 glass rounded-full px-3 py-1.5 sm:px-4 sm:py-2 mb-6 sm:mb-8 transition-all duration-700 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0" />
            <span className="text-[11px] sm:text-xs text-white/80 font-medium tracking-wide">
              50 000+ судебных дел и нормативных актов в базе знаний
            </span>
          </div>

          {/* Headline */}
          <h1
            className={`font-cormorant font-bold text-4xl sm:text-5xl md:text-7xl text-white leading-[1.1] mb-4 sm:mb-6 transition-all duration-700 delay-100 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            Юридическая помощь{" "}
            <span className="text-gradient-gold italic">24/7</span>
            <br />
            <span className="text-white/90">на основе AI</span>
          </h1>

          <p
            className={`text-white/65 text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed transition-all duration-700 delay-200 px-2 sm:px-0 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            Обучен практикующими юристами с многолетним опытом. Точные ответы со ссылками на статьи ГК, ТК, СК и КоАП РФ — готовые документы за минуты.
          </p>

          {/* Typing input */}
          <div
            className={`glass rounded-2xl p-1 max-w-xl mx-auto mb-8 sm:mb-10 flex items-center gap-2 sm:gap-3 transition-all duration-700 delay-300 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <div className="flex-1 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 min-w-0">
              <Icon name="MessageSquare" size={16} className="text-gold-400 shrink-0" />
              <span className="text-white/70 text-xs sm:text-sm font-golos truncate">
                {displayText}
                <span className="inline-block w-[2px] h-4 bg-gold-400 ml-0.5 animate-pulse align-middle" />
              </span>
            </div>
            <button
              onClick={onConsult}
              className="btn-gold px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl text-sm shrink-0 whitespace-nowrap"
            >
              Спросить AI
            </button>
          </div>

          {/* CTAs */}
          <div
            className={`flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-12 sm:mb-16 transition-all duration-700 delay-400 px-4 sm:px-0 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <button
              onClick={onConsult}
              className="btn-gold px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl text-sm sm:text-base font-semibold flex items-center gap-2 w-full sm:w-auto sm:min-w-[220px] justify-center"
            >
              <Icon name="Bot" size={18} />
              Получить консультацию
            </button>
            <button
              onClick={onDocument}
              className="btn-outline-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl text-sm sm:text-base font-medium flex items-center gap-2 w-full sm:w-auto sm:min-w-[220px] justify-center"
            >
              <Icon name="FileText" size={18} />
              Подготовить документ
            </button>
          </div>

          {/* Stats */}
          <div
            className={`grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-2xl mx-auto transition-all duration-700 delay-500 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            {stats.map((stat) => (
              <div key={stat.value} className="glass rounded-2xl p-3 sm:p-4 text-center">
                <div className="font-cormorant font-bold text-xl sm:text-2xl text-gradient-gold">
                  {stat.value}
                </div>
                <div className="text-[10px] sm:text-xs text-white/55 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* AI capabilities banner */}
          <div
            className={`mt-6 sm:mt-8 max-w-2xl mx-auto transition-all duration-700 delay-600 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <div className="glass rounded-2xl p-4 sm:p-5 border border-white/10">
              <p className="text-[10px] sm:text-xs text-white/50 uppercase tracking-widest font-medium mb-3 text-center">Возможности AI-юриста</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: "GraduationCap", title: "Обучен профессионалами", text: "Юристы с многолетней практикой заложили знания о действующем законодательстве РФ" },
                  { icon: "FileSearch", title: "Анализ документов", text: "Проверяет договоры, иски, претензии на юридические риски и соответствие нормам" },
                  { icon: "TrendingUp", title: "Судебная перспектива", text: "Оценивает шансы в споре с учётом актуальной судебной практики и позиций ВС РФ" },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3 text-left">
                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon name={item.icon} size={15} className="text-gold-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white/90 mb-0.5">{item.title}</p>
                      <p className="text-[11px] text-white/50 leading-relaxed">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}