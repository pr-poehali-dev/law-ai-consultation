import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";

const FEATURES = [
  {
    icon: "FileSearch",
    emoji: "📄",
    tagBg: "bg-blue-50 text-blue-700",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    highlightBorder: "border-l-blue-400",
    highlightText: "text-blue-700",
    tag: "Мгновенный анализ",
    title: "Анализ документов за секунды из любой точки мира",
    description:
      "Загрузите файл с компьютера или просто сфотографируйте документ на телефон — прямо сейчас, на месте. Отказ госоргана, решение суда, контракт? AI мгновенно выявит недостатки, оценит законность и укажет на слабые места.",
    highlight: "Ваша скорость реакции и глубина анализа теперь всегда превосходит оппонента.",
  },
  {
    icon: "Brain",
    emoji: "🧠",
    tagBg: "bg-violet-50 text-violet-700",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    highlightBorder: "border-l-violet-400",
    highlightText: "text-violet-700",
    tag: "2–3 минуты",
    title: "Глубокая проработка ситуации за 2–3 минуты",
    description:
      "Задайте контекст. AI установит неочевидные взаимосвязи, учтёт все нюансы вашей ситуации и за пару минут общения сформирует детально проработанный, юридически безупречный документ.",
    highlight: "Там, где человек утонет в деталях, AI создаст шедевр.",
  },
  {
    icon: "Zap",
    emoji: "🚀",
    tagBg: "bg-amber-50 text-amber-700",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    highlightBorder: "border-l-amber-400",
    highlightText: "text-amber-700",
    tag: "Готово за 2 минуты",
    title: "Мгновенная подготовка любых документов",
    description:
      "Забудьте о томительном ожидании «часов или дней». Иск, претензия, договор, жалоба — готово через 2 минуты. Отправьте готовый документ на вторичный анализ Юриста AI, чтобы отточить каждую деталь до идеала.",
    highlight: "Без ожиданий. Без очередей. Без компромиссов.",
  },
  {
    icon: "Users",
    emoji: "👨‍⚖️",
    tagBg: "bg-emerald-50 text-emerald-700",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    highlightBorder: "border-l-emerald-400",
    highlightText: "text-emerald-700",
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
    <section ref={ref} className="relative py-20 sm:py-28 bg-gradient-to-b from-slate-50 to-background overflow-hidden">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div
          className={`text-center max-w-2xl mx-auto mb-12 sm:mb-16 transition-all duration-700 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-gold-600 bg-gold-400/10 px-4 py-2 rounded-full mb-4">
            Возможности
          </span>
          <h2 className="font-cormorant font-bold text-3xl sm:text-4xl md:text-5xl text-navy-800 leading-tight mb-4">
            И это ещё{" "}
            <span className="text-gradient-gold italic">не всё</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
            Наш Юрист AI продолжает вас удивлять. Будущее юридической помощи — это симбиоз опыта человека с безграничной скоростью и точностью машинного интеллекта.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 max-w-5xl mx-auto">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`group rounded-3xl border border-border bg-card p-6 sm:p-8 card-hover transition-all duration-700 ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
              }`}
              style={{ transitionDelay: `${150 + i * 100}ms` }}
            >
              {/* Tag */}
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-10 h-10 rounded-2xl ${f.iconBg} flex items-center justify-center shrink-0`}>
                  <Icon name={f.icon} size={20} className={f.iconColor} />
                </div>
                <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${f.tagBg}`}>
                  {f.tag}
                </span>
              </div>

              {/* Emoji + title */}
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl leading-none mt-1 shrink-0">{f.emoji}</span>
                <h3 className="font-cormorant font-bold text-xl sm:text-2xl text-navy-800 leading-snug">
                  {f.title}
                </h3>
              </div>

              {/* Description */}
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed mb-4">
                {f.description}
              </p>

              {/* Highlight */}
              <div className={`border-l-2 ${f.highlightBorder} pl-3`}>
                <p className={`text-sm font-medium ${f.highlightText} leading-snug`}>{f.highlight}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <div
          className={`text-center mt-12 transition-all duration-700 delay-700 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <p className="text-muted-foreground text-sm sm:text-base italic max-w-xl mx-auto">
            Позвольте AI решить вашу проблему, пока другие ждут ответа.
          </p>
        </div>
      </div>
    </section>
  );
}
