"""GenMedics 2.0 API (/v2) — the contract used by the web app in /web.

Response shapes mirror the frontend types in web/src/lib/store.ts, so the same UI runs against this API
(locally) or against browser storage (GitHub Pages demo).
"""
import base64
import json
import os
import re
import uuid
from datetime import datetime
from typing import List, Literal, Optional

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

import auth
import models
from database import get_db

router = APIRouter(prefix="/v2", tags=["v2"])
UPLOAD_DIR = "uploads/prescriptions"
SCANNER_URL = os.getenv("SCANNER_URL", "http://127.0.0.1:4712/scan-text-only")
DEFAULT_SETTINGS = {"freeAbove": 299, "fee": 40, "portalTitle": "GenMedics Admin", "rxCheck": True, "cod": True, "upi": True}
ORDER_FLOW = ["pending", "confirmed", "processing", "shipped", "delivered"]
STATUSES = set(ORDER_FLOW) | {"cancelled"}


def iso(dt):
    return (dt.isoformat() + "Z") if dt else None


def now():
    return datetime.utcnow()


# ---------------------------------------------------------------- serialisers
def user_out(u: models.User):
    return {"id": str(u.id), "name": u.name, "email": u.email, "phone": u.phone, "admin": bool(u.is_admin), "createdAt": iso(u.created_at)}


def address_out(a: models.Address):
    return {"id": str(a.id), "userId": str(a.user_id), "label": a.label or "Home", "name": a.name or "", "phone": a.phone or "",
            "line1": a.street or "", "line2": a.line2 or "", "city": a.city or "", "state": a.state or "", "pincode": a.pincode or "",
            "isDefault": bool(a.is_default)}


def med_out(m: models.Medicine):
    return {"id": m.id, "name": m.name, "salt": m.generic_name or m.name, "price": m.price, "stock": m.stock or 0,
            "rx": bool(m.prescription_required), "pack": m.net_quantity or "", "cat": m.category or "other",
            "use": m.description or "", "form": m.dosage or "Other"}


def order_out(o: models.CustomerOrder):
    items = [{"id": it.medicine_id, "name": it.medicine.name if it.medicine else f"Medicine #{it.medicine_id}", "price": it.price_per_unit,
              "qty": it.quantity, "rx": bool(it.medicine and it.medicine.prescription_required), "pack": (it.medicine.net_quantity if it.medicine else "") or ""}
             for it in o.items]
    addr = json.loads(o.address_snapshot) if o.address_snapshot else (address_out(o.shipping_address) if o.shipping_address else {})
    history = json.loads(o.status_history) if o.status_history else [{"status": o.status, "at": iso(o.created_at)}]
    subtotal = o.subtotal if o.subtotal is not None else sum(i["price"] * i["qty"] for i in items)
    return {"id": o.id, "userId": str(o.user_id), "items": items, "subtotal": round(subtotal, 2), "delivery": o.delivery_fee or 0,
            "total": round(o.total_amount or 0, 2), "brandTotal": round(o.brand_total if o.brand_total is not None else subtotal, 2),
            "address": addr, "payment": o.payment or "cod", "rxId": f"RX-{o.prescription_id}" if o.prescription_id else None,
            "status": o.status, "history": history, "tracking": o.tracking_number, "createdAt": iso(o.created_at)}


def rx_out(p: models.Prescription):
    try:
        matches = json.loads(p.matched_medicines) if p.matched_medicines else []
    except ValueError:
        matches = []
    # older records (from /prescriptions/scan) store a different match shape
    matches = [m if "medId" in m else {"medId": m.get("medicine_id"), "name": m.get("name"), "line": "", "score": (m.get("confidence") or 0) / 100}
               for m in matches]
    image = f"/uploads/prescriptions/{os.path.basename(p.image_path)}" if p.image_path else None
    return {"id": f"RX-{p.id}", "userId": str(p.user_id), "image": image, "text": p.ocr_text or "", "matches": matches,
            "confidence": p.confidence_score or 0, "status": p.status or "pending", "note": p.notes,
            "createdAt": iso(p.uploaded_at), "reviewedAt": iso(p.verified_at)}


def rx_id(s: str) -> int:
    m = re.fullmatch(r"(?:RX-)?#?(\d+)", s.strip(), re.I)
    if not m:
        raise HTTPException(404, "Prescription not found")
    return int(m.group(1))


def get_settings(db: Session):
    row = db.get(models.Setting, "store")
    return {**DEFAULT_SETTINGS, **(json.loads(row.value) if row else {})}


# ---------------------------------------------------------------- auth
class Login(BaseModel):
    email: str
    password: str


class Register(BaseModel):
    name: str
    email: str
    password: str
    phone: Optional[str] = None


def token_for(u):
    return {"token": auth.create_access_token({"sub": u.email}), "user": user_out(u)}


@router.get("/health")
def health():
    return {"ok": True, "service": "genmedics-api", "version": 2}


@router.post("/auth/login")
def login(body: Login, db: Session = Depends(get_db)):
    u = auth.authenticate_user(db, body.email.strip().lower(), body.password)
    if not u:
        raise HTTPException(401, "Incorrect email or password")
    return token_for(u)


@router.post("/auth/register")
def register(body: Register, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(400, "Enter a valid email address")
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if not body.name.strip():
        raise HTTPException(400, "Enter your name")
    if auth.get_user_by_email(db, email):
        raise HTTPException(400, "Email already registered")
    u = models.User(name=body.name.strip(), email=email, phone=(body.phone or "").strip() or None, password_hash=auth.get_password_hash(body.password), is_active=True)
    db.add(u); db.commit(); db.refresh(u)
    return token_for(u)


class Profile(BaseModel):
    name: str
    phone: Optional[str] = None


class PasswordChange(BaseModel):
    old: str
    new: str


@router.get("/me")
def me(u=Depends(auth.get_current_user)):
    return user_out(u)


@router.patch("/me")
def update_me(body: Profile, u=Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if body.name.strip():
        u.name = body.name.strip()
    u.phone = (body.phone or "").strip() or None
    db.commit()
    return user_out(u)


@router.post("/me/password")
def change_password(body: PasswordChange, u=Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not auth.verify_password(body.old, u.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    if len(body.new) < 6:
        raise HTTPException(400, "New password must be at least 6 characters")
    u.password_hash = auth.get_password_hash(body.new)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- catalogue
class MedIn(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    rx: Optional[bool] = None
    pack: Optional[str] = None
    cat: Optional[str] = None
    use: Optional[str] = None
    form: Optional[str] = None
    salt: Optional[str] = None


@router.get("/medicines")
def medicines(db: Session = Depends(get_db)):
    return [med_out(m) for m in db.query(models.Medicine).filter(models.Medicine.status == "active").all()]


def apply_med(m: models.Medicine, b: MedIn):
    if b.name is not None:
        if not b.name.strip():
            raise HTTPException(400, "Name is required")
        m.name = b.name.strip()
    if b.price is not None:
        if b.price <= 0:
            raise HTTPException(400, "Price must be greater than 0")
        m.price = b.price
        if not m.original_price or m.original_price < b.price:
            m.original_price = b.price
    if b.stock is not None:
        if b.stock < 0:
            raise HTTPException(400, "Stock can't be negative")
        m.stock = b.stock
    if b.rx is not None: m.prescription_required = b.rx
    if b.pack is not None: m.net_quantity = b.pack
    if b.cat is not None: m.category = b.cat
    if b.use is not None: m.description = b.use
    if b.form is not None: m.dosage = b.form
    if b.salt is not None: m.generic_name = b.salt


@router.post("/medicines")
def add_medicine(b: MedIn, admin=Depends(auth.get_current_admin_user), db: Session = Depends(get_db)):
    m = models.Medicine(name="", generic_name=b.salt or b.name, category="other", price=1, stock=0, low_stock_threshold=30,
                        manufacturer="GenMedics", prescription_required=True, status="active")
    apply_med(m, b)
    if not m.name or not b.price:
        raise HTTPException(400, "Name and price are required")
    db.add(m); db.commit(); db.refresh(m)
    return med_out(m)


@router.patch("/medicines/{mid}")
def edit_medicine(mid: int, b: MedIn, admin=Depends(auth.get_current_admin_user), db: Session = Depends(get_db)):
    m = db.get(models.Medicine, mid)
    if not m or m.status != "active":
        raise HTTPException(404, "Medicine not found")
    apply_med(m, b)
    db.commit()
    return med_out(m)


@router.delete("/medicines/{mid}")
def remove_medicine(mid: int, admin=Depends(auth.get_current_admin_user), db: Session = Depends(get_db)):
    m = db.get(models.Medicine, mid)
    if not m:
        raise HTTPException(404, "Medicine not found")
    m.status = "deleted"  # soft delete keeps past orders intact
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- addresses
class AddressIn(BaseModel):
    label: str = "Home"
    name: str
    phone: str
    line1: str
    line2: Optional[str] = ""
    city: str
    state: str
    pincode: str
    isDefault: bool = False


def validate_address(b: AddressIn):
    for k in ("name", "phone", "line1", "city", "state", "pincode"):
        if not str(getattr(b, k) or "").strip():
            raise HTTPException(400, "Please fill in all required address fields")
    if not re.fullmatch(r"\d{6}", b.pincode.strip()):
        raise HTTPException(400, "PIN code must be 6 digits")
    if not re.fullmatch(r"[6-9]\d{9}", re.sub(r"\D", "", b.phone)[-10:]):
        raise HTTPException(400, "Enter a valid 10-digit mobile number")


def my_address(db, u, aid: str):
    a = db.query(models.Address).filter(models.Address.id == int(aid) if aid.isdigit() else -1, models.Address.user_id == u.id).first()
    if not a:
        raise HTTPException(404, "Address not found")
    return a


@router.get("/addresses")
def addresses(u=Depends(auth.get_current_user), db: Session = Depends(get_db)):
    return [address_out(a) for a in db.query(models.Address).filter(models.Address.user_id == u.id).order_by(models.Address.id)]


def write_address(db, u, a: models.Address, b: AddressIn):
    validate_address(b)
    first = db.query(models.Address).filter(models.Address.user_id == u.id).count() == (0 if a.id is None else 1)
    a.label, a.name, a.phone, a.street, a.line2 = b.label, b.name.strip(), b.phone.strip(), b.line1.strip(), (b.line2 or "").strip()
    a.city, a.state, a.pincode = b.city.strip(), b.state.strip(), b.pincode.strip()
    if b.isDefault or first:
        db.query(models.Address).filter(models.Address.user_id == u.id).update({"is_default": False})
        a.is_default = True


@router.post("/addresses")
def create_address(b: AddressIn, u=Depends(auth.get_current_user), db: Session = Depends(get_db)):
    a = models.Address(user_id=u.id, is_default=False)
    write_address(db, u, a, b)
    db.add(a); db.commit(); db.refresh(a)
    return address_out(a)


@router.put("/addresses/{aid}")
def update_address(aid: str, b: AddressIn, u=Depends(auth.get_current_user), db: Session = Depends(get_db)):
    a = my_address(db, u, aid)
    write_address(db, u, a, b)
    db.commit()
    return address_out(a)


@router.post("/addresses/{aid}/default")
def default_address(aid: str, u=Depends(auth.get_current_user), db: Session = Depends(get_db)):
    a = my_address(db, u, aid)
    db.query(models.Address).filter(models.Address.user_id == u.id).update({"is_default": False})
    a.is_default = True
    db.commit()
    return {"ok": True}


@router.delete("/addresses/{aid}")
def delete_address(aid: str, u=Depends(auth.get_current_user), db: Session = Depends(get_db)):
    a = my_address(db, u, aid)
    was_default = a.is_default
    in_use = db.query(models.CustomerOrder).filter(models.CustomerOrder.shipping_address_id == a.id).count()
    if in_use:  # past orders keep a snapshot; just detach the row from the user
        a.user_id = None
    else:
        db.delete(a)
    db.flush()
    if was_default:
        nxt = db.query(models.Address).filter(models.Address.user_id == u.id).first()
        if nxt:
            nxt.is_default = True
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- orders
class OrderLine(BaseModel):
    id: int
    qty: int


class OrderIn(BaseModel):
    items: List[OrderLine]
    addressId: str
    payment: Literal["cod", "upi"] = "cod"
    rxId: Optional[str] = None


def order_query(db):
    return db.query(models.CustomerOrder).options(joinedload(models.CustomerOrder.items).joinedload(models.CustomerOrderItem.medicine),
                                                   joinedload(models.CustomerOrder.shipping_address))


@router.get("/orders")
def orders(all: bool = False, u=Depends(auth.get_current_user), db: Session = Depends(get_db)):
    q = order_query(db)
    if not (all and u.is_admin):
        q = q.filter(models.CustomerOrder.user_id == u.id)
    return [order_out(o) for o in q.order_by(models.CustomerOrder.id.desc()).all()]


@router.post("/orders")
def place_order(b: OrderIn, u=Depends(auth.get_current_user), db: Session = Depends(get_db)):
    s = get_settings(db)
    if not b.items:
        raise HTTPException(400, "Your cart is empty")
    addr = my_address(db, u, b.addressId)
    lines, needs_rx = [], False
    for it in b.items:
        m = db.get(models.Medicine, it.id)
        if not m or m.status != "active":
            raise HTTPException(400, f"Medicine #{it.id} is no longer available")
        if it.qty < 1 or it.qty > (m.stock or 0):
            raise HTTPException(400, f"Only {m.stock or 0} left of {m.name}")
        needs_rx |= bool(m.prescription_required)
        lines.append((m, it.qty))
    rx = None
    if needs_rx and s["rxCheck"]:
        rx = db.get(models.Prescription, rx_id(b.rxId)) if b.rxId else None
        if not rx or rx.user_id != u.id or rx.status == "rejected":
            raise HTTPException(400, "Attach a valid prescription for the Rx medicines in your cart")
    elif needs_rx and b.rxId:
        rx = db.get(models.Prescription, rx_id(b.rxId))
    subtotal = round(sum(m.price * q for m, q in lines), 2)
    brand_total = round(sum(max(m.original_price or m.price, m.price) * q for m, q in lines), 2)
    delivery = 0 if subtotal >= s["freeAbove"] else s["fee"]
    o = models.CustomerOrder(user_id=u.id, shipping_address_id=addr.id, status="pending", payment=b.payment, subtotal=subtotal,
                             delivery_fee=delivery, total_amount=round(subtotal + delivery, 2), brand_total=brand_total,
                             prescription_id=rx.id if rx else None, address_snapshot=json.dumps(address_out(addr)),
                             status_history=json.dumps([{"status": "pending", "at": iso(now())}]), created_at=now())
    db.add(o); db.flush()
    for m, q in lines:
        db.add(models.CustomerOrderItem(order_id=o.id, medicine_id=m.id, quantity=q, price_per_unit=m.price))
        m.stock -= q
    db.commit()
    return order_out(order_query(db).filter(models.CustomerOrder.id == o.id).one())


class StatusIn(BaseModel):
    status: str
    note: Optional[str] = None


def set_status(db, o: models.CustomerOrder, status: str, note: Optional[str]):
    status = status.strip().lower()
    if status not in STATUSES:
        raise HTTPException(400, f"Invalid status '{status}'")
    if o.status == status:
        return
    if o.status in ("cancelled", "delivered"):
        raise HTTPException(400, f"Order is already {o.status}")
    if status == "cancelled":
        for it in o.items:
            if it.medicine:
                it.medicine.stock = (it.medicine.stock or 0) + it.quantity
    if status == "shipped" and not o.tracking_number:
        o.tracking_number = f"GM{o.id:06d}IN"
    hist = json.loads(o.status_history) if o.status_history else [{"status": o.status, "at": iso(o.created_at)}]
    hist.append({"status": status, "at": iso(now()), **({"note": note.strip()} if note and note.strip() else {})})
    o.status_history = json.dumps(hist)
    o.status = status


@router.post("/orders/{oid}/cancel")
def cancel(oid: int, u=Depends(auth.get_current_user), db: Session = Depends(get_db)):
    o = order_query(db).filter(models.CustomerOrder.id == oid, models.CustomerOrder.user_id == u.id).first()
    if not o:
        raise HTTPException(404, "Order not found")
    if o.status not in ("pending", "confirmed"):
        raise HTTPException(400, "This order can no longer be cancelled")
    set_status(db, o, "cancelled", "Cancelled by customer")
    db.commit()
    return order_out(o)


@router.patch("/admin/orders/{oid}")
def admin_order(oid: int, b: StatusIn, admin=Depends(auth.get_current_admin_user), db: Session = Depends(get_db)):
    o = order_query(db).filter(models.CustomerOrder.id == oid).first()
    if not o:
        raise HTTPException(404, "Order not found")
    if b.status == "confirmed" and o.prescription_id and get_settings(db)["rxCheck"]:
        rx = db.get(models.Prescription, o.prescription_id)
        if rx and rx.status != "approved":
            raise HTTPException(400, f"Approve prescription RX-{rx.id} first")
    set_status(db, o, b.status, b.note)
    db.commit()
    return order_out(o)


# ---------------------------------------------------------------- prescriptions
class Match(BaseModel):
    medId: int
    name: str
    line: str = ""
    score: float = 0
    brand: Optional[str] = None


class RxIn(BaseModel):
    text: str = ""
    confidence: float = 0
    image: Optional[str] = None  # data: URL (browser OCR fallback)
    matches: List[Match] = []


class RxMatchesIn(BaseModel):
    matches: List[Match]
    text: Optional[str] = None


def save_image(user_id: int, data: bytes, ext: str):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    name = f"{user_id}_{now():%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:8]}{ext}"
    with open(os.path.join(UPLOAD_DIR, name), "wb") as f:
        f.write(data)
    return f"{UPLOAD_DIR}/{name}"


@router.post("/prescriptions/scan")
async def scan(file: UploadFile = File(...), u=Depends(auth.get_current_user), db: Session = Depends(get_db)):
    """Save the image, run it through the Python scanner service (OpenCV + Tesseract), store the record."""
    ext = os.path.splitext(file.filename or "")[1].lower() or ".png"
    if ext not in {".png", ".jpg", ".jpeg", ".bmp", ".webp"}:
        raise HTTPException(400, "Upload a PNG or JPG image")
    data = await file.read()
    if not data or len(data) > 10 * 1024 * 1024:
        raise HTTPException(400, "Image must be between 1 byte and 10 MB")
    try:
        async with httpx.AsyncClient(timeout=60.0) as c:
            r = await c.post(SCANNER_URL, files={"file": (file.filename or "rx" + ext, data, file.content_type or "image/png")})
    except httpx.HTTPError:
        raise HTTPException(503, "Scanner service unavailable")
    if r.status_code != 200:
        raise HTTPException(422 if r.status_code == 400 else 502, "The scanner couldn't read this image")
    out = r.json()
    conf = float(out.get("confidence") or 0)
    p = models.Prescription(user_id=u.id, image_path=save_image(u.id, data, ext), ocr_text=out.get("text", ""), matched_medicines="[]",
                            status="pending", confidence_score=conf / 100 if conf > 1 else conf, is_verified=False, uploaded_at=now())
    db.add(p); db.commit(); db.refresh(p)
    return rx_out(p)


@router.post("/prescriptions")
def create_rx(b: RxIn, u=Depends(auth.get_current_user), db: Session = Depends(get_db)):
    """Store a prescription read in the browser (used when the scanner service isn't running)."""
    path = None
    if b.image and b.image.startswith("data:image/"):
        head, _, payload = b.image.partition(",")
        ext = ".png" if "png" in head else ".jpg"
        path = save_image(u.id, base64.b64decode(payload), ext)
    p = models.Prescription(user_id=u.id, image_path=path, ocr_text=b.text, confidence_score=b.confidence, status="pending",
                            matched_medicines=json.dumps([m.model_dump() for m in b.matches]), is_verified=False, uploaded_at=now())
    db.add(p); db.commit(); db.refresh(p)
    return rx_out(p)


@router.put("/prescriptions/{pid}/matches")
def set_matches(pid: str, b: RxMatchesIn, u=Depends(auth.get_current_user), db: Session = Depends(get_db)):
    p = db.get(models.Prescription, rx_id(pid))
    if not p or p.user_id != u.id:
        raise HTTPException(404, "Prescription not found")
    p.matched_medicines = json.dumps([m.model_dump() for m in b.matches])
    if b.text is not None:
        p.ocr_text = b.text
    db.commit()
    return rx_out(p)


@router.get("/prescriptions")
def prescriptions(all: bool = False, u=Depends(auth.get_current_user), db: Session = Depends(get_db)):
    q = db.query(models.Prescription)
    if not (all and u.is_admin):
        q = q.filter(models.Prescription.user_id == u.id)
    return [rx_out(p) for p in q.order_by(models.Prescription.id.desc()).all()]


@router.delete("/prescriptions/{pid}")
def delete_rx(pid: str, u=Depends(auth.get_current_user), db: Session = Depends(get_db)):
    p = db.get(models.Prescription, rx_id(pid))
    if not p or p.user_id != u.id:
        raise HTTPException(404, "Prescription not found")
    if db.query(models.CustomerOrder).filter(models.CustomerOrder.prescription_id == p.id).count():
        raise HTTPException(400, "This prescription is attached to an order")
    db.delete(p); db.commit()
    return {"ok": True}


class ReviewIn(BaseModel):
    status: Literal["pending", "approved", "rejected"]
    note: Optional[str] = None


@router.patch("/admin/prescriptions/{pid}")
def review(pid: str, b: ReviewIn, admin=Depends(auth.get_current_admin_user), db: Session = Depends(get_db)):
    p = db.get(models.Prescription, rx_id(pid))
    if not p:
        raise HTTPException(404, "Prescription not found")
    if b.status == "rejected" and not (b.note or "").strip():
        raise HTTPException(400, "Add a note telling the customer what's wrong")
    p.status, p.is_verified = b.status, b.status == "approved"
    p.verified_by, p.verified_at = admin.name or admin.email, now()
    if b.note and b.note.strip():
        p.notes = b.note.strip()
    db.commit()
    return rx_out(p)


# ---------------------------------------------------------------- admin: users + settings
@router.get("/admin/users")
def users(admin=Depends(auth.get_current_admin_user), db: Session = Depends(get_db)):
    return [user_out(u) for u in db.query(models.User).order_by(models.User.id)]


class SettingsIn(BaseModel):
    freeAbove: Optional[float] = None
    fee: Optional[float] = None
    portalTitle: Optional[str] = None
    rxCheck: Optional[bool] = None
    cod: Optional[bool] = None
    upi: Optional[bool] = None


@router.get("/settings")
def settings(db: Session = Depends(get_db)):
    return get_settings(db)


@router.put("/settings")
def put_settings(b: SettingsIn, admin=Depends(auth.get_current_admin_user), db: Session = Depends(get_db)):
    cur = {**get_settings(db), **{k: v for k, v in b.model_dump().items() if v is not None}}
    if not cur["cod"] and not cur["upi"]:
        cur["cod"] = True
    row = db.get(models.Setting, "store") or models.Setting(key="store")
    row.value = json.dumps(cur)
    db.merge(row); db.commit()
    return cur
