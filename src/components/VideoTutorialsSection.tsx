import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";

const API_URL = (func2url as Record<string, string>)["video-tutorials"];

interface Tutorial {
  id: number;
  title: string;
  description: string;
  video_url: string;
  sort_order: number;
}

// ─── Плеер видео ──────────────────────────────────────────────────────────────
function VideoModal({ tutorial, onClose }: { tutorial: Tutorial; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    // Закрытие по Escape
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // iOS Safari: нет autoPlay со звуком — даём пользователю нажать play сам
  const handlePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    // КРИТИЧНО для iOS: явно включаем звук перед play(), т.к. браузер может оставить muted
    v.muted = false;
    v.volume = 1.0;
    v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)", padding: "env(safe-area-inset-top,12px) 12px env(safe-area-inset-bottom,12px) 12px" }}
      onClick={onClose}
    >
      <div
        className="relative w-full rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ maxWidth: "min(720px, 100%)", maxHeight: "calc(100dvh - 24px)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ background: "#0a1628" }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(232,168,32,0.18)" }}>
              <Icon name="Play" size={13} color="#e8a820" />
            </div>
            <p className="text-sm font-semibold text-white truncate">{tutorial.title}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-white/15 active:bg-white/20 shrink-0 ml-2"
            aria-label="Закрыть"
          >
            <Icon name="X" size={18} color="rgba(255,255,255,0.8)" />
          </button>
        </div>

        {/* Видео-область */}
        <div className="relative bg-black flex-1 flex items-center justify-center" style={{ minHeight: 0 }}>
          {tutorial.video_url && !error ? (
            <>
              <video
                ref={videoRef}
                src={tutorial.video_url}
                controls
                playsInline
                // Явно НЕ muted — звук должен работать
                muted={false}
                defaultMuted={false}
                // webkit-playsinline нужен для старых iOS Safari (iOS < 10)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                {...({ "webkit-playsinline": "true", "x-webkit-airplay": "allow" } as any)}
                preload="metadata"
                className="w-full"
                style={{ maxHeight: "calc(100dvh - 140px)", display: "block" }}
                onPlay={(e) => {
                  // Гарантируем звук при каждом запуске
                  const v = e.currentTarget;
                  if (v.muted) { v.muted = false; v.volume = 1.0; }
                  setPlaying(true);
                }}
                onPause={() => setPlaying(false)}
                onError={() => setError(true)}
                onLoadedMetadata={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  v.muted = false;
                  v.volume = 1.0;
                  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                  if (!isMobile) {
                    v.play().catch(() => {});
                  }
                }}
              >
                <p className="text-white/50 text-sm p-4">Ваш браузер не поддерживает воспроизведение видео.</p>
              </video>
              {/* Большая кнопка Play для мобильных (поверх видео пока не нажато) */}
              {!playing && (
                <button
                  onClick={handlePlay}
                  className="absolute inset-0 flex items-center justify-center sm:hidden"
                  aria-label="Воспроизвести"
                >
                  <div className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(232,168,32,0.92)", boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
                    <Icon name="Play" size={26} color="#0a1628" />
                  </div>
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-6 w-full">
              <Icon name="Video" size={48} color="rgba(255,255,255,0.15)" />
              <p className="text-white/40 text-sm mt-4">
                {error ? "Ошибка загрузки видео" : "Видео ещё не загружено"}
              </p>
            </div>
          )}
        </div>

        {/* Описание */}
        {tutorial.description && (
          <div className="px-4 py-3 shrink-0" style={{ background: "#0f1f3d" }}>
            <p className="text-sm text-white/70 leading-relaxed">{tutorial.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Основной компонент ───────────────────────────────────────────────────────
export default function VideoTutorialsSection() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [activeVideo, setActiveVideo] = useState<Tutorial | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!API_URL) { setLoading(false); return; }
    fetch(API_URL, { method: "GET" })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.tutorials) setTutorials(data.tutorials); })
      .catch(() => { /* видеотуториалы временно недоступны */ })
      .finally(() => setLoading(false));
  }, []);

  if (!loading && tutorials.length === 0) return null;

  return (
    <section className="py-12 sm:py-16 bg-white border-t border-slate-100">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8 sm:mb-10">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-gold-600 bg-gold-400/10 px-4 py-2 rounded-full mb-3">
            Обучение
          </span>
          <h2 className="font-cormorant font-bold text-2xl sm:text-3xl md:text-4xl text-navy-800 mb-2">
            Как это работает
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            Видео-инструкции по работе с сервисом
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 max-w-4xl mx-auto">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 max-w-4xl mx-auto">
            {tutorials.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveVideo(t)}
                className="group flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-slate-200 bg-white hover:border-navy-300 hover:shadow-md transition-all text-left active:scale-[0.98]"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all group-hover:scale-105"
                  style={{ background: "linear-gradient(135deg, #0a1628, #162d5a)" }}
                >
                  <Icon name={t.video_url ? "Play" : "Video"} size={16} color={t.video_url ? "#e8a820" : "rgba(232,168,32,0.4)"} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy-800 leading-tight group-hover:text-navy-600 transition-colors">
                    {t.title}
                  </p>
                  {t.description && (
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{t.description}</p>
                  )}
                </div>
                <Icon name="ChevronRight" size={15} className="text-slate-400 shrink-0 group-hover:text-navy-500 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>

      {activeVideo && (
        <VideoModal tutorial={activeVideo} onClose={() => setActiveVideo(null)} />
      )}
    </section>
  );
}