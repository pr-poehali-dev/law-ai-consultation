import Icon from "@/components/ui/icon";

export default function LandingChatHeader() {
  return (
    <div
      className="flex items-center justify-between px-5 py-3.5"
      style={{
        background: "linear-gradient(135deg, #060e1f 0%, #0d2348 60%, #152d5c 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: "linear-gradient(145deg, #1a3a6b, #0c1f40)",
              border: "1px solid rgba(232,168,32,0.35)",
              boxShadow: "0 0 16px rgba(232,168,32,0.12), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <Icon name="Scale" size={15} color="#e8a820" />
          </div>
          <div
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
            style={{ background: "#22c55e", border: "2px solid #060e1f", boxShadow: "0 0 6px rgba(34,197,94,0.6)" }}
          />
        </div>
        <div>
          <p className="text-[13px] font-bold text-white leading-tight">Помощник по созданию документов</p>
          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.01em" }}>
            законодательство РФ · онлайн
          </p>
        </div>
      </div>
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
        style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.18)" }}
      >
        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4ade80" }} />
        <span className="text-[10px] font-semibold" style={{ color: "#4ade80" }}>онлайн</span>
      </div>
    </div>
  );
}
