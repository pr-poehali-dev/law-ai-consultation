import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";

const FEATURES = [
  {
    icon: "FileSearch",
    emoji: "📄",
    accent: "from-blue-500/20 to-cyan-500/10",
    border: "border-blue-500/20",
    iconColor: "text-blue-400",
    tag: "Мгновенный анализ",
    title: "Анализ документов за секунды из любой точки мира",
    description:
      "Загрузите файл с компьютера или просто сфотографируйте документ на телефон — прямо сейчас, на месте. Отказ госоргана, решение суда, контракт? AI мгновенно выявит недостатки, оценит законность и укажет на слабые места.",
    highlight: "Ваша скорость реакции и глубина анализа теперь всегда превосходит оппонента.",
  },
  {
    icon: "Brain",
    emoji: "🧠",
    accent: "from-violet-500/20 to-purple-500/10",
    border: "border-violet-500/20",
    iconColor: "text-violet-400",
    tag: "2–3 минуты",
    title: "Глубокая проработка ситуации за 2–3 минуты",
    description:
      "Задайте контекст. AI установит неочевидные взаимосвязи, учтёт все нюансы вашей ситуации и за пару минут общения сформирует детально проработанный, юридически безупречный документ.",
    highlight: "Там, где человек утонет в деталях, AI создаст шедевр.",
  },
  {
    icon: "Zap",
    emoji: "🚀",
    accent: "from-gold-500/20 to-amber-500/10",
    border: "border-gold-500/20",
    iconColor: "text-gold-400",
    tag: "Готово за 2 минуты",
    title: "Мгновенная подготовка любых документов",
    description:
      "Забудьте о томительном ожидании «часов или дней». Иск, претензия, договор, жалоба — готово через 2 минуты. Отправьте готовый документ на вторичный анализ Юриста AI, чтобы отточить каждую деталь до идеала.",
    highlight: "Без ожиданий. Без очередей. Без компромиссов.",
  },
  {
    icon: "Users",
    emoji: "👨‍⚖️",
    accent: "from-emerald-500/20 to-teal-500/10",
    border: "border-emerald-500/20",
    iconColor: "text-emerald-400",
    tag: "При необходимости",
    title: "Эскорт к живому эксперту",
    description:
      "В ситуациях, где требуется личное присутствие или уникальный опыт, AI бережно перенаправит вас и все ваши материалы к практикующему юристу-эксперту.",
    highlight: "Комплексное сопровождение «от и до»: от быстрого AI-анализа до живого профессионала.",
  },
];

export default function FeaturesSection() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="relative py-20 sm:py-28 overflow-hidden" style={{ background: '#0a1628' }}>
      {/* subtle bg pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="orb w-[500px] h-[500px] bg-gold-500/5 top-0 right-[-150px] pointer-events-none" />
      <div className="orb w-[400px] h-[400px] bg-navy-400/10 bottom-0 left-[-100px] pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div
          className={`text-center max-w-2xl mx-auto mb-14 sm:mb-18 transition-all duration-700 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-5">
            <Icon name="Sparkles" size={13} className="text-gold-400" />
            <span className="text-[11px] text-white/70 font-medium tracking-wider uppercase">Возможности</span>
          </div>
          <h2 className="font-cormorant font-bold text-3xl sm:text-4xl md:text-5xl text-white leading-tight mb-4">
            И это ещё{" "}
            <span className="text-gradient-gold italic">не всё</span>
          </h2>
          <p className="text-white/55 text-base sm:text-lg leading-relaxed">
            Наш Юрист AI продолжает вас удивлять. Будущее юридической помощи — это симбиоз опыта человека с безграничной скоростью и точностью машинного интеллекта.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 max-w-5xl mx-auto">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`relative group rounded-3xl border ${f.border} bg-gradient-to-br ${f.accent} backdrop-blur-sm p-6 sm:p-8 overflow-hidden transition-all duration-700 hover:scale-[1.015] hover:shadow-2xl hover:shadow-black/30 ${
                visible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-10"
              }`}
              style={{ transitionDelay: `${150 + i * 100}ms` }}
            >
              {/* glow on hover */}
              <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-white/[0.02]" />

              {/* Tag */}
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/10 px-3 py-1 mb-5">
                <Icon name={f.icon} size={12} className={f.iconColor} />
                <span className="text-[10px] font-medium text-white/70 tracking-wide uppercase">{f.tag}</span>
              </div>

              {/* Emoji + title */}
              <div className="flex items-start gap-3 mb-4">
                <span className="text-3xl leading-none mt-0.5 shrink-0">{f.emoji}</span>
                <h3 className="font-cormorant font-bold text-xl sm:text-2xl text-white leading-snug">
                  {f.title}
                </h3>
              </div>

              {/* Description */}
              <p className="text-white/70 text-sm sm:text-base leading-relaxed mb-4">
                {f.description}
              </p>

              {/* Highlight */}
              <div className={`flex items-start gap-2 rounded-xl bg-white/5 border ${f.border} px-3 py-2`}>
                <Icon name="Quote" size={13} className={`${f.iconColor} shrink-0 mt-0.5`} />
                <p className={`text-sm font-medium ${f.iconColor} leading-snug`}>{f.highlight}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div
          className={`text-center mt-14 transition-all duration-700 delay-700 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <p className="text-white/40 text-sm sm:text-base italic max-w-xl mx-auto">
            Позвольте AI решить вашу проблему, пока другие ждут ответа.
          </p>
        </div>
      </div>
    </section>
  );
}