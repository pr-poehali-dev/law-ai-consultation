import { useState } from "react";
import Icon from "@/components/ui/icon";
import { AttachmentModal } from "./ExpertAttachPanel";
import func2url from "../../../backend/func2url.json";

interface FileLinkProps {
  name: string;
  url: string;
  isMe: boolean;
}

export default function FileLink({ name, url, isMe }: FileLinkProps) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const isImage = ["jpg", "jpeg", "png"].includes(ext);
  const [preview, setPreview] = useState(false);
  const [dlState, setDlState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [dlProgress, setDlProgress] = useState(0);
  const iconName = isImage ? "Image" : ext === "pdf" ? "FileText" : "File";

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as Record<string, unknown>).MSStream;

  const handleDownload = async () => {
    if (dlState === "loading") return;
    const proxyUrl = (func2url as Record<string, string>)["file-proxy"];
    const href = `${proxyUrl}?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;

    // iOS Safari: не поддерживает blob download и атрибут download на <a>.
    // Единственный надёжный способ — открыть прокси-URL в новой вкладке.
    // Прокси отдаёт Content-Disposition: attachment → Safari предложит «Открыть в...» / сохранить.
    if (isIOS) {
      const win = window.open(href, "_blank");
      if (!win) window.location.href = href;
      setDlState("done");
      setTimeout(() => { setDlState("idle"); }, 2000);
      return;
    }

    // ПК + Android: fetch с прогрессом → blob → тихое скачивание
    setDlState("loading");
    setDlProgress(0);
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error(`${res.status}`);

      const contentLength = res.headers.get("Content-Length");
      const total = contentLength ? parseInt(contentLength) : 0;
      const reader = res.body!.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total > 0) setDlProgress(Math.round((received / total) * 100));
        else setDlProgress(Math.min(90, Math.round((received / 500_000) * 90)));
      }

      const blob = new Blob(chunks);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);

      setDlProgress(100);
      setDlState("done");
      setTimeout(() => { setDlState("idle"); setDlProgress(0); }, 2000);
    } catch {
      setDlState("error");
      setTimeout(() => { setDlState("idle"); setDlProgress(0); }, 2500);
    }
  };

  return (
    <>
      <div
        className="flex flex-col gap-1.5 px-3 py-2.5 rounded-xl border min-w-0"
        style={isMe
          ? { background: "rgba(255,255,255,0.18)", borderColor: "rgba(255,255,255,0.3)", color: "#fff" }
          : { background: "#fff", borderColor: "#e2e8f0", color: "#1e3a5f" }
        }
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon name={iconName} size={13} className="shrink-0 opacity-80" />
          <span className="flex-1 truncate text-xs font-semibold min-w-0">{name}</span>
          <div className="flex items-center gap-1 shrink-0">
            {isImage && (
              <button
                onClick={() => setPreview(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-colors"
                style={isMe ? { background: "rgba(255,255,255,0.15)" } : { background: "#f1f5f9" }}
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
              {dlState === "done" && <Icon name="Check" size={10} />}
              {dlState === "error" && <Icon name="AlertCircle" size={10} />}
              {dlState === "idle" && <Icon name="Download" size={10} />}
              {dlState === "loading" ? `${dlProgress}%` : dlState === "done" ? "Готово" : dlState === "error" ? "Ошибка" : "Скачать"}
            </button>
          </div>
        </div>
        {dlState === "loading" && (
          <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: isMe ? "rgba(255,255,255,0.2)" : "#e2e8f0" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${dlProgress}%`, background: isMe ? "#fff" : "#162d5a" }}
            />
          </div>
        )}
      </div>
      {preview && (
        <AttachmentModal
          title={name}
          content=""
          type="image"
          downloadUrl={url}
          onClose={() => setPreview(false)}
        />
      )}
    </>
  );
}