import { useEffect, useMemo, useState } from "react";
import { Category, Med, seedDemo, useDB } from "./store.js";

export const CATEGORIES: { id: Category; en: string; hi: string; color: string; ground: string }[] = [
  { id: "pain", en: "Pain & fever", hi: "दर्द और बुखार", color: "#E8A33D", ground: "#F6EAD3" },
  { id: "bp", en: "Heart & BP", hi: "हृदय और बीपी", color: "#C2483B", ground: "#F3DCD8" },
  { id: "diab", en: "Diabetes", hi: "मधुमेह", color: "#3E7CB1", ground: "#DCE6F1" },
  { id: "acid", en: "Acidity & stomach", hi: "एसिडिटी और पेट", color: "#8C6BB1", ground: "#E7DFF0" },
  { id: "allergy", en: "Allergy & breathing", hi: "एलर्जी और सांस", color: "#5BA37A", ground: "#DDEEE2" },
  { id: "abx", en: "Infections", hi: "संक्रमण", color: "#2F8F8A", ground: "#D8ECEA" },
  { id: "chol", en: "Cholesterol", hi: "कोलेस्ट्रॉल", color: "#D06A8E", ground: "#F3DCE5" },
  { id: "vit", en: "Vitamins & supplements", hi: "विटामिन और सप्लीमेंट", color: "#B88A2E", ground: "#F2E8D2" },
  { id: "skin", en: "Skin care", hi: "त्वचा देखभाल", color: "#C9785B", ground: "#F5E2DA" },
  { id: "other", en: "Other medicines", hi: "अन्य दवाएं", color: "#6B7872", ground: "#E6E9E4" },
];
export const catInfo = (id: Category) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

let raw: Med[] | null = null;
let pending: Promise<Med[]> | null = null;
function fetchCatalogue() {
  if (raw) return Promise.resolve(raw);
  if (!pending) pending = fetch("data/medicines.json").then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then((j: Med[]) => (raw = j));
  return pending;
}

export function useCatalog() {
  const db = useDB();
  const [base, setBase] = useState<Med[] | null>(raw);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!base) fetchCatalogue().then((m) => { setBase(m); }).catch((e) => { pending = null; setError(String(e.message || e)); });
  }, []);
  const meds = useMemo(() => {
    if (!base) return [] as Med[];
    const list: Med[] = [];
    for (const m of db.custom) list.push(m);
    for (const m of base) {
      const p = db.inv[m.id];
      if (!p) { list.push(m); continue; }
      if (p.deleted) continue;
      const merged = { ...m, ...p } as Med;
      if (p.price != null) merged.unit = Math.round((p.price / Math.max(1, m.count)) * 100) / 100;
      list.push(merged);
    }
    return list;
  }, [base, db.inv, db.custom]);
  const byId = useMemo(() => new Map(meds.map((m) => [m.id, m])), [meds]);
  useEffect(() => { if (base && !db.seeded) seedDemo(base); }, [base, db.seeded]);
  return { ready: !!base, error, meds, byId };
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Ranked search over generic names, salts, uses and branded equivalents. */
export function searchMeds(meds: Med[], q: string) {
  const n = norm(q);
  if (!n) return meds;
  const words = n.split(" ");
  const scored: { m: Med; s: number }[] = [];
  for (const m of meds) {
    const name = norm(m.name), brands = m.brands.map((b) => norm(b.name)).join(" "), hay = name + " " + norm(m.salt) + " " + norm(m.use) + " " + brands;
    if (!words.every((w) => hay.includes(w))) continue;
    let s = 0;
    if (name.startsWith(n)) s += 100;
    else if (name.includes(n)) s += 60;
    if (brands.split(" ").some((b) => b.startsWith(words[0]))) s += 80;
    s += m.save ? 10 : 0;
    s -= name.length / 50;
    scored.push({ m, s });
  }
  return scored.sort((a, b) => b.s - a.s).map((x) => x.m);
}

/** The brand a shopper would recognise for a generic, if we know one. */
export function cheapestBrand(m: Med) {
  const priced = m.brands.filter((b) => b.unit);
  return priced.length ? priced.reduce((a, b) => (b.unit! < a.unit! ? b : a)) : null;
}
