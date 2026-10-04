import React, { useMemo, useState } from "react";
import { useCatalog, CATEGORIES } from "../lib/catalog.js";
import { useT, useLang } from "../lib/i18n.js";
import { Link } from "../lib/router.js";
import { inr, inr0, cx } from "../lib/format.js";
import { Icon } from "../components/Icon.js";
import { MedCard } from "../components/MedCard.js";
import { Med } from "../lib/store.js";

const SWAPS: [string, string, "month" | "course"][] = [
  ["Storvas", "Atorvastatin Tablets IP 10 mg", "month"],
  ["Pantocid", "Pantoprazole Gastro Resistant Tablets IP 40 mg", "month"],
  ["Telma", "Telmisartan Tablets IP 40 mg", "month"],
  ["Omez", "Omeprazole Gastro-Resistant Capsules IP 20 mg", "month"],
  ["Azee", "Azithromycin Tablets IP 500 mg", "course"],
  ["Clopilet", "Clopidogrel Tablets IP 75 mg", "month"],
];

export default function Home() {
  const t = useT();
  const lang = useLang();
  const { meds, ready } = useCatalog();
  const swaps = useMemo(() => SWAPS.map(([b, f, course]) => {
    const med = meds.find((m) => m.full === f);
    const brand = med?.brands.find((x) => x.name === b && x.unit);
    return med && brand ? { med, brand, course } : null;
  }).filter(Boolean) as { med: Med; brand: { name: string; maker?: string; mrp?: number; count?: number; unit?: number }; course: "month" | "course" }[], [meds]);
  const [pick, setPick] = useState(0);
  const s = swaps[Math.min(pick, swaps.length - 1)];
  const top = useMemo(() => meds.filter((m) => m.save > 0).sort((a, b) => b.save - a.save).slice(0, 8), [meds]);
  const maxSave = top[0]?.save || 0;

  return (
    <>
      <section className="wrap pt-12 md:pt-20 pb-14 flex flex-wrap gap-12 items-center">
        <div className="flex-[1_1_520px] min-w-0">
          <span className="eyebrow inline-flex items-center gap-2 text-pine bg-pine-soft px-3 py-1.5 rounded-full">{t("hero_eyebrow")}</span>
          <h1 className="h-display text-[clamp(42px,6vw,84px)] leading-[.95] my-6">
            {t("hero_title_a")} <span className="bg-lime px-[.12em] rounded-lg [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">{t("hero_title_b")}</span> {t("hero_title_c")}
          </h1>
          <p className="text-[19px] leading-relaxed text-body max-w-[540px] mb-8">{t("hero_body")}</p>
          <div className="flex flex-wrap gap-3">
            <Link to="/medicines" className="btn-primary h-14 px-6 text-base no-underline">{t("hero_find")} <Icon name="arrow" size={18} /></Link>
            <Link to="/prescriptions" className="btn h-14 px-6 text-base bg-white border-[1.5px] border-ink text-ink no-underline hover:bg-field"><Icon name="scan" size={20} stroke={1.8} />{t("hero_scan")}</Link>
          </div>
          <div className="flex flex-wrap gap-7 mt-10 text-sm text-body">
            <div className="flex gap-2.5 items-center"><span className="font-mono text-2xl font-semibold text-ink">{ready ? meds.length.toLocaleString("en-IN") : "—"}</span>{t("hero_stat_catalogue")}</div>
            <div className="flex gap-2.5 items-center"><span className="font-mono text-2xl font-semibold text-ink">{maxSave ? maxSave + "%" : "—"}</span>{t("hero_stat_max")}</div>
          </div>
        </div>

        <div className="flex-[1_1_460px] min-w-0">
          <div className="text-sm text-muted mb-3">{t("swap_try")}</div>
          <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label={t("swap_try")}>
            {swaps.map((x, i) => (
              <button key={x.brand.name} type="button" aria-pressed={i === pick} onClick={() => setPick(i)} className={i === pick ? "chip-on" : "chip-off"}>{x.brand.name}</button>
            ))}
          </div>
          {s ? <SwapCard s={s} /> : <div className="card h-[420px] animate-pulse" />}
          <p className="text-xs text-muted mt-3 mx-1 leading-relaxed">{t("swap_note")}</p>
        </div>
      </section>

      <section className="bg-white border-y border-line">
        <div className="wrap grid sm:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className={cx("py-9 sm:px-7 first:sm:pl-0 last:sm:pr-0", n < 3 && "border-b sm:border-b-0 sm:border-r border-line")}>
              <div className="font-mono text-[13px] text-pine">0{n}</div>
              <h3 className="font-display text-2xl tracking-tight mt-2.5 mb-2 font-bold">{t(("how_" + n + "_t") as any)}</h3>
              <p className="text-body leading-relaxed">{t(("how_" + n + "_b") as any)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap pt-20 pb-6">
        <div className="flex flex-wrap justify-between items-end gap-4 mb-7">
          <h2 className="h-display text-4xl md:text-[44px]">{t("shop_condition")}</h2>
          <Link to="/medicines" className="font-semibold">{t("all_medicines")} →</Link>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
          {CATEGORIES.map((c) => (
            <Link key={c.id} to={`/medicines?cat=${c.id}`} className="card lift flex items-center gap-3.5 p-4 no-underline text-ink">
              <span className="w-10 h-10 rounded-xl shrink-0" style={{ background: c.color, boxShadow: "inset 0 0 0 6px rgba(255,255,255,.55)" }} />
              <span className="font-semibold">{lang === "hi" ? c.hi : c.en}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="wrap pt-16 pb-24">
        <div className="flex flex-wrap justify-between items-end gap-4 mb-7">
          <div>
            <h2 className="h-display text-4xl md:text-[44px] mb-1.5">{t("savings_title")}</h2>
            <p className="text-body">{t("savings_sub")}</p>
          </div>
          <Link to="/medicines?sort=save" className="font-semibold">{t("see_all")} →</Link>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
          {ready ? top.map((m) => <MedCard key={m.id} med={m} />) : Array.from({ length: 4 }, (_, i) => <div key={i} className="card h-[300px] animate-pulse" />)}
        </div>
      </section>

      <section className="bg-ink text-white">
        <div className="wrap py-20 flex flex-wrap gap-14 items-center">
          <div className="flex-[1_1_460px] min-w-0">
            <div className="eyebrow text-lime">{t("rx_band_eyebrow")}</div>
            <h2 className="h-display text-[clamp(36px,4.5vw,60px)] leading-none mt-4 mb-5">{t("rx_band_title")}</h2>
            <p className="text-lg leading-relaxed text-[#B9C7C0] max-w-[520px] mb-7">{t("rx_band_body")}</p>
            <Link to="/prescriptions" className="btn-lime h-14 px-6 text-base no-underline">{t("rx_band_cta")} <Icon name="arrow" size={18} /></Link>
          </div>
          <div className="flex-[1_1_400px] min-w-0 flex justify-center">
            <div className="w-full max-w-[440px] bg-[#FBFBF8] text-[#1C2A24] rounded-lg px-7 pt-6 pb-7 -rotate-2 shadow-[0_40px_80px_-30px_rgba(0,0,0,.6)]">
              <div className="flex justify-between border-b-2 border-[#1C2A24] pb-2.5 mb-3.5">
                <span className="font-display font-bold text-lg">Dr. [Doctor name], MBBS</span><span className="font-mono text-xs">Rx</span>
              </div>
              <div className="flex flex-col gap-2.5 font-mono text-sm">
                {[["1. Tab Pantocid 40", "1-0-0"], ["2. Tab Storvas 10", "0-0-1"], ["3. Tab Losar 50", "1-0-0"]].map(([a, b]) => (
                  <div key={a} className="flex justify-between px-2.5 py-2 rounded-md bg-lime/55 outline outline-[1.5px] outline-pine"><span>{a}</span><span>{b}</span></div>
                ))}
              </div>
              <div className="mt-4 flex justify-between font-mono text-xs text-pine"><span>3 of 3 matched</span><span>sample</span></div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function SwapCard({ s }: { s: { med: Med; brand: { name: string; maker?: string; mrp?: number; count?: number; unit?: number }; course: "month" | "course" } }) {
  const t = useT();
  const b = s.brand.unit!, g = s.med.unit;
  const pct = Math.round((1 - g / b) * 100);
  const saved = s.course === "month" ? t("swap_month", { n: inr0((b - g) * 30) }) : t("swap_course", { n: inr0((b - g) * 3) });
  return (
    <div className="card rounded-3xl p-5 sm:p-7 shadow-card">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-[#F4F5F2] min-w-0">
          <div className="eyebrow text-[11px] text-muted">{t("swap_your")}</div>
          <div className="font-display font-bold text-2xl tracking-tight mt-2 truncate">{s.brand.name}</div>
          <div className="text-[13px] text-muted truncate">{s.brand.maker}</div>
          <div className="font-mono text-[13px] text-body mt-3.5">{inr(s.brand.mrp || 0)} · {s.brand.count}</div>
          <div className="font-mono text-2xl font-semibold mt-1 line-through decoration-warn decoration-2 text-muted">{inr(b)}<span className="text-[13px] font-normal">{t("per_unit")}</span></div>
        </div>
        <div className="p-4 sm:p-5 rounded-2xl bg-pine text-white min-w-0">
          <div className="eyebrow text-[11px] text-lime">{t("swap_ours")}</div>
          <div className="font-display font-bold text-2xl tracking-tight mt-2 truncate">{s.med.name}</div>
          <div className="text-[13px] text-[#CFE3D9]">Jan Aushadhi · PMBI</div>
          <div className="font-mono text-[13px] text-[#CFE3D9] mt-3.5">{inr(s.med.price)} · {s.med.count}</div>
          <div className="font-mono text-2xl font-semibold mt-1">{inr(g)}<span className="text-[13px] font-normal">{t("per_unit")}</span></div>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-2 font-mono text-xs text-muted" aria-hidden="true">
        <div className="flex items-center gap-3"><span className="w-16">BRAND</span><div className="flex-1 h-2.5 rounded-full bg-[#E6E9E4]"><div className="h-2.5 rounded-full bg-[#9AA6A0] w-full" /></div></div>
        <div className="flex items-center gap-3"><span className="w-16">GENERIC</span><div className="flex-1 h-2.5 rounded-full bg-[#E6E9E4]"><div className="h-2.5 rounded-full bg-pine transition-[width] duration-300" style={{ width: Math.max(4, (g / b) * 100) + "%" }} /></div></div>
      </div>
      <div className="flex items-center gap-2.5 mt-5 px-3.5 py-3 rounded-xl border border-dashed border-[#9CC5B2] bg-pine-tint text-sm">
        <Icon name="checkCircle" className="text-pine shrink-0" />
        <span className="min-w-0">{t("swap_match")} <strong className="font-mono font-semibold">{s.med.salt.replace(/ Tablets| Capsules| IP/g, "")}</strong></span>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4 mt-6">
        <div>
          <div className="font-display font-extrabold text-[56px] leading-none tracking-tighter">{pct}% <span className="text-[22px] font-semibold tracking-normal">{t("swap_cheaper")}</span></div>
          <div className="text-sm text-body mt-1.5">{saved}</div>
        </div>
        <Link to={`/product/${s.med.id}`} className="btn-lime h-12 px-5 no-underline">{t("swap_switch")} <Icon name="arrow" size={16} stroke={2.2} /></Link>
      </div>
    </div>
  );
}
