// Rule-based shopping assistant (the original ChatBot was rule-based too).
// It answers store questions and looks medicines / brands up in the catalogue. Not medical advice.
import { DB, Med, currentUser } from "./store.js";
import { searchMeds } from "./catalog.js";
import { inr, inr0 } from "./format.js";

type Reply = { from: "bot"; text: string; links?: { label: string; to: string }[] };
const has = (q: string, ...w: string[]) => w.some((x) => q.includes(x));
const STOP = new Set("what is the a an for of to my me i do you have generic generics brand alternative substitute cheaper cheap price cost tablet tablets tab mg please can find show any is there which".split(" "));

export function answer(raw: string, meds: Med[], db: DB): Reply {
  const q = raw.toLowerCase().trim();
  const me = currentUser(db);

  if (/^(hi|hello|hey|namaste|hii+)\b/.test(q)) return { from: "bot", text: "Hello! Tell me a brand name from your strip (e.g. “Pantocid 40”) and I'll find the generic with the same composition." };
  if (has(q, "deliver", "shipping", "ship ", "charges")) return { from: "bot", text: `Delivery is free on orders above ${inr0(db.settings.freeAbove)}; below that it's ${inr0(db.settings.fee)}. Orders are packed after a pharmacist checks them.`, links: [{ label: "Shipping policy", to: "/page/shipping" }] };
  if (has(q, "return", "refund", "exchange")) return { from: "bot", text: "Unopened, undamaged packs can be returned within 7 days of delivery. Prescription medicines can be returned only if they arrived damaged or wrong.", links: [{ label: "Returns policy", to: "/page/returns" }] };
  if (has(q, "pay", "upi", "cash", "cod")) return { from: "bot", text: `We accept ${[db.settings.cod && "cash on delivery", db.settings.upi && "UPI on delivery"].filter(Boolean).join(" and ")}.` };
  if (has(q, "where is my order", "order status", "track", "my order")) {
    if (!me) return { from: "bot", text: "Sign in and I can show your latest order.", links: [{ label: "Your orders", to: "/orders" }] };
    const o = db.orders.find((x) => x.userId === me.id);
    return o ? { from: "bot", text: `Your latest order #${o.id} (${inr(o.total)}) is ${o.status}.${o.tracking ? " Tracking: " + o.tracking : ""}`, links: [{ label: `Order #${o.id}`, to: `/orders/${o.id}` }] }
      : { from: "bot", text: "You haven't placed an order yet." };
  }
  if (has(q, "prescription", "rx", "scan", "parcha", "पर्चा")) return { from: "bot", text: "Medicines marked Rx need a prescription. Photograph it on the Scan page — we read it in your browser, match each medicine, and a pharmacist verifies it before dispatch.", links: [{ label: "Scan a prescription", to: "/prescriptions" }] };
  if (has(q, "dose", "dosage", "side effect", "pregnan", "safe to", "can i take", "overdose")) {
    return { from: "bot", text: "I can't advise on dosing or safety — please ask your doctor or pharmacist. If symptoms are severe, seek medical care right away. I can still look a medicine up for you." };
  }
  if (has(q, "what is generic", "are generics", "generic safe", "same as brand", "jan aushadhi")) return { from: "bot", text: "A generic has the same active ingredient, strength and dosage form as the brand. Ours come from the Jan Aushadhi (PMBI) scheme, which sources from WHO-GMP certified manufacturers.", links: [{ label: "About GenMedics", to: "/page/about" }] };

  // Catalogue lookup: brand names first, then generic names / salts.
  const words = q.replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
  if (words.length) {
    const term = words.join(" ");
    const brandHits = meds.filter((m) => m.brands.some((b) => words.some((w) => w.length > 2 && b.name.toLowerCase().replace(/[^a-z0-9]/g, "").startsWith(w))));
    const hits = (brandHits.length ? brandHits : searchMeds(meds, term)).slice(0, 3);
    if (hits.length) {
      const b = brandHits.length ? hits[0].brands.find((x) => words.some((w) => x.name.toLowerCase().replace(/[^a-z0-9]/g, "").startsWith(w))) : null;
      const head = b ? `${b.name} has the same composition as:` : `Here's what I found for “${raw.trim()}”:`;
      return { from: "bot", text: head + "\n" + hits.map((m) => `• ${m.name} — ${inr(m.price)} / ${m.pack}${m.save ? ` (${m.save}% cheaper)` : ""}${m.rx ? " · Rx" : ""}`).join("\n"),
        links: hits.map((m) => ({ label: m.name, to: `/product/${m.id}` })) };
    }
  }
  return { from: "bot", text: "I couldn't find that. Try a brand name (e.g. “Telma 40”), a salt (e.g. “metformin”), or ask about delivery, returns or prescriptions.", links: [{ label: "Help & FAQ", to: "/page/help" }] };
}
