import React from "react";
import { Med, addToCart, getDB, toggleWish, useDB, wishOf } from "../lib/store.js";
import { catInfo, cheapestBrand } from "../lib/catalog.js";
import { inr } from "../lib/format.js";
import { useT, useLang } from "../lib/i18n.js";
import { Link } from "../lib/router.js";
import { toast } from "../lib/ui.js";
import { Blister, RxTag, SaveTag } from "./bits.js";
import { Icon } from "./Icon.js";

export function addWithToast(med: Med, qty: number, t: ReturnType<typeof useT>) {
  const have = getDB().cart.find((c) => c.id === med.id)?.qty || 0;
  if (have + qty > med.stock) { toast(t("only_left", { n: med.stock }), { tone: "err" }); return false; }
  addToCart(med.id, qty);
  toast(`${t("added")} · ${med.name}`, { action: { label: t("view_cart"), to: "/cart" } });
  return true;
}

export function MedCard({ med }: { med: Med }) {
  const t = useT();
  const lang = useLang();
  const db = useDB();
  const wished = wishOf(db).includes(med.id);
  const inCart = db.cart.find((c) => c.id === med.id)?.qty || 0;
  const brand = cheapestBrand(med) || med.brands[0];
  const c = catInfo(med.cat);
  const out = med.stock <= 0;
  return (
    <article className="card lift overflow-hidden flex flex-col relative">
      <Link to={`/product/${med.id}`} className="flex flex-col flex-1 text-ink no-underline" aria-label={med.name}>
        <Blister med={med} size="md" />
        <div className="px-4 pt-4 flex flex-col gap-1">
          <span className="eyebrow text-[11px] text-muted">{lang === "hi" ? c.hi : c.en} · {med.form}</span>
          <span className="font-display font-bold text-[19px] leading-tight tracking-tight line-clamp-2">{med.name}</span>
          <span className="text-[13px] text-muted line-clamp-1">{brand ? t("generic_for", { b: brand.name }) : med.pack}</span>
        </div>
      </Link>
      {med.rx && <RxTag className="absolute top-2.5 right-2.5" />}
      <button type="button" onClick={() => toggleWish(med.id)} aria-pressed={wished} aria-label={(wished ? "Remove from" : "Save to") + " wishlist"}
        className="absolute top-1.5 left-1.5 w-11 h-11 grid place-items-center rounded-full text-ink hover:bg-white/60">
        <Icon name="heart" size={19} stroke={1.8} className={wished ? "fill-[#C2483B] text-[#C2483B]" : ""} />
      </button>
      <div className="flex items-center justify-between gap-2 mx-4 mt-3.5 mb-4 pt-3.5 border-t border-dashed border-line">
        <div className="flex flex-col min-w-0">
          <span className="font-mono text-lg font-semibold">{inr(med.price)}<span className="text-xs font-normal text-muted"> / {med.pack}</span></span>
          {med.save > 0 ? <span className="flex items-center gap-1.5"><SaveTag pct={med.save} />{brand && <span className="text-xs text-muted truncate">vs {brand.name}</span>}</span>
            : out ? <span className="font-mono text-xs text-danger font-semibold">{t("out_of_stock")}</span>
            : med.stock < 30 ? <span className="font-mono text-xs text-warn font-semibold">{t("only_left", { n: med.stock })}</span> : null}
        </div>
        <button type="button" disabled={out} onClick={() => addWithToast(med, 1, t)} aria-label={`${t("add_to_cart")}: ${med.name}`}
          className="relative w-11 h-11 shrink-0 rounded-xl bg-pine text-white grid place-items-center hover:bg-pine-dark disabled:bg-[#9AA6A0]">
          <Icon name="plus" size={18} stroke={2.4} />
          {inCart > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-lime text-ink text-[11px] font-mono font-bold grid place-items-center">{inCart}</span>}
        </button>
      </div>
    </article>
  );
}
