"""Build web/public/data/medicines.json from the Jan Aushadhi medicine database.

Run: python scripts/build_catalogue.py
Inputs : scripts/medicine_db_clean.csv  (generic catalogue, same file the scanner uses)
         scripts/brand_prices.csv       (branded equivalents with MRP, used for savings)
"""
import csv, json, re, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / "web" / "public" / "data" / "medicines.json"

FILLER = r"\b(tablets?|capsules?|caps?|tab|ip|bp|usp|i\.p\.|film|coated|gastro|resistant|enteric|sustained|prolonged|extended|modified|release|sr|er|pr|dispersible|oral|suspension|syrup|hydrochloride|hcl|potassium|sodium|besilate|besylate|calcium|dihydrochloride|eq\.?|equivalent|to|of|and|with|w/v|w/w)\b"

def signature(text):
    """Set of (salt, strength) pairs, e.g. {('atorvastatin', 10.0)}."""
    t = (text or "").lower().replace("+", " ").replace(",", " ").replace("&", " ")
    t = re.sub(r"\bs\s*\(\s*-\s*\)\s*", "s-", t)
    t = re.sub(r"\(.*?\)", " ", t)
    strengths = re.findall(r"\d+(?:\.\d+)?\s*(?:mg|mcg|iu|g)\b", t)
    t = re.sub(FILLER, " ", t)
    t = re.sub(r"(?<![a-z])-|-(?![a-z])", " ", t)
    pairs = re.findall(r"([a-z][a-z\-]{2,})\s*(\d+(?:\.\d+)?)\s*mg", t)
    if len(pairs) != len(strengths):
        return frozenset()  # some ingredient could not be parsed: never claim equivalence
    return frozenset((s.strip("-"), float(n)) for s, n in pairs)

CATS = [
    ("vit", ["vitamin", "calcium", "iron", "ferrous", "folic", "supplement", "zinc", "multivit", "cholecalciferol", "methylcobalamin", "b-complex", "ors", "electrolyte"]),
    ("chol", ["statin", "cholesterol", "lipid", "fenofibrate", "ezetimibe"]),
    ("diab", ["diabet", "metformin", "glimepiride", "gliclazide", "insulin", "gliptin", "voglibose", "pioglitazone", "glipizide", "acarbose"]),
    ("bp", ["hypertension", "blood pressure", "angina", "heart", "cardiac", "amlodipine", "losartan", "telmisartan", "atenolol", "metoprolol", "clopidogrel", "ramipril", "enalapril", "olmesartan", "bisoprolol", "nifedipine", "aspirin", "warfarin", "digoxin"]),
    ("abx", ["infection", "antibiotic", "cillin", "mycin", "floxacin", "cef", "metronidazole", "antifungal", "antiviral", "fluconazole", "doxycycline", "cotrimoxazole", "nitrofurantoin", "tinidazole", "linezolid", "acyclovir", "aciclovir", "valacyclovir", "oseltamivir", "albendazole", "ivermectin"]),
    ("acid", ["acidity", "hyperacid", "gerd", "ulcer", "prazole", "ranitidine", "famotidine", "domperidone", "antacid", "constipation", "digest", "ondansetron", "vomit", "nausea", "lactulose", "dicyclomine", "bowel"]),
    ("allergy", ["allerg", "cetirizine", "montelukast", "asthma", "cough", "cold", "salbutamol", "fexofenadine", "chlorpheniramine", "bronch", "inhal", "ambroxol"]),
    ("pain", ["paracetamol", "aceclofenac", "diclofenac", "ibuprofen", "pain", "fever", "analgesic", "inflammat", "arthritis", "naproxen", "etoricoxib", "tramadol", "mefenamic", "gout", "migraine", "muscle"]),
    ("skin", ["cream", "ointment", " gel", "lotion", "skin", "derm", "acne", "fungal infection of skin", "clobetasol", "betamethasone", "mupirocin", "soap"]),
]
OTC_HINTS = ["vitamin", "calcium", "ferrous", "folic", "zinc", "multivit", "ors", "electrolyte", "antacid", "cetirizine", "levocetirizine", "chlorpheniramine", "lactulose", "cough", "soap", "lotion"]
RX_SKIN = ["clobetasol", "betamethasone", "mupirocin", "fusidic", "tacrolimus", "steroid"]

def categorise(name, use):
    hay = f"{name} {use}".lower()
    for cid, words in CATS:
        if any(w in hay for w in words):
            return cid
    return "other"

def is_rx(name, cat):
    """Heuristic: India lists most of these under Schedule H. Demo data only."""
    n = name.lower()
    if any(w in n for w in ("injection", "vial", "infusion")):
        return True
    if cat == "vit":
        return False
    if cat == "skin":
        return any(w in n for w in RX_SKIN)
    combo = "+" in n or " and " in n or "," in n
    if cat == "pain":
        return not (n.startswith("paracetamol") and not combo)
    if cat in ("allergy", "acid") and any(w in n for w in OTC_HINTS):
        return False
    return True

def form_of(name, pack):
    h = f"{name} {pack}".lower()
    for f, words in [("Injection", ["injection", "vial", "infusion"]), ("Syrup", ["syrup", "suspension", " ml", "oral solution"]),
                     ("Drops", ["drops"]), ("Cream", ["cream", "ointment", "gel", "lotion"]), ("Capsule", ["capsule"]),
                     ("Inhaler", ["inhal", "rotacap", "respules"]), ("Powder", ["powder", "sachet"]), ("Tablet", ["tablet", "'s"])]:
        if any(w in h for w in words):
            return f
    return "Other"

def units_in(pack):
    m = re.match(r"\s*(\d+)\s*'s", pack or "")
    return int(m.group(1)) if m else 1

def nice(name):
    name = re.sub(r"\s+", " ", name).strip()
    return re.sub(r"(\d)\s*Mg\b", r"\1 mg", name).replace(" Ip ", " IP ")

def main():
    rows = list(csv.DictReader(open(ROOT / "medicine_db_clean.csv", encoding="utf-8", errors="ignore")))
    # Branded equivalents with prices
    brands_by_sig = {}
    for b in csv.DictReader(open(ROOT / "brand_prices.csv", encoding="utf-8", errors="ignore")):
        m = re.match(r"₹\s*([\d.]+)\s*\((\d+)s?\)", b["MRP (₹)"].strip())
        if not m:
            continue
        price, n = float(m.group(1)), int(m.group(2))
        sig = signature(b["Branded Composition"])
        if not sig:
            continue
        lst = brands_by_sig.setdefault(sig, {})
        key = b["Brand Name"].strip()
        unit = round(price / n, 2)
        # keep the lowest listed MRP per brand (conservative savings)
        if key not in lst or unit < lst[key]["unit"]:
            lst[key] = {"name": key, "maker": b["Manufacturer"].strip(), "mrp": price, "count": n, "unit": unit}

    grouped = {}
    for r in rows:
        if r["Source"].strip() != "Jan Aushadhi":
            continue
        g = r["Generic Name"].strip()
        grouped.setdefault(g, []).append(r)

    meds = []
    for g, rs in grouped.items():
        r0 = rs[0]
        try:
            price = float(r0["MRP_NUM"])
        except ValueError:
            continue
        if price <= 0:
            continue
        use = next((x["Use of Medicine"] for x in rs if x["Use of Medicine"] not in ("nan", "")), "")
        sig = signature(r0["Generic Composition"] or g)
        # exact-composition branded equivalents only
        equiv = {}
        for x in rs:
            bn = x["Brand Name"].strip()
            if bn.lower() in ("nan", "") or x["Composition Match"].strip() != "✅ Yes":
                continue
            if sig and signature(x["Branded Composition"]) == sig:
                equiv[bn] = {"name": bn, "maker": "" if x["Manufacturer"] == "nan" else x["Manufacturer"]}
        priced = list(brands_by_sig.get(sig, {}).values()) if sig else []
        for p in priced:
            equiv[p["name"]] = p
        cat = categorise(g, use)
        pack = r0["Dosage"].strip()
        count = units_in(pack)
        unit = round(price / count, 2)
        best = min((b["unit"] for b in equiv.values() if "unit" in b), default=None)
        save = round((1 - unit / best) * 100) if best and best > unit else 0
        name = nice(g)
        title = re.sub(r"\b(Tablets?|Capsules?|IP|USP|BP)\b", " ", name)
        title = re.sub(r"\s+", " ", title).strip(" ,")
        stock = 20 + int(hashlib.md5((g + "s").encode()).hexdigest()[:4], 16) % 380
        meds.append({
            "name": title, "full": name, "salt": nice(r0["Generic Composition"] if r0["Generic Composition"] != "nan" else g),
            "pack": pack, "count": count, "price": round(price, 2), "unit": unit,
            "use": use.strip(), "cat": cat, "rx": is_rx(name, cat), "form": form_of(g, pack),
            "brands": sorted(equiv.values(), key=lambda b: -b.get("unit", 0)), "save": save,
            "stock": stock,
        })
    meds.sort(key=lambda m: m["name"].lower())
    meds = [{"id": 1001 + i, **m} for i, m in enumerate(meds)]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(meds, ensure_ascii=False, separators=(",", ":")))
    print(len(meds), "medicines;", sum(1 for m in meds if m["save"]), "with priced brand comparison;",
          sum(1 for m in meds if m["brands"]), "with any brand equivalent ->", OUT, OUT.stat().st_size // 1024, "KB")

if __name__ == "__main__":
    main()
