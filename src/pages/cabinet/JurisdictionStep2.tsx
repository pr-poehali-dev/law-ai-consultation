import Icon from "@/components/ui/icon";
import type { Step2, CaseCategory } from "./JurisdictionTypes";
import { CASE_CATEGORIES } from "./JurisdictionTypes";
import { CheckRow } from "./JurisdictionStep1";

interface Props {
  s2: Step2;
  setS2: React.Dispatch<React.SetStateAction<Step2>>;
  onBack: () => void;
  onSearch: () => void;
}

export default function JurisdictionStep2({ s2, setS2, onBack, onSearch }: Props) {
  return (
    <>
      <div className="space-y-1">
        <p className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
          <Icon name="Home" size={10} color="#64748b" /> Адрес ответчика
          <span className="text-[9px] text-slate-400 font-normal">(где живёт или находится организация)</span>
        </p>
        <input className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400 transition-all"
          placeholder="г. Москва, ул. Тверская, д. 1"
          value={s2.defendantAddress}
          onChange={e => setS2(p => ({ ...p, defendantAddress: e.target.value }))} />
      </div>

      <div className="space-y-1">
        <p className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
          <Icon name="MapPin" size={10} color="#64748b" /> Ваш адрес (истца)
          <span className="text-[9px] text-slate-400 font-normal">(для льготных категорий)</span>
        </p>
        <input className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400 transition-all"
          placeholder="г. Санкт-Петербург, Невский пр., д. 10"
          value={s2.plaintiffAddress}
          onChange={e => setS2(p => ({ ...p, plaintiffAddress: e.target.value }))} />
      </div>

      <div className="rounded-xl border border-slate-100 overflow-hidden">
        <div className="px-3 py-2" style={{ background: "rgba(15,76,129,0.04)" }}>
          <p className="text-[11px] font-bold text-slate-700">О чём спор?</p>
        </div>
        <div className="px-3 py-2 grid grid-cols-1 gap-1.5">
          {CASE_CATEGORIES.map(c => (
            <div key={c.id} onClick={() => setS2(p => ({ ...p, caseCategory: c.id }))}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl cursor-pointer transition-all text-[11px] select-none"
              style={s2.caseCategory === c.id
                ? { background: "rgba(15,76,129,0.08)", border: "1px solid rgba(15,76,129,0.25)", color: "#0f4c81", fontWeight: 600 }
                : { background: "#f8fafc", border: "1px solid #e2e8f0", color: "#475569" }}>
              <span className="w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0"
                style={{ borderColor: s2.caseCategory === c.id ? "#0f4c81" : "#cbd5e1" }}>
                {s2.caseCategory === c.id && <span className="w-1.5 h-1.5 rounded-full bg-blue-800" />}
              </span>
              <Icon name={c.icon as Parameters<typeof Icon>[0]["name"]} size={10} color={s2.caseCategory === c.id ? "#0f4c81" : "#94a3b8"} />
              {c.label}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 px-3 py-2.5 space-y-2">
        <p className="text-[11px] font-bold text-slate-600 mb-1">Дополнительные условия:</p>
        <CheckRow checked={s2.isCyberFraud} onChange={v => setS2(p => ({ ...p, isCyberFraud: v }))}
          label="Пострадал от телефонных/интернет-мошенников" />
        <CheckRow checked={s2.unknownDefendant} onChange={v => setS2(p => ({ ...p, unknownDefendant: v }))}
          label="Не знаю точный адрес ответчика" />
        <CheckRow checked={s2.hasContractualCourt} onChange={v => setS2(p => ({ ...p, hasContractualCourt: v }))}
          label="В договоре указан конкретный суд для споров" />
        {s2.hasContractualCourt && (
          <input className="w-full text-xs border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:border-blue-400 mt-1"
            placeholder="Название суда из договора"
            value={s2.contractualCourt}
            onChange={e => setS2(p => ({ ...p, contractualCourt: e.target.value }))} />
        )}
        {s2.caseCategory === "realestate" && (
          <div className="mt-1">
            <p className="text-[11px] text-slate-500 mb-1">Адрес спорной недвижимости:</p>
            <input className="w-full text-xs border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:border-blue-400"
              placeholder="г. Краснодар, ул. Красная, д. 10, кв. 5"
              value={s2.realEstateAddress}
              onChange={e => setS2(p => ({ ...p, realEstateAddress: e.target.value }))} />
          </div>
        )}
      </div>

      <div className="flex justify-between pt-1">
        <button onClick={onBack}
          className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50">
          <Icon name="ChevronLeft" size={13} /> Назад
        </button>
        <button onClick={onSearch}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white active:scale-95"
          style={{ background: "linear-gradient(135deg,#0f4c81,#1a6bb5)" }}>
          <Icon name="Search" size={13} color="#fff" /> Определить суд
        </button>
      </div>
    </>
  );
}
