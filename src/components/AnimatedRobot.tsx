import { useEffect, useRef, useState } from "react";

// ─── Спрайты робота-помощника (AI-юрист) ───────────────────────────────────
// Единый персонаж в разных позах — используется как покадровая (flipbook)
// анимация: кадры переключаются по таймеру, создавая эффект живого движения.
// Все три спрайта обрезаны и выровнены по единому канвасу (робот «стоит»
// на одной высоте), поэтому смена кадров не даёт «прыжков» по вертикали.
export const ROBOT_POSES = {
  /** Указательный палец поднят на уровне плеча — базовая приветственная поза */
  wave: "/assets/robot-pose-wave.png",
  /** Рука поднята высоко вверх, голова чуть наклонена — акцентный/радостный кадр */
  cheer: "/assets/robot-pose-cheer.png",
  /** Руки опущены — спокойная поза ожидания */
  idle: "/assets/robot-pose-idle.png",
} as const;

export type RobotPoseName = keyof typeof ROBOT_POSES;

interface AnimatedRobotProps {
  /** Ширина/высота обёртки в px — сам спрайт вписывается через object-contain */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Последовательность поз для покадровой анимации и её тайминг (мс на кадр).
   * По умолчанию — доброжелательное «помахивание»: wave → cheer → wave → idle.
   */
  sequence?: { pose: RobotPoseName; duration: number }[];
  /** Если false — анимация выключена, показывается первый кадр последовательности (пауза) */
  animate?: boolean;
}

const DEFAULT_SEQUENCE: { pose: RobotPoseName; duration: number }[] = [
  { pose: "wave", duration: 900 },
  { pose: "cheer", duration: 700 },
  { pose: "wave", duration: 900 },
  { pose: "idle", duration: 1200 },
];

/**
 * Переиспользуемый аниматор персонажа-робота (AI-юрист) на спрайтах.
 * Используй в любом месте интерфейса, где нужен «живой» маскот — попапы,
 * приветственные экраны, лоадеры. Спрайты подгружаются заранее (preload),
 * чтобы смена кадров не мигала при первом проигрывании.
 */
export default function AnimatedRobot({
  size = 96,
  className,
  style,
  sequence = DEFAULT_SEQUENCE,
  animate = true,
}: AnimatedRobotProps) {
  const [frameIdx, setFrameIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Предзагрузка всех поз — исключает мигание/пустой кадр при первом переключении
  useEffect(() => {
    Object.values(ROBOT_POSES).forEach(src => { const img = new Image(); img.src = src; });
  }, []);

  useEffect(() => {
    if (!animate || sequence.length <= 1) return;
    const step = () => {
      setFrameIdx(prev => (prev + 1) % sequence.length);
    };
    timerRef.current = setTimeout(step, sequence[frameIdx].duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [frameIdx, animate, sequence]);

  const currentPose = animate ? sequence[frameIdx].pose : sequence[0].pose;

  return (
    <div
      className={className}
      style={{ width: size, height: size, position: "relative", ...style }}
    >
      {/* Все кадры наложены друг на друга через absolute — переключение по opacity,
          без «прыжков» геометрии и без домигивания белым между сменой src. */}
      {Object.entries(ROBOT_POSES).map(([pose, src]) => (
        <img
          key={pose}
          src={src}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
          style={{
            opacity: pose === currentPose ? 1 : 0,
            transition: "opacity 0.18s ease-in-out",
          }}
        />
      ))}
    </div>
  );
}
