import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import func2url from "../../../backend/func2url.json";

const PROXY = (func2url as Record<string, string>)["file-proxy"];

/* ── Полноэкранная галерея изображений ─────────────────────────────── */
function ImageGallery({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[400] flex flex-col" style={{ background: "rgba(0,0,0,.96)", backdropFilter: "blur(20px)" }} onClick={onClose}>
      {/* Шапка */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-white/5" onClick={e => e.stopPropagation()}>
        <p className="text-sm font-medium text-white/90 truncate max-w-[60%]">{name}</p>
        <div className="flex items-center gap-1">
          <button onClick={() => setZoomed(z => !z)}
            className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all text-[11px] flex items-center gap-1.5">
            <Icon name={zoomed ? "ZoomOut" : "ZoomIn"} size={16} />
            <span className="hidden sm:inline">{zoomed ? "Уменьшить" : "Увеличить"}</span>
          </button>
          <a href={src} download={name} target="_blank" rel="noopener noreferrer"
            className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all" onClick={e => e.stopPropagation()}>
            <Icon name="Download" size={16} />
          </a>
          <button onClick={onClose} className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all">
            <Icon name="X" size={18} />
          </button>
        </div>
      </div>
      {/* Картинка */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-auto" onClick={e => e.stopPropagation()}>
        <img src={src} alt={name} onClick={() => setZoomed(z => !z)}
          className="select-none rounded-xl shadow-2xl transition-transform duration-300"
          style={{
            maxWidth: zoomed ? "none" : "100%",
            maxHeight: zoomed ? "none" : "calc(100vh - 120px)",
            transform: zoomed ? "scale(1.6)" : "scale(1)",
            transformOrigin: "center",
            cursor: zoomed ? "zoom-out" : "zoom-in",
          }} />
      </div>
    </div>
  );
}

/* ── Карточка файла ─────────────────────────────────────────────────── */
interface FileLinkProps { name: string; url: string; isMe: boolean; }

export default function FileLink({ name, url, isMe }: FileLinkProps) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
  const isPdf = ext === "pdf";
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const [gallery, setGallery] = useState(false);
  const [dlState, setDlState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [pct, setPct] = useState(0);

  const iconName = isImage ? "Image" : isPdf ? "FileText" : ext === "docx" || ext === "doc" ? "BookOpen" : "File";
  const href = `${PROXY}?url=${encodeURIComponent(url)}`;

  const download = useCallback(async () => {
    if (dlState === "loading") return;

    /* iOS */
    if (isIOS) {
      if (isPdf) {
        const win = window.open("", "_blank");
        if (!win) { window.location.href = href; return; }
        win.document.write(`<html><body style="margin:0;background:#0a1628;display:flex;align-items:center;justify-content:center;height:100vh;color:#e8a820;font-family:sans-serif">Загрузка…</body></html>`);
        setDlState("loading");
        try {
          const res = await fetch(href);
          if (!res.ok) throw new Error();
          const blob = await res.blob();
          const bu = URL.createObjectURL(blob);
          win.location.href = bu;
          setTimeout(() => URL.revokeObjectURL(bu), 10000);
          setDlState("done");
          setTimeout(() => setDlState("idle"), 2000);
        } catch {
          win.close(); setDlState("error");
          setTimeout(() => setDlState("idle"), 2500);
        }
        return;
      }
      const w = window.open(href, "_blank");
      if (!w) window.location.href = href;
      setDlState("done"); setTimeout(() => setDlState("idle"), 2000);
      return;
    }

    /* ПК + Android — прогресс-бар */
    setDlState("loading"); setPct(0);
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error();
      const total = parseInt(res.headers.get("Content-Length") || "0");
      const reader = res.body!.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        setPct(total > 0 ? Math.round(received / total * 100) : Math.min(90, Math.round(received / 500000 * 90)));
      }
      const blob = new Blob(chunks);
      const bu = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = bu; a.download = name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(bu), 10000);
      setPct(100); setDlState("done");
      setTimeout(() => { setDlState("idle"); setPct(0); }, 2000);
    } catch {
      setDlState("error");
      setTimeout(() => { setDlState("idle"); setPct(0); }, 2500);
    }
  }, [dlState, href, name, isIOS, isPdf]);

  const base = isMe
    ? { bg: "rgba(255,255,255,.12)", border: "rgba(255,255,255,.2)", text: "#fff", subtext: "rgba(255,255,255,.6)" }
    : { bg: "#f8fafc", border: "#e2e8f0", text: "#1e3a5f", subtext: "#64748b" };

  return (
    <>
      <div className="rounded-xl overflow-hidden transition-all" style={{ background: base.bg, border: `1px solid ${base.border}` }}>
        {/* Превью изображения */}
        {isImage && (
          <button onClick={() => setGallery(true)} className="block w-full overflow-hidden" style={{ maxHeight: 180 }}>
            <img src={url} alt={name} loading="lazy"
              className="w-full object-cover hover:scale-105 transition-transform duration-500"
              style={{ maxHeight: 180 }} />
          </button>
        )}

        <div className="flex items-center gap-2 px-3 py-2 min-w-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: isMe ? "rgba(255,255,255,.15)" : "rgba(15,76,129,.08)" }}>
            <Icon name={iconName} size={14} style={{ color: isMe ? "#fff" : "#0f4c81" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11.5px] font-semibold truncate" style={{ color: base.text }}>{name}</p>
            {dlState === "loading" && (
              <div className="mt-1 h-0.5 rounded-full overflow-hidden" style={{ background: isMe ? "rgba(255,255,255,.2)" : "#e2e8f0" }}>
                <div className="h-full rounded-full transition-all duration-200" style={{ width: `${pct}%`, background: isMe ? "#fff" : "#0f4c81" }} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isImage && (
              <button onClick={() => setGallery(true)}
                className="p-1.5 rounded-lg transition-colors hover:bg-white/20"
                title="Просмотр">
                <Icon name="Eye" size={12} style={{ color: base.subtext }} />
              </button>
            )}
            <button onClick={download} disabled={dlState === "loading"}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-semibold transition-all disabled:opacity-50"
              style={{ background: isMe ? "rgba(255,255,255,.15)" : "rgba(15,76,129,.08)", color: base.text }}>
              {dlState === "loading" && <Icon name="Loader" size={10} className="animate-spin" />}
              {dlState === "done"    && <Icon name="Check" size={10} />}
              {dlState === "error"   && <Icon name="AlertCircle" size={10} />}
              {dlState === "idle"    && <Icon name="Download" size={10} />}
              <span>
                {dlState === "loading" ? `${pct}%` : dlState === "done" ? "Готово" : dlState === "error" ? "Ошибка" : "Скачать"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {gallery && <ImageGallery src={url} name={name} onClose={() => setGallery(false)} />}
    </>
  );
}
