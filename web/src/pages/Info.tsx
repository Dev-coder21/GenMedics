import React, { useState } from "react";
import { useT } from "../lib/i18n.js";
import { Link } from "../lib/router.js";
import { inr0 } from "../lib/format.js";
import { useDB } from "../lib/store.js";
import { openChat } from "../lib/ui.js";
import { Empty } from "../components/bits.js";
import { Icon } from "../components/Icon.js";

type Section = { h: string; p: string[] };
function pages(free: number, fee: number): Record<string, { eyebrow: string; title: string; lead: string; sections: Section[] }> {
  return {
    about: { eyebrow: "About", title: "Honest prices for the medicine you already trust.", lead: "GenMedics matches branded prescriptions to certified generics with the identical salt and strength, so families pay for the molecule — not the marketing.",
      sections: [
        { h: "Why generics", p: ["A generic contains the same active ingredient, in the same strength and dosage form, as the brand it replaces. In India the same molecule is often sold under dozens of brand names at very different prices.", "Our catalogue is built from the Pradhan Mantri Bhartiya Janaushadhi Pariyojana (PMBI) product list, sourced from WHO-GMP certified manufacturers."] },
        { h: "How matching works", p: ["We parse the composition of every product into salts and strengths and only call two products equivalent when every ingredient and every strength matches. Prices are compared per unit, so different pack sizes don't skew the saving."] },
        { h: "The platform", p: ["GenMedics is a student project made of three parts: this storefront, a prescription scanner (OCR plus fuzzy matching) and an admin console for pharmacists. This public build runs entirely in your browser."] },
      ] },
    help: { eyebrow: "Help", title: "Questions, answered.", lead: "Can't find what you need? Our assistant can look up medicines and orders for you.",
      sections: [
        { h: "How do I find the generic for my brand?", p: ["Type the brand name from your strip (for example “Telma 40”) into search. Products with the same composition show “Generic for …” and, where we have brand prices, the per-unit saving."] },
        { h: "Do I need a prescription?", p: ["Medicines marked Rx need a valid prescription. Scan or upload it on the Scan prescription page; a pharmacist verifies it before your order is packed."] },
        { h: "How do I track my order?", p: ["Open Orders from the menu. Each order shows its status timeline and a tracking number once it has shipped."] },
        { h: "Can I cancel?", p: ["Yes — orders can be cancelled until they are packed (status Pending or Confirmed)."] },
        { h: "Is this a real pharmacy?", p: ["This public site is a demo. Orders, accounts and prescriptions are stored only in your browser and nothing is dispatched."] },
      ] },
    shipping: { eyebrow: "Shipping", title: "Delivery", lead: `Free delivery on orders above ${inr0(free)}. Below that, a flat ${inr0(fee)} delivery fee applies.`,
      sections: [
        { h: "When will it arrive?", p: ["Orders are packed after pharmacist verification, usually the same day, and delivered in 2–5 working days depending on your PIN code."] },
        { h: "Cold-chain products", p: ["Insulin, some vaccines and other temperature-sensitive products ship in insulated packaging and may take longer to reach remote PIN codes."] },
      ] },
    returns: { eyebrow: "Returns", title: "Returns & refunds", lead: "If something arrives damaged, wrong or near expiry, we'll replace it or refund you.",
      sections: [
        { h: "What can be returned", p: ["Unopened, undamaged packs within 7 days of delivery. Prescription medicines, cold-chain products and opened packs can only be returned if they were damaged or incorrect on arrival."] },
        { h: "How refunds work", p: ["Refunds go back to the original payment method within 5–7 working days of the return being picked up."] },
      ] },
    privacy: { eyebrow: "Privacy", title: "Your data", lead: "Health information is sensitive. Here's what this site does with it.",
      sections: [
        { h: "This demo build", p: ["Your account, cart, addresses, orders and prescription images are stored in your browser's local storage on this device only. Nothing is sent to a server. Clearing site data removes it."] },
        { h: "Prescription images", p: ["Text recognition runs in your browser. The OCR engine and language data are downloaded from a public CDN; your image is not uploaded."] },
      ] },
    terms: { eyebrow: "Terms", title: "Terms of use", lead: "By using GenMedics you agree to the following.",
      sections: [
        { h: "Not medical advice", p: ["Information on this site, including the assistant's replies, is for general information only. Always follow your doctor's or pharmacist's advice before switching or starting a medicine."] },
        { h: "Prices", p: ["Prices are MRPs from the PMBI catalogue and published brand MRPs and may change. Savings are calculated per unit against the cheapest listed brand with the same composition."] },
      ] },
    careers: { eyebrow: "Careers", title: "Build affordable healthcare with us.", lead: "We're a small team working on pharmacy software, OCR and data. There are no open roles right now.",
      sections: [{ h: "Stay in touch", p: ["Want to contribute? The project is open source — issues and pull requests are welcome on GitHub."] }] },
  };
}

export default function Info({ slug }: { slug: string }) {
  const t = useT();
  const db = useDB();
  const pg = pages(db.settings.freeAbove, db.settings.fee)[slug];
  const [open, setOpen] = useState<number | null>(0);
  if (!pg) return <NotFound />;
  const faq = slug === "help";
  return (
    <div className="wrap pt-12 pb-24 max-w-3xl">
      <div className="eyebrow text-pine">{pg.eyebrow}</div>
      <h1 className="h-display text-[clamp(36px,5vw,60px)] leading-none mt-3 mb-5">{pg.title}</h1>
      <p className="text-lg text-body leading-relaxed mb-10">{pg.lead}</p>
      <div className={faq ? "divide-y divide-line border-y border-line" : "flex flex-col gap-8"}>
        {pg.sections.map((s, i) => faq ? (
          <div key={s.h}>
            <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="w-full flex justify-between items-center gap-4 py-5 text-left font-semibold text-lg min-h-[44px]">
              {s.h}<Icon name={open === i ? "minus" : "plus"} size={18} />
            </button>
            {open === i && <div className="pb-5 text-body leading-relaxed">{s.p.map((x) => <p key={x}>{x}</p>)}</div>}
          </div>
        ) : (
          <section key={s.h}>
            <h2 className="font-display text-2xl font-bold mb-2">{s.h}</h2>
            {s.p.map((x) => <p key={x} className="text-body leading-relaxed mb-3">{x}</p>)}
          </section>
        ))}
      </div>
      {faq && <button type="button" className="btn-primary mt-8" onClick={() => openChat()}><Icon name="chat" size={18} />{t("pd_chat")}</button>}
    </div>
  );
}

export function NotFound() {
  const t = useT();
  return <div className="wrap py-20"><Empty icon="search" title={t("notfound")}><Link to="/" className="btn-primary no-underline">{t("go_home")}</Link></Empty></div>;
}
