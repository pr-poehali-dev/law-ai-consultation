import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";

const API_URL = (func2url as Record<string, string>)["video-tutorials"];
const SEEN_KEY = "tutorials_welcome_seen";

interface Tutorial {
  id: number;
  title: string;
  description: string;
  video_url: string;
  is_welcome?: boolean;
}

interface WelcomeTutorialsModalProps {
  onClose: () => void;
}

export default function WelcomeTutorialsModal({ onClose }: WelcomeTutorialsModalProps) {
  const [visible, setVisible] = useState(false);
  const [welcomeVideo, setWelcomeVideo] = useState<Tutorial | null>(null);
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [activeVideo, setActiveVideo] = useState<Tutorial | null>(null);
  const [welcomePlaying, setWelcomePlaying] = useState(false);
  const welcomeRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    document.body.style.overflow = "hidden";

    if (API_URL) {
      fetch(API_URL, { method: "GET" })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data) return;
          if (data.welcome_video) setWelcomeVideo(data.welcome_video);
          if (data.tutorials) setTutorials(data.tutorials);
        })
        .catch(() => {});
    }

    return () => { clearTimeout(t); document.body.style.overflow = ""; };
  }, []);

  const handleClose = () => {
    localStorage.setItem(SEEN_KEY, "1");
    setVisible(false);
    setTimeout(onClose, 280);
  };

  const toggleWelcomePlay = () => {
    const v = welcomeRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setWelcomePlaying(true); }
    else { v.pause(); setWelcomePlaying(false); }
  };

  return (
    <div
      className={`fixed inset-0 z-[300] flex items-end sm:items-center justify-center transition-all duration-300 ${visible ? "bg-black/70 backdrop-blur-sm" : "bg-transparent pointer-events-none"}`}
      onClick={handleClose}
    >
      <div
        className={`bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ease-out
          ${visible ? "translate-y-0 opacity-100 sm:scale-100" : "translate-y-full sm:translate-y-0 opacity-0 sm:scale-95"}
          max-h-[92dvh] sm:max-h-[85vh]`}
        onClick={e => e.stopPropagation()}
      >
        {/* Просмотр обучающего ролика */}
        {activeVideo ? (
          <div className="flex flex-col h-full min-h-0">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 shrink-0">
              <button
                onClick={() => setActiveVideo(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <Icon name="ArrowLeft" size={16} className="text-navy-700" />
              </button>
              <p className="text-sm font-semibold text-navy-800 truncate flex-1">{activeVideo.title}</p>
            </div>
            <div className="flex-1 flex items-center justify-center bg-black min-h-0">
              {activeVideo.video_url ? (
                <video
                  src={activeVideo.video_url}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                  className="w-full max-h-full"
                />
              ) : (
                <div className="text-center py-12">
                  <Icon name="Clock" size={36} className="text-white/30 mx-auto mb-3" />
                  <p className="text-white/50 text-sm">Видео скоро появится</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Шапка */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 gradient-navy rounded-2xl flex items-center justify-center shadow-sm">
                  <Icon name="Sparkles" size={17} className="text-gold-400" />
                </div>
                <div>
                  <h3 className="font-bold text-navy-800 text-base">Добро пожаловать!</h3>
                  <p className="text-xs text-slate-500">Посмотрите как пользоваться сервисом</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <Icon name="X" size={16} className="text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Приветственное видео */}
              {welcomeVideo?.video_url && (
                <div className="px-4 pb-4">
                  <div
                    className="relative rounded-2xl overflow-hidden bg-black cursor-pointer group"
                    style={{ aspectRatio: "16/9" }}
                    onClick={toggleWelcomePlay}
                  >
                    <video
                      ref={welcomeRef}
                      src={welcomeVideo.video_url}
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover"
                      onPlay={() => setWelcomePlaying(true)}
                      onPause={() => setWelcomePlaying(false)}
                      onEnded={() => setWelcomePlaying(false)}
                    />
                    {/* Оверлей с кнопкой плей */}
                    <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${welcomePlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"}`}>
                      <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg transition-transform group-hover:scale-110">
                        <Icon name={welcomePlaying ? "Pause" : "Play"} size={28} className="text-white ml-1" />
                      </div>
                    </div>
                    {/* Градиент снизу */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                    <div className="absolute bottom-3 left-4 right-4 pointer-events-none">
                      <p className="text-white text-sm font-semibold drop-shadow">{welcomeVideo.title}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Плейсхолдер если нет приветственного видео */}
              {!welcomeVideo?.video_url && (
                <div className="mx-4 mb-4 rounded-2xl overflow-hidden bg-gradient-to-br from-navy-900 to-navy-700 flex items-center justify-center" style={{ aspectRatio: "16/9" }}>
                  <div className="text-center">
                    <Icon name="Video" size={40} className="text-white/20 mx-auto mb-2" />
                    <p className="text-white/40 text-sm">Приветственное видео</p>
                    <p className="text-white/25 text-xs mt-1">Скоро появится</p>
                  </div>
                </div>
              )}

              {/* Обучающие ролики */}
              {tutorials.length > 0 && (
                <div className="px-4 pb-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Обучающие ролики</p>
                  <div className="space-y-2">
                    {tutorials.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setActiveVideo(t)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-slate-200 hover:border-navy-300 hover:shadow-sm transition-all text-left group active:scale-[0.98]"
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform"
                          style={{ background: "linear-gradient(135deg,#0a1628,#162d5a)" }}
                        >
                          <Icon name={t.video_url ? "Play" : "Clock"} size={15} color="#e8a820" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-navy-800 truncate group-hover:text-navy-600">{t.title}</p>
                          {t.description && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">{t.description}</p>
                          )}
                        </div>
                        <Icon name="ChevronRight" size={14} className="text-slate-400 shrink-0 group-hover:text-navy-500 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="h-4" />
            </div>

            {/* Футер */}
            <div className="px-4 pb-5 pt-2 shrink-0 border-t border-slate-100">
              <button
                onClick={handleClose}
                className="w-full py-3 rounded-2xl bg-navy-800 hover:bg-navy-700 text-white text-sm font-semibold transition-colors active:scale-[0.98]"
              >
                Начать работу →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function shouldShowWelcomeTutorials(): boolean {
  return !localStorage.getItem(SEEN_KEY);
}
