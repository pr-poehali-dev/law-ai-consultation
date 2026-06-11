export default function VideoTutorialsSection() {
  const features = [
    {
      tag: "Калькулятор неустойки",
      title: "Точный расчёт\nза секунды",
      desc: "Забудьте о ручных подсчётах. Наш калькулятор автоматически рассчитает пени по 395-й или 330-й статье ГК РФ, учитывая ключевую ставку ЦБ и периоды просрочки. Подходит для суда, досудебных претензий и договоров.",
      img: "https://cdn.poehali.dev/projects/3f0ef70d-a78f-4ee8-b1bc-a70a6b86cef1/bucket/342a3ba3-c9ce-49d1-a29f-a1e10cb3388a.jpg",
      accent: "#f59e0b",
      accentBg: "rgba(245,158,11,0.08)",
      iconBg: "linear-gradient(135deg,#f59e0b,#d97706)",
      badge: "ГК РФ ст. 395 и 330",
    },
    {
      tag: "Судебная практика",
      title: "От запроса —\nк уверенности",
      desc: "Анализируйте прецеденты и стройте сильную линию защиты. Мы собрали для вас ключ к любой судебной базе.",
      img: "https://cdn.poehali.dev/projects/3f0ef70d-a78f-4ee8-b1bc-a70a6b86cef1/bucket/18224958-80a2-4a85-8627-2204b97796a4.jpg",
      accent: "#059669",
      accentBg: "rgba(5,150,105,0.07)",
      iconBg: "linear-gradient(135deg,#059669,#047857)",
      badge: "Судебные базы РФ",
    },
    {
      tag: "Территориальная подсудность",
      title: "Мировой, районный\nили арбитраж?",
      desc: "Наш помощник точно определит, какому суду подведомственно ваше дело по нормам ГПК РФ. Больше никаких ошибок в подаче.",
      img: "https://cdn.poehali.dev/projects/3f0ef70d-a78f-4ee8-b1bc-a70a6b86cef1/bucket/50ecbf94-ee88-4312-90cd-08eef1a4bf69.jpg",
      accent: "#7c3aed",
      accentBg: "rgba(124,58,237,0.07)",
      iconBg: "linear-gradient(135deg,#7c3aed,#6d28d9)",
      badge: "ГПК РФ",
    },
    {
      tag: "Калькулятор госпошлины",
      title: "Сколько стоит\nподать иск?",
      desc: "Рассчитайте точную сумму пошлины за 5 секунд. Просто выберите суд (общей юрисдикции или арбитраж) и укажите цену иска.",
      img: "https://cdn.poehali.dev/projects/3f0ef70d-a78f-4ee8-b1bc-a70a6b86cef1/bucket/1309ff3f-7371-4657-925d-83856db2d60b.jpg",
      accent: "#0f4c81",
      accentBg: "rgba(15,76,129,0.07)",
      iconBg: "linear-gradient(135deg,#0f4c81,#1a6bb5)",
      badge: "НК РФ",
    },
  ];

  return (
    <section className="py-16 sm:py-24" style={{ background: "linear-gradient(180deg,#f8fafc 0%,#ffffff 100%)" }}>
      <div className="container mx-auto px-4 max-w-6xl">

        {/* Заголовок */}
        <div className="text-center mb-12 sm:mb-16">
          <span className="inline-block text-[11px] font-bold tracking-[0.18em] uppercase px-4 py-1.5 rounded-full mb-4"
            style={{ background: "rgba(15,76,129,0.08)", color: "#0f4c81" }}>
            Возможности
          </span>
          <h2 className="font-cormorant font-bold text-3xl sm:text-4xl md:text-5xl text-navy-900 leading-tight mb-4">
            Всё для победы в суде
          </h2>
          <p className="text-slate-500 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            Профессиональные инструменты юриста — теперь доступны каждому
          </p>
        </div>

        {/* Карточки */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {features.map((f, i) => (
            <article
              key={i}
              className="group relative rounded-3xl overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
              style={{
                background: "#fff",
                border: "1.5px solid rgba(15,76,129,0.08)",
                boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
              }}
            >
              {/* Картинка */}
              <div className="relative overflow-hidden" style={{ height: "220px" }}>
                <img
                  src={f.img}
                  alt={f.tag}
                  className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                />
                {/* Градиентный оверлей снизу */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: "linear-gradient(to bottom,rgba(0,0,0,0) 40%,rgba(0,0,0,0.45) 100%)",
                  }}
                />
                {/* Бейдж сверху */}
                <div className="absolute top-4 left-4">
                  <span
                    className="text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full backdrop-blur-sm"
                    style={{ background: "rgba(255,255,255,0.92)", color: f.accent }}
                  >
                    {f.badge}
                  </span>
                </div>
              </div>

              {/* Текст */}
              <div className="flex flex-col flex-1 p-6 sm:p-7" style={{ background: f.accentBg }}>
                <p
                  className="text-[11px] font-bold tracking-widest uppercase mb-2"
                  style={{ color: f.accent }}
                >
                  {f.tag}
                </p>
                <h3
                  className="font-cormorant font-bold text-2xl sm:text-[26px] leading-tight mb-3 whitespace-pre-line"
                  style={{ color: "#0f172a" }}
                >
                  {f.title}
                </h3>
                <p className="text-slate-500 text-[14px] leading-relaxed flex-1">
                  {f.desc}
                </p>

                {/* Нижняя полоска акцента */}
                <div
                  className="mt-5 h-0.5 rounded-full opacity-30"
                  style={{ background: f.accent }}
                />
              </div>

              {/* Цветной левый бордер */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-3xl"
                style={{ background: f.iconBg }}
              />
            </article>
          ))}
        </div>

        {/* Нижний CTA */}
        <div className="mt-12 text-center">
          <p className="text-slate-400 text-sm">
            Все инструменты работают в вашем личном кабинете — без скачивания и регистрации сторонних сервисов
          </p>
        </div>

      </div>
    </section>
  );
}
