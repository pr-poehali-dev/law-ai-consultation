import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";

interface LawyerNotificationToastProps {
  message: string;
  onReply: () => void;
  onClose: () => void;
}

export default function LawyerNotificationToast({ message, onReply, onClose }: LawyerNotificationToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t1 = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    const t2 = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 400);
    }, 8000);
    return () => { cancelAnimationFrame(t1); clearTimeout(t2); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReply = () => {
    setVisible(false);
    setTimeout(() => { onClose(); onReply(); }, 200);
  };

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 400);
  };

  return (
    <div
      className="fixed top-4 right-4 z-[300] w-[340px] max-w-[calc(100vw-2rem)]"
      style={{
        transition: "all 0.45s cubic-bezier(0.34,1.56,0.64,1)",
        transform: visible ? "translateX(0) scale(1)" : "translateX(calc(100% + 2rem)) scale(0.9)",
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: "linear-gradient(135deg, #0a1628 0%, #162d5a 100%)",
          border: "1px solid rgba(232,168,32,0.35)",
          boxShadow: "0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(232,168,32,0.1), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        {/* Прогресс-бар */}
        <div className="h-0.5 w-full" style={{ background: "rgba(232,168,32,0.12)" }}>
          <div
            className="h-full"
            style={{
              background: "linear-gradient(90deg, #e8a820, #f5cc5a)",
              width: visible ? "0%" : "100%",
              transition: "width 8s linear",
            }}
          />
        </div>

        {/* Шапка */}
        <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
          <div
            className="relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(232,168,32,0.2)", border: "1px solid rgba(232,168,32,0.35)" }}
          >
            <Icon name="UserCheck" size={16} color="#f0c060" />
            {/* Онлайн-точка */}
            <div
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
              style={{ background: "#22c55e", borderColor: "#0a1628" }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "rgba(232,168,32,0.8)" }}>
              Юрист-эксперт
            </p>
            <p className="text-xs text-white/50 leading-none">Новое сообщение</p>
          </div>
          <button
            onClick={handleClose}
            className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10 shrink-0"
          >
            <Icon name="X" size={13} color="rgba(255,255,255,0.4)" />
          </button>
        </div>

        {/* Тело сообщения */}
        <div className="px-4 pb-3">
          <p
            className="text-sm text-white/85 leading-relaxed line-clamp-3"
            style={{ fontFamily: "inherit" }}
          >
            {message}
          </p>
        </div>

        {/* Кнопка */}
        <div className="px-4 pb-4">
          <button
            onClick={handleReply}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] hover:brightness-110"
            style={{
              background: "linear-gradient(135deg, #e8a820 0%, #f5cc5a 100%)",
              color: "#0a1628",
              boxShadow: "0 4px 16px rgba(232,168,32,0.35)",
            }}
          >
            <Icon name="MessageCircle" size={14} color="#0a1628" />
            Ответить
          </button>
        </div>
      </div>
    </div>
  );
}
