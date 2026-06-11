import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";

interface ServicesSectionProps {
  onSelectService: (service: string) => void;
}

function useInView(threshold = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

const FEATURES = [
  { icon: "Zap",       title: "Мгновенный ответ",      desc: "AI анализирует ситуацию за секунды — без очередей и ожидания.", accent: "#f59e0b" },
  { icon: "BookOpen",  title: "Актуальная база законов", desc: "ГК, ТК, ЖК РФ и судебная практика — всегда актуально.",        accent: "#3b82f6" },
  { icon: "FileCheck", title: "Готовые документы",       desc: "Иски, претензии, жалобы под вашу конкретную ситуацию.",         accent: "#10b981" },
  { icon: "Shield",    title: "Конфиденциально",         desc: "Ваши данные защищены — мы не передаём их третьим лицам.",        accent: "#8b5cf6" },
  { icon: "Users",     title: "Живой юрист на связи",    desc: "Отправка на проверку и личный чат с практикующим юристом.",     accent: "#f43f5e" },
  { icon: "Smartphone",title: "Всегда под рукой",        desc: "Работает как приложение. Доступно 24/7 с любого устройства.",   accent: "#0ea5e9" },
];

const STATS = [
  { value: "12 400+", label: "пользователей" },
  { value: "120+",    label: "типов документов" },
  { value: "24/7",    label: "доступность" },
  { value: "99%",     label: "довольных клиентов" },
];

const IMAGES = [
  {
    url: "https://cdn.poehali.dev/projects/3f0ef70d-a78f-4ee8-b1bc-a70a6b86cef1/bucket/1e27bcd8-1b80-48e4-b961-6ba29253ed5e.jpg",
    title: "Генерация документов",
    sub: "Иски, претензии и ходатайства за минуту",
    accent: "#0f4c81",
  },
  {
    url: "https://cdn.poehali.dev/projects/3f0ef70d-a78f-4ee8-b1bc-a70a6b86cef1/bucket/3a20e942-9702-461b-a83d-e1ed1d3c30b8.jpg",
    title: "Диалог с экспертом",
    sub: "Живой юрист проверит и усилит вашу позицию",
    accent: "#059669",
  },
];

function ImageCard({ img, delay, reverse }: { img: typeof IMAGES[0]; delay: number; reverse: boolean }) {
  const { ref, visible } = useInView(0);
  return (
    <div
      ref={ref}
      className="flex-1 min-w-0 rounded-3xl overflow-hidden relative group"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : `translateY(32px) scale(0.97)`,
        transition: `opacity 0.7s ease ${delay}s, transform 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}s`,
        boxShadow: "0 16px 48px rgba(0,0,0,0.13), 0 0 0 1px rgba(0,0,0,0.05)",
      }}
    >
      <img
        src={img.url}
        alt={img.title}
        className="w-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
        style={{ height: "clamp(200px,42vw,340px)" }}
      />
      {/* Оверлей снизу */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(to top, ${img.accent}ee 0%, ${img.accent}44 40%, transparent 70%)` }}
      />
      {/* Подпись */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
        <p className="text-white font-bold text-[15px] sm:text-[17px] leading-tight mb-1">{img.title}</p>
        <p className="text-white/70 text-[12px] sm:text-[13px] leading-snug">{img.sub}</p>
      </div>
      {/* Угловой бейдж */}
      <div className="absolute top-4 left-4">
        <span
          className="text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full backdrop-blur-md"
          style={{ background: "rgba(255,255,255,0.18)", color: "#fff", border: "1px solid rgba(255,255,255,0.22)" }}
        >
          {reverse ? "Экспертиза" : "AI · Право"}
        </span>
      </div>
    </div>
  );
}

function FeatureCard({ f, delay }: { f: typeof FEATURES[0]; delay: number }) {
  const { ref, visible } = useInView(0);
  return (
    <div
      ref={ref}
      className="flex gap-4 p-5 rounded-2xl transition-all duration-200 hover:shadow-md"
      style={{
        background: "#fff",
        border: "1.5px solid rgba(15,76,129,0.07)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s cubic-bezier(0.22,1,0.36,1) ${delay}s, box-shadow 0.2s`,
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: `${f.accent}14` }}
      >
        <Icon name={f.icon as Parameters<typeof Icon>[0]["name"]} size={18} color={f.accent} />
      </div>
      <div>
        <h4 className="font-golos font-semibold text-navy-800 text-[14px] mb-1 leading-tight">{f.title}</h4>
        <p className="text-slate-500 text-[13px] leading-relaxed">{f.desc}</p>
      </div>
    </div>
  );
}

export default function ServicesSection({ onSelectService: _onSelectService }: ServicesSectionProps) {
  const { ref: hRef, visible: hVisible } = useInView(0.2);
  const { ref: sRef, visible: sVisible } = useInView(0);

  return (
    <section id="services" className="bg-white overflow-hidden">
      <div className="py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">

          {/* ── Заголовок ── */}
          <div
            ref={hRef}
            className="text-center mb-10 sm:mb-14"
            style={{
              opacity: hVisible ? 1 : 0,
              transform: hVisible ? "translateY(0)" : "translateY(28px)",
              transition: "opacity 0.65s ease, transform 0.65s cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <span className="inline-block text-[11px] font-bold tracking-[0.2em] uppercase px-4 py-1.5 rounded-full mb-4"
              style={{ background: "rgba(15,76,129,0.07)", color: "#0f4c81" }}>
              Возможности
            </span>
            <h2 className="font-cormorant font-bold text-3xl sm:text-4xl md:text-5xl text-navy-800 mb-3 leading-tight">
              Почему выбирают нас
            </h2>
            <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
              Технологии на стороне закона — быстро, надёжно, конфиденциально
            </p>
          </div>

          {/* ── Две картинки рядом ── */}
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 mb-10 sm:mb-14">
            {IMAGES.map((img, i) => (
              <ImageCard key={i} img={img} delay={i * 0.12} reverse={i === 1} />
            ))}
          </div>

          {/* ── Карточки возможностей ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-12 sm:mb-16">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.title} f={f} delay={i * 0.07} />
            ))}
          </div>

          {/* ── Статистика ── */}
          <div
            ref={sRef}
            className="rounded-3xl px-6 py-10 sm:px-12 sm:py-14"
            style={{
              background: "linear-gradient(135deg,#0a1628 0%,#0f2d54 60%,#0a1628 100%)",
              opacity: sVisible ? 1 : 0,
              transform: sVisible ? "translateY(0)" : "translateY(32px)",
              transition: "opacity 0.7s ease 0.1s, transform 0.7s cubic-bezier(0.22,1,0.36,1) 0.1s",
              boxShadow: "0 24px 64px rgba(0,0,0,0.15)",
            }}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
              {STATS.map((s, i) => (
                <div
                  key={s.label}
                  style={{
                    opacity: sVisible ? 1 : 0,
                    transform: sVisible ? "translateY(0)" : "translateY(16px)",
                    transition: `opacity 0.5s ease ${0.2 + i * 0.08}s, transform 0.5s ease ${0.2 + i * 0.08}s`,
                  }}
                >
                  <div className="font-cormorant font-bold text-3xl sm:text-4xl mb-1"
                    style={{ color: "#e8a820" }}>{s.value}</div>
                  <div className="text-white/50 text-sm">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
