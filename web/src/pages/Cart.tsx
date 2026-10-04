import React, { useMemo, useState } from "react";
import { useCatalog } from "../lib/catalog.js";
import { useT } from "../lib/i18n.js";
import { Link, navigate } from "../lib/router.js";
import { inr, cx, fmtDate } from "../lib/format.js";
import { Med, Order, currentUser, placeOrder, quote, removeFromCart, setQty, useDB } from "../lib/store.js";
import { openAuth, toast } from "../lib/ui.js";
import { Blister, Empty, RxPill, RxTag, Stepper } from "../components/bits.js";
import { Icon } from "../components/Icon.js";
import { AddressForm } from "../components/AddressForm.js";

export function useCartLines() {
  const db = useDB();
  const { byId, ready } = useCatalog();
  return useMemo(() => {
    const lines = db.cart.map((c) => ({ med: byId.get(c.id), qty: c.qty })).filter((l) => l.med) as { med: Med; qty: number }[];
    return { lines, ready, q: quote(lines, db.settings), needsRx: lines.some((l) => l.med.rx) };
  }, [db.cart, byId, db.settings, ready]);
}

function Summary({ q, children }: { q: ReturnType<typeof quote>; children?: React.ReactNode }) {
  const t = useT();
  const db = useDB();
  const short = db.settings.freeAbove - q.subtotal;
  return (
    <aside className="card p-6 flex flex-col gap-3 lg:sticky lg:top-28">
      <h2 className="font-display text-2xl font-bold tracking-tight mb-1">{t("co_summary")}</h2>
      <div className="flex justify-between"><span className="text-body">{t("cart_subtotal")}</span><span className="font-mono">{inr(q.subtotal)}</span></div>
      <div className="flex justify-between"><span className="text-body">{t("cart_delivery")}</span><span className="font-mono">{q.delivery ? inr(q.delivery) : t("cart_free")}</span></div>
      {short > 0 && q.subtotal > 0 && <p className="text-xs text-pine bg-pine-tint rounded-lg px-3 py-2">{t("cart_free_hint", { n: inr(short) })}</p>}
      <div className="flex justify-between items-baseline border-t border-ink pt-3 mt-1"><span className="font-semibold">{t("cart_total")}</span><span className="font-mono text-2xl font-semibold">{inr(q.total)}</span></div>
      {q.savings > 0 && <div className="flex justify-between items-center rounded-xl bg-lime px-3 py-2.5 font-semibold text-sm"><span>{t("cart_savings")}</span><span className="font-mono">{inr(q.savings)}</span></div>}
      {children}
    </aside>
  );
}

export default function Cart() {
  const t = useT();
  const { lines, ready, q, needsRx } = useCartLines();
  if (!ready) return <div className="wrap py-16"><div className="card h-80 animate-pulse" /></div>;
  if (!lines.length) return (
    <div className="wrap py-16"><Empty icon="cart" title={t("cart_empty")} body={t("cart_empty_b")}><Link to="/medicines" className="btn-primary no-underline">{t("cart_browse")}</Link><Link to="/prescriptions" className="btn-ghost no-underline">{t("nav_scan")}</Link></Empty></div>
  );
  return (
    <div className="wrap pt-10 pb-24">
      <h1 className="h-display text-[clamp(36px,4vw,52px)] mb-7">{t("cart_title")}</h1>
      <div className="flex flex-wrap gap-8 items-start">
        <section className="flex-[999_1_560px] min-w-0 flex flex-col gap-3">
          {needsRx && <p className="flex gap-3 p-4 rounded-2xl bg-warn-bg border border-warn-line text-sm text-warn-ink"><Icon name="doc" size={20} className="text-warn shrink-0" />{t("cart_rx_hint")}</p>}
          {lines.map(({ med, qty }) => (
            <article key={med.id} className="card p-3 sm:p-4 flex flex-wrap sm:flex-nowrap gap-4 items-center">
              <Link to={`/product/${med.id}`} className="w-24 shrink-0 rounded-xl overflow-hidden"><Blister med={med} size="sm" /></Link>
              <div className="flex-1 min-w-[160px]">
                <Link to={`/product/${med.id}`} className="font-display font-bold text-lg leading-tight text-ink no-underline">{med.name}</Link>
                <div className="text-sm text-muted mt-0.5 flex items-center gap-2">{med.pack} · {inr(med.price)} {med.rx && <RxTag />}</div>
              </div>
              <div className="flex items-center gap-3 ml-auto">
                <Stepper value={qty} onChange={(n) => setQty(med.id, Math.min(n, med.stock))} max={Math.min(99, med.stock)} label={`${t("qty")} ${med.name}`} />
                <span className="font-mono font-semibold w-24 text-right">{inr(med.price * qty)}</span>
                <button type="button" onClick={() => { removeFromCart(med.id); toast(`${t("cart_remove")}: ${med.name}`); }} aria-label={`${t("cart_remove")} ${med.name}`} className="w-11 h-11 grid place-items-center rounded-full text-muted hover:text-danger hover:bg-danger-bg"><Icon name="trash" size={18} /></button>
              </div>
            </article>
          ))}
        </section>
        <div className="flex-[1_1_320px] min-w-0">
          <Summary q={q}><Link to="/checkout" className="btn-primary h-14 text-base mt-2 no-underline">{t("cart_checkout")} <Icon name="arrow" size={18} /></Link></Summary>
        </div>
      </div>
    </div>
  );
}

export function Checkout() {
  const t = useT();
  const db = useDB();
  const me = currentUser(db);
  const { lines, ready, q, needsRx } = useCartLines();
  const mine = db.addresses.filter((a) => a.userId === me?.id);
  const myRx = db.prescriptions.filter((p) => p.userId === me?.id && p.status !== "rejected");
  const [addrId, setAddrId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [payment, setPayment] = useState<"cod" | "upi">(db.settings.cod ? "cod" : "upi");
  const [rxId, setRxId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<Order | null>(null);
  const selAddr = addrId || mine.find((a) => a.isDefault)?.id || mine[0]?.id || null;
  const selRx = rxId || myRx[0]?.id || null;

  if (done) return (
    <div className="wrap py-16 max-w-2xl">
      <div className="card p-8 text-center flex flex-col items-center gap-3 fade-up">
        <span className="w-16 h-16 rounded-full bg-lime grid place-items-center"><Icon name="check" size={30} stroke={2.6} /></span>
        <h1 className="h-display text-4xl">{t("co_done_t")}</h1>
        <p className="text-body max-w-md">{t("co_done_b", { id: done.id })}</p>
        <div className="w-full max-w-sm font-mono text-sm border-y border-line py-3 my-2 flex flex-col gap-1.5">
          <div className="flex justify-between"><span className="text-muted">ORDER</span><span>#{done.id}</span></div>
          <div className="flex justify-between"><span className="text-muted">TOTAL</span><span>{inr(done.total)}</span></div>
          <div className="flex justify-between"><span className="text-muted">PAYMENT</span><span>{done.payment === "cod" ? t("co_cod") : t("co_upi")}</span></div>
        </div>
        <div className="flex flex-wrap gap-3 justify-center"><Link to={`/orders/${done.id}`} className="btn-primary no-underline">{t("co_track")}</Link><Link to="/medicines" className="btn-ghost no-underline">{t("co_continue")}</Link></div>
      </div>
    </div>
  );
  if (!ready) return <div className="wrap py-16"><div className="card h-80 animate-pulse" /></div>;
  if (!lines.length) return <div className="wrap py-16"><Empty icon="cart" title={t("cart_empty")}><Link to="/medicines" className="btn-primary no-underline">{t("cart_browse")}</Link></Empty></div>;
  if (!me) return <div className="wrap py-16"><Empty icon="user" title={t("co_signin")} body={t("co_signin_b")}><button className="btn-primary" onClick={() => openAuth("signin")}>{t("auth_signin")}</button><button className="btn-ghost" onClick={() => openAuth("register")}>{t("auth_register")}</button></Empty></div>;

  const place = () => {
    setErr("");
    try {
      if (!selAddr) throw new Error("Add a delivery address");
      const o = placeOrder({ lines, addressId: selAddr, payment, rxId: needsRx ? selRx || undefined : undefined });
      setDone(o); window.scrollTo({ top: 0 });
      toast(`Order #${o.id} placed`);
    } catch (x: any) { setErr(x.message); }
  };
  const radio = (on: boolean) => cx("card p-4 flex gap-3 items-start cursor-pointer border-[1.5px]", on ? "border-pine bg-pine-tint" : "border-line hover:border-[#9AA6A0]");

  return (
    <div className="wrap pt-10 pb-24">
      <h1 className="h-display text-[clamp(36px,4vw,52px)] mb-7">{t("co_title")}</h1>
      <div className="flex flex-wrap gap-8 items-start">
        <div className="flex-[999_1_560px] min-w-0 flex flex-col gap-10">
          <section>
            <h2 className="font-display text-2xl font-bold mb-4"><span className="font-mono text-sm text-pine mr-2">01</span>{t("co_address")}</h2>
            <div className="grid sm:grid-cols-2 gap-3" role="radiogroup" aria-label={t("co_address")}>
              {mine.map((a) => (
                <label key={a.id} className={radio(selAddr === a.id)}>
                  <input type="radio" name="addr" className="mt-1 w-5 h-5 accent-pine" checked={selAddr === a.id} onChange={() => setAddrId(a.id)} />
                  <span className="text-sm leading-relaxed"><strong className="text-base">{a.label}</strong>{a.isDefault && <span className="pill bg-pine-soft text-pine ml-2">{t("addr_default")}</span>}<br />{a.name} · {a.phone}<br />{a.line1}{a.line2 ? ", " + a.line2 : ""}<br />{a.city}, {a.state} {a.pincode}</span>
                </label>
              ))}
            </div>
            {adding || !mine.length ? (
              <div className="card p-5 mt-3"><AddressForm defaultName={me.name} defaultPhone={me.phone} onSaved={(a) => { setAddrId(a.id); setAdding(false); toast("Address saved"); }} onCancel={mine.length ? () => setAdding(false) : undefined} /></div>
            ) : <button type="button" className="btn-ghost mt-3" onClick={() => setAdding(true)}><Icon name="plus" size={16} />{t("co_add_address")}</button>}
          </section>

          {needsRx && (
            <section>
              <h2 className="font-display text-2xl font-bold mb-1.5"><span className="font-mono text-sm text-pine mr-2">02</span>{t("co_rx")}</h2>
              <p className="text-body text-sm mb-4">{t("co_rx_pick")}</p>
              {myRx.length ? (
                <div className="flex flex-col gap-2" role="radiogroup" aria-label={t("co_rx")}>
                  {myRx.map((p) => (
                    <label key={p.id} className={radio(selRx === p.id)}>
                      <input type="radio" name="rx" className="mt-1 w-5 h-5 accent-pine" checked={selRx === p.id} onChange={() => setRxId(p.id)} />
                      <span className="flex-1 min-w-0 text-sm"><span className="flex flex-wrap items-center gap-2"><strong className="font-mono">{p.id}</strong><RxPill status={p.status} /><span className="text-muted">{fmtDate(p.createdAt)}</span></span>
                        <span className="block text-body mt-1 truncate">{p.matches.map((m) => m.name).join(", ") || p.text.slice(0, 80)}</span></span>
                    </label>
                  ))}
                </div>
              ) : <p className="text-sm text-muted mb-2">{t("co_rx_none")}</p>}
              <Link to="/prescriptions?next=checkout" className="btn-ghost mt-3 no-underline"><Icon name="scan" size={18} />{t("co_rx_scan")}</Link>
            </section>
          )}

          <section>
            <h2 className="font-display text-2xl font-bold mb-4"><span className="font-mono text-sm text-pine mr-2">{needsRx ? "03" : "02"}</span>{t("co_payment")}</h2>
            <div className="grid sm:grid-cols-2 gap-3" role="radiogroup" aria-label={t("co_payment")}>
              {db.settings.cod && <label className={radio(payment === "cod")}><input type="radio" name="pay" className="mt-1 w-5 h-5 accent-pine" checked={payment === "cod"} onChange={() => setPayment("cod")} /><span><strong>{t("co_cod")}</strong><br /><span className="text-sm text-muted">Pay when it arrives</span></span></label>}
              {db.settings.upi && <label className={radio(payment === "upi")}><input type="radio" name="pay" className="mt-1 w-5 h-5 accent-pine" checked={payment === "upi"} onChange={() => setPayment("upi")} /><span><strong>{t("co_upi")}</strong><br /><span className="text-sm text-muted">Scan the courier's QR</span></span></label>}
            </div>
          </section>
        </div>

        <div className="flex-[1_1_320px] min-w-0">
          <Summary q={q}>
            <ul className="text-sm border-t border-line pt-3 flex flex-col gap-1.5 max-h-48 overflow-auto">
              {lines.map((l) => <li key={l.med.id} className="flex justify-between gap-3"><span className="truncate">{l.qty} × {l.med.name}</span><span className="font-mono">{inr(l.med.price * l.qty)}</span></li>)}
            </ul>
            {err && <p role="alert" className="text-sm text-danger bg-danger-bg rounded-lg px-3 py-2">{err}</p>}
            <button type="button" className="btn-primary h-14 text-base mt-1" onClick={place}>{t("co_place")} · {inr(q.total)}</button>
            <p className="text-xs text-muted">{t("demo_note")}</p>
          </Summary>
        </div>
      </div>
    </div>
  );
}
