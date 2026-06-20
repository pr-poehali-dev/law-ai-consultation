import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { getToken } from "@/lib/auth";
import func2url from "../../backend/func2url.json";

const API_URL = (func2url as Record<string, string>)["video-tutorials"];

interface Tutorial {
  id: number;
  title: string;
  description: string;
  video_url: string;
  sort_order: number;
  is_active: boolean;
  is_welcome: boolean;
}

async function apiCall(body: object) {
  const token = getToken();
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ── Секция: приветственное видео ─────────────────────────────────────────────
function WelcomeVideoSection() {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiCall({ action: "list_all" }).then(data => {
      const welcome = data.tutorials?.find((t: Tutorial) => t.is_welcome);
      if (welcome) setCurrentUrl(welcome.video_url || null);
    });
  }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setMsg("Файл слишком большой (макс. 20 МБ)"); return;
    }
    if (!file.name.match(/\.(mp4|webm|mov|m4v)$/i)) {
      setMsg("Допустимые форматы: mp4, webm, mov"); return;
    }

    setUploading(true);
    setMsg("Загружаю видео...");
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const upload = await apiCall({ action: "upload_video", file: b64, filename: file.name, is_welcome: true });
      if (!upload.url) { setMsg(upload.error || "Ошибка загрузки"); setUploading(false); return; }

      await apiCall({ action: "set_welcome", video_url: upload.url, title: "Добро пожаловать!" });
      setCurrentUrl(upload.url);
      setMsg("Приветственное видео обновлено!");
    } catch {
      setMsg("Ошибка загрузки");
    }
    setUploading(false);
  };

  const handleRemove = async () => {
    if (!confirm("Убрать приветственное видео?")) return;
    await apiCall({ action: "set_welcome", video_url: "" });
    setCurrentUrl(null);
    setMsg("Удалено");
  };

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm p-4 sm:p-6 mb-4">
      <input ref={fileRef} type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v" className="hidden" onChange={handleFile} />

      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 gradient-navy rounded-xl flex items-center justify-center shrink-0">
          <Icon name="Sparkles" size={16} className="text-gold-400" />
        </div>
        <div>
          <h3 className="font-semibold text-navy-800 text-sm">Приветственное видео</h3>
          <p className="text-xs text-muted-foreground">Показывается новым пользователям при первом входе</p>
        </div>
      </div>

      {msg && (
        <div className={`mb-3 px-3 py-2 rounded-xl text-xs font-medium ${msg.includes("Ошибка") || msg.includes("большой") || msg.includes("Допустим") ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
          {msg}
        </div>
      )}

      {/* Превью текущего видео */}
      {currentUrl ? (
        <div className="mb-4">
          <div className="relative rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
            <video src={currentUrl} controls playsInline preload="metadata" className="w-full h-full object-cover" />
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex-1 py-2 rounded-xl btn-gold text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {uploading ? <><Icon name="Loader" size={12} className="animate-spin" />Загружаю...</> : <><Icon name="Upload" size={12} />Заменить видео</>}
            </button>
            <button
              onClick={handleRemove}
              className="px-4 py-2 rounded-xl border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 transition-colors"
            >
              Удалить
            </button>
          </div>
        </div>
      ) : (
        /* Зона загрузки */
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-slate-200 hover:border-navy-300 rounded-2xl p-8 flex flex-col items-center gap-3 transition-colors group disabled:opacity-50"
        >
          <div className="w-14 h-14 rounded-2xl bg-slate-100 group-hover:bg-navy-50 flex items-center justify-center transition-colors">
            {uploading
              ? <Icon name="Loader" size={24} className="text-navy-400 animate-spin" />
              : <Icon name="Upload" size={24} className="text-slate-400 group-hover:text-navy-500 transition-colors" />
            }
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-navy-700">{uploading ? "Загружаю..." : "Загрузить приветственное видео"}</p>
            <p className="text-xs text-slate-400 mt-1">MP4, MOV, WebM · 16:9 · до 20 МБ</p>
          </div>
        </button>
      )}
    </div>
  );
}

// ── Секция: обучающие ролики ─────────────────────────────────────────────────
export default function VideoTutorialsAdmin() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formOrder, setFormOrder] = useState(99);
  const [formActive, setFormActive] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadForId = useRef<number | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await apiCall({ action: "list_all" });
    if (data.tutorials) setTutorials(data.tutorials.filter((t: Tutorial) => !t.is_welcome));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startEdit = (t: Tutorial) => {
    setEditingId(t.id); setFormTitle(t.title); setFormDesc(t.description);
    setFormOrder(t.sort_order); setFormActive(t.is_active); setCreating(false);
  };

  const startCreate = () => {
    setEditingId(null); setCreating(true); setFormTitle(""); setFormDesc("");
    setFormOrder(tutorials.length + 1); setFormActive(true);
  };

  const cancelEdit = () => { setEditingId(null); setCreating(false); };

  const save = async () => {
    if (!formTitle.trim()) { setMsg("Введите заголовок"); return; }
    setSaving(true); setMsg("");
    try {
      if (creating) {
        await apiCall({ action: "create", title: formTitle, description: formDesc, sort_order: formOrder });
      } else if (editingId) {
        await apiCall({ action: "update", id: editingId, title: formTitle, description: formDesc, sort_order: formOrder, is_active: formActive });
      }
      setMsg("Сохранено"); cancelEdit(); await load();
    } catch { setMsg("Ошибка"); }
    setSaving(false);
  };

  const del = async (id: number) => {
    if (!confirm("Удалить этот ролик?")) return;
    await apiCall({ action: "delete", id }); await load();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = uploadForId.current;
    if (!file || !id) return;
    e.target.value = "";

    if (file.size > 20 * 1024 * 1024) { setMsg("Файл слишком большой (макс. 20 МБ)"); return; }

    setUploadingId(id); setMsg("Загружаю видео...");
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const data = await apiCall({ action: "upload_video", file: b64, filename: file.name });
      if (data.url) {
        await apiCall({ action: "update", id, video_url: data.url });
        setMsg("Видео загружено!"); await load();
      } else {
        setMsg(data.error || "Ошибка загрузки");
      }
    } catch { setMsg("Ошибка загрузки"); }
    setUploadingId(null);
  };

  return (
    <>
      <WelcomeVideoSection />

      <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm p-4 sm:p-6">
        <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 gradient-navy rounded-xl flex items-center justify-center shrink-0">
              <Icon name="Video" size={16} className="text-gold-400" />
            </div>
            <div>
              <h3 className="font-semibold text-navy-800 text-sm">Обучающие ролики</h3>
              <p className="text-xs text-muted-foreground">Список в приветственном окне</p>
            </div>
          </div>
          <button
            onClick={startCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl btn-gold text-xs font-semibold"
          >
            <Icon name="Plus" size={13} />Добавить
          </button>
        </div>

        {msg && (
          <div className={`mb-3 px-3 py-2 rounded-xl text-xs font-medium ${msg.includes("Ошибка") || msg.includes("большой") ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
            {msg}
          </div>
        )}

        {/* Форма */}
        {(creating || editingId !== null) && (
          <div className="mb-4 p-4 rounded-2xl border border-navy-200 bg-navy-50 space-y-3">
            <p className="text-xs font-bold text-navy-700 uppercase tracking-wide">
              {creating ? "Новый ролик" : "Редактировать"}
            </p>
            <div>
              <label className="text-[11px] font-semibold text-navy-700 mb-1 block">Название *</label>
              <input
                value={formTitle} onChange={e => setFormTitle(e.target.value)}
                placeholder="Как создать документ?"
                className="w-full text-sm border border-border rounded-xl px-3 py-2 outline-none focus:border-navy-400"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-navy-700 mb-1 block">Описание</label>
              <textarea
                value={formDesc} onChange={e => setFormDesc(e.target.value)}
                placeholder="Краткое описание..."
                rows={2}
                className="w-full text-sm border border-border rounded-xl px-3 py-2 outline-none focus:border-navy-400 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-navy-700 mb-1 block">Порядок</label>
                <input type="number" min={1} value={formOrder}
                  onChange={e => setFormOrder(parseInt(e.target.value) || 1)}
                  className="w-full text-sm border border-border rounded-xl px-3 py-2 outline-none focus:border-navy-400"
                />
              </div>
              {editingId && (
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formActive} onChange={e => setFormActive(e.target.checked)} className="w-4 h-4 rounded" />
                    <span className="text-sm text-navy-700">Активен</span>
                  </label>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={save} disabled={saving}
                className="flex-1 py-2 rounded-xl btn-gold text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
                {saving ? <><Icon name="Loader" size={13} className="animate-spin" />Сохраняю...</> : <><Icon name="Check" size={13} />Сохранить</>}
              </button>
              <button onClick={cancelEdit} className="px-4 py-2 rounded-xl border border-border text-sm text-slate-600 hover:bg-slate-50">
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* Список */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : tutorials.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Нет роликов. Создайте первый.</p>
        ) : (
          <div className="space-y-2">
            {tutorials.map(t => (
              <div key={t.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${t.is_active ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"}`}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-navy-50">
                  {uploadingId === t.id
                    ? <Icon name="Loader" size={13} className="text-navy-500 animate-spin" />
                    : <Icon name={t.video_url ? "Play" : "Clock"} size={13} className="text-navy-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy-800 truncate">{t.title}</p>
                  {t.description && <p className="text-[11px] text-slate-400 truncate">{t.description}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { uploadForId.current = t.id; fileRef.current?.click(); }}
                    disabled={uploadingId !== null}
                    className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40"
                    title="Загрузить видео"
                  >
                    <Icon name="Upload" size={14} className="text-slate-500" />
                  </button>
                  <button onClick={() => startEdit(t)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                    <Icon name="Pencil" size={14} className="text-slate-500" />
                  </button>
                  <button onClick={() => del(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                    <Icon name="Trash2" size={14} className="text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
