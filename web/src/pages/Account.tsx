import React, { useState } from "react";
import { useCatalog } from "../lib/catalog.js";
import { useT } from "../lib/i18n.js";
import { Link, navigate } from "../lib/router.js";
import { inr, fmtDate, cx } from "../lib/format.js";
import { ORDER_FLOW, Order, addToCart, cancelOrder, changePassword, currentUser, deleteAddress, setDefaultAddress, updateProfile, useDB, wishOf, Address } from "../lib/store.js";
import { openAuth, toast } from "../lib/ui.js";
import { Empty, Field, OrderPill } from "../components/bits.js";
import { Icon } from "../components/Icon.js";
import { MedCard } from "../components/MedCard.js";
import { AddressForm } from "../components/AddressForm.js";

function NeedSignIn() {
  const t = useT();
  return <div className="wrap py-16"><Empty icon="user" title={t("co_signin")} body={t("co_signin_b")}><button className="btn-primary" onClick={() => openAuth("signin")}>{t("auth_signin")}</button><button className="btn-ghost" onClick={() => openAuth("register")}>{t("auth_register")}</button></Empty></div>;
}

function useReorder() {
  const t = useT();
  const { byId } = useCatalog();
  return (o: Order) => {
    let n = 0;
    for (const it of o.items) { const m = byId.get(it.id); if (m && m.stock > 0) { addToCart(m.id, Math.min(it.qty, m.stock)); n++; } }
    if (n) { toast(`${n} ${t("ord_items")} → ${t("nav_cart")}`, { action: { label: t("view_cart"), to: "/cart" } }); }
    else toast(t("out_of_stock"), { tone: "err" });
  };
}

export function Orders() {
  const t = useT();
  const db = useDB();
  const me = currentUser(db);
  const reorder = useReorder();
  if (!me) return <NeedSignIn />;
  const mine = db.orders.filter((o) => o.userId === me.id);
  return (
    <div className="wrap pt-10 pb-24">
      <h1 className="h-display text-[clamp(36px,4vw,52px)] mb-1.5">{t("ord_title")}</h1>
      <p className="text-body mb-7">{t("ord_sub")}</p>
      {!mine.length ? <Empty icon="box" title={t("ord_empty")} body={t("ord_empty_b")}><Link to="/medicines" className="btn-primary no-underline">{t("cart_browse")}</Link></Empty> : (
        <div className="flex flex-col gap-3">
          {mine.map((o) => (
            <article key={o.id} className="card p-5 flex flex-wrap gap-x-6 gap-y-3 items-center">
              <div className="min-w-[140px]">
                <div className="font-mono font-semibold text-lg">#{o.id}</div>
                <div className="text-sm text-muted">{t("ord_placed")} {fmtDate(o.createdAt)}</div>
              </div>
              <OrderPill status={o.status} />
              <div className="flex-1 min-w-[200px] text-sm text-body truncate">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</div>
              <div className="font-mono font-semibold">{inr(o.total)}</div>
              <div className="flex gap-2 ml-auto">
                <Link to={`/orders/${o.id}`} className="btn-ghost h-11 no-underline">{t("ord_details")}</Link>
                {o.status === "delivered" && <button type="button" className="btn-primary h-11" onClick={() => reorder(o)}>{t("ord_reorder")}</button>}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function OrderDetail({ id }: { id: number }) {
  const t = useT();
  const db = useDB();
  const me = currentUser(db);
  const reorder = useReorder();
  const [confirm, setConfirm] = useState(false);
  if (!me) return <NeedSignIn />;
  const o = db.orders.find((x) => x.id === id && (x.userId === me.id || me.admin));
  if (!o) return <div className="wrap py-16"><Empty icon="box" title={t("notfound")}><Link to="/orders" className="btn-primary no-underline">{t("ord_back")}</Link></Empty></div>;
  const reached = o.status === "cancelled" ? -1 : ORDER_FLOW.indexOf(o.status);
  const at = (s: string) => o.history.find((h) => h.status === s)?.at;
  return (
    <div className="wrap pt-8 pb-24 max-w-5xl">
      <Link to="/orders" className="inline-flex items-center gap-2 text-sm font-semibold mb-5"><Icon name="back" size={16} />{t("ord_back")}</Link>
      <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
        <div>
          <h1 className="h-display text-5xl">#{o.id}</h1>
          <p className="text-body mt-1">{t("ord_placed")} {fmtDate(o.createdAt, true)}</p>
        </div>
        <OrderPill status={o.status} />
      </div>

      <section className="card p-6 mb-6" aria-label={t("ord_timeline")}>
        {o.status === "cancelled" ? (
          <p className="flex items-center gap-2 text-body"><Icon name="x" className="text-danger" />{t("st_cancelled")} · {fmtDate(at("cancelled") || o.createdAt, true)}</p>
        ) : (
          <ol className="grid grid-cols-5 gap-2">
            {ORDER_FLOW.map((s, i) => (
              <li key={s} className="flex flex-col gap-2">
                <span className={cx("h-2 rounded-full", i <= reached ? "bg-pine" : "bg-[#E6E9E4]")} />
                <span className={cx("text-xs sm:text-sm", i <= reached ? "font-semibold text-ink" : "text-muted")}>{t(("st_" + s) as any)}</span>
                {at(s) && <span className="font-mono text-[11px] text-muted hidden sm:block">{fmtDate(at(s)!, true)}</span>}
              </li>
            ))}
          </ol>
        )}
        {o.tracking && <p className="mt-5 text-sm flex items-center gap-2"><Icon name="truck" size={18} className="text-pine" />{t("ord_tracking")}: <span className="font-mono font-semibold">{o.tracking}</span></p>}
        {o.history.filter((h) => h.note).map((h) => <p key={h.at} className="mt-2 text-sm text-body">“{h.note}” — {t(("st_" + h.status) as any)}</p>)}
      </section>

      <div className="flex flex-wrap gap-6 items-start">
        <section className="card flex-[2_1_420px] min-w-0 overflow-hidden">
          <ul className="divide-y divide-line">
            {o.items.map((it) => (
              <li key={it.id} className="flex items-center gap-4 px-5 py-4">
                <span className="font-mono text-sm text-muted w-8">{it.qty}×</span>
                <Link to={`/product/${it.id}`} className="flex-1 min-w-0 text-ink font-semibold no-underline truncate">{it.name}</Link>
                {it.rx && <span className="pill bg-white text-warn border border-warn-line">Rx</span>}
                <span className="font-mono">{inr(it.price * it.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-5 py-4 font-mono text-sm flex flex-col gap-1.5">
            <div className="flex justify-between"><span className="text-muted">{t("cart_subtotal").toUpperCase()}</span><span>{inr(o.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted">{t("cart_delivery").toUpperCase()}</span><span>{o.delivery ? inr(o.delivery) : t("cart_free")}</span></div>
            <div className="flex justify-between text-base font-semibold"><span>{t("cart_total").toUpperCase()}</span><span>{inr(o.total)}</span></div>
            {o.brandTotal > o.subtotal && <div className="flex justify-between text-pine"><span>{t("cart_savings").toUpperCase()}</span><span>{inr(o.brandTotal - o.subtotal)}</span></div>}
          </div>
        </section>
        <aside className="flex-[1_1_260px] min-w-0 flex flex-col gap-4">
          <div className="card p-5 text-sm leading-relaxed">
            <div className="eyebrow text-muted mb-2">{t("ord_ship_to")}</div>
            <strong>{o.address.name}</strong> · {o.address.phone}<br />{o.address.line1}{o.address.line2 ? ", " + o.address.line2 : ""}<br />{o.address.city}, {o.address.state} {o.address.pincode}
            <div className="eyebrow text-muted mt-4 mb-1">{t("ord_pay")}</div>{o.payment === "cod" ? t("co_cod") : t("co_upi")}
            {o.rxId && <><div className="eyebrow text-muted mt-4 mb-1">{t("co_rx")}</div><span className="font-mono">{o.rxId}</span></>}
          </div>
          {o.status === "delivered" && <button type="button" className="btn-primary" onClick={() => reorder(o)}>{t("ord_reorder")}</button>}
          {(o.status === "pending" || o.status === "confirmed") && (confirm ? (
            <div className="card p-4 flex flex-col gap-3"><p className="text-sm font-semibold">{t("ord_cancel_q")}</p>
              <div className="flex gap-2"><button className="btn-danger flex-1" onClick={() => { cancelOrder(o.id); setConfirm(false); toast(`#${o.id} ${t("st_cancelled")}`); }}>{t("ord_cancel")}</button><button className="btn-ghost" onClick={() => setConfirm(false)}>{t("cancel")}</button></div></div>
          ) : <button type="button" className="btn-danger" onClick={() => setConfirm(true)}>{t("ord_cancel")}</button>)}
        </aside>
      </div>
    </div>
  );
}

export function AccountPage() {
  const t = useT();
  const db = useDB();
  const me = currentUser(db);
  const [p, setP] = useState({ name: me?.name || "", phone: me?.phone || "" });
  const [pw, setPw] = useState({ old: "", next: "" });
  const [pwErr, setPwErr] = useState("");
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  if (!me) return <NeedSignIn />;
  const mine = db.addresses.filter((a) => a.userId === me.id);
  return (
    <div className="wrap pt-10 pb-24 max-w-4xl">
      <h1 className="h-display text-[clamp(36px,4vw,52px)] mb-1.5">{t("acc_title")}</h1>
      <p className="text-body mb-8">{me.email} · {t("acc_member", { d: fmtDate(me.createdAt) })}</p>

      <section className="card p-6 mb-6">
        <h2 className="font-display text-2xl font-bold mb-4">{t("acc_profile")}</h2>
        <form className="grid sm:grid-cols-2 gap-4" onSubmit={(e) => { e.preventDefault(); updateProfile(p); toast(t("acc_saved")); }}>
          <Field label={t("auth_name")}><input className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
          <Field label={t("addr_phone")}><input className="input" type="tel" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></Field>
          <Field label={t("acc_email")}><input className="input bg-field" value={me.email} readOnly /></Field>
          <div className="flex items-end"><button className="btn-primary h-12 px-6">{t("acc_save")}</button></div>
        </form>
      </section>

      <section className="card p-6 mb-6">
        <div className="flex justify-between items-center mb-4 gap-3 flex-wrap">
          <h2 className="font-display text-2xl font-bold">{t("acc_addresses")}</h2>
          {editing === null && <button type="button" className="btn-ghost" onClick={() => setEditing("new")}><Icon name="plus" size={16} />{t("co_add_address")}</button>}
        </div>
        {editing !== null && <div className="mb-5 p-4 rounded-2xl bg-paper"><AddressForm initial={editing === "new" ? undefined : editing} defaultName={me.name} defaultPhone={me.phone} onSaved={() => { setEditing(null); toast(t("acc_saved")); }} onCancel={() => setEditing(null)} /></div>}
        {!mine.length && editing === null ? <p className="text-muted">{t("acc_no_addr")}</p> : (
          <div className="grid sm:grid-cols-2 gap-3">
            {mine.map((a) => (
              <div key={a.id} className="rounded-2xl border border-line p-4 text-sm leading-relaxed">
                <div className="flex items-center gap-2 mb-1"><strong className="text-base">{a.label}</strong>{a.isDefault && <span className="pill bg-pine-soft text-pine">{t("addr_default")}</span>}</div>
                {a.name} · {a.phone}<br />{a.line1}{a.line2 ? ", " + a.line2 : ""}<br />{a.city}, {a.state} {a.pincode}
                <div className="flex flex-wrap gap-1 mt-3 -ml-2">
                  <button className="px-2 min-h-[36px] text-pine font-semibold" onClick={() => setEditing(a)}>{t("addr_edit")}</button>
                  {!a.isDefault && <button className="px-2 min-h-[36px] text-pine font-semibold" onClick={() => setDefaultAddress(a.id)}>{t("addr_make_default")}</button>}
                  <button className="px-2 min-h-[36px] text-danger font-semibold" onClick={() => { deleteAddress(a.id); toast(t("addr_delete")); }}>{t("addr_delete")}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-6">
        <h2 className="font-display text-2xl font-bold mb-4">{t("acc_security")}</h2>
        <form className="grid sm:grid-cols-2 gap-4" onSubmit={async (e) => { e.preventDefault(); setPwErr(""); try { await changePassword(pw.old, pw.next); setPw({ old: "", next: "" }); toast(t("acc_changed")); } catch (x: any) { setPwErr(x.message); } }}>
          <Field label={t("acc_old")}><input className="input" type="password" autoComplete="current-password" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} /></Field>
          <Field label={t("acc_new")}><input className="input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
          {pwErr && <p role="alert" className="sm:col-span-2 text-sm text-danger bg-danger-bg rounded-lg px-3 py-2">{pwErr}</p>}
          <div><button className="btn-ghost h-12">{t("acc_change")}</button></div>
        </form>
      </section>
    </div>
  );
}

export function Wishlist() {
  const t = useT();
  const db = useDB();
  const { byId, ready } = useCatalog();
  const ids = wishOf(db);
  const meds = ids.map((i) => byId.get(i)).filter(Boolean) as any[];
  return (
    <div className="wrap pt-10 pb-24">
      <h1 className="h-display text-[clamp(36px,4vw,52px)] mb-7">{t("wish_title")}</h1>
      {!ready ? <div className="card h-64 animate-pulse" /> : !meds.length ? (
        <Empty icon="heart" title={t("wish_empty")} body={t("wish_empty_b")}><Link to="/medicines" className="btn-primary no-underline">{t("cart_browse")}</Link></Empty>
      ) : <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">{meds.map((m) => <MedCard key={m.id} med={m} />)}</div>}
    </div>
  );
}
