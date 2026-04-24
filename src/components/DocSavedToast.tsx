/**
 * Toast-уведомление «Документ сохранён» после успешной генерации.
 * Показывается 4 секунды, затем плавно скрывается.
 */
import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";

interface DocSavedToastProps {
  docName: string;
  onClose: () => void;
}

export default function DocSavedToast({ docName, onClose }: DocSavedToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Небольшой delay чтобы анимация сработала
    const t1 = setTimeout(() => setVisible(true), 50);
    const t2 = setTimeout(() => setVisible(false), 3800);
    const t3 = setTimeout(() => onClose(), 4300);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onClose]);

  return (
    <div
      className="fixed bottom-24 md:bottom-8 left-1/2 z-[200] pointer-events-none"
      style={{
        transform: `translateX(-50%) translateY(${visible ? 0 : 24}px)`,
        opacity: visible ? 1 : 0,
        transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease",
      }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl"
        style={{
          background: "linear-gradient(135deg, #0d1e38, #162d5a)",
          border: "1px solid rgba(232,168,32,0.35)",
          backdropFilter: "blur(16px)",
          minWidth: "240px",
          maxWidth: "340px",
        }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(34,197,94,0.15)" }}
        >
          <Icon name="CheckCircle" size={16} color="#4ade80" />
        </div>
        <div>
          <p className="text-xs font-bold text-white leading-tight">Документ сохранён</p>
          <p className="text-[10px] mt-0.5 truncate max-w-[200px]" style={{ color: "rgba(255,255,255,0.5)" }}>
            {docName}
          </p>
        </div>
        <div
          className="w-4 h-4 rounded-full ml-auto shrink-0"
          style={{ background: "rgba(34,197,94,0.2)" }}
        >
          <div
            className="w-full h-full rounded-full"
            style={{
              background: "#4ade80",
              transform: "scale(0.5)",
              animation: "ping 1s ease-out infinite",
            }}
          />
        </div>
      </div>
    </div>
  );
}
