import React, { useEffect, useMemo, useState } from "react";
import { CATEGORIES, searchMeds, useCatalog } from "../lib/catalog.js";
import { useT, useLang } from "../lib/i18n.js";
import { Link, navigate, useRoute } from "../lib/router.js";
import { MedCard } from "../components/MedCard.js";
import { Empty } from "../components/bits.js";
import { Icon } from "../components/Icon.js";

const PAGE = 24;
const FORMS = ["Tablet", "Capsule", "Syrup", "Injection", "Cream", "Drops", "Inhaler", "Powder"];

export default function Medicines() {
  const t = useT();
  const lang = useLang();
  const { meds, ready, error } = useCatalog();
  const { query } = useRoute();
  const q = query.get("q") || "";
  const cat = query.get("cat") || "all";
  const form = query.get("form") || "";
  const otc = query.get("otc") === "1";
  const cmp = query.get("cmp") === "1";
  const sort = query.get("sort") || (q ? "rel" : "save");
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [q, cat, form, otc, cmp, sort]);

  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(query);
    if (v == null || v === "" || v === "all") p.delete(k); else p.set(k, v);
    const s = p.toString();
    navigate("/medicines" + (s ? "?" + s : ""), true);
  };

  const list = useMemo(() => {
    let l = q ? searchMeds(meds, q) : meds.slice();
    if (cat !== "all") l = l.filter((m) => m.cat === cat);
    if (form) l = l.filter((m) => m.form === form);
    if (otc) l = l.filter((m) => !m.rx);
    if (cmp) l = l.filter((m) => m.brands.length > 0);
    if (sort === "save") l.sort((a, b) => b.save - a.save || b.brands.length - a.brands.length || a.name.localeCompare(b.name));
    else if (sort === "price") l.sort((a, b) => a.unit - b.unit);
    else if (sort === "name") l.sort((a, b) => a.name.localeCompare(b.name));
    return l;
  }, [meds, q, cat, form, otc, cmp, sort]);

  const sorts: [string, string][] = [...(q ? [["rel", "Best match"] as [string, string]] : []), ["save", t("med_sort_save")], ["price", t("med_sort_price")], ["name", t("med_sort_name")]];
  const filtered = cat !== "all" || form || otc || cmp;

  return (
    <div className="wrap pt-10 pb-24">
      <div className="flex flex-wrap justify-between items-end gap-5 mb-7">
        <div>
          <h1 className="h-display text-[clamp(36px,4vw,52px)] mb-1.5">{q ? <>“{q}”</> : t("med_title")}</h1>
          <p className="text-body" aria-live="polite">{ready ? t("med_shown", { n: list.length.toLocaleString("en-IN") }) : t("loading")}</p>
        </div>
        <div role="group" aria-label="Sort" className="flex flex-wrap gap-1 p-1 bg-white border border-line rounded-xl">
          {sorts.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={sort === id} onClick={() => setParam("sort", id === (q ? "rel" : "save") ? null : id)}
              className={sort === id ? "h-10 px-3.5 rounded-lg text-sm font-semibold bg-pine text-white" : "h-10 px-3.5 rounded-lg text-sm font-semibold text-body hover:bg-field"}>{label}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-8 items-start">
        <aside className="flex-[1_1_250px] max-w-full lg:max-w-[290px] flex flex-col gap-7">
          <div>
            <div className="eyebrow text-muted mb-3">{t("med_condition")}</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={cat === "all"} onClick={() => setParam("cat", null)} className={cat === "all" ? "chip-on" : "chip-off"}>{t("med_all")}</button>
              {CATEGORIES.map((c) => (
                <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => setParam("cat", c.id)} className={cat === c.id ? "chip-on" : "chip-off"}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: cat === c.id ? "#CDEB6B" : c.color }} />{lang === "hi" ? c.hi : c.en}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="eyebrow text-muted mb-3 block" htmlFor="form-select">{t("med_form")}</label>
            <select id="form-select" className="input" value={form} onChange={(e) => setParam("form", e.target.value)}>
              <option value="">{t("med_all")}</option>
              {FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <div className="eyebrow text-muted mb-2">{t("med_availability")}</div>
            <label className="flex items-center gap-3 min-h-[44px] cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-pine" checked={otc} onChange={(e) => setParam("otc", e.target.checked ? "1" : null)} />{t("med_otc")}</label>
            <label className="flex items-center gap-3 min-h-[44px] cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-pine" checked={cmp} onChange={(e) => setParam("cmp", e.target.checked ? "1" : null)} />{t("med_compared")}</label>
            {filtered && <button type="button" onClick={() => navigate("/medicines" + (q ? "?q=" + encodeURIComponent(q) : ""), true)} className="self-start text-pine font-semibold underline mt-1 min-h-[36px]">{t("clear_filters")}</button>}
          </div>
          <div className="rounded-[18px] bg-ink text-white p-5">
            <div className="font-display font-bold text-xl leading-tight">{t("med_have_rx")}</div>
            <p className="text-[#B9C7C0] text-sm leading-relaxed mt-2 mb-4">{t("med_have_rx_b")}</p>
            <Link to="/prescriptions" className="btn-lime h-11 text-sm no-underline">{t("nav_scan")}</Link>
          </div>
        </aside>

        <section aria-label="Results" className="flex-[999_1_600px] min-w-0">
          {error ? (
            <Empty icon="warn" title={t("error_catalogue")} body={error}><button className="btn-primary" onClick={() => location.reload()}>{t("retry")}</button></Empty>
          ) : !ready ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5">{Array.from({ length: 6 }, (_, i) => <div key={i} className="card h-[300px] animate-pulse" />)}</div>
          ) : list.length === 0 ? (
            <Empty icon="search" title={t("med_empty")}>
              <Link to="/medicines" className="btn-ghost no-underline">{t("clear_filters")}</Link>
              <Link to="/prescriptions" className="btn-primary no-underline"><Icon name="scan" size={18} />{t("nav_scan")}</Link>
            </Empty>
          ) : (
            <>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5">
                {list.slice(0, limit).map((m) => <MedCard key={m.id} med={m} />)}
              </div>
              {limit < list.length && (
                <div className="flex justify-center mt-8">
                  <button type="button" className="btn-ghost h-12 px-6" onClick={() => setLimit((n) => n + PAGE)}>{t("med_more")} · {Math.min(PAGE, list.length - limit)}</button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
