import React, { useEffect, useRef } from "react";
import { catInfo } from "../lib/catalog.js";
import { Med, OrderStatus, RxStatus } from "../lib/store.js";
import { cx } from "../lib/format.js";
import { Icon } from "./Icon.js";
import { useT } from "../lib/i18n.js";

const PILL_COLORS: Record<string, string> = { Capsule: "#E9EEF5", Tablet: "#FFFFFF" };

/** CSS-drawn product visual: a blister strip for solids, a bottle / tube / vial for the rest. */
export function Blister({ med, size = "md" }: { med: Pick<Med, "cat" | "form" | "id">; size?: "sm" | "md" | "lg" }) {
  const c = catInfo(med.cat);
  const h = size === "lg" ? "aspect-[5/4]" : size === "md" ? "h-[150px]" : "h-[96px]";
  const tint = ["#FFFFFF", "#F1C94A", "#F2B9B0", "#E9EEF5", "#C9B6E4", "#FFFFFF"][med.id % 6];
  let inner: React.ReactNode;
  if (med.form === "Tablet" || med.form === "Capsule" || med.form === "Other") {
    const cols = size === "lg" ? "grid-cols-5 gap-x-6 gap-y-5 p-9 w-[72%] -rotate-6" : size === "md" ? "grid-cols-5 gap-x-2.5 gap-y-2 p-4" : "grid-cols-5 gap-x-1.5 gap-y-1.5 p-2.5";
    const pill = size === "lg" ? "h-7" : size === "md" ? "h-3.5 w-7" : "h-2.5 w-5";
    inner = (
      <div className={cx("grid rounded-xl bg-white/60 border border-ink/10", cols, size === "lg" && "shadow-card")}>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={cx("block rounded-full", pill)} style={{ background: med.form === "Capsule" ? PILL_COLORS.Capsule : tint, boxShadow: "0 2px 0 rgba(14,26,22,.12), inset 0 -3px 0 rgba(14,26,22,.05)" }} />
        ))}
      </div>
    );
  } else {
    const scale = size === "lg" ? 2.2 : size === "md" ? 1 : 0.62;
    const shape = med.form === "Cream" ? { w: 34, h: 92, r: "10px 10px 4px 4px" } : med.form === "Injection" ? { w: 26, h: 70, r: "6px" } : med.form === "Drops" ? { w: 30, h: 66, r: "10px" } : { w: 46, h: 88, r: "12px" };
    inner = (
      <div className="flex flex-col items-center" style={{ transform: `scale(${scale})` }}>
        <span className="block rounded-t-md" style={{ width: shape.w * 0.6, height: 14, background: "#0E1A16", opacity: 0.85 }} />
        <span className="relative block border border-ink/10" style={{ width: shape.w, height: shape.h, borderRadius: shape.r, background: "rgba(255,255,255,.75)" }}>
          <span className="absolute left-1 right-1 top-1/3 h-1/3 rounded-sm" style={{ background: c.color, opacity: 0.85 }} />
        </span>
      </div>
    );
  }
  return (
    <div className={cx("relative grid place-items-center overflow-hidden", h, size === "lg" && "rounded-[28px]")} style={{ background: c.ground }}>
      {inner}
    </div>
  );
}

export function RxTag({ className }: { className?: string }) {
  return <span className={cx("pill bg-white text-warn border border-warn-line", className)} title="Prescription required">Rx</span>;
}

export function SaveTag({ pct }: { pct: number }) {
  return <span className="pill bg-lime text-ink">−{pct}%</span>;
}

const ORDER_TONE: Record<OrderStatus, string> = {
  pending: "bg-warn-bg text-[#8A3606]", confirmed: "bg-[#E2ECF7] text-[#1F4E7A]", processing: "bg-[#ECE5F5] text-[#553A7E]",
  shipped: "bg-[#DDF0EE] text-[#1D5F5B]", delivered: "bg-pine text-white", cancelled: "bg-[#EEF0EC] text-muted line-through",
};
export function OrderPill({ status }: { status: OrderStatus }) {
  const t = useT();
  return <span className={cx("pill rounded-full px-2.5", ORDER_TONE[status])}>{t(("st_" + status) as any)}</span>;
}
const RX_TONE: Record<RxStatus, string> = { pending: "bg-warn-bg text-[#8A3606]", approved: "bg-lime text-ink", rejected: "bg-danger-bg text-danger" };
export function RxPill({ status }: { status: RxStatus }) {
  const t = useT();
  return <span className={cx("pill rounded-full px-2.5", RX_TONE[status])}>{t(("rx_status_" + status) as any)}</span>;
}

export function Empty({ icon = "box", title, body, children }: { icon?: string; title: string; body?: string; children?: React.ReactNode }) {
  return (
    <div className="card border-dashed px-6 py-14 text-center flex flex-col items-center gap-3">
      <span className="w-14 h-14 rounded-2xl bg-pine-soft text-pine grid place-items-center"><Icon name={icon} size={26} stroke={1.7} /></span>
      <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
      {body && <p className="text-body max-w-md">{body}</p>}
      {children && <div className="mt-2 flex flex-wrap gap-3 justify-center">{children}</div>}
    </div>
  );
}

export function Stepper({ value, onChange, max = 99, label }: { value: number; onChange: (n: number) => void; max?: number; label: string }) {
  return (
    <div className="inline-flex items-center border-[1.5px] border-ink rounded-xl h-11 overflow-hidden" role="group" aria-label={label}>
      <button type="button" className="w-11 h-11 grid place-items-center disabled:opacity-30" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Decrease"><Icon name="minus" size={16} /></button>
      <span className="min-w-[36px] text-center font-mono font-semibold" aria-live="polite">{value}</span>
      <button type="button" className="w-11 h-11 grid place-items-center disabled:opacity-30" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Increase"><Icon name="plus" size={16} /></button>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    setTimeout(() => ref.current?.querySelector<HTMLElement>("input,button,select,textarea")?.focus(), 30);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; prev?.focus?.(); };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-ink/50" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={cx("fade-up w-full bg-white rounded-3xl shadow-card max-h-[90vh] overflow-auto", wide ? "max-w-2xl" : "max-w-md")}>
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
          <button type="button" onClick={onClose} className="w-11 h-11 grid place-items-center rounded-full hover:bg-field" aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx("inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin", className)} aria-hidden="true" />;
}
