import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";

interface DocUpgradeToastProps {
  show: boolean;
  type: "lawyer_prompt" | "need_starter" | "need_consultation";
  onClose: () => void;
  onViewPlans?: () => void;
}

export default function DocUpgradeToast({ show, type, onClose, onViewPlans }: DocUpgradeToastProps) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (show) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      const t = setTimeout(() => {
        setVisible(false);
        setTimeout(() => { setMounted(false); onClose(); }, 400);
      }, 8000);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 400);
      return () => clearTimeout(t);
    }
  }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;

  const configs = {
    lawyer_prompt: {
      icon: "UserCheck" as const,
      iconColor: "#f0c060",
      bg: "linear-gradient(135deg,#0a1628 0%,#162d5a 100%)",
      border: "rgba(232,168,32,0.35)",
      title: "Документ готов!",
      text: 'Направьте документ на проверку юристу-эксперту с тарифом «Старт»',
      btnLabel: "Посмотреть тарифы",
      btnBg: "linear-gradient(135deg,#c8901a,#e8a820)",
      btnColor: "#0a1628",
    },
    need_starter: {
      icon: "Lock" as const,
      iconColor: "#f0c060",
      bg: "linear-gradient(135deg,#0a1628 0%,#162d5a 100%)",
      border: "rgba(232,168,32,0.35)",
      title: "Нужен тариф «Старт»",
      text: "Отправка юристу и консультации AI доступны с тарифа «Старт»",
      btnLabel: "Посмотреть тарифы",
      btnBg: "linear-gradient(135deg,#c8901a,#e8a820)",
      btnColor: "#0a1628",
    },
    need_consultation: {
      icon: "AlertCircle" as const,
      iconColor: "#f0c060",
      bg: "linear-gradient(135deg,#0a1628 0%,#162d5a 100%)",
      border: "rgba(232,168,32,0.35)",
      title: "Консультации исчерпаны",
      text: "Для отправки юристу необходима 1 консультация на счету",
      btnLabel: "Докупить консультацию",
      btnBg: "linear-gradient(135deg,#c8901a,#e8a820)",
      btnColor: "#0a1628",
    },
  };

  const cfg = configs[type];

  return (
    <div
      className="fixed bottom-6 left-4 z-[200] max-w-[320px] w-[calc(100vw-2rem)] sm:w-80"
      style={{
        transition: "all 0.4s cubic-bezier(0.34,1.56,0.64,1)",
        transform: visible ? "translateX(0) scale(1)" : "translateX(-110%) scale(0.9)",
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        className="rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          boxShadow: "0 8px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(232,168,32,0.08)",
        }}
      >
        {/* Прогресс-бар */}
        <div className="h-0.5 w-full" style={{ background: "rgba(232,168,32,0.15)" }}>
          <div
            className="h-full"
            style={{
              background: "linear-gradient(90deg,#e8a820,#f5cc5a)",
              width: visible ? "0%" : "100%",
              transition: "width 8s linear",
            }}
          />
        </div>

        <div className="p-4">
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: "rgba(232,168,32,0.15)", border: "1px solid rgba(232,168,32,0.25)" }}
            >
              <Icon name={cfg.icon} size={16} color={cfg.iconColor} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold mb-0.5" style={{ color: "#f0c060" }}>{cfg.title}</p>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>{cfg.text}</p>
              {onViewPlans && (
                <button
                  onClick={() => { onViewPlans(); onClose(); }}
                  className="mt-2.5 w-full py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                  style={{ background: cfg.btnBg, color: cfg.btnColor }}
                >
                  {cfg.btnLabel}
                </button>
              )}
            </div>
            <button
              onClick={() => { setVisible(false); setTimeout(() => { setMounted(false); onClose(); }, 400); }}
              className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 hover:bg-white/10 transition-colors"
            >
              <Icon name="X" size={13} color="rgba(255,255,255,0.4)" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
