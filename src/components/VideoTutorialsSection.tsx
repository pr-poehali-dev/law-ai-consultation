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

// ─── Модалка предпросмотра видео ─────────────────────────────────────────────
function VideoModal({ tutorial, onClose }: { tutorial: Tutorial; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between px-4 py-3" style={{ background: "#0a1628" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(232,168,32,0.15)" }}>
              <Icon name="Play" size={13} color="#e8a820" />
            </div>
            <p className="text-sm font-semibold text-white truncate">{tutorial.title}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
          >
            <Icon name="X" size={16} color="rgba(255,255,255,0.7)" />
          </button>
        </div>

        {/* Видео */}
        {tutorial.video_url ? (
          <video
            ref={videoRef}
            src={tutorial.video_url}
            controls
            autoPlay
            playsInline
            className="w-full"
            style={{ maxHeight: "70vh", background: "#000" }}
          >
            Ваш браузер не поддерживает воспроизведение видео.
          </video>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-6" style={{ background: "#111827" }}>
            <Icon name="Video" size={40} color="rgba(255,255,255,0.2)" />
            <p className="text-white/50 text-sm mt-3">Видео ещё не загружено</p>
          </div>
        )}

        {/* Описание */}
        {tutorial.description && (
          <div className="px-4 py-3" style={{ background: "#0f1f3d" }}>
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
      .then(r => r.json())
      .then(data => {
        if (data.tutorials) setTutorials(data.tutorials);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Не показываем секцию если нет туториалов и загрузка завершена
  if (!loading && tutorials.length === 0) return null;

  return (
    <section className="py-12 sm:py-16 bg-white border-t border-slate-100">
      <div className="container mx-auto px-4">

        {/* Заголовок */}
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

        {/* Список блоков */}
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
                {/* Иконка воспроизведения */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all group-hover:scale-105"
                  style={{ background: "linear-gradient(135deg, #0a1628, #162d5a)" }}>
                  {t.video_url ? (
                    <Icon name="Play" size={16} color="#e8a820" />
                  ) : (
                    <Icon name="Video" size={16} color="rgba(232,168,32,0.4)" />
                  )}
                </div>

                {/* Текст */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy-800 leading-tight group-hover:text-navy-600 transition-colors">
                    {t.title}
                  </p>
                  {t.description && (
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{t.description}</p>
                  )}
                </div>

                {/* Стрелка */}
                <Icon name="ChevronRight" size={15} className="text-slate-400 shrink-0 group-hover:text-navy-500 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Модалка видео */}
      {activeVideo && (
        <VideoModal tutorial={activeVideo} onClose={() => setActiveVideo(null)} />
      )}
    </section>
  );
}
