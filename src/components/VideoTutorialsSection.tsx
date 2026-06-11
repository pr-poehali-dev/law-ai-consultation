import { useEffect, useRef, useState } from "react";

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

const features = [
  {
    tag: "Калькулятор неустойки",
    law: "ГК РФ ст. 395 и 330",
    title: "Точный расчёт за секунды",
    desc: "Забудьте о ручных подсчётах. Наш калькулятор автоматически рассчитает пени по 395-й или 330-й статье ГК РФ, учитывая ключевую ставку ЦБ и периоды просрочки. Подходит для суда, досудебных претензий и договоров.",
    img: "https://cdn.poehali.dev/projects/3f0ef70d-a78f-4ee8-b1bc-a70a6b86cef1/bucket/342a3ba3-c9ce-49d1-a29f-a1e10cb3388a.jpg",
    accent: "#f59e0b",
    num: "01",
  },
  {
    tag: "Судебная практика",
    law: "Судебные базы РФ",
    title: "От запроса — к уверенности",
    desc: "Анализируйте прецеденты и стройте сильную линию защиты. Мы собрали для вас ключ к любой судебной базе — от КАД Арбитр до ГАС Правосудие.",
    img: "https://cdn.poehali.dev/projects/3f0ef70d-a78f-4ee8-b1bc-a70a6b86cef1/bucket/18224958-80a2-4a85-8627-2204b97796a4.jpg",
    accent: "#059669",
    num: "02",
  },
  {
    tag: "Территориальная подсудность",
    law: "ГПК РФ",
    title: "Мировой, районный или арбитраж?",
    desc: "Наш помощник точно определит, какому суду подведомственно ваше дело по нормам ГПК РФ. Больше никаких ошибок в подаче и возвратов иска.",
    img: "https://cdn.poehali.dev/projects/3f0ef70d-a78f-4ee8-b1bc-a70a6b86cef1/bucket/50ecbf94-ee88-4312-90cd-08eef1a4bf69.jpg",
    accent: "#7c3aed",
    num: "03",
  },
  {
    tag: "Калькулятор госпошлины",
    law: "НК РФ",
    title: "Сколько стоит подать иск?",
    desc: "Рассчитайте точную сумму пошлины за 5 секунд. Просто выберите суд — общей юрисдикции или арбитраж — и укажите цену иска. Учитываются все льготы.",
    img: "https://cdn.poehali.dev/projects/3f0ef70d-a78f-4ee8-b1bc-a70a6b86cef1/bucket/1309ff3f-7371-4657-925d-83856db2d60b.jpg",
    accent: "#0f4c81",
    num: "04",
  },
];

function FeatureRow({ f, reverse }: { f: typeof features[0]; reverse: boolean }) {
  const { ref, visible } = useInView(0.12);

  return (
    <div
      ref={ref}
      className={`flex flex-col ${reverse ? "lg:flex-row-reverse" : "lg:flex-row"} items-center gap-10 lg:gap-20 py-14 lg:py-20`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(52px)",
        transition: "opacity 0.75s ease, transform 0.75s cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      {/* ── Картинка ── */}
      <div className="w-full lg:w-[52%] relative">
        {/* Большой декор-номер */}
        <span
          className="absolute font-cormorant font-bold select-none pointer-events-none z-0 leading-none"
          style={{
            fontSize: "clamp(80px,14vw,140px)",
            color: f.accent,
            opacity: 0.06,
            top: "-32px",
            left: reverse ? "auto" : "-12px",
            right: reverse ? "-12px" : "auto",
          }}
        >
          {f.num}
        </span>

        <div
          className="relative rounded-[28px] overflow-hidden"
          style={{
            transform: visible
              ? "perspective(900px) rotateY(0deg) scale(1)"
              : `perspective(900px) rotateY(${reverse ? "8deg" : "-8deg"}) scale(0.94)`,
            transition: "transform 0.9s cubic-bezier(0.22,1,0.36,1) 0.1s",
            boxShadow: `0 32px 72px rgba(0,0,0,0.13), 0 0 0 1.5px rgba(0,0,0,0.05)`,
          }}
        >
          <img
            src={f.img}
            alt={f.tag}
            className="w-full object-cover"
            style={{ height: "340px", objectPosition: "top" }}
          />
          {/* Нижний градиент */}
          <div
            className="absolute bottom-0 left-0 right-0 h-28"
            style={{ background: `linear-gradient(to top,${f.accent}30,transparent)` }}
          />
          {/* Бейдж */}
          <div className="absolute bottom-5 left-5">
            <span
              className="text-[11px] font-bold tracking-[0.14em] uppercase px-3.5 py-1.5 rounded-full backdrop-blur-md"
              style={{ background: "rgba(255,255,255,0.93)", color: f.accent, boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }}
            >
              {f.law}
            </span>
          </div>
        </div>
      </div>

      {/* ── Текст ── */}
      <div
        className="w-full lg:w-[48%] flex flex-col"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateX(0)" : `translateX(${reverse ? "-40px" : "40px"})`,
          transition: "opacity 0.75s ease 0.22s, transform 0.75s cubic-bezier(0.22,1,0.36,1) 0.22s",
        }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="h-0.5 w-8 rounded-full" style={{ background: f.accent }} />
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: f.accent }}>
            {f.tag}
          </span>
        </div>

        <h3
          className="font-cormorant font-bold leading-[1.1] text-navy-900 mb-5"
          style={{ fontSize: "clamp(28px,4vw,42px)" }}
        >
          {f.title}
        </h3>

        <p className="text-slate-500 leading-relaxed mb-8 max-w-sm" style={{ fontSize: "15px" }}>
          {f.desc}
        </p>

        {/* Прогресс-точки */}
        <div className="flex items-center gap-2">
          <div className="h-[3px] w-9 rounded-full" style={{ background: f.accent }} />
          <div className="h-[3px] w-3 rounded-full" style={{ background: f.accent, opacity: 0.3 }} />
          <div className="h-[3px] w-2 rounded-full" style={{ background: f.accent, opacity: 0.12 }} />
        </div>
      </div>
    </div>
  );
}

export default function VideoTutorialsSection() {
  const { ref: hRef, visible: hVisible } = useInView(0.3);

  return (
    <section className="overflow-hidden" style={{ background: "linear-gradient(180deg,#f8fafc 0%,#fff 50%,#f8fafc 100%)" }}>
      <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      <div className="container mx-auto px-5 sm:px-8 max-w-5xl py-16 sm:py-24">

        {/* Шапка секции */}
        <div
          ref={hRef}
          className="text-center mb-2"
          style={{
            opacity: hVisible ? 1 : 0,
            transform: hVisible ? "translateY(0)" : "translateY(30px)",
            transition: "opacity 0.65s ease, transform 0.65s cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          <span
            className="inline-block text-[11px] font-bold tracking-[0.22em] uppercase px-4 py-1.5 rounded-full mb-5"
            style={{ background: "rgba(15,76,129,0.07)", color: "#0f4c81" }}
          >
            Возможности
          </span>
          <h2 className="font-cormorant font-bold text-3xl sm:text-4xl md:text-5xl text-navy-900 mb-4 leading-tight">
            Всё для победы в суде
          </h2>
          <p className="text-slate-400 text-base sm:text-lg max-w-md mx-auto leading-relaxed">
            Профессиональные инструменты юриста — теперь доступны каждому
          </p>
        </div>

        {/* Зигзаг */}
        <div>
          {features.map((f, i) => (
            <div key={i}>
              {i > 0 && <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-100 to-transparent" />}
              <FeatureRow f={f} reverse={i % 2 === 1} />
            </div>
          ))}
        </div>

        <p className="text-center text-slate-400 text-sm mt-4">
          Все инструменты работают в личном кабинете — без сторонних сервисов
        </p>
      </div>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
    </section>
  );
}
