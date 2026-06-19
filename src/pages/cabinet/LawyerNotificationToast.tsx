import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";

interface LawyerNotificationToastProps {
  message: string;
  onReply: () => void;
  onClose: () => void;
}

export default function LawyerNotificationToast({ message, onReply, onClose }: LawyerNotificationToastProps) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const t1 = requestAnimationFrame(() => requestAnimationFrame(() => {
      setVisible(true);
      setProgress(0);
    }));
    const t2 = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 500);
    }, 8000);
    return () => { cancelAnimationFrame(t1); clearTimeout(t2); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReply = () => {
    setVisible(false);
    setTimeout(() => { onClose(); onReply(); }, 200);
  };

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 500);
  };

  return (
    <div
      className="fixed z-[300]"
      style={{
        top: "1rem",
        right: "1rem",
        width: "min(360px, calc(100vw - 2rem))",
        transition: "transform 0.5s cubic-bezier(0.22,1,0.36,1), opacity 0.5s ease",
        transform: visible ? "translateY(0) scale(1)" : "translateY(-12px) scale(0.96)",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div
        className="relative overflow-hidden"
        style={{
          borderRadius: "16px",
          background: "#ffffff",
          border: "1px solid rgba(226,232,240,0.9)",
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07), 0 10px 40px -4px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)",
        }}
      >
        {/* Цветная полоска сверху */}
        <div style={{ height: "3px", background: "linear-gradient(90deg, #0f4c81, #1a6bb5)" }} />

        {/* Прогресс убывания */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", zIndex: 1 }}>
          <div
            style={{
              height: "100%",
              background: "linear-gradient(90deg, #0f4c81, #1a6bb5)",
              width: `${progress}%`,
              transition: visible ? "width 8s linear" : "none",
              transformOrigin: "left",
            }}
          />
        </div>

        <div className="p-4">
          {/* Шапка */}
          <div className="flex items-start gap-3 mb-3">
            {/* Аватар юриста */}
            <div className="relative shrink-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #0f4c81 0%, #1a6bb5 100%)" }}
              >
                <Icon name="UserCheck" size={18} className="text-white" />
              </div>
              <div
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                style={{ background: "#22c55e" }}
              />
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-semibold text-slate-900 leading-none">Юрист-эксперт</p>
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                  style={{ background: "rgba(34,197,94,0.1)", color: "#16a34a" }}
                >
                  онлайн
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Новое сообщение · сейчас</p>
            </div>

            <button
              onClick={handleClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors hover:bg-slate-100"
              style={{ marginTop: "1px" }}
            >
              <Icon name="X" size={14} className="text-slate-400" />
            </button>
          </div>

          {/* Текст сообщения */}
          <div
            className="mb-3 px-3 py-2.5 rounded-xl"
            style={{ background: "#f8fafc", border: "1px solid rgba(226,232,240,0.8)" }}
          >
            <p className="text-sm text-slate-700 leading-relaxed line-clamp-3">
              {message}
            </p>
          </div>

          {/* Кнопки */}
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="flex-1 py-2 rounded-xl text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
              style={{ border: "1px solid rgba(226,232,240,0.9)" }}
            >
              Закрыть
            </button>
            <button
              onClick={handleReply}
              className="flex-[2] flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] hover:brightness-105"
              style={{
                background: "linear-gradient(135deg, #0f4c81 0%, #1a6bb5 100%)",
                color: "white",
                boxShadow: "0 2px 8px rgba(15,76,129,0.3)",
              }}
            >
              <Icon name="MessageCircle" size={13} className="text-white" />
              Перейти к диалогу
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
