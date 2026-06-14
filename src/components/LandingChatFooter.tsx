import { PWAInstallButton } from "@/components/LandingChatUpsell";

export default function LandingChatFooter() {
  return (
    <>
      {/* PWA */}
      <div className="mt-3 flex justify-center">
        <PWAInstallButton />
      </div>

      {/* Социальные сети */}
      <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
        <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: "rgba(255,255,255,0.28)" }}>
          Мы в соцсетях:
        </span>
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <a
            href="https://vk.ru/ai_pravorf"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-full transition-all duration-200 active:scale-95"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)" }}
          >
            <img
              src="https://cdn.poehali.dev/projects/3f0ef70d-a78f-4ee8-b1bc-a70a6b86cef1/files/f966fdfe-7ab1-464e-bb46-e70bf162004e.jpg"
              alt="VK"
              className="w-5 h-5 rounded-full object-cover shrink-0"
            />
            <span className="text-xs font-medium">ВКонтакте</span>
          </a>
          <a
            href="https://vk.com/away.php?to=https%3A%2F%2Fmax.ru%2Fjoin%2FzoHlcjX6QssCLMfhkcWj08KtE0Q_C4HQJhp6WdHNhbY&utf=1"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-full transition-all duration-200 active:scale-95"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)" }}
          >
            <img
              src="https://cdn.poehali.dev/projects/3f0ef70d-a78f-4ee8-b1bc-a70a6b86cef1/files/4b6ec240-afc6-41c9-befd-87022247d412.jpg"
              alt="MAX"
              className="w-5 h-5 rounded-full object-cover shrink-0"
            />
            <span className="text-xs font-medium">MAX</span>
          </a>
          <a
            href="https://dzen.ru/jurist_ai?share_to=link"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-full transition-all duration-200 active:scale-95"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)" }}
          >
            <span className="text-xs font-bold shrink-0 text-yellow-300" style={{ color: "rgba(255,82,82,0.9)" }}>Д</span>
            <span className="text-xs font-medium">Читать на Дзен</span>
          </a>
        </div>
      </div>

      <p className="text-center text-[11px] mt-3" style={{ color: "rgba(255,255,255,0.3)" }}>
        Документ 290 ₽ · Пакет 30 вопросов + 5 документов за 990 ₽
      </p>
    </>
  );
}
