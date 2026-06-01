import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";

const API_URL = (func2url as Record<string, string>)["video-tutorials"];
const SEEN_KEY = "tutorials_welcome_seen";

interface Tutorial {
  id: number;
  title: string;
  description: string;
  video_url: string;
}

interface WelcomeTutorialsModalProps {
  onClose: () => void;
}

function VideoPlayer({ tutorial, onBack }: { tutorial: Tutorial; onBack: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors">
          <Icon name="ArrowLeft" size={15} className="text-navy-600" />
        </button>
        <p className="text-sm font-semibold text-navy-800 truncate">{tutorial.title}</p>
      </div>
      <div className="flex-1 flex items-center justify-center bg-black">
        {tutorial.video_url ? (
          <video
            src={tutorial.video_url}
            controls
            playsInline
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {...({ "webkit-playsinline": "true", "x-webkit-airplay": "allow" } as any)}
            preload="metadata"
            className="w-full max-h-full"
            onLoadedMetadata={(e) => {
              const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
              if (!isMobile) (e.target as HTMLVideoElement).play().catch(() => {});
            }}
          />
        ) : (
          <div className="text-center py-12">
            <Icon name="Video" size={40} className="text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm">Видео скоро появится</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WelcomeTutorialsModal({ onClose }: WelcomeTutorialsModalProps) {
  const [visible, setVisible] = useState(false);
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [activeVideo, setActiveVideo] = useState<Tutorial | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    document.body.style.overflow = "hidden";

    if (API_URL) {
      fetch(API_URL, { method: "GET" })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.tutorials) setTutorials(data.tutorials); })
        .catch(() => { /* туториалы недоступны — показываем без них */ });
    }

    return () => { clearTimeout(t); document.body.style.overflow = ""; };
  }, []);

  const handleClose = () => {
    localStorage.setItem(SEEN_KEY, "1");
    setVisible(false);
    setTimeout(onClose, 250);
  };

  return (
    <div
      className={`fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-250 ${visible ? "bg-black/60 backdrop-blur-sm" : "bg-transparent"}`}
    >
      <div
        className={`bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-250 ease-out
          ${visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}
          max-h-[88dvh] sm:max-h-[80vh]`}
        onClick={e => e.stopPropagation()}
      >
        {activeVideo ? (
          <VideoPlayer tutorial={activeVideo} onBack={() => setActiveVideo(null)} />
        ) : (
          <>
            {/* Шапка */}
            <div className="px-5 pt-5 pb-4 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 gradient-navy rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                    <Icon name="Play" size={18} className="text-gold-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-navy-800 text-base leading-tight">Добро пожаловать!</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Посмотрите как пользоваться сервисом</p>
                  </div>
                </div>
                <button onClick={handleClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center shrink-0 transition-colors">
                  <Icon name="X" size={15} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Список */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
              {tutorials.length === 0 ? (
                <div className="text-center py-8">
                  <Icon name="Video" size={32} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Видео инструкции скоро появятся</p>
                </div>
              ) : (
                tutorials.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveVideo(t)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-slate-200 hover:border-navy-300 hover:shadow-sm transition-all text-left group active:scale-[0.98]"
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform"
                      style={{ background: "linear-gradient(135deg,#0a1628,#162d5a)" }}>
                      <Icon name={t.video_url ? "Play" : "Clock"} size={14} color="#e8a820" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy-800 truncate group-hover:text-navy-600">{t.title}</p>
                      {t.description && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{t.description}</p>
                      )}
                    </div>
                    <Icon name="ChevronRight" size={14} className="text-slate-400 shrink-0 group-hover:text-navy-500" />
                  </button>
                ))
              )}
            </div>

            {/* Футер */}
            <div className="px-4 pb-5 shrink-0">
              <button
                onClick={handleClose}
                className="w-full py-3 rounded-2xl bg-navy-800 hover:bg-navy-700 text-white text-sm font-semibold transition-colors"
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

// Вспомогательная функция: показывать ли модалку
export function shouldShowWelcomeTutorials(): boolean {
  return !localStorage.getItem(SEEN_KEY);
}