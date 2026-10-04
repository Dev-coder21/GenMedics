import React, { useEffect, useRef, useState } from "react";
import { DEMO_ACCOUNTS, currentUser, getDB, isApi, login, logout, register, setLang, useDB } from "../lib/store.js";
import { API, apiCandidate } from "../lib/api.js";
import { useT } from "../lib/i18n.js";
import { Link, navigate, useRoute } from "../lib/router.js";
import { closeAuth, closeChat, dismissToast, openAuth, openChat, toast, useUI } from "../lib/ui.js";
import { inr0, cx } from "../lib/format.js";
import { Icon, Logo } from "./Icon.js";
import { Field, Modal, Spinner } from "./bits.js";
import { useCatalog, searchMeds } from "../lib/catalog.js";
import { answer } from "../lib/assistant.js";

export function Header() {
  const t = useT();
  const db = useDB();
  const me = currentUser(db);
  const { path, query } = useRoute();
  const [q, setQ] = useState(query.get("q") || "");
  const [menu, setMenu] = useState(false);
  const count = db.cart.reduce((n, c) => n + c.qty, 0);
  useEffect(() => { setMenu(false); }, [path]);
  useEffect(() => { if (path === "/medicines") setQ(query.get("q") || ""); }, [path, query.get("q")]);
  const submit = (e: React.FormEvent) => { e.preventDefault(); navigate(`/medicines${q.trim() ? "?q=" + encodeURIComponent(q.trim()) : ""}`); };
  const navLink = (to: string, label: string) => (
    <Link to={to} aria-current={path.startsWith(to) ? "page" : undefined}
      className={cx("px-3.5 py-2.5 rounded-full text-[15px] no-underline text-ink hover:bg-field", path.startsWith(to) ? "font-bold" : "font-medium")}>{label}</Link>
  );
  return (
    <>
      <div className="bg-ink text-[#DCE6E0] font-mono text-xs tracking-[.04em]">
        <div className="wrap py-2 flex flex-wrap gap-x-6 gap-y-1 justify-between">
          <span className="uppercase">{t("util_strip")}</span>
          <span className="flex items-center gap-4">
            <span className="text-lime">{t("util_free", { n: inr0(db.settings.freeAbove) })}</span>
            <button type="button" onClick={() => setLang(db.lang === "en" ? "hi" : "en")} className="flex items-center gap-1.5 hover:text-white min-h-[24px]" aria-label="Switch language">
              <Icon name="globe" size={14} /> {t("lang")}
            </button>
          </span>
        </div>
      </div>
      <header className="bg-white border-b border-line sticky top-0 z-30">
        <div className="wrap py-3 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link to="/" className="flex items-center gap-2.5 no-underline text-ink">
            <Logo />
            <span className="font-display font-extrabold text-[22px] tracking-tight">GenMedics</span>
          </Link>
          <form onSubmit={submit} role="search" className="order-3 lg:order-none basis-full lg:basis-auto flex-1 flex items-center gap-2.5 bg-field border border-line rounded-full pl-4 pr-1.5 h-12 focus-within:border-pine">
            <Icon name="search" size={18} className="text-muted shrink-0" />
            <label className="sr-only-x" htmlFor="site-search">{t("search_label")}</label>
            <input id="site-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search_ph")}
              className="flex-1 min-w-0 bg-transparent outline-none text-[15px]" autoComplete="off" />
            <button type="submit" className="h-9 px-4 rounded-full bg-ink text-white text-sm font-semibold">{t("search_label").split(" ")[0]}</button>
          </form>
          <nav aria-label="Primary" className="ml-auto flex items-center gap-1">
            <div className="hidden md:flex items-center gap-1">
              {navLink("/medicines", t("nav_medicines"))}
              {navLink("/prescriptions", t("nav_scan"))}
              {navLink("/orders", t("nav_orders"))}
            </div>
            <div className="relative">
              <button type="button" onClick={() => (me ? setMenu((m) => !m) : openAuth("signin"))} aria-expanded={menu} aria-haspopup={me ? "menu" : undefined}
                className="h-11 min-w-[44px] px-2.5 rounded-full grid grid-flow-col items-center gap-2 hover:bg-field" aria-label={me ? t("nav_account") : t("nav_signin")}>
                <Icon name="user" size={20} stroke={1.8} />
                <span className="hidden sm:inline text-[15px] font-medium max-w-[120px] truncate">{me ? me.name.split(" ")[0] : t("nav_signin")}</span>
              </button>
              {menu && me && (
                <div role="menu" className="fade-up absolute right-0 mt-2 w-60 card shadow-card p-2 z-40">
                  <div className="px-3 py-2 text-sm text-muted truncate">{me.email}</div>
                  {[["/account", t("nav_account")], ["/orders", t("nav_orders")], ["/prescriptions", t("nav_scan")], ["/wishlist", t("nav_wishlist")], ...(me.admin ? [["/admin", t("nav_admin")]] : [])].map(([to, l]) => (
                    <Link key={to} role="menuitem" to={to} className="block px-3 py-2.5 rounded-lg text-ink no-underline hover:bg-field">{l}</Link>
                  ))}
                  <button role="menuitem" type="button" onClick={() => { logout(); setMenu(false); toast("Signed out"); }} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-field flex items-center gap-2"><Icon name="logout" size={16} />{t("nav_signout")}</button>
                </div>
              )}
            </div>
            <Link to="/wishlist" aria-label={t("nav_wishlist")} className="hidden sm:grid w-11 h-11 place-items-center rounded-full text-ink hover:bg-field"><Icon name="heart" size={20} stroke={1.8} /></Link>
            <Link to="/cart" className="flex items-center gap-2 h-11 px-4 rounded-full bg-pine text-white no-underline font-semibold text-[15px] hover:bg-pine-dark" aria-label={`${t("nav_cart")}, ${count}`}>
              <Icon name="cart" size={18} /><span className="hidden sm:inline">{t("nav_cart")}</span><span className="font-mono">{count}</span>
            </Link>
          </nav>
        </div>
        <div className="md:hidden border-t border-line">
          <div className="wrap flex gap-1 overflow-x-auto py-1.5">
            {navLink("/medicines", t("nav_medicines"))}
            {navLink("/prescriptions", t("nav_scan"))}
            {navLink("/orders", t("nav_orders"))}
            {navLink("/wishlist", t("nav_wishlist"))}
          </div>
        </div>
      </header>
    </>
  );
}

export function Footer() {
  const t = useT();
  const col = (title: string, links: [string, string][]) => (
    <div className="flex flex-col gap-2.5">
      <strong className="eyebrow text-[13px]">{title}</strong>
      {links.map(([to, l]) => <Link key={to} to={to} className="text-body no-underline hover:text-ink">{l}</Link>)}
    </div>
  );
  return (
    <footer className="border-t border-line mt-auto">
      <div className="wrap pt-14 pb-10 flex flex-wrap gap-10 justify-between">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5"><Logo size={28} /><span className="font-display font-extrabold text-2xl tracking-tight">GenMedics</span></div>
          <p className="text-body text-sm leading-relaxed mt-3">{t("footer_tag")}</p>
          {isApi() ? (
            <p className="text-xs mt-3 leading-relaxed flex items-center gap-2 text-pine"><span className="w-2 h-2 rounded-full bg-pine" />Connected to the GenMedics API ({API}) · PostgreSQL</p>
          ) : (
            <p className="text-muted text-xs mt-3 leading-relaxed">{t("demo_note")}{apiCandidate() ? ` Backend not found at ${apiCandidate()} — start it to switch to full-stack mode.` : ""}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-12 text-sm">
          {col(t("footer_shop"), [["/medicines", t("all_medicines")], ["/prescriptions", t("nav_scan")], ["/wishlist", t("nav_wishlist")], ["/orders", t("nav_orders")]])}
          {col(t("footer_help"), [["/page/help", t("page_help")], ["/page/shipping", t("page_shipping")], ["/page/returns", t("page_returns")]])}
          {col(t("footer_company"), [["/page/about", t("page_about")], ["/page/careers", t("page_careers")], ["/page/privacy", t("page_privacy")], ["/page/terms", t("page_terms")], ["/admin", t("nav_admin")]])}
        </div>
      </div>
      <div className="wrap py-5 border-t border-line flex flex-wrap justify-between gap-2 font-mono text-xs text-muted">
        <span>© {new Date().getFullYear()} GenMedics</span><span>Made by Dev Trivedi</span>
      </div>
    </footer>
  );
}

export function Toaster() {
  const { toasts } = useUI();
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-[min(92vw,420px)]" role="status" aria-live="polite">
      {toasts.map((x) => (
        <div key={x.id} className={cx("fade-up flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm shadow-card", x.tone === "err" ? "bg-danger text-white" : "bg-ink text-white")}>
          <span className="flex items-center gap-2 min-w-0"><Icon name={x.tone === "err" ? "warn" : "check"} size={18} className={x.tone === "err" ? "" : "text-lime"} /><span className="truncate">{x.text}</span></span>
          <span className="flex items-center gap-1 shrink-0">
            {x.action && <Link to={x.action.to} onClick={() => dismissToast(x.id)} className="text-lime font-semibold no-underline px-2 py-1">{x.action.label}</Link>}
            <button type="button" onClick={() => dismissToast(x.id)} aria-label="Dismiss" className="w-8 h-8 grid place-items-center rounded-full hover:bg-white/10"><Icon name="x" size={14} /></button>
          </span>
        </div>
      ))}
    </div>
  );
}

export function AuthModal() {
  const t = useT();
  const ui = useUI();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (ui.auth) { setMode(ui.auth); setErr(""); } }, [ui.auth]);
  const upd = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const u = mode === "signin" ? await login(f.email, f.password) : await register(f);
      toast(t("auth_welcome", { n: u.name.split(" ")[0] }));
      const next = ui.authNext; closeAuth(); setF({ name: "", email: "", phone: "", password: "" }); next?.();
    } catch (x: any) { setErr(x.message || String(x)); } finally { setBusy(false); }
  };
  return (
    <Modal open={!!ui.auth} onClose={closeAuth} title={mode === "signin" ? t("auth_signin") : t("auth_register")}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {mode === "register" && <Field label={t("auth_name")}><input className="input" value={f.name} onChange={upd("name")} autoComplete="name" required /></Field>}
        <Field label={t("auth_email")}><input className="input" type="email" value={f.email} onChange={upd("email")} autoComplete="email" required /></Field>
        {mode === "register" && <Field label={t("auth_phone")}><input className="input" type="tel" value={f.phone} onChange={upd("phone")} autoComplete="tel" /></Field>}
        <Field label={t("auth_password")} hint={mode === "register" ? "At least 6 characters" : undefined}><input className="input" type="password" value={f.password} onChange={upd("password")} autoComplete={mode === "signin" ? "current-password" : "new-password"} required /></Field>
        {err && <p role="alert" className="text-sm text-danger bg-danger-bg rounded-lg px-3 py-2">{err}</p>}
        <button className="btn-primary h-12" disabled={busy}>{busy && <Spinner />}{mode === "signin" ? t("auth_signin") : t("auth_register")}</button>
        {mode === "signin" && (
          <div className="rounded-xl bg-pine-tint border border-dashed border-[#9CC5B2] p-3 text-sm flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs">{t("auth_demo", { e: DEMO_ACCOUNTS.customer.email, p: DEMO_ACCOUNTS.customer.password })}</span>
            <button type="button" className="text-pine font-semibold underline min-h-[32px]" onClick={() => setF({ ...f, email: DEMO_ACCOUNTS.customer.email, password: DEMO_ACCOUNTS.customer.password })}>{t("auth_use_demo")}</button>
          </div>
        )}
        <p className="text-sm text-body text-center">
          {mode === "signin" ? t("auth_no_acc") : t("auth_have_acc")}{" "}
          <button type="button" className="text-pine font-semibold underline min-h-[32px]" onClick={() => { setMode(mode === "signin" ? "register" : "signin"); setErr(""); }}>{mode === "signin" ? t("auth_register") : t("auth_signin")}</button>
        </p>
      </form>
    </Modal>
  );
}

type Msg = { from: "bot" | "me"; text: string; links?: { label: string; to: string }[] };
export function ChatWidget() {
  const t = useT();
  const ui = useUI();
  const { meds } = useCatalog();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ui.chat && !msgs.length) setMsgs([{ from: "bot", text: t("chat_hello") }]); if (ui.chat) setTimeout(() => input.current?.focus(), 50); }, [ui.chat]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs]);
  const send = (q: string) => {
    if (!q.trim()) return;
    const reply = answer(q, meds, getDB());
    setMsgs((m) => [...m, { from: "me", text: q }, reply]);
    setText("");
  };
  useEffect(() => { if (ui.chat && ui.chatSeed) send(ui.chatSeed); }, [ui.chatSeed]);
  return (
    <>
      {!ui.chat && (
        <button type="button" onClick={() => openChat()} aria-label={t("chat_open")}
          className="fixed bottom-5 right-5 z-40 h-14 pl-4 pr-5 rounded-full bg-ink text-white shadow-card flex items-center gap-2 font-semibold hover:bg-black">
          <Icon name="chat" size={20} /> <span className="hidden sm:inline">{t("chat_title").replace("GenMedics ", "")}</span>
        </button>
      )}
      {ui.chat && (
        <section aria-label={t("chat_title")} className="fade-up fixed z-50 bottom-0 right-0 sm:bottom-5 sm:right-5 w-full sm:w-[380px] h-[min(560px,85vh)] bg-white sm:rounded-3xl shadow-card border border-line flex flex-col overflow-hidden">
          <div className="bg-ink text-white px-5 py-4 flex items-center justify-between">
            <div><div className="font-display font-bold text-lg">{t("chat_title")}</div><div className="text-xs text-[#B9C7C0]">{t("chat_disclaimer")}</div></div>
            <button type="button" onClick={closeChat} aria-label={t("chat_close")} className="w-11 h-11 grid place-items-center rounded-full hover:bg-white/10"><Icon name="x" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-paper" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={cx("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line", m.from === "me" ? "self-end bg-pine text-white rounded-br-md" : "self-start bg-white border border-line rounded-bl-md")}>
                {m.text}
                {m.links && <div className="mt-2 flex flex-col gap-1.5">{m.links.map((l) => <Link key={l.to + l.label} to={l.to} onClick={() => { if (innerWidth < 640) closeChat(); }} className="text-pine font-semibold">{l.label} →</Link>)}</div>}
              </div>
            ))}
            {msgs.length <= 1 && (
              <div className="flex flex-wrap gap-2">
                {["Generic for Dolo 650?", "Delivery charges", "How do prescriptions work?", "Where is my order?"].map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="chip-off h-9 text-xs">{s}</button>
                ))}
              </div>
            )}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="p-3 border-t border-line flex gap-2">
            <label className="sr-only-x" htmlFor="chat-in">{t("chat_ph")}</label>
            <input id="chat-in" ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("chat_ph")} className="input h-11" autoComplete="off" />
            <button className="btn-primary h-11 px-4" aria-label={t("chat_send")}><Icon name="arrow" size={18} /></button>
          </form>
        </section>
      )}
    </>
  );
}
