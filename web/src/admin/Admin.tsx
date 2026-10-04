import React, { useMemo, useState } from "react";
import { CATEGORIES, catInfo, searchMeds, useCatalog } from "../lib/catalog.js";
import { Link, navigate } from "../lib/router.js";
import { inr, inr0, fmtDate, timeAgo, cx } from "../lib/format.js";
import {
  Category, DEMO_ACCOUNTS, LOW_STOCK, Med, ORDER_FLOW, Order, OrderStatus, Prescription, RxStatus, addMed, currentUser, deleteMed,
  isApi, login, logout, patchMed, resetDemo, reviewPrescription, setOrderStatus, updateSettings, useDB,
} from "../lib/store.js";
import { toast } from "../lib/ui.js";
import { assetUrl } from "../lib/api.js";
import { Field, Modal, OrderPill, RxPill, Spinner } from "../components/bits.js";
import { Icon, Logo } from "../components/Icon.js";

const NAV = [
  ["overview", "Overview", "grid"], ["prescriptions", "Prescriptions", "doc"], ["orders", "Orders", "box"], ["inventory", "Inventory", "pill"],
  ["customers", "Customers", "users"], ["analytics", "Analytics", "chart"], ["settings", "Settings", "gear"],
] as const;
type Section = (typeof NAV)[number][0];

export default function Admin({ section }: { section: string }) {
  const db = useDB();
  const me = currentUser(db);
  const [mobileNav, setMobileNav] = useState(false);
  if (!me || !me.admin) return <AdminLogin signedInAs={me?.email} />;
  const sec = (NAV.find((n) => n[0] === section)?.[0] || "overview") as Section;
  const pendingRx = db.prescriptions.filter((p) => p.status === "pending").length;
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-paper">
      <aside className={cx("bg-ink text-[#DCE6E0] lg:w-[250px] lg:min-h-screen shrink-0 flex flex-col", "lg:sticky lg:top-0 lg:h-screen")}>
        <div className="flex items-center justify-between gap-2 px-5 py-5">
          <Link to="/admin" className="flex items-center gap-2.5 no-underline">
            <Logo size={32} inverse />
            <span className="font-display font-extrabold text-xl text-white tracking-tight">GenMedics</span>
            <span className="font-mono text-[10px] tracking-widest text-ink bg-lime px-1.5 py-0.5 rounded">OPS</span>
          </Link>
          <button type="button" className="lg:hidden w-11 h-11 grid place-items-center rounded-lg hover:bg-white/10" aria-expanded={mobileNav} aria-label="Menu" onClick={() => setMobileNav(!mobileNav)}><Icon name="menu" /></button>
        </div>
        <nav aria-label="Admin" className={cx("px-3 flex-col gap-0.5", mobileNav ? "flex" : "hidden lg:flex")}>
          {NAV.map(([id, label, icon]) => (
            <Link key={id} to={id === "overview" ? "/admin" : `/admin/${id}`} onClick={() => setMobileNav(false)} aria-current={sec === id ? "page" : undefined}
              className={cx("flex items-center gap-3 h-11 px-3 rounded-lg no-underline text-[15px]", sec === id ? "bg-[#1F3A30] text-white font-semibold shadow-[inset_3px_0_0_#CDEB6B]" : "text-[#B9C7C0] hover:bg-white/5")}>
              <Icon name={icon} size={18} stroke={1.8} /><span className="flex-1">{label}</span>
              {id === "prescriptions" && pendingRx > 0 && <span className="font-mono text-[11px] font-semibold bg-[#E8962E] text-ink px-2 py-0.5 rounded-full">{pendingRx}</span>}
            </Link>
          ))}
        </nav>
        <div className={cx("mt-auto p-4 flex-col gap-2", mobileNav ? "flex" : "hidden lg:flex")}>
          <Link to="/" className="flex items-center gap-2 text-sm text-[#B9C7C0] no-underline hover:text-white px-2 min-h-[40px]"><Icon name="store" size={16} />View storefront</Link>
          <div className="p-3 rounded-xl bg-[#1A2A24] flex items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-[#2E4A3F] grid place-items-center font-bold text-lime text-sm">{me.name.slice(0, 2).toUpperCase()}</span>
            <span className="flex-1 min-w-0 text-sm"><span className="block text-white font-semibold truncate">{me.name}</span><span className="block text-[#9FB0A8] truncate text-xs">{me.email}</span></span>
            <button type="button" aria-label="Sign out" onClick={() => { logout(); navigate("/admin"); }} className="w-9 h-9 grid place-items-center rounded-lg hover:bg-white/10"><Icon name="logout" size={16} /></button>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 px-4 sm:px-8 py-7 pb-20">
        {sec === "overview" && <Overview />}
        {sec === "prescriptions" && <RxSection />}
        {sec === "orders" && <OrdersSection />}
        {sec === "inventory" && <Inventory />}
        {sec === "customers" && <Customers />}
        {sec === "analytics" && <Analytics />}
        {sec === "settings" && <Settings />}
      </main>
    </div>
  );
}

function AdminLogin({ signedInAs }: { signedInAs?: string }) {
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="min-h-screen bg-ink grid place-items-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 fade-up">
        <div className="flex items-center gap-2.5 mb-6"><Logo /><span className="font-display font-extrabold text-2xl tracking-tight">GenMedics</span><span className="font-mono text-[10px] tracking-widest bg-ink text-lime px-1.5 py-0.5 rounded">OPS</span></div>
        <h1 className="h-display text-4xl mb-2">Admin console</h1>
        <p className="text-body mb-6">Sign in with a pharmacist or admin account.{signedInAs && <> You're signed in as <strong>{signedInAs}</strong>, which isn't an admin.</>}</p>
        <form className="flex flex-col gap-4" onSubmit={async (e) => { e.preventDefault(); setErr(""); setBusy(true); try { await login(f.email, f.password, true); toast("Welcome to the console"); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } }}>
          <Field label="Email"><input className="input" type="email" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Password"><input className="input" type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          {err && <p role="alert" className="text-sm text-danger bg-danger-bg rounded-lg px-3 py-2">{err}</p>}
          <button className="btn-primary h-12" disabled={busy}>{busy && <Spinner />}Sign in</button>
        </form>
        <div className="mt-5 rounded-xl bg-pine-tint border border-dashed border-[#9CC5B2] p-3 text-sm flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-xs">Demo admin: {DEMO_ACCOUNTS.admin.email} / {DEMO_ACCOUNTS.admin.password}</span>
          <button type="button" className="text-pine font-semibold underline min-h-[32px]" onClick={() => setF({ email: DEMO_ACCOUNTS.admin.email, password: DEMO_ACCOUNTS.admin.password })}>Fill in</button>
        </div>
        <Link to="/" className="inline-flex items-center gap-2 mt-6 text-sm font-semibold"><Icon name="back" size={16} />Back to the store</Link>
      </div>
    </div>
  );
}

function Head({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between items-end gap-4 mb-6">
      <div><h1 className="h-display text-4xl">{title}</h1>{sub && <p className="text-sm text-muted mt-1">{sub}</p>}</div>
      <div className="flex flex-wrap gap-2.5 items-center">{children}</div>
    </div>
  );
}

const live = (o: Order) => o.status !== "cancelled";
function useUsersById() { const db = useDB(); return useMemo(() => new Map(db.users.map((u) => [u.id, u])), [db.users]); }

function Overview() {
  const db = useDB();
  const { meds } = useCatalog();
  const users = useUsersById();
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const today = new Date().toDateString();
  const todays = db.orders.filter((o) => live(o) && new Date(o.createdAt).toDateString() === today);
  const low = meds.filter((m) => m.stock < LOW_STOCK).sort((a, b) => a.stock - b.stock);
  const pending = db.prescriptions.filter((p) => p.status === "pending");
  const kpis = [
    ["Revenue today", inr0(todays.reduce((s, o) => s + o.total, 0)), `${todays.length} orders today`],
    ["Open orders", String(db.orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length), `${db.orders.length} all time`],
    ["Rx to verify", String(pending.length), "Before dispatch"],
    ["Low-stock SKUs", String(low.length), `Below ${LOW_STOCK} units`],
  ];
  const orders = db.orders.filter((o) => filter === "all" || o.status === filter).slice(0, 8);
  return (
    <>
      <Head title="Overview" sub={isApi() ? "Live from the GenMedics API · PostgreSQL" : "Live from this browser's demo database"}>
        {isApi() ? <span className="pill bg-pine-soft text-pine border border-[#9CC5B2] py-1.5 px-2.5">● LIVE API</span> : <span className="pill bg-warn-bg text-[#8A3606] border border-warn-line py-1.5 px-2.5">DEMO DATA</span>}
        <Link to="/admin/inventory?new=1" className="btn-primary no-underline"><Icon name="plus" size={16} />Add medicine</Link>
      </Head>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        {kpis.map(([l, v, n]) => (
          <div key={l} className="card p-5"><div className="eyebrow text-[11px] text-muted">{l}</div><div className="font-mono text-[32px] font-semibold tracking-tight mt-2 mb-1">{v}</div><div className="text-sm text-body">{n}</div></div>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 mt-4">
        <section className="card p-5 flex-[3_1_460px] min-w-0">
          <div className="flex justify-between items-center mb-2"><h2 className="font-display text-xl font-bold">Prescriptions to verify</h2><Link to="/admin/prescriptions" className="text-sm font-semibold">All →</Link></div>
          {!pending.length && <p className="text-muted text-sm py-4">Queue is clear.</p>}
          {pending.slice(0, 4).map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 py-3.5 border-t border-dashed border-line">
              <RxThumb p={p} />
              <div className="flex-[1_1_200px] min-w-0">
                <div className="font-semibold truncate">{p.id} · {users.get(p.userId)?.name || "Customer"}</div>
                <div className="font-mono text-xs text-muted mt-0.5 truncate">OCR {p.confidence.toFixed(2)} · {p.matches.length} matched · {timeAgo(p.createdAt)}</div>
              </div>
              <div className="flex gap-2">
                <Link to={`/admin/prescriptions?id=${p.id}`} className="btn-ghost h-10 min-h-0 no-underline">Review</Link>
                <button type="button" className="btn-primary h-10 min-h-0" onClick={() => reviewPrescription(p.id, "approved").then(() => toast(`${p.id} approved`), (x) => toast(x.message, { tone: "err" }))}>Approve</button>
              </div>
            </div>
          ))}
        </section>
        <section className="card p-5 flex-[2_1_300px] min-w-0">
          <div className="flex justify-between items-center mb-3.5"><h2 className="font-display text-xl font-bold">Running low</h2><Link to="/admin/inventory?low=1" className="text-sm font-semibold">All →</Link></div>
          <div className="flex flex-col gap-4">
            {low.slice(0, 5).map((m) => (
              <div key={m.id}>
                <div className="flex justify-between gap-3 text-sm mb-1.5"><span className="font-semibold truncate">{m.name}</span><span className="font-mono text-muted shrink-0">{m.stock} / {LOW_STOCK}</span></div>
                <div className="h-2 rounded-full bg-[#EEF0EC]"><div className="h-2 rounded-full" style={{ width: Math.max(3, (m.stock / LOW_STOCK) * 100) + "%", background: m.stock < LOW_STOCK * 0.4 ? "#B54708" : "#E8962E" }} /></div>
              </div>
            ))}
            {!low.length && <p className="text-muted text-sm">All SKUs above threshold.</p>}
          </div>
          {low.length > 0 && <button type="button" className="btn-ghost w-full mt-5" onClick={async () => { try { for (const m of low) await patchMed(m.id, { stock: m.stock + 200 }); toast(`Restocked ${low.length} SKUs (+200 each)`); } catch (x: any) { toast(x.message, { tone: "err" }); } }}>Restock all (+200)</button>}
        </section>
      </div>
      <section className="card p-5 mt-4">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-3.5">
          <h2 className="font-display text-xl font-bold">Recent orders</h2>
          <StatusChips value={filter} onChange={setFilter} />
        </div>
        <OrdersTable orders={orders} />
      </section>
    </>
  );
}

function RxThumb({ p, big }: { p: Prescription; big?: boolean }) {
  return (
    <div className={cx("rounded-md bg-[#FBFBF8] border border-line overflow-hidden shrink-0 grid place-items-center", big ? "w-full aspect-[3/4]" : "w-11 h-14")}>
      {p.image ? <img src={assetUrl(p.image)} alt={big ? `Prescription ${p.id}` : ""} className={big ? "w-full h-full object-contain" : "w-full h-full object-cover"} />
        : <div className="w-full h-full p-2 flex flex-col gap-1"><span className="h-[3px] bg-[#C9D1CA]" /><span className="h-[3px] bg-lime" /><span className="h-[3px] bg-lime" /><span className="h-[3px] w-3/5 bg-[#C9D1CA]" /></div>}
    </div>
  );
}

function StatusChips<T extends string>({ value, onChange, options = ["all", ...ORDER_FLOW, "cancelled"] as any }: { value: T; onChange: (v: T) => void; options?: T[] }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
      {options.map((s) => <button key={s} type="button" aria-pressed={value === s} onClick={() => onChange(s)} className={cx("h-9 px-3 rounded-full text-[13px] font-semibold border capitalize", value === s ? "bg-ink text-white border-ink" : "bg-white text-body border-line hover:border-ink")}>{s}</button>)}
    </div>
  );
}

function OrdersTable({ orders }: { orders: Order[] }) {
  const users = useUsersById();
  if (!orders.length) return <p className="text-muted text-sm py-6 text-center">No orders here.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-sm border-collapse">
        <thead><tr className="text-left font-mono text-[11px] tracking-[.08em] text-muted"><th className="px-3 py-2.5 font-medium">ORDER</th><th className="px-3 py-2.5 font-medium">CUSTOMER</th><th className="px-3 py-2.5 font-medium">ITEMS</th><th className="px-3 py-2.5 font-medium">AMOUNT</th><th className="px-3 py-2.5 font-medium">STATUS</th><th className="px-3 py-2.5 font-medium">PLACED</th><th className="px-3 py-2.5" /></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-t border-[#EEF0EC]">
              <td className="px-3 py-3 font-mono font-semibold">#{o.id}</td>
              <td className="px-3 py-3">{users.get(o.userId)?.name || o.address.name}</td>
              <td className="px-3 py-3 text-body">{o.items.reduce((n, i) => n + i.qty, 0)} items{o.rxId ? " · Rx" : ""}</td>
              <td className="px-3 py-3 font-mono">{inr(o.total)}</td>
              <td className="px-3 py-3"><OrderPill status={o.status} /></td>
              <td className="px-3 py-3 font-mono text-muted">{timeAgo(o.createdAt)}</td>
              <td className="px-3 py-3 text-right"><Link to={`/admin/orders?id=${o.id}`} className="font-semibold">Open</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function useQueryParam(name: string) {
  const h = location.hash.split("?")[1] || "";
  return new URLSearchParams(h).get(name);
}

function RxSection() {
  const db = useDB();
  const users = useUsersById();
  const { byId } = useCatalog();
  const [filter, setFilter] = useState<"pending" | RxStatus | "all">("pending");
  const openId = useQueryParam("id");
  const [note, setNote] = useState("");
  const list = db.prescriptions.filter((p) => filter === "all" || p.status === filter);
  const open = db.prescriptions.find((p) => p.id === openId);
  const close = () => { setNote(""); navigate("/admin/prescriptions", true); };
  const decide = async (s: RxStatus) => { if (!open) return; if (s === "rejected" && !note.trim()) { toast("Add a note telling the customer what's wrong", { tone: "err" }); return; } try { await reviewPrescription(open.id, s, note); toast(`${open.id} ${s}`); close(); } catch (x: any) { toast(x.message, { tone: "err" }); } };
  return (
    <>
      <Head title="Prescriptions" sub="Verify OCR matches before orders are packed"><StatusChips value={filter} onChange={setFilter} options={["pending", "approved", "rejected", "all"] as any} /></Head>
      {!list.length ? <div className="card p-10 text-center text-muted">Nothing here.</div> : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
          {list.map((p) => (
            <article key={p.id} className="card p-4 flex gap-4">
              <RxThumb p={p} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2"><span className="font-mono font-semibold">{p.id}</span><RxPill status={p.status} /></div>
                <div className="text-sm mt-1">{users.get(p.userId)?.name || "Customer"} · <span className="text-muted">{timeAgo(p.createdAt)}</span></div>
                <div className="text-sm text-body mt-1 line-clamp-2">{p.matches.map((m) => m.name).join(", ") || "No matches"}</div>
                <Link to={`/admin/prescriptions?id=${p.id}`} className="inline-block mt-2 font-semibold text-sm">Review →</Link>
              </div>
            </article>
          ))}
        </div>
      )}
      <Modal open={!!open} onClose={close} title={open ? `Prescription ${open.id}` : ""} wide>
        {open && (
          <div className="flex flex-wrap gap-5">
            <div className="flex-[1_1_220px] min-w-0"><RxThumb p={open} big /></div>
            <div className="flex-[2_1_300px] min-w-0 flex flex-col gap-3 text-sm">
              <div className="flex flex-wrap gap-2 items-center"><RxPill status={open.status} /><span className="text-muted">{users.get(open.userId)?.name} · {fmtDate(open.createdAt, true)} · OCR {open.confidence.toFixed(2)}</span></div>
              <div>
                <div className="eyebrow text-muted mb-1.5">Matched medicines</div>
                <ul className="flex flex-col gap-1.5">{open.matches.map((m) => (
                  <li key={m.medId} className="flex justify-between gap-3 rounded-lg bg-paper px-3 py-2"><span className="min-w-0"><span className="font-mono text-xs text-muted block truncate">“{m.line}”</span><span className="font-semibold">{byId.get(m.medId)?.name || m.name}</span></span><span className="font-mono">{m.score.toFixed(2)}</span></li>
                ))}{!open.matches.length && <li className="text-muted">None</li>}</ul>
              </div>
              <details><summary className="cursor-pointer font-semibold min-h-[32px]">OCR text</summary><pre className="whitespace-pre-wrap font-mono text-xs bg-paper rounded-lg p-3 mt-2 max-h-40 overflow-auto">{open.text || "—"}</pre></details>
              {open.note && <p className="text-body">Note: “{open.note}”</p>}
              <Field label="Note to customer (required to reject)"><textarea className="input h-20 py-2.5" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary" onClick={() => decide("approved")}><Icon name="check" size={16} />Approve</button>
                <button type="button" className="btn-danger" onClick={() => decide("rejected")}>Reject</button>
                {open.status !== "pending" && <button type="button" className="btn-ghost" onClick={() => decide("pending")}>Back to queue</button>}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function OrdersSection() {
  const db = useDB();
  const users = useUsersById();
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [q, setQ] = useState("");
  const [note, setNote] = useState("");
  const openId = Number(useQueryParam("id"));
  const open = db.orders.find((o) => o.id === openId);
  const rx = open?.rxId ? db.prescriptions.find((p) => p.id === open.rxId) : undefined;
  const list = db.orders.filter((o) => (filter === "all" || o.status === filter) && (!q || String(o.id).includes(q.replace("#", "")) || (users.get(o.userId)?.name || o.address.name).toLowerCase().includes(q.toLowerCase())));
  const close = () => { setNote(""); navigate("/admin/orders", true); };
  const nextStatus = open && open.status !== "cancelled" ? ORDER_FLOW[ORDER_FLOW.indexOf(open.status) + 1] : undefined;
  const advance = async (s: OrderStatus) => {
    if (!open) return;
    if (s === "confirmed" && open.rxId && rx && rx.status !== "approved" && db.settings.rxCheck) { toast(`Approve prescription ${open.rxId} first`, { tone: "err" }); return; }
    try { await setOrderStatus(open.id, s, note); setNote(""); toast(`#${open.id} → ${s}`); } catch (x: any) { toast(x.message, { tone: "err" }); }
  };
  return (
    <>
      <Head title="Orders" sub={`${db.orders.length} orders`}>
        <label className="relative"><span className="sr-only-x">Search orders</span><input className="input h-10 w-56 pl-9" placeholder="Order # or customer" value={q} onChange={(e) => setQ(e.target.value)} /><Icon name="search" size={16} className="absolute left-3 top-3 text-muted" /></label>
      </Head>
      <div className="mb-4"><StatusChips value={filter} onChange={setFilter} /></div>
      <section className="card p-4"><OrdersTable orders={list} /></section>
      <Modal open={!!open} onClose={close} title={open ? `Order #${open.id}` : ""} wide>
        {open && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex flex-wrap items-center gap-2"><OrderPill status={open.status} /><span className="text-muted">{users.get(open.userId)?.name} · {fmtDate(open.createdAt, true)} · {open.payment.toUpperCase()}</span></div>
            <ol className="flex flex-wrap gap-1.5">{open.history.map((h) => <li key={h.at} className="font-mono text-[11px] bg-paper rounded-md px-2 py-1">{h.status} · {fmtDate(h.at, true)}{h.note ? ` · “${h.note}”` : ""}</li>)}</ol>
            <ul className="divide-y divide-line border-y border-line">{open.items.map((i) => <li key={i.id} className="flex justify-between gap-3 py-2"><span>{i.qty} × {i.name}{i.rx && <span className="pill bg-white text-warn border border-warn-line ml-2">Rx</span>}</span><span className="font-mono">{inr(i.price * i.qty)}</span></li>)}</ul>
            <div className="flex justify-between font-mono font-semibold"><span>TOTAL</span><span>{inr(open.total)}</span></div>
            <p className="text-body">{open.address.name} · {open.address.phone}<br />{open.address.line1}, {open.address.city}, {open.address.state} {open.address.pincode}</p>
            {open.rxId && <p className="flex flex-wrap items-center gap-2">Prescription <Link to={`/admin/prescriptions?id=${open.rxId}`} className="font-mono font-semibold">{open.rxId}</Link>{rx && <RxPill status={rx.status} />}</p>}
            {open.status !== "cancelled" && open.status !== "delivered" && (
              <>
                <Field label="Note (optional, shown to customer)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
                <div className="flex flex-wrap gap-2">
                  {nextStatus && <button type="button" className="btn-primary" onClick={() => advance(nextStatus)}>Mark as {nextStatus}</button>}
                  <label className="flex items-center gap-2"><span className="sr-only-x">Set status</span>
                    <select className="input h-11 w-auto" value={open.status} onChange={(e) => advance(e.target.value as OrderStatus)}>{[...ORDER_FLOW, "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
                  </label>
                  <button type="button" className="btn-danger" onClick={() => advance("cancelled")}>Cancel order</button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

const PAGE = 50;
function Inventory() {
  const { meds, ready } = useCatalog();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | Category>("all");
  const [lowOnly, setLowOnly] = useState(useQueryParam("low") === "1");
  const [page, setPage] = useState(0);
  const [edit, setEdit] = useState<Med | "new" | null>(useQueryParam("new") === "1" ? "new" : null);
  const [del, setDel] = useState<Med | null>(null);
  const list = useMemo(() => {
    let l = q ? searchMeds(meds, q) : meds;
    if (cat !== "all") l = l.filter((m) => m.cat === cat);
    if (lowOnly) l = l.filter((m) => m.stock < LOW_STOCK).sort((a, b) => a.stock - b.stock);
    return l;
  }, [meds, q, cat, lowOnly]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const view = list.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <>
      <Head title="Inventory" sub={ready ? `${meds.length.toLocaleString("en-IN")} SKUs · ${meds.filter((m) => m.stock < LOW_STOCK).length} low` : "Loading…"}>
        <button type="button" className="btn-primary" onClick={() => setEdit("new")}><Icon name="plus" size={16} />Add medicine</button>
      </Head>
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <label className="relative flex-[1_1_260px]"><span className="sr-only-x">Search inventory</span><input className="input pl-10" placeholder="Search name, salt or brand" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /><Icon name="search" size={18} className="absolute left-3.5 top-3.5 text-muted" /></label>
        <label><span className="sr-only-x">Category</span><select className="input w-auto" value={cat} onChange={(e) => { setCat(e.target.value as any); setPage(0); }}><option value="all">All categories</option>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.en}</option>)}</select></label>
        <label className="flex items-center gap-2 min-h-[44px] cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-pine" checked={lowOnly} onChange={(e) => { setLowOnly(e.target.checked); setPage(0); }} />Low stock only</label>
      </div>
      <section className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm border-collapse">
          <thead><tr className="text-left font-mono text-[11px] tracking-[.08em] text-muted"><th className="px-4 py-3 font-medium">MEDICINE</th><th className="px-4 py-3 font-medium">CATEGORY</th><th className="px-4 py-3 font-medium">PACK</th><th className="px-4 py-3 font-medium">MRP</th><th className="px-4 py-3 font-medium">STOCK</th><th className="px-4 py-3 font-medium">RX</th><th className="px-4 py-3" /></tr></thead>
          <tbody>
            {view.map((m) => (
              <tr key={m.id} className="border-t border-[#EEF0EC]">
                <td className="px-4 py-3 max-w-[340px]"><div className="font-semibold truncate">{m.name}</div><div className="font-mono text-[11px] text-muted">#{m.id}{m.custom ? " · added" : ""}</div></td>
                <td className="px-4 py-3"><span className="inline-flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: catInfo(m.cat).color }} />{catInfo(m.cat).en}</span></td>
                <td className="px-4 py-3 text-body">{m.pack}</td>
                <td className="px-4 py-3 font-mono">{inr(m.price)}</td>
                <td className="px-4 py-3"><span className={cx("font-mono font-semibold", m.stock <= 0 ? "text-danger" : m.stock < LOW_STOCK ? "text-warn" : "")}>{m.stock}</span></td>
                <td className="px-4 py-3">{m.rx ? <span className="pill bg-white text-warn border border-warn-line">Rx</span> : <span className="text-muted">OTC</span>}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button type="button" className="px-2 min-h-[36px] font-semibold text-pine" onClick={() => setEdit(m)}>Edit</button>
                  <button type="button" className="px-2 min-h-[36px] font-semibold text-danger" onClick={() => setDel(m)}>Delete</button>
                </td>
              </tr>
            ))}
            {!view.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted">{ready ? "No medicines match." : "Loading…"}</td></tr>}
          </tbody>
        </table>
      </section>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button type="button" className="btn-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="font-mono text-sm">{page + 1} / {pages}</span>
          <button type="button" className="btn-ghost" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
      <MedEditor med={edit} onClose={() => { setEdit(null); if (location.hash.includes("new=1")) navigate("/admin/inventory", true); }} />
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete medicine?">
        {del && <><p className="text-body mb-5"><strong>{del.name}</strong> will be removed from the store and from any carts.</p>
          <div className="flex gap-2"><button className="btn-danger" onClick={async () => { try { await deleteMed(del.id); toast(`Deleted ${del.name}`); } catch (x: any) { toast(x.message, { tone: "err" }); } setDel(null); }}>Delete</button><button className="btn-ghost" onClick={() => setDel(null)}>Cancel</button></div></>}
      </Modal>
    </>
  );
}

function MedEditor({ med, onClose }: { med: Med | "new" | null; onClose: () => void }) {
  const isNew = med === "new";
  const m = med && med !== "new" ? med : null;
  const [f, setF] = useState<any>({});
  const [err, setErr] = useState("");
  const key = isNew ? "new" : m?.id;
  const [lastKey, setLastKey] = useState<any>(null);
  if (med && key !== lastKey) {
    setLastKey(key);
    setF(m ? { name: m.name, price: String(m.price), stock: String(m.stock), pack: m.pack, count: String(m.count), cat: m.cat, rx: m.rx, use: m.use, form: m.form }
      : { name: "", price: "", stock: "100", pack: "10's", count: "10", cat: "other", rx: true, use: "", form: "Tablet" });
    setErr("");
  }
  if (!med && lastKey !== null) setLastKey(null);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    const price = Number(f.price), stock = Math.round(Number(f.stock)), count = Math.max(1, Math.round(Number(f.count) || 1));
    if (!f.name.trim()) return setErr("Name is required");
    if (!(price > 0)) return setErr("Price must be greater than 0");
    if (!(stock >= 0)) return setErr("Stock can't be negative");
    try {
      if (isNew) { await addMed({ name: f.name.trim(), price, stock, pack: f.pack, count, cat: f.cat, rx: !!f.rx, use: f.use, form: f.form }); toast(`Added ${f.name}`); }
      else if (m) { await patchMed(m.id, { name: f.name.trim(), price, stock, pack: f.pack, cat: f.cat, rx: !!f.rx, use: f.use }); toast(`Saved ${f.name}`); }
      onClose();
    } catch (x: any) { setErr(x.message); }
  };
  const u = (k: string) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  return (
    <Modal open={!!med} onClose={onClose} title={isNew ? "Add medicine" : "Edit medicine"} wide>
      <form onSubmit={save} className="grid sm:grid-cols-2 gap-4" noValidate>
        <div className="sm:col-span-2"><Field label="Name"><input className="input" value={f.name || ""} onChange={u("name")} /></Field></div>
        <Field label="MRP (₹, per pack)"><input className="input" inputMode="decimal" value={f.price || ""} onChange={u("price")} /></Field>
        <Field label="Stock (packs)"><input className="input" inputMode="numeric" value={f.stock || ""} onChange={u("stock")} /></Field>
        <Field label="Pack label"><input className="input" value={f.pack || ""} onChange={u("pack")} /></Field>
        {isNew && <Field label="Units per pack"><input className="input" inputMode="numeric" value={f.count || ""} onChange={u("count")} /></Field>}
        <Field label="Category"><select className="input" value={f.cat} onChange={u("cat")}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.en}</option>)}</select></Field>
        {isNew && <Field label="Form"><select className="input" value={f.form} onChange={u("form")}>{["Tablet", "Capsule", "Syrup", "Injection", "Cream", "Drops", "Inhaler", "Powder", "Other"].map((x) => <option key={x}>{x}</option>)}</select></Field>}
        <div className="sm:col-span-2"><Field label="Used for"><input className="input" value={f.use || ""} onChange={u("use")} /></Field></div>
        <label className="flex items-center gap-3 min-h-[44px] cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-pine" checked={!!f.rx} onChange={u("rx")} />Prescription required</label>
        {err && <p role="alert" className="sm:col-span-2 text-sm text-danger bg-danger-bg rounded-lg px-3 py-2">{err}</p>}
        <div className="sm:col-span-2 flex gap-2"><button className="btn-primary">{isNew ? "Add medicine" : "Save changes"}</button><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button></div>
      </form>
    </Modal>
  );
}

function Customers() {
  const db = useDB();
  const rows = db.users.map((u) => {
    const os = db.orders.filter((o) => o.userId === u.id);
    return { u, n: os.length, spend: os.filter(live).reduce((s, o) => s + o.total, 0), last: os[0]?.createdAt, rx: db.prescriptions.filter((p) => p.userId === u.id).length };
  });
  return (
    <>
      <Head title="Customers" sub={`${db.users.filter((u) => !u.admin).length} customers · ${db.users.filter((u) => u.admin).length} staff`} />
      <section className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm border-collapse">
          <thead><tr className="text-left font-mono text-[11px] tracking-[.08em] text-muted"><th className="px-4 py-3 font-medium">NAME</th><th className="px-4 py-3 font-medium">EMAIL</th><th className="px-4 py-3 font-medium">ROLE</th><th className="px-4 py-3 font-medium">ORDERS</th><th className="px-4 py-3 font-medium">SPEND</th><th className="px-4 py-3 font-medium">RX</th><th className="px-4 py-3 font-medium">JOINED</th></tr></thead>
          <tbody>{rows.map(({ u, n, spend, rx }) => (
            <tr key={u.id} className="border-t border-[#EEF0EC]">
              <td className="px-4 py-3 font-semibold">{u.name}</td><td className="px-4 py-3 text-body">{u.email}</td>
              <td className="px-4 py-3">{u.admin ? <span className="pill bg-ink text-lime">ADMIN</span> : <span className="text-muted">Customer</span>}</td>
              <td className="px-4 py-3 font-mono">{n}</td><td className="px-4 py-3 font-mono">{inr(spend)}</td><td className="px-4 py-3 font-mono">{rx}</td>
              <td className="px-4 py-3 font-mono text-muted">{fmtDate(u.createdAt)}</td>
            </tr>))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function Bars({ data, fmt = (n: number) => String(n), color = "#0F5B43" }: { data: { label: string; value: number }[]; fmt?: (n: number) => string; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((d) => (
        <div key={d.label} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-body capitalize">{d.label}</span>
          <span className="h-3 rounded-full bg-[#EEF0EC]"><span className="block h-3 rounded-full" style={{ width: Math.max(d.value ? 2 : 0, (d.value / max) * 100) + "%", background: color }} /></span>
          <span className="font-mono text-xs w-20 text-right">{fmt(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

function Analytics() {
  const db = useDB();
  const { byId } = useCatalog();
  const orders = db.orders.filter(live);
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const saved = orders.reduce((s, o) => s + Math.max(0, o.brandTotal - o.subtotal), 0);
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (13 - i)); return d; });
  const daily = days.map((d) => ({ d, v: orders.filter((o) => new Date(o.createdAt).toDateString() === d.toDateString()).reduce((s, o) => s + o.total, 0) }));
  const maxDay = Math.max(1, ...daily.map((x) => x.v));
  const byStatus = [...ORDER_FLOW, "cancelled" as const].map((s) => ({ label: s, value: db.orders.filter((o) => o.status === s).length }));
  const catRev = new Map<string, number>();
  for (const o of orders) for (const i of o.items) { const c = catInfo(byId.get(i.id)?.cat || "other").en; catRev.set(c, (catRev.get(c) || 0) + i.price * i.qty); }
  const cats = [...catRev.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  return (
    <>
      <Head title="Analytics" sub={isApi() ? "Computed from orders in PostgreSQL" : "Computed from orders in this browser"} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 mb-4">
        {[["Revenue", inr0(revenue)], ["Orders", String(orders.length)], ["Avg. order", inr(orders.length ? revenue / orders.length : 0)], ["Saved for customers", inr0(saved)]].map(([l, v]) => (
          <div key={l} className="card p-5"><div className="eyebrow text-[11px] text-muted">{l}</div><div className="font-mono text-3xl font-semibold mt-2">{v}</div></div>
        ))}
      </div>
      <section className="card p-5 mb-4">
        <h2 className="font-display text-xl font-bold mb-4">Revenue, last 14 days</h2>
        <div className="flex items-end gap-1.5 h-48" role="img" aria-label="Daily revenue bar chart">
          {daily.map((x) => (
            <div key={+x.d} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
              <span className="font-mono text-[10px] text-muted opacity-0 group-hover:opacity-100">{x.v ? inr0(x.v) : ""}</span>
              <span className="w-full rounded-t-md bg-pine" style={{ height: x.v ? Math.max(4, (x.v / maxDay) * 85) + "%" : "2px", opacity: x.v ? 1 : 0.2 }} title={`${x.d.toDateString()}: ${inr(x.v)}`} />
              <span className="font-mono text-[10px] text-muted">{x.d.getDate()}</span>
            </div>
          ))}
        </div>
      </section>
      <div className="flex flex-wrap gap-4">
        <section className="card p-5 flex-[1_1_320px]"><h2 className="font-display text-xl font-bold mb-4">Orders by status</h2><Bars data={byStatus} /></section>
        <section className="card p-5 flex-[1_1_320px]"><h2 className="font-display text-xl font-bold mb-4">Revenue by category</h2>{cats.length ? <Bars data={cats} fmt={inr0} color="#CDEB6B" /> : <p className="text-muted text-sm">No sales yet.</p>}</section>
      </div>
    </>
  );
}

function Settings() {
  const db = useDB();
  const [f, setF] = useState({ ...db.settings, freeAbove: String(db.settings.freeAbove), fee: String(db.settings.fee) });
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Head title="Settings" />
      <form className="card p-6 grid sm:grid-cols-2 gap-5 max-w-3xl" onSubmit={async (e) => { e.preventDefault(); try { await updateSettings({ portalTitle: f.portalTitle, freeAbove: Math.max(0, Number(f.freeAbove) || 0), fee: Math.max(0, Number(f.fee) || 0), rxCheck: f.rxCheck, cod: f.cod || !f.upi, upi: f.upi }); toast("Settings saved"); } catch (x: any) { toast(x.message, { tone: "err" }); } }}>
        <div className="sm:col-span-2"><Field label="Portal display title"><input className="input" value={f.portalTitle} onChange={(e) => setF({ ...f, portalTitle: e.target.value })} /></Field></div>
        <Field label="Free delivery above (₹)"><input className="input" inputMode="numeric" value={f.freeAbove} onChange={(e) => setF({ ...f, freeAbove: e.target.value })} /></Field>
        <Field label="Delivery fee (₹)"><input className="input" inputMode="numeric" value={f.fee} onChange={(e) => setF({ ...f, fee: e.target.value })} /></Field>
        {([["rxCheck", "Require a prescription for Rx medicines at checkout"], ["cod", "Accept cash on delivery"], ["upi", "Accept UPI on delivery"]] as const).map(([k, l]) => (
          <label key={k} className="sm:col-span-2 flex items-center gap-3 min-h-[44px] cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-pine" checked={(f as any)[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} />{l}</label>
        ))}
        <div className="sm:col-span-2"><button className="btn-primary">Save settings</button></div>
      </form>
      {!isApi() && <section className="card p-6 mt-4 max-w-3xl border-[#F4C7C3]">
        <h2 className="font-display text-xl font-bold">Reset demo data</h2>
        <p className="text-body text-sm mt-1 mb-4">Clears every account, order, prescription and inventory edit stored in this browser and restores the sample data.</p>
        {confirm ? <div className="flex gap-2"><button className="btn-danger" onClick={() => { resetDemo(); toast("Demo data reset"); navigate("/admin"); }}>Yes, reset everything</button><button className="btn-ghost" onClick={() => setConfirm(false)}>Cancel</button></div>
          : <button className="btn-danger" onClick={() => setConfirm(true)}><Icon name="refresh" size={16} />Reset demo data</button>}
      </section>}
    </>
  );
}
