import React, { useMemo, useState } from "react";
import { catInfo, cheapestBrand, useCatalog } from "../lib/catalog.js";
import { useT, useLang } from "../lib/i18n.js";
import { Link } from "../lib/router.js";
import { inr, cx } from "../lib/format.js";
import { toggleWish, useDB, wishOf } from "../lib/store.js";
import { openChat } from "../lib/ui.js";
import { Blister, Empty, RxTag, Stepper } from "../components/bits.js";
import { Icon } from "../components/Icon.js";
import { MedCard, addWithToast } from "../components/MedCard.js";

export default function Product({ id }: { id: number }) {
  const t = useT();
  const lang = useLang();
  const db = useDB();
  const { byId, meds, ready } = useCatalog();
  const med = byId.get(id);
  const [qty, setQty] = useState(1);
  const related = useMemo(() => (med ? meds.filter((m) => m.cat === med.cat && m.id !== med.id && m.form === med.form).sort((a, b) => b.save - a.save || b.brands.length - a.brands.length).slice(0, 4) : []), [med, meds]);

  if (!ready) return <div className="wrap py-16"><div className="card h-[480px] animate-pulse" /></div>;
  if (!med) return <div className="wrap py-16"><Empty icon="search" title={t("pd_notfound")}><Link to="/medicines" className="btn-primary no-underline">{t("all_medicines")}</Link></Empty></div>;

  const c = catInfo(med.cat);
  const best = cheapestBrand(med);
  const wished = wishOf(db).includes(med.id);
  const inCart = db.cart.find((x) => x.id === med.id)?.qty || 0;
  const maxQty = Math.max(1, Math.min(10, med.stock - inCart));
  const rows = [
    { name: med.name + " · GenMedics", maker: "PMBI · Jan Aushadhi", mrp: med.price, count: med.count, unit: med.unit, us: true },
    ...med.brands.filter((b) => b.unit).map((b) => ({ name: b.name, maker: b.maker || "—", mrp: b.mrp!, count: b.count!, unit: b.unit!, us: false })),
  ];
  const unpriced = med.brands.filter((b) => !b.unit);
  const solid = med.count > 1;

  return (
    <div className="wrap pt-7 pb-24">
      <nav aria-label="Breadcrumb" className="text-sm text-muted flex flex-wrap gap-2 mb-6">
        <Link to="/" className="text-muted">Home</Link><span>/</span>
        <Link to={`/medicines?cat=${med.cat}`} className="text-muted">{lang === "hi" ? c.hi : c.en}</Link><span>/</span>
        <span className="text-ink">{med.name}</span>
      </nav>

      <div className="flex flex-wrap gap-12 items-start">
        <div className="flex-[1_1_440px] min-w-0 relative">
          <Blister med={med} size="lg" />
          <div className="absolute left-4 bottom-4 flex flex-wrap gap-2">
            {med.rx && <span className="pill bg-white text-warn border border-warn-line text-xs py-1.5 px-2.5">Rx · {t("rx_required")}</span>}
            <span className="pill bg-ink text-lime text-xs py-1.5 px-2.5">Jan Aushadhi</span>
          </div>
        </div>

        <div className="flex-[1_1_440px] min-w-0">
          <div className="eyebrow text-pine">{(lang === "hi" ? c.hi : c.en)} · {med.form}</div>
          <h1 className="h-display text-[clamp(34px,4vw,54px)] leading-none mt-3 mb-3">{med.name}</h1>
          {med.brands.length > 0 && <p className="text-[17px] text-body mb-6">{t("generic_for", { b: med.brands.slice(0, 3).map((b) => b.name).join(", ") })}</p>}

          <dl className="border-t border-ink font-mono text-sm">
            {[
              [t("pd_composition"), med.salt],
              [t("pd_pack"), med.pack],
              [t("pd_source"), "PMBI · Jan Aushadhi"],
              ...(med.use ? [[t("pd_use"), med.use]] : []),
              [t("pd_stock"), med.stock > 0 ? (med.stock < 30 ? t("only_left", { n: med.stock }) : "In stock") : t("out_of_stock")],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-3 border-b border-line"><dt className="text-muted uppercase shrink-0">{k}</dt><dd className="text-right">{v}</dd></div>
            ))}
          </dl>

          <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-2 mt-6 mb-1">
            <span className="font-mono text-[44px] font-semibold tracking-tight">{inr(med.price)}</span>
            {solid && <span className="font-mono text-[15px] text-muted">{inr(med.unit)}{t("per_unit")}</span>}
            {best && med.save > 0 && <span className="pill bg-lime text-ink text-[13px] px-2.5">{t("pd_below", { p: med.save, b: best.name })}</span>}
          </div>
          <div className="text-[13px] text-muted mb-5">{t("pd_taxes")}</div>

          <div className="flex flex-wrap gap-3 items-center">
            <Stepper value={qty} onChange={(n) => setQty(Math.max(1, Math.min(maxQty, n)))} max={maxQty} label={t("qty")} />
            <button type="button" disabled={med.stock <= inCart} onClick={() => { if (addWithToast(med, qty, t)) setQty(1); }} className="btn-primary flex-[1_1_220px] h-14 text-base">
              {med.stock <= 0 ? t("out_of_stock") : `${t("add_to_cart")} · ${inr(med.price * qty)}`}
            </button>
            <button type="button" onClick={() => toggleWish(med.id)} aria-pressed={wished} aria-label={t("nav_wishlist")} className="w-14 h-14 rounded-xl border-[1.5px] border-ink grid place-items-center hover:bg-field">
              <Icon name="heart" size={22} stroke={1.8} className={wished ? "fill-[#C2483B] text-[#C2483B]" : ""} />
            </button>
          </div>
          {inCart > 0 && <p className="text-sm text-pine mt-3 flex items-center gap-2"><Icon name="check" size={16} />{inCart} in cart · <Link to="/cart" className="font-semibold">{t("view_cart")}</Link></p>}

          {med.rx && (
            <div className="mt-5 flex gap-3 p-4 rounded-2xl bg-warn-bg border border-warn-line text-sm leading-relaxed text-warn-ink">
              <Icon name="doc" size={22} className="text-warn shrink-0" stroke={1.8} />
              <span><strong>{t("rx_required")}.</strong> {t("pd_rx_note")} <Link to="/prescriptions" className="text-[#8A3606] font-semibold">{t("nav_scan")} →</Link></span>
            </div>
          )}
        </div>
      </div>

      {rows.length > 1 && (
        <section className="mt-20">
          <h2 className="h-display text-4xl mb-1.5">{t("pd_compare_t")}</h2>
          <p className="text-body mb-6">{t("pd_compare_b")}</p>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[15px]">
              <thead><tr className="text-left font-mono text-xs tracking-[.08em] text-muted uppercase">
                {[t("pd_product"), t("pd_maker"), t("pd_strip"), t("pd_unit"), t("pd_30"), t("pd_composition")].map((h) => <th key={h} className="px-5 py-4 font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className={cx("border-t border-line", r.us && "bg-lime-soft")}>
                    <td className="px-5 py-4 font-semibold">{r.name}</td>
                    <td className="px-5 py-4 text-body">{r.maker}</td>
                    <td className="px-5 py-4 font-mono">{inr(r.mrp)} <span className="text-muted text-xs">/{r.count}</span></td>
                    <td className="px-5 py-4 font-mono">{inr(r.unit)}</td>
                    <td className="px-5 py-4 font-mono font-semibold">{inr(r.unit * 30)}</td>
                    <td className="px-5 py-4"><span className="inline-flex items-center gap-1.5 font-mono text-[13px] text-pine"><Icon name="check" size={16} stroke={2.4} />{t("pd_identical")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {unpriced.length > 0 && <p className="text-sm text-muted mt-3">{t("pd_brand_known")}: {unpriced.map((b) => b.name).join(", ")}</p>}
        </section>
      )}

      <section className="mt-16 flex flex-wrap gap-10">
        <div className="flex-[999_1_520px] min-w-0">
          <h2 className="h-display text-3xl mb-4">{t("pd_info")}</h2>
          <ul className="divide-y divide-dashed divide-line border-y border-dashed border-line">
            <li className="flex gap-4 py-4"><span className="font-mono text-[13px] text-pine pt-0.5">01</span><span>{med.use ? `${t("pd_use")}: ${med.use}.` : `${med.name} — ${med.pack}.`}</span></li>
            <li className="flex gap-4 py-4"><span className="font-mono text-[13px] text-pine pt-0.5">02</span><span>{t("pd_composition")}: {med.salt}.</span></li>
            <li className="flex gap-4 py-4"><span className="font-mono text-[13px] text-pine pt-0.5">03</span><span>{med.rx ? t("rx_required") + ". " : ""}{t("pd_safety")}</span></li>
          </ul>
        </div>
        <aside className="flex-[1_1_300px] self-start rounded-[20px] bg-ink text-white p-6">
          <div className="eyebrow text-lime">{t("pd_ask")}</div>
          <p className="font-display text-2xl font-bold leading-tight mt-3 mb-4">{t("pd_ask_t")}</p>
          <p className="text-[#B9C7C0] leading-relaxed mb-5">{t("pd_ask_b")}</p>
          <button type="button" className="btn-lime h-12" onClick={() => openChat(med.brands[0]?.name || med.name)}>{t("pd_chat")}</button>
        </aside>
      </section>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="h-display text-3xl mb-5">{t("pd_related", { c: lang === "hi" ? c.hi : c.en })}</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">{related.map((m) => <MedCard key={m.id} med={m} />)}</div>
        </section>
      )}
    </div>
  );
}
