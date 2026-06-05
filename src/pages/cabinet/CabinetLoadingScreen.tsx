interface CabinetLoadingScreenProps {
  timeout: boolean;
}

export default function CabinetLoadingScreen({ timeout }: CabinetLoadingScreenProps) {
  if (timeout) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: "#0a1628", paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex flex-col items-center gap-5 px-8 text-center max-w-xs">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
          </div>
          <div>
            <p className="font-semibold mb-1" style={{ color: "rgba(255,255,255,0.9)" }}>Нет соединения</p>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>Проверьте интернет и попробуйте снова</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 text-sm font-semibold rounded-xl"
              style={{ background: "linear-gradient(135deg, #e8a820, #f0c060)", color: "#0a1628" }}
            >
              Повторить
            </button>
            <button
              onClick={() => { localStorage.removeItem("yurist_ai_token"); window.location.replace("/"); }}
              className="px-6 py-2.5 text-sm font-semibold rounded-xl"
              style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
            >
              На главную
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ background: "#0a1628", paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="flex flex-col items-center gap-5">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl" style={{ background: "linear-gradient(135deg, #0a1628, #162d5a)", border: "1px solid rgba(232,168,32,0.3)" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e8a820" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>Загружаем кабинет...</p>
        <div className="flex gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{background:"#e8a820", animationDelay:"0ms"}}/>
          <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{background:"#e8a820", animationDelay:"150ms"}}/>
          <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{background:"#e8a820", animationDelay:"300ms"}}/>
        </div>
      </div>
    </div>
  );
}
