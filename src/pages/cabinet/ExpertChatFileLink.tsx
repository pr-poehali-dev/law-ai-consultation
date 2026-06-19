import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import func2url from "../../../backend/func2url.json";

interface FileLinkProps {
  name: string;
  url: string;
  isMe: boolean;
}

// Полноэкранная галерея изображений
function ImageGallery({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col"
      style={{ background: "rgba(0,0,0,0.95)", backdropFilter: "blur(16px)" }}
      onClick={onClose}
    >
      {/* Шапка */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ background: "rgba(255,255,255,0.06)" }}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-white truncate max-w-[70%]">{name}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(z => !z)}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all"
            title={zoom ? "Уменьшить" : "Увеличить"}
          >
            <Icon name={zoom ? "ZoomOut" : "ZoomIn"} size={18} />
          </button>
          <a
            href={src}
            download={name}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all"
            title="Скачать"
            onClick={e => e.stopPropagation()}
          >
            <Icon name="Download" size={18} />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all"
          >
            <Icon name="X" size={20} />
          </button>
        </div>
      </div>

      {/* Изображение */}
      <div
        className="flex-1 flex items-center justify-center overflow-auto p-4"
        onClick={e => e.stopPropagation()}
      >
        <img
          src={src}
          alt={name}
          onClick={() => setZoom(z => !z)}
          className="rounded-xl shadow-2xl select-none transition-transform duration-300 cursor-zoom-in"
          style={{
            maxWidth: zoom ? "none" : "100%",
            maxHeight: zoom ? "none" : "calc(100vh - 120px)",
            transform: zoom ? "scale(1.5)" : "scale(1)",
            transformOrigin: "center",
          }}
        />
      </div>
    </div>
  );
}

export default function FileLink({ name, url, isMe }: FileLinkProps) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
  const isPdf = ext === "pdf";

  const [preview, setPreview] = useState(false);
  const [dlState, setDlState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [dlProgress, setDlProgress] = useState(0);

  const iconName = isImage ? "Image" : isPdf ? "FileText" : "File";

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as Record<string, unknown>).MSStream;

  const handleDownload = useCallback(async () => {
    if (dlState === "loading") return;
    const proxyUrl = (func2url as Record<string, string>)["file-proxy"];
    const href = `${proxyUrl}?url=${encodeURIComponent(url)}`;

    if (isIOS) {
      if (isPdf) {
        const win = window.open("", "_blank");
        if (!win) { window.location.href = href; return; }
        win.document.write(`<html><body style="margin:0;background:#0a1628;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#e8a820;font-size:16px">Загрузка...</body></html>`);
        setDlState("loading");
        try {
          const res = await fetch(href);
          if (!res.ok) throw new Error();
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          win.location.href = blobUrl;
          setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
          setDlState("done");
          setTimeout(() => setDlState("idle"), 2000);
        } catch {
          win.close();
          setDlState("error");
          setTimeout(() => { setDlState("idle"); setDlProgress(0); }, 2500);
        }
        return;
      }
      const win = window.open(href, "_blank");
      if (!win) window.location.href = href;
      setDlState("done");
      setTimeout(() => setDlState("idle"), 2000);
      return;
    }

    // ПК + Android: прогресс-скачивание
    setDlState("loading");
    setDlProgress(0);
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
        setDlProgress(total > 0
          ? Math.round((received / total) * 100)
          : Math.min(90, Math.round((received / 500_000) * 90)));
      }
      const blob = new Blob(chunks);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl; a.download = name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
      setDlProgress(100); setDlState("done");
      setTimeout(() => { setDlState("idle"); setDlProgress(0); }, 2000);
    } catch {
      setDlState("error");
      setTimeout(() => { setDlState("idle"); setDlProgress(0); }, 2500);
    }
  }, [dlState, url, name, ext, isIOS, isPdf]);

  return (
    <>
      {/* Карточка файла */}
      <div
        className="flex flex-col gap-1.5 px-3 py-2.5 rounded-xl border min-w-0 transition-all"
        style={isMe
          ? { background: "rgba(255,255,255,0.18)", borderColor: "rgba(255,255,255,0.3)", color: "#fff" }
          : { background: "#fff", borderColor: "#e2e8f0", color: "#1e3a5f" }
        }
      >
        {/* Превью изображения (миниатюра) */}
        {isImage && (
          <button
            onClick={() => setPreview(true)}
            className="w-full rounded-lg overflow-hidden block"
            style={{ maxHeight: 160 }}
          >
            <img
              src={url}
              alt={name}
              className="w-full object-cover rounded-lg"
              style={{ maxHeight: 160 }}
              loading="lazy"
            />
          </button>
        )}

        <div className="flex items-center gap-2 min-w-0">
          <Icon name={iconName} size={13} className="shrink-0 opacity-80" />
          <span className="flex-1 truncate text-xs font-semibold min-w-0">{name}</span>
          <div className="flex items-center gap-1 shrink-0">
            {isImage && (
              <button
                onClick={() => setPreview(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-colors"
                style={isMe ? { background: "rgba(255,255,255,0.15)" } : { background: "#f1f5f9" }}
                title="Просмотр"
              >
                <Icon name="Eye" size={10} />
              </button>
            )}
            <button
              onClick={handleDownload}
              disabled={dlState === "loading"}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all active:scale-95 disabled:opacity-70"
              style={isMe ? { background: "rgba(255,255,255,0.15)" } : { background: "#f1f5f9" }}
            >
              {dlState === "loading" && <Icon name="Loader" size={10} className="animate-spin" />}
              {dlState === "done"    && <Icon name="Check" size={10} />}
              {dlState === "error"   && <Icon name="AlertCircle" size={10} />}
              {dlState === "idle"    && <Icon name="Download" size={10} />}
              {dlState === "loading" ? `${dlProgress}%` : dlState === "done" ? "Готово" : dlState === "error" ? "Ошибка" : "Скачать"}
            </button>
          </div>
        </div>

        {/* Прогресс-бар */}
        {dlState === "loading" && (
          <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: isMe ? "rgba(255,255,255,0.2)" : "#e2e8f0" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${dlProgress}%`, background: isMe ? "#fff" : "#162d5a" }}
            />
          </div>
        )}
      </div>

      {/* Полноэкранная галерея */}
      {preview && isImage && (
        <ImageGallery src={url} name={name} onClose={() => setPreview(false)} />
      )}
    </>
  );
}
