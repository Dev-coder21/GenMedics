import React, { useEffect, useMemo, useRef, useState } from "react";
import { useCatalog, cheapestBrand } from "../lib/catalog.js";
import { useT } from "../lib/i18n.js";
import { Link, useRoute } from "../lib/router.js";
import { inr, fmtDate, cx } from "../lib/format.js";
import { addToCart, currentUser, deletePrescription, getDB, savePrescription, useDB, Prescription } from "../lib/store.js";
import { openAuth, toast } from "../lib/ui.js";
import { fileToImage, recognise, thumbnail } from "../lib/ocr.js";
import { LineMatch, matchPrescription, packsFor } from "../lib/match.js";
import { Empty, RxPill, Spinner, Stepper } from "../components/bits.js";
import { Icon } from "../components/Icon.js";

type Stage = "idle" | "reading" | "review" | "error";
type Row = LineMatch & { on: boolean; qty: number };

export default function Prescriptions() {
  const t = useT();
  const db = useDB();
  const me = currentUser(db);
  const { meds, ready } = useCatalog();
  const { query } = useRoute();
  const next = query.get("next");
  const [stage, setStage] = useState<Stage>("idle");
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(0);
  const [preview, setPreview] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [ocr, setOcr] = useState({ text: "", confidence: 0 });
  const [thumb, setThumb] = useState("");
  const [saved, setSaved] = useState<Prescription | null>(null);
  const [added, setAdded] = useState(false);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const fileIn = useRef<HTMLInputElement>(null);
  const camIn = useRef<HTMLInputElement>(null);

  const doSave = (text: string, conf: number, th: string, rs: Row[]) => {
    try {
      const p = savePrescription({ image: th, text, confidence: conf, matches: rs.map((r) => ({ medId: r.med.id, name: r.med.name, line: r.line, score: r.score, brand: r.brand })) });
      setSaved(p);
    } catch { /* not signed in */ }
  };

  const run = async (file: Blob) => {
    if (!ready) return;
    setErr(""); setStage("reading"); setStep(0); setPct(0); setAdded(false); setSaved(null);
    try {
      const img = await fileToImage(file);
      setPreview(URL.createObjectURL(file));
      const th = thumbnail(img);
      setThumb(th);
      const passes = await recognise(img, (s, p) => { setStep(s); setPct(p); });
      setStep(2);
      // pick the OCR pass that finds the most medicines (ties: higher confidence)
      const scored = passes.map((p) => ({ p, r: matchPrescription(p.text, meds) })).sort((a, b) => b.r.matches.length - a.r.matches.length || b.p.confidence - a.p.confidence);
      const { p, r } = scored[0];
      setStep(3);
      await new Promise((res) => setTimeout(res, 350));
      const rs = r.matches.map((m) => ({ ...m, on: m.med.stock > 0, qty: Math.min(packsFor(m), Math.max(1, m.med.stock)) }));
      setRows(rs); setUnmatched(r.unmatched); setOcr({ text: p.text.trim(), confidence: p.confidence });
      setStage("review"); setStep(4);
      if (currentUser(getDB())) doSave(p.text.trim(), p.confidence, th, rs);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      setErr(e?.message || t("rx_ocr_fail")); setStage("error");
    }
  };

  const onFiles = (fl: FileList | null) => { const f = fl?.[0]; if (f) { if (!f.type.startsWith("image/")) { toast("Please choose an image (JPG or PNG)", { tone: "err" }); return; } run(f); } };
  const sample = async () => { const r = await fetch("img/sample-prescription.png"); run(await r.blob()); };
  const reset = () => { setStage("idle"); setRows([]); setUnmatched([]); setPreview(""); setSaved(null); setAdded(false); if (fileIn.current) fileIn.current.value = ""; };

  const sel = rows.filter((r) => r.on);
  const total = sel.reduce((s, r) => s + r.med.price * r.qty, 0);
  const brandTotal = sel.reduce((s, r) => {
    const b = r.med.brands.find((x) => x.name === r.brand && x.unit) || cheapestBrand(r.med);
    return s + (b?.unit && b.unit > r.med.unit ? b.unit : r.med.unit) * r.med.count * r.qty;
  }, 0);
  const addAll = () => {
    if (added) return;
    sel.forEach((r) => addToCart(r.med.id, r.qty));
    setAdded(true);
    toast(t("added"), { action: { label: t("view_cart"), to: next === "checkout" ? "/checkout" : "/cart" } });
  };
  const steps = [[t("rx_s1"), t("rx_s1d")], [t("rx_s2"), t("rx_s2d")], [t("rx_s3"), t("rx_s3d")], [t("rx_s4"), t("rx_s4d")]];
  const crumbs = [t("rx_upload"), t("rx_reading").replace("…", ""), t("rx_review")];
  const stageIdx = stage === "review" ? 2 : stage === "reading" ? 1 : 0;
  const mine = db.prescriptions.filter((p) => p.userId === me?.id);

  return (
    <div className="wrap pt-10 pb-24">
      <div className="flex flex-wrap justify-between items-end gap-5 mb-7">
        <div>
          <div className="eyebrow text-pine">{t("rx_band_eyebrow")}</div>
          <h1 className="h-display text-[clamp(34px,4vw,52px)] mt-2">{stage === "review" ? t("rx_review") : stage === "reading" ? t("rx_reading") : t("rx_upload")}</h1>
        </div>
        <ol aria-label="Progress" className="flex flex-wrap gap-2 font-mono text-xs">
          {crumbs.map((c, i) => <li key={c} className={cx("px-3 py-2 rounded-full", i === stageIdx ? "bg-ink text-white" : i < stageIdx ? "bg-pine-soft text-pine" : "bg-white text-muted border border-line")}>{i + 1} · {c.toUpperCase()}</li>)}
        </ol>
      </div>

      {(stage === "idle" || stage === "error") && (
        <div className="flex flex-wrap gap-6">
          <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files); }}
            className={cx("flex-[999_1_540px] min-w-0 min-h-[420px] rounded-[28px] border-2 border-dashed bg-white flex flex-col items-center justify-center gap-4 p-8 text-center transition", drag ? "border-pine bg-pine-tint" : "border-[#9CC5B2]")}>
            <span className="w-20 h-20 rounded-3xl bg-pine-soft grid place-items-center text-pine"><Icon name="scan" size={38} stroke={1.6} /></span>
            <div className="font-display text-[28px] font-bold tracking-tight leading-tight">{t("rx_drop")}</div>
            <div className="text-body max-w-md">{t("rx_drop_b")}</div>
            {stage === "error" && <p role="alert" className="text-sm text-danger bg-danger-bg rounded-lg px-3 py-2">{err || t("rx_ocr_fail")}</p>}
            <div className="flex flex-wrap gap-3 justify-center mt-2">
              <button type="button" className="btn-primary h-14 px-6 text-base" onClick={() => fileIn.current?.click()} disabled={!ready}><Icon name="upload" size={18} />{t("rx_choose")}</button>
              <button type="button" className="btn-ghost h-14 px-5 text-base sm:hidden" onClick={() => camIn.current?.click()} disabled={!ready}><Icon name="camera" size={18} />{t("rx_camera")}</button>
              <button type="button" className="btn h-14 px-6 text-base bg-white border-[1.5px] border-ink" onClick={sample} disabled={!ready}>{t("rx_sample")}</button>
            </div>
            <input ref={fileIn} type="file" accept="image/*" className="hidden" onChange={(e) => onFiles(e.target.files)} aria-label={t("rx_choose")} />
            <input ref={camIn} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFiles(e.target.files)} aria-label={t("rx_camera")} />
          </div>
          <div className="flex-[1_1_280px] min-w-0 flex flex-col gap-3">
            <div className="eyebrow text-muted">{t("rx_tips")}</div>
            {[t("rx_tip1"), t("rx_tip2"), t("rx_tip3")].map((x, i) => <div key={i} className="card p-4 flex gap-3.5"><span className="font-mono text-pine">0{i + 1}</span><span>{x}</span></div>)}
          </div>
        </div>
      )}

      {stage === "reading" && (
        <div className="flex flex-wrap gap-8 items-start">
          <div className="flex-[1_1_380px] min-w-0 rounded-[28px] bg-ink p-6 flex justify-center">
            <div className="relative w-full max-w-[460px] bg-white rounded-lg overflow-hidden">
              {preview && <img src={preview} alt="Your prescription" className="w-full block" />}
              <div className="sweep" />
            </div>
          </div>
          <div className="flex-[1_1_380px] min-w-0 card p-7">
            <div className="font-display text-2xl font-bold mb-4">{t("rx_reading")}</div>
            <ol className="flex flex-col">
              {steps.map(([l, d], i) => (
                <li key={l} className="flex gap-3.5 items-center py-3.5 border-b border-dashed border-line last:border-0">
                  <span className={cx("w-7 h-7 rounded-full grid place-items-center shrink-0 border", step > i ? "bg-lime border-lime" : "bg-field border-line")}>
                    {step > i ? <Icon name="check" size={14} stroke={3} /> : step === i ? <Spinner className="text-pine w-3.5 h-3.5" /> : null}
                  </span>
                  <span className="flex flex-col"><span className={cx(step >= i ? "font-semibold" : "text-muted")}>{l}{i === 1 && step === 1 && pct > 0 ? ` · ${pct}%` : ""}</span><span className="font-mono text-xs text-muted">{d}</span></span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {stage === "review" && (
        <div className="flex flex-wrap gap-8 items-start">
          <div className="flex-[1_1_360px] min-w-0 flex flex-col gap-4">
            <div className="rounded-[28px] bg-ink p-5 flex justify-center">{preview && <img src={preview} alt="Your prescription" className="w-full max-w-[440px] rounded-lg bg-white" />}</div>
            <details className="card p-4">
              <summary className="cursor-pointer font-semibold min-h-[32px]">{t("rx_text")} · <span className="font-mono text-sm text-muted">conf {ocr.confidence.toFixed(2)}</span></summary>
              <pre className="mt-3 whitespace-pre-wrap font-mono text-xs text-body max-h-64 overflow-auto">{ocr.text || "—"}</pre>
            </details>
          </div>
          <div className="flex-[1_1_480px] min-w-0 flex flex-col gap-3">
            {rows.length === 0 ? (
              <Empty icon="search" title={t("rx_none")} body={t("rx_none_b")}><button className="btn-primary" onClick={reset}>{t("rx_again")}</button><Link to="/medicines" className="btn-ghost no-underline">{t("nav_medicines")}</Link></Empty>
            ) : rows.map((r, i) => {
              const b = r.med.brands.find((x) => x.name === r.brand && x.unit);
              return (
                <div key={r.med.id} className={cx("card p-4 border-[1.5px] transition", r.on ? "border-pine" : "border-line opacity-60")}>
                  <div className="flex items-start gap-3.5">
                    <input type="checkbox" className="w-[22px] h-[22px] mt-1 accent-pine shrink-0" checked={r.on} disabled={r.med.stock <= 0} aria-label={`Include ${r.med.name}`}
                      onChange={() => { setRows(rows.map((x, j) => (j === i ? { ...x, on: !x.on } : x))); setAdded(false); }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-muted truncate">{t("rx_line", { n: i + 1, t: r.line })}</div>
                      <div className="flex flex-wrap items-baseline gap-2 mt-1">
                        {r.brand && <span className="text-muted line-through">{r.brand}</span>}{r.brand && <span aria-hidden="true">→</span>}
                        <Link to={`/product/${r.med.id}`} className="font-display font-bold text-xl tracking-tight text-ink no-underline">{r.med.name}</Link>
                        {r.med.rx && <span className="pill bg-white text-warn border border-warn-line">Rx</span>}
                      </div>
                      <div className="text-sm text-body mt-1">{r.perDay}×/day{r.days ? ` · ${r.days} days` : ""} · {r.med.pack}{r.med.stock <= 0 && <span className="text-danger font-semibold"> · {t("out_of_stock")}</span>}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-lg font-semibold">{inr(r.med.price * r.qty)}</div>
                      {b && <div className="font-mono text-xs text-muted line-through">{inr(b.unit! * r.med.count * r.qty)}</div>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pl-9">
                    <div className="flex items-center gap-2.5 font-mono text-xs text-muted">
                      {t("rx_match").toUpperCase()}
                      <span className="w-28 h-1.5 rounded-full bg-[#E6E9E4]"><span className="block h-1.5 rounded-full" style={{ width: r.score * 100 + "%", background: r.score > 0.85 ? "#0F5B43" : "#D98B2B" }} /></span>
                      <span className="text-ink font-semibold">{r.score.toFixed(2)}</span>
                    </div>
                    <Stepper value={r.qty} max={Math.max(1, Math.min(20, r.med.stock))} label={t("qty")} onChange={(n) => { setRows(rows.map((x, j) => (j === i ? { ...x, qty: n } : x))); setAdded(false); }} />
                  </div>
                </div>
              );
            })}
            {unmatched.length > 0 && (
              <div className="flex gap-3 p-4 rounded-2xl bg-warn-bg border border-warn-line text-sm text-warn-ink">
                <Icon name="warn" size={20} className="text-warn shrink-0" />
                <span><strong>{t("rx_unmatched", { n: unmatched.length })}</strong><br /><span className="font-mono text-xs">{unmatched.join(" · ")}</span></span>
              </div>
            )}
            {rows.length > 0 && (
              <div className="rounded-[20px] bg-ink text-white p-5 flex flex-wrap items-center justify-between gap-4 mt-1">
                <div>
                  <div className="eyebrow text-lime">{(rows.some((r) => r.days) ? t("rx_total", { n: sel.length }) : `${sel.length} ${t("ord_items")}`)}</div>
                  <div className="flex items-baseline gap-3 mt-1.5"><span className="font-mono text-3xl font-semibold">{inr(total)}</span>{brandTotal > total && <span className="font-mono text-[#9FB0A8] line-through">{inr(brandTotal)}</span>}</div>
                  {brandTotal > total && <div className="text-sm text-[#CFE3D9] mt-1">{t("rx_save_vs", { n: inr(brandTotal - total) })}</div>}
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <button type="button" className="btn h-12 border border-muted text-white hover:bg-white/10" onClick={reset}>{t("rx_again")}</button>
                  {added ? <Link to={next === "checkout" ? "/checkout" : "/cart"} className="btn-lime h-12 no-underline">{t("rx_added")} →</Link>
                    : <button type="button" className="btn-lime h-12" disabled={!sel.length} onClick={addAll}>{t("rx_add", { n: sel.length })}</button>}
                </div>
              </div>
            )}
            {saved ? <p className="text-sm text-pine flex items-center gap-2"><Icon name="check" size={16} />{t("rx_save_note")} <span className="font-mono">{saved.id}</span></p>
              : !me ? <p className="text-sm text-body flex flex-wrap items-center gap-2">{t("rx_signin_save")}<button className="text-pine font-semibold underline min-h-[32px]" onClick={() => openAuth("signin", () => doSave(ocr.text, ocr.confidence, thumb, rows))}>{t("auth_signin")}</button></p> : null}
            {next === "checkout" && saved && <Link to="/checkout" className="btn-primary self-start no-underline">← {t("co_title")}</Link>}
          </div>
        </div>
      )}

      {me && (
        <section className="mt-16">
          <h2 className="h-display text-3xl mb-5">{t("rx_history")}</h2>
          {!mine.length ? <p className="text-muted">{t("rx_history_empty")}</p> : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
              {mine.map((p) => (
                <article key={p.id} className="card p-4 flex gap-4">
                  <div className="w-20 h-24 rounded-lg bg-paper border border-line overflow-hidden shrink-0 grid place-items-center">
                    {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <Icon name="doc" size={26} className="text-muted" stroke={1.5} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-mono font-semibold">{p.id}</span><RxPill status={p.status} /></div>
                    <div className="text-xs text-muted mt-1">{fmtDate(p.createdAt, true)}</div>
                    <div className="text-sm text-body mt-1.5 line-clamp-2">{p.matches.map((m) => m.name).join(", ") || "—"}</div>
                    {p.note && <div className="text-xs mt-1.5 text-warn-ink">“{p.note}”</div>}
                    <button type="button" className="text-xs text-danger font-semibold mt-1.5 min-h-[32px]" onClick={() => { deletePrescription(p.id); toast("Deleted " + p.id); }}>{t("addr_delete")}</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
