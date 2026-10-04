// Port of the scanner's RapidFuzz matching: every OCR line is compared, word by word, against the
// brand names and generic salt names in the catalogue; strength and dosage form break ties.
import { Med } from "./store.js";

/** Indel similarity (what RapidFuzz's fuzz.ratio computes), 0..100. */
export function ratio(a: string, b: string) {
  if (!a.length && !b.length) return 100;
  const m = a.length, n = b.length;
  let prev = new Array(n + 1).fill(0), cur = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    [prev, cur] = [cur, prev];
  }
  return (200 * prev[n]) / (m + n);
}

/** fuzz.token_set_ratio */
export function tokenSetRatio(a: string, b: string) {
  const A = new Set(a.split(/\s+/).filter(Boolean)), B = new Set(b.split(/\s+/).filter(Boolean));
  const inter = [...A].filter((x) => B.has(x)).sort().join(" ");
  const da = [...A].filter((x) => !B.has(x)).sort().join(" "), db = [...B].filter((x) => !A.has(x)).sort().join(" ");
  const ab = (inter + " " + da).trim(), ba = (inter + " " + db).trim();
  return Math.max(inter ? ratio(inter, ab) : 0, inter ? ratio(inter, ba) : 0, ratio(ab, ba));
}

const FORM_HINT: [RegExp, string][] = [[/\b(tab|tabs|tablet|t)\b/, "Tablet"], [/\b(cap|caps|capsule)\b/, "Capsule"], [/\b(syp|syr|syrup|susp)\b/, "Syrup"], [/\b(inj|injection)\b/, "Injection"], [/\b(oint|cream|gel)\b/, "Cream"], [/\b(drops?|gtt)\b/, "Drops"]];
const NOISE = new Set("tab tabs tablet tablets cap caps capsule capsules syp syr syrup inj mg ml x od bd tds hs sos days day daily after before food meal breakfast lunch dinner night morning for take times week weeks month dr mbbs md rx date sign signature reg clinic".split(" "));

export function cleanLine(line: string) {
  return line.toLowerCase()
    .replace(/(\d)[oO](?=\b|\d)/g, "$10").replace(/[oO](\d)/g, "0$1")      // OCR: 5O -> 50, O5 -> 05
    .replace(/(\d)[lI|](?=\d|\b)/g, "$11")
    .replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z]{3,})/g, "$1 $2")
    .replace(/[^a-z0-9.\- ]+/g, " ").replace(/\s+/g, " ").trim();
}

type Vocab = { word: string; meds: Med[]; kind: "brand" | "salt"; brand?: string };
let cache: { key: Med[]; vocab: Vocab[] } | null = null;
function vocabulary(meds: Med[]) {
  if (cache && cache.key === meds) return cache.vocab;
  const map = new Map<string, Vocab>();
  const add = (word: string, m: Med, kind: "brand" | "salt", brand?: string) => {
    const k = kind + ":" + word;
    const v = map.get(k) || { word, meds: [], kind, brand };
    if (!v.meds.includes(m)) v.meds.push(m);
    map.set(k, v);
  };
  for (const m of meds) {
    for (const b of m.brands) { const w = b.name.toLowerCase().match(/^[a-z]{3,}/)?.[0]; if (w) add(w, m, "brand", b.name); }
    const salt = m.name.toLowerCase().match(/^[a-z]{5,}/)?.[0];
    if (salt) add(salt, m, "salt");
  }
  cache = { key: meds, vocab: [...map.values()] };
  return cache.vocab;
}

export type LineMatch = { line: string; med: Med; score: number; brand?: string; perDay: number; days: number /* 0 = not stated */ };
export type MatchResult = { matches: LineMatch[]; unmatched: string[] };

function parseDose(l: string) {
  const f = l.match(/\b([0-3])\s*-\s*([0-3])\s*-\s*([0-3])\b/);
  let perDay = f ? +f[1] + +f[2] + +f[3] : /\b(bd|bid|twice)\b/.test(l) ? 2 : /\b(tds|tid|thrice)\b/.test(l) ? 3 : 1;
  if (!perDay) perDay = 1;
  const d = l.match(/(?:x|for)\s*(\d{1,3})\s*(?:d|day|days)\b/) || l.match(/\b(\d{1,3})\s*days?\b/);
  const w = l.match(/(?:x|for)\s*(\d{1,2})\s*(?:w|wk|week|weeks)\b/);
  const days = d ? +d[1] : w ? +w[1] * 7 : 0;
  return { perDay, days: Math.min(days, 180) };
}

export function matchPrescription(text: string, meds: Med[]): MatchResult {
  const vocab = vocabulary(meds);
  const matches: LineMatch[] = [];
  const unmatched: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = cleanLine(raw);
    if (line.replace(/[^a-z]/g, "").length < 3) continue;
    const looksLikeMed = /^(\d+[.)]?\s*)?(tab|cap|syp|syr|inj|t\.|oint|drops?)\b/.test(line) || /\d\s*-\s*\d\s*-\s*\d/.test(line) || /\d\s*mg\b/.test(line);
    const words = line.split(" ").filter((w) => /^[a-z][a-z\-]{2,}$/.test(w) && !NOISE.has(w));
    const nums = (line.match(/\b\d+(?:\.\d+)?\b/g) || []).map(Number).filter((n) => n >= 1 && n <= 2000 && !/\d-\d-\d/.test(String(n)));
    const form = FORM_HINT.find(([re]) => re.test(line))?.[1];
    let best: { v: Vocab; s: number } | null = null;
    for (const w of words) {
      for (const v of vocab) {
        if (Math.abs(v.word.length - w.length) > 3 || v.word[0] !== w[0]) continue;
        const s = v.word.length <= 4 ? (w === v.word ? 100 : 0) : ratio(w, v.word);
        const score = s + (v.kind === "brand" ? 1 : 0);
        if (s >= 80 && (!best || score > best.s)) best = { v, s: score };
      }
    }
    if (!best) { if (looksLikeMed) unmatched.push(raw.trim()); continue; }
    // choose the product: strength in the line > dosage form > single-ingredient > biggest saving
    const rank = (m: Med) => {
      const n = m.name.toLowerCase();
      let r = 0;
      if (nums.some((x) => new RegExp(`\\b${String(x).replace(".", "\\.")}\\s*mg\\b`).test(n))) r += 40;
      if (form && m.form === form) r += 15;
      if (!/\band\b|\+|,/.test(n)) r += 20;
      r += m.save / 10 - n.length / 100;
      return r;
    };
    const med = best.v.meds.slice().sort((a, b) => rank(b) - rank(a))[0];
    const strengthOk = nums.some((x) => new RegExp(`\\b${String(x).replace(".", "\\.")}\\s*mg\\b`).test(med.name.toLowerCase()));
    if (matches.some((m) => m.med.id === med.id)) continue;
    const { perDay, days } = parseDose(line);
    matches.push({ line: raw.trim(), med, brand: best.v.brand, score: Math.min(0.99, (Math.min(100, best.s) / 100) * (strengthOk || !nums.length ? 1 : 0.85)), perDay, days });
  }
  return { matches, unmatched };
}

/** Packs needed for the prescribed course. */
export function packsFor(m: LineMatch) {
  if (m.med.count <= 1 || !m.days) return 1;
  return Math.max(1, Math.min(20, Math.ceil((m.perDay * m.days) / m.med.count)));
}
