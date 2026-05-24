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

export default function VideoTutorialsAdmin() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  // Форма редактирования
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formOrder, setFormOrder] = useState(99);
  const [formActive, setFormActive] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadForId = useRef<number | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await apiCall({ action: "list_all" });
    if (data.tutorials) setTutorials(data.tutorials);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startEdit = (t: Tutorial) => {
    setEditingId(t.id);
    setFormTitle(t.title);
    setFormDesc(t.description);
    setFormOrder(t.sort_order);
    setFormActive(t.is_active);
    setCreating(false);
  };

  const startCreate = () => {
    setEditingId(null);
    setCreating(true);
    setFormTitle("");
    setFormDesc("");
    setFormOrder(tutorials.length + 1);
    setFormActive(true);
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
      setMsg("Сохранено");
      cancelEdit();
      await load();
    } catch { setMsg("Ошибка"); }
    setSaving(false);
  };

  const del = async (id: number) => {
    if (!confirm("Удалить этот блок?")) return;
    await apiCall({ action: "delete", id });
    await load();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = uploadForId.current;
    if (!file || !id) return;
    e.target.value = "";

    if (file.size > 12 * 1024 * 1024) {
      setMsg("Файл слишком большой (макс. 12 МБ)"); return;
    }

    setUploadingId(id);
    setMsg("Загружаю видео...");
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
        setMsg("Видео загружено!");
        await load();
      } else {
        setMsg(data.error || "Ошибка загрузки");
      }
    } catch { setMsg("Ошибка загрузки"); }
    setUploadingId(null);
  };

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-border shadow-sm p-4 sm:p-6">
      <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 gradient-navy rounded-xl flex items-center justify-center shrink-0">
            <Icon name="Video" size={16} className="text-gold-400" />
          </div>
          <div>
            <h3 className="font-semibold text-navy-800 text-sm">Видео-инструкции</h3>
            <p className="text-xs text-muted-foreground">Блоки на главной странице</p>
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
        <div className={`mb-3 px-3 py-2 rounded-xl text-xs font-medium ${msg.includes("Ошибка") ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
          {msg}
        </div>
      )}

      {/* Форма создания/редактирования */}
      {(creating || editingId !== null) && (
        <div className="mb-4 p-4 rounded-2xl border border-navy-200 bg-navy-50 space-y-3">
          <p className="text-xs font-bold text-navy-700 uppercase tracking-wide">
            {creating ? "Новый блок" : "Редактировать"}
          </p>
          <div>
            <label className="text-[11px] font-semibold text-navy-700 mb-1 block">Заголовок *</label>
            <input
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              placeholder="Как создать документ?"
              className="w-full text-sm border border-border rounded-xl px-3 py-2 outline-none focus:border-navy-400"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-navy-700 mb-1 block">Описание</label>
            <textarea
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              placeholder="Краткое описание видео..."
              rows={2}
              className="w-full text-sm border border-border rounded-xl px-3 py-2 outline-none focus:border-navy-400 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-navy-700 mb-1 block">Порядок</label>
              <input
                type="number" min={1}
                value={formOrder}
                onChange={e => setFormOrder(parseInt(e.target.value) || 1)}
                className="w-full text-sm border border-border rounded-xl px-3 py-2 outline-none focus:border-navy-400"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formActive} onChange={e => setFormActive(e.target.checked)}
                  className="w-4 h-4 rounded" />
                <span className="text-sm text-navy-700">Активен</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 py-2 rounded-xl btn-gold text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
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
        <p className="text-sm text-muted-foreground text-center py-6">Нет блоков. Создайте первый.</p>
      ) : (
        <div className="space-y-2">
          {tutorials.map(t => (
            <div key={t.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${t.is_active ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"}`}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: t.video_url ? "linear-gradient(135deg,#0a1628,#162d5a)" : "#f1f5f9" }}>
                <Icon name={t.video_url ? "Play" : "Video"} size={13}
                  color={t.video_url ? "#e8a820" : "#94a3b8"} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-navy-800 truncate">{t.title}</p>
                <p className="text-[10px] text-slate-400">
                  №{t.sort_order} · {t.video_url ? "Видео загружено" : "Видео не загружено"}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {/* Загрузить видео */}
                <button
                  disabled={uploadingId === t.id}
                  onClick={() => { uploadForId.current = t.id; fileInputRef.current?.click(); }}
                  className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition-colors"
                  title="Загрузить видео"
                >
                  {uploadingId === t.id
                    ? <Icon name="Loader" size={13} className="animate-spin" />
                    : <Icon name="Upload" size={13} />
                  }
                </button>
                {/* Редактировать */}
                <button
                  onClick={() => startEdit(t)}
                  className="p-1.5 rounded-lg hover:bg-navy-50 text-navy-500 hover:text-navy-700 transition-colors"
                  title="Редактировать"
                >
                  <Icon name="Pencil" size={13} />
                </button>
                {/* Удалить */}
                <button
                  onClick={() => del(t.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                  title="Удалить"
                >
                  <Icon name="Trash2" size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
