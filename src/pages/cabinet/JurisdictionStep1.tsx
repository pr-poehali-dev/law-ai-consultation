import Icon from "@/components/ui/icon";
import type { Step1, PlaintiffType, DefendantType } from "./JurisdictionTypes";

export function RadioGroup({ options, value, onChange }: { options: {id: string; label: string}[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-2 mt-1">
      {options.map(o => (
        <div key={o.id} onClick={() => onChange(o.id)}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-xs select-none"
          style={value === o.id ? { background: "rgba(15,76,129,0.08)", border: "1px solid rgba(15,76,129,0.25)", color: "#0f4c81", fontWeight: 600 } : { background: "#f8fafc", border: "1px solid #e2e8f0", color: "#475569" }}>
          <span className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0"
            style={{ borderColor: value === o.id ? "#0f4c81" : "#cbd5e1" }}>
            {value === o.id && <span className="w-1.5 h-1.5 rounded-full bg-blue-800" />}
          </span>
          {o.label}
        </div>
      ))}
    </div>
  );
}

export function CheckRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer select-none">
      <span className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all"
        style={{ borderColor: checked ? "#0f4c81" : "#cbd5e1", background: checked ? "#0f4c81" : "white" }}
        onClick={() => onChange(!checked)}>
        {checked && <Icon name="Check" size={9} color="#fff" />}
      </span>
      {label}
    </label>
  );
}

interface Props {
  s1: Step1;
  setS1: React.Dispatch<React.SetStateAction<Step1>>;
  onNext: () => void;
}

export default function JurisdictionStep1({ s1, setS1, onNext }: Props) {
  return (
    <>
      <div className="rounded-xl border border-slate-100 overflow-hidden">
        <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: "rgba(15,76,129,0.04)" }}>
          <Icon name="User" size={11} color="#0f4c81" />
          <p className="text-[11px] font-bold text-slate-700">Кто подаёт иск (истец)?</p>
        </div>
        <div className="px-3 py-2">
          <RadioGroup value={s1.plaintiff} onChange={v => setS1(p => ({ ...p, plaintiff: v as PlaintiffType }))} options={[
            { id: "individual", label: "Физическое лицо (обычный человек)" },
            { id: "ip",         label: "ИП или самозанятый" },
            { id: "org",        label: "Организация (ООО, АО и т.д.)" },
          ]} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 overflow-hidden">
        <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: "rgba(15,76,129,0.04)" }}>
          <Icon name="UserX" size={11} color="#0f4c81" />
          <p className="text-[11px] font-bold text-slate-700">На кого подаётся иск (ответчик)?</p>
        </div>
        <div className="px-3 py-2">
          <RadioGroup value={s1.defendant} onChange={v => setS1(p => ({ ...p, defendant: v as DefendantType }))} options={[
            { id: "individual", label: "Физическое лицо (обычный человек)" },
            { id: "ip",         label: "ИП или самозанятый" },
            { id: "org",        label: "Организация (ООО, АО и т.д.)" },
          ]} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 overflow-hidden">
        <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: "rgba(15,76,129,0.04)" }}>
          <Icon name="Briefcase" size={11} color="#0f4c81" />
          <p className="text-[11px] font-bold text-slate-700">Это предпринимательский/бизнес-спор?</p>
          <span className="text-[9px] text-slate-400 ml-1">(определяет суд: арбитражный или общей юрисдикции)</span>
        </div>
        <div className="px-3 py-2">
          <RadioGroup value={s1.isBusiness ? "yes" : "no"} onChange={v => setS1(p => ({ ...p, isBusiness: v === "yes" }))} options={[
            { id: "no",  label: "Нет — личный, бытовой, семейный спор" },
            { id: "yes", label: "Да — связан с предпринимательской деятельностью" },
          ]} />
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button onClick={onNext}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white active:scale-95"
          style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
          Далее <Icon name="ChevronRight" size={13} color="#fff" />
        </button>
      </div>
    </>
  );
}
