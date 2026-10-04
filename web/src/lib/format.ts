const inrFmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const inr = (n: number) => "₹" + inrFmt.format(Number.isFinite(n) ? n : 0);
export const inr0 = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export function fmtDate(iso: string, withTime = false) {
  const d = new Date(iso);
  if (isNaN(+d)) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });
}

export function timeAgo(iso: string) {
  const s = (Date.now() - +new Date(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " h ago";
  return Math.floor(s / 86400) + " d ago";
}

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");
