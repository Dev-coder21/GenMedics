from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func
import models
import schemas
import auth
from fastapi import UploadFile, HTTPException
import shutil
import os
import uuid
import json
import re
from datetime import datetime
import httpx
try:
    from rapidfuzz import fuzz as rapidfuzz_fuzz
except ImportError:  # pragma: no cover - rapidfuzz is in requirements; difflib keeps imports working without it
    import difflib
    class rapidfuzz_fuzz:  # noqa: N801
        @staticmethod
        def token_set_ratio(a, b):
            a, b = " ".join(sorted(set(a.split()))), " ".join(sorted(set(b.split())))
            return difflib.SequenceMatcher(None, a, b).ratio() * 100
        partial_ratio = token_set_ratio

# User CRUD operations
def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).offset(skip).limit(limit).all()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(
        name=user.name,
        email=user.email,
        phone=user.phone,
        password_hash=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# Medicine CRUD operations
def get_medicines(db: Session, skip: int = 0, limit: int = 100, category: str = None):
    query = db.query(models.Medicine).filter(models.Medicine.status == "active")
    if category:
        query = query.filter(models.Medicine.category == category)
    return query.offset(skip).limit(limit).all()

def get_medicine(db: Session, medicine_id: int):
    return db.query(models.Medicine).filter(
        and_(models.Medicine.id == medicine_id, models.Medicine.status == "active")
    ).first()

def create_medicine(db: Session, medicine: schemas.MedicineCreate):
    db_medicine = models.Medicine(
        name=medicine.name,
        generic_name=medicine.generic_name,
        category=medicine.category,
        price=medicine.price,
        original_price=medicine.original_price or medicine.price,
        stock=medicine.stock,
        low_stock_threshold=medicine.low_stock_threshold or 10,
        manufacturer=medicine.manufacturer,
        prescription_required=medicine.prescription_required,
        description=medicine.description,
        image_url=medicine.image_url,
        net_quantity=medicine.net_quantity,
        dosage=medicine.dosage,
        status="active"
    )
    db.add(db_medicine)
    db.commit()
    db.refresh(db_medicine)
    return db_medicine

def update_medicine(db: Session, medicine_id: int, updates: schemas.MedicineUpdate):
    db_medicine = db.query(models.Medicine).filter(models.Medicine.id == medicine_id).first()
    if not db_medicine:
        return None
    update_data = updates.dict(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None:
            setattr(db_medicine, key, value)
    db.commit()
    db.refresh(db_medicine)
    return db_medicine

def delete_medicine(db: Session, medicine_id: int):
    db_medicine = db.query(models.Medicine).filter(models.Medicine.id == medicine_id).first()
    if not db_medicine:
        return False
    # Clear any active cart items referencing this medicine so FK constraint is satisfied
    db.query(models.Cart).filter(models.Cart.medicine_id == medicine_id).delete()
    
    has_orders = db.query(models.CustomerOrderItem).filter(models.CustomerOrderItem.medicine_id == medicine_id).first()
    if has_orders:
        db_medicine.status = "inactive"
    else:
        db.delete(db_medicine)
    db.commit()
    return True

def search_medicines(db: Session, query: str = "", category: str = None, min_price: float = None, max_price: float = None):
    db_query = db.query(models.Medicine).filter(models.Medicine.status == "active")
    
    if query:
        db_query = db_query.filter(
            or_(
                models.Medicine.name.ilike(f"%{query}%"),
                models.Medicine.generic_name.ilike(f"%{query}%"),
                models.Medicine.category.ilike(f"%{query}%")
            )
        )
    
    if category:
        db_query = db_query.filter(models.Medicine.category == category)
    
    if min_price:
        db_query = db_query.filter(models.Medicine.price >= min_price)
    
    if max_price:
        db_query = db_query.filter(models.Medicine.price <= max_price)
    
    return db_query.all()

def get_featured_medicines(db: Session):
    return db.query(models.Medicine).filter(
        and_(
            models.Medicine.status == "active",
            models.Medicine.rating >= 4.5
        )
    ).limit(8).all()

def get_medicines_by_category(db: Session, category: str):
    return db.query(models.Medicine).filter(
        and_(
            models.Medicine.category == category,
            models.Medicine.status == "active"
        )
    ).all()

# Cart CRUD operations
def get_user_cart(db: Session, user_id: int):
    return db.query(models.Cart).filter(models.Cart.user_id == user_id).all()

def add_to_cart(db: Session, user_id: int, item: schemas.CartAdd):
    # Check if item already exists in cart
    existing_item = db.query(models.Cart).filter(
        and_(
            models.Cart.user_id == user_id,
            models.Cart.medicine_id == item.medicine_id
        )
    ).first()
    
    if existing_item:
        # Update quantity
        existing_item.quantity += item.quantity
        db.commit()
        db.refresh(existing_item)
        return existing_item
    else:
        # Create new cart item
        db_item = models.Cart(
            user_id=user_id,
            medicine_id=item.medicine_id,
            quantity=item.quantity
        )
        db.add(db_item)
        db.commit()
        db.refresh(db_item)
        return db_item

def remove_from_cart(db: Session, item_id: int, user_id: int):
    item = db.query(models.Cart).filter(
        and_(
            models.Cart.id == item_id,
            models.Cart.user_id == user_id
        )
    ).first()
    
    if item:
        db.delete(item)
        db.commit()
        return True
    return False

def clear_user_cart(db: Session, user_id: int):
    db.query(models.Cart).filter(models.Cart.user_id == user_id).delete()
    db.commit()

# Address CRUD operations
def get_user_addresses(db: Session, user_id: int):
    return db.query(models.Address).filter(models.Address.user_id == user_id).all()

def create_address(db: Session, address: schemas.AddressCreate, user_id: int):
    # If this is set as default, make all other addresses non-default
    if address.is_default:
        db.query(models.Address).filter(models.Address.user_id == user_id).update(
            {"is_default": False}
        )
    
    db_address = models.Address(**address.dict(), user_id=user_id)
    db.add(db_address)
    db.commit()
    db.refresh(db_address)
    return db_address

# Order CRUD operations
def get_user_orders(db: Session, user_id: int):
    return db.query(models.CustomerOrder).filter(
        models.CustomerOrder.user_id == user_id
    ).order_by(models.CustomerOrder.created_at.desc()).all()

def get_order(db: Session, order_id: int, user_id: int):
    return db.query(models.CustomerOrder).filter(
        and_(
            models.CustomerOrder.id == order_id,
            models.CustomerOrder.user_id == user_id
        )
    ).first()

def create_order(db: Session, order: schemas.CustomerOrderCreate, user_id: int):
    # Calculate total amount from cart items
    cart_items = get_user_cart(db, user_id)
    # If DB cart is empty, populate from order.items if provided
    if not cart_items and order.items:
        for it in order.items:
            add_to_cart(db, user_id, schemas.CartAdd(medicine_id=it.medicine_id, quantity=it.quantity))
        cart_items = get_user_cart(db, user_id)

    if not cart_items:
        raise ValueError("Cart is empty")
    
    total_amount = 0
    order_items = []
    
    for cart_item in cart_items:
        medicine = get_medicine(db, cart_item.medicine_id)
        if not medicine or medicine.stock < cart_item.quantity:
            raise ValueError(f"Insufficient stock for {medicine.name if medicine else 'unknown medicine'}")
        
        item_total = medicine.price * cart_item.quantity
        total_amount += item_total
        
        order_items.append({
            "medicine_id": cart_item.medicine_id,
            "quantity": cart_item.quantity,
            "price_per_unit": medicine.price
        })
        
        # Update stock
        medicine.stock -= cart_item.quantity
    
    # Create order
    db_order = models.CustomerOrder(
        user_id=user_id,
        total_amount=total_amount,
        shipping_address_id=order.shipping_address_id,
        status="pending"
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    
    # Create order items
    for item_data in order_items:
        db_item = models.CustomerOrderItem(
            order_id=db_order.id,
            **item_data
        )
        db.add(db_item)
    
    # Clear cart
    clear_user_cart(db, user_id)
    
    db.commit()
    db.refresh(db_order)
    return db_order

# Admin Order CRUD operations
def get_all_customer_orders(db: Session, skip: int = 0, limit: int = 100):
    return (
        db.query(models.CustomerOrder)
        .options(
            joinedload(models.CustomerOrder.user),
            joinedload(models.CustomerOrder.shipping_address),
            joinedload(models.CustomerOrder.items).joinedload(models.CustomerOrderItem.medicine),
        )
        .order_by(models.CustomerOrder.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def get_customer_order_by_id(db: Session, order_id: int):
    return (
        db.query(models.CustomerOrder)
        .options(
            joinedload(models.CustomerOrder.user),
            joinedload(models.CustomerOrder.shipping_address),
            joinedload(models.CustomerOrder.items).joinedload(models.CustomerOrderItem.medicine),
        )
        .filter(models.CustomerOrder.id == order_id)
        .first()
    )

def update_customer_order_status(db: Session, order_id: int, status: str):
    order = db.query(models.CustomerOrder).filter(models.CustomerOrder.id == order_id).first()
    if not order:
        return None
    order.status = status
    db.commit()
    db.refresh(order)
    return get_customer_order_by_id(db, order_id)

def format_admin_order(order: models.CustomerOrder) -> dict:
    customer_name = order.user.name if order.user and order.user.name else f"Customer #{order.user_id}"
    customer_email = order.user.email if order.user and order.user.email else ""
    
    if order.shipping_address:
        addr = order.shipping_address
        parts = [p for p in [addr.street, addr.city, addr.state, addr.pincode] if p]
        shipping_address_str = ", ".join(parts) if parts else "N/A"
    else:
        shipping_address_str = "N/A"
        
    items = []
    for item in (order.items or []):
        med_name = item.medicine.name if item.medicine and item.medicine.name else f"Medicine #{item.medicine_id}"
        items.append({
            "name": med_name,
            "quantity": item.quantity,
            "price": item.price_per_unit,
        })
        
    return {
        "id": f"#{order.id}",
        "customer": customer_name,
        "email": customer_email,
        "amount": order.total_amount,
        "status": order.status,
        "date": order.created_at,
        "shippingAddress": shipping_address_str,
        "trackingNumber": order.tracking_number,
        "items": items,
    }

# Prescription CRUD operations
def get_user_prescriptions(db: Session, user_id: int):
    return db.query(models.Prescription).filter(
        models.Prescription.user_id == user_id
    ).order_by(models.Prescription.uploaded_at.desc()).all()

def get_user_prescription_by_id(db: Session, prescription_id: int, user_id: int):
    return db.query(models.Prescription).filter(
        models.Prescription.id == prescription_id,
        models.Prescription.user_id == user_id
    ).first()

ALLOWED_PRESCRIPTION_EXTS = {'.png', '.jpg', '.jpeg', '.bmp'}
MAX_PRESCRIPTION_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB

async def scan_and_process_prescription(db: Session, file: UploadFile, user_id: int):
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_PRESCRIPTION_EXTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed formats are PNG, JPG, JPEG, BMP."
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(file_bytes) > MAX_PRESCRIPTION_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Prescription file exceeds maximum allowed size (10 MB)."
        )

    upload_dir = "uploads/prescriptions"
    os.makedirs(upload_dir, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    unique_id = uuid.uuid4().hex[:8]
    safe_filename = f"{user_id}_{timestamp}_{unique_id}{ext}"
    file_path = os.path.join(upload_dir, safe_filename)

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    scanner_url = os.getenv("SCANNER_URL", "http://127.0.0.1:4712/scan-text-only")
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            files = {"file": (safe_filename, file_bytes, file.content_type or "image/png")}
            resp = await client.post(scanner_url, files=files)
    except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError):
        raise HTTPException(status_code=502, detail="Prescription scanner service unavailable.")
    except Exception:
        raise HTTPException(status_code=500, detail="Unexpected failure communicating with scanner service.")

    if resp.status_code == 400:
        error_detail = "Could not extract any text from the image."
        try:
            error_detail = resp.json().get("detail", error_detail)
        except Exception:
            pass
        raise HTTPException(status_code=400, detail=error_detail)
    elif resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Scanner service returned an unexpected error.")

    try:
        scanner_data = resp.json()
    except Exception:
        raise HTTPException(status_code=500, detail="Invalid response from scanner service.")

    ocr_text = scanner_data.get("text", "")
    scanner_confidence = float(scanner_data.get("confidence", 0.0))
    scanner_meds = scanner_data.get("medicines", [])

    all_meds = db.query(models.Medicine).all()
    clean_ocr = re.sub(r'[^a-z0-9\s]', ' ', ocr_text.lower()) if ocr_text else ""
    ocr_lines = [re.sub(r'[^a-z0-9\s]', ' ', l.lower()).strip() for l in ocr_text.split('\n') if l.strip()]
    ignore_terms = {'prescription', 'patient', 'doctor', 'signature', 'date', 'rx', 'medical', 'license', 'duration', 'days', 'take', 'tablet', 'capsule'}

    matched_medicines = []
    seen_med_ids = set()

    for med in all_meds:
        med_name_clean = re.sub(r'[^a-z0-9\s]', ' ', med.name.lower()).strip()
        med_generic_clean = re.sub(r'[^a-z0-9\s]', ' ', med.generic_name.lower()).strip() if med.generic_name else ""

        best_score = 0.0

        for sm in scanner_meds:
            sm_name = re.sub(r'[^a-z0-9\s]', ' ', sm.get('name', '').lower()).strip()
            if sm_name:
                s1 = rapidfuzz_fuzz.token_set_ratio(med_name_clean, sm_name) if med_name_clean else 0
                s2 = rapidfuzz_fuzz.token_set_ratio(med_generic_clean, sm_name) if med_generic_clean else 0
                best_score = max(best_score, s1, s2)

        for line in ocr_lines:
            if len(line) >= 4 and line not in ignore_terms:
                s1 = rapidfuzz_fuzz.token_set_ratio(line, med_name_clean) if med_name_clean else 0
                s2 = rapidfuzz_fuzz.token_set_ratio(line, med_generic_clean) if med_generic_clean else 0
                best_score = max(best_score, s1, s2)

        if med_generic_clean and len(med_generic_clean) >= 4:
            pr = rapidfuzz_fuzz.partial_ratio(med_generic_clean, clean_ocr)
            if pr >= 85:
                best_score = max(best_score, float(pr))

        if best_score >= 75.0 and med.id not in seen_med_ids:
            seen_med_ids.add(med.id)
            matched_medicines.append({
                "medicine_id": med.id,
                "name": med.name,
                "generic_name": med.generic_name or "",
                "price": float(med.price),
                "dosage": med.dosage or "",
                "confidence": round(best_score, 1),
                "in_stock": bool(med.stock is not None and med.stock > 0)
            })

    matched_medicines.sort(key=lambda x: x["confidence"], reverse=True)

    relative_path = f"uploads/prescriptions/{safe_filename}"
    db_prescription = models.Prescription(
        user_id=user_id,
        image_path=relative_path,
        ocr_text=ocr_text,
        matched_medicines=json.dumps(matched_medicines),
        status="pending",
        confidence_score=scanner_confidence,
        is_verified=False,
        uploaded_at=datetime.utcnow()
    )
    db.add(db_prescription)
    db.commit()
    db.refresh(db_prescription)

    return {
        "prescription_id": db_prescription.id,
        "status": "pending",
        "image_url": f"/{relative_path}",
        "ocr_text": ocr_text,
        "matched_medicines": matched_medicines,
        "confidence_score": scanner_confidence,
        "uploaded_at": db_prescription.uploaded_at.isoformat()
    }

def get_all_prescriptions_for_admin(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Prescription).options(
        joinedload(models.Prescription.user)
    ).order_by(models.Prescription.uploaded_at.desc()).offset(skip).limit(limit).all()

def format_admin_prescription(prescription: models.Prescription):
    matched = []
    if prescription.matched_medicines:
        try:
            matched = json.loads(prescription.matched_medicines)
        except Exception:
            matched = []

    filename = os.path.basename(prescription.image_path) if prescription.image_path else ""
    image_url = f"/uploads/prescriptions/{filename}" if filename else ""

    return {
        "id": f"#{prescription.id}",
        "prescription_id": prescription.id,
        "customer": prescription.user.name if prescription.user else f"User #{prescription.user_id}",
        "customer_email": prescription.user.email if prescription.user else "unknown",
        "upload_date": prescription.uploaded_at.isoformat() if prescription.uploaded_at else "",
        "status": prescription.status or ("approved" if prescription.is_verified else "pending"),
        "is_verified": bool(prescription.is_verified),
        "confidence": round(prescription.confidence_score or 0.0, 1),
        "ocr_text": prescription.ocr_text or "",
        "matched_medicines": matched,
        "image_url": image_url,
        "verified_by": prescription.verified_by,
        "verified_at": prescription.verified_at.isoformat() if prescription.verified_at else None,
        "notes": prescription.notes
    }

def update_admin_prescription(db: Session, prescription_id: int, updates: schemas.AdminPrescriptionUpdate, admin_user: models.User):
    prescription = db.query(models.Prescription).filter(models.Prescription.id == prescription_id).first()
    if not prescription:
        return None

    if updates.status is not None:
        normalized_status = updates.status.strip().lower()
        prescription.status = normalized_status
        if normalized_status == "approved":
            prescription.is_verified = True
        elif normalized_status == "rejected":
            prescription.is_verified = False

    if updates.is_verified is not None:
        prescription.is_verified = updates.is_verified
        if updates.is_verified and not updates.status:
            prescription.status = "approved"

    prescription.verified_by = admin_user.name or admin_user.email
    prescription.verified_at = datetime.utcnow()

    if updates.notes is not None:
        prescription.notes = updates.notes

    db.commit()
    db.refresh(prescription)
    return prescription

# Admin Dashboard Stats
def get_admin_dashboard_stats(db: Session):
    total_revenue = db.query(func.coalesce(func.sum(models.CustomerOrder.total_amount), 0.0)).scalar() or 0.0
    orders_count = db.query(models.CustomerOrder).count()
    products_count = db.query(models.Medicine).filter(models.Medicine.status == "active").count()
    active_users_count = db.query(models.User).filter(models.User.is_active == True).count()

    recent_orders_db = (
        db.query(models.CustomerOrder)
        .options(joinedload(models.CustomerOrder.user))
        .order_by(models.CustomerOrder.created_at.desc())
        .limit(5)
        .all()
    )
    recent_orders = []
    for o in recent_orders_db:
        cust_name = o.user.name if o.user and o.user.name else f"Customer #{o.user_id}"
        date_str = o.created_at.strftime("%Y-%m-%d") if o.created_at else ""
        recent_orders.append({
            "id": f"#{o.id}",
            "customer": cust_name,
            "amount": f"${o.total_amount:.2f}",
            "status": o.status.capitalize(),
            "date": date_str,
        })

    low_stock_db = (
        db.query(models.Medicine)
        .filter(
            models.Medicine.status == "active",
            models.Medicine.stock <= func.coalesce(models.Medicine.low_stock_threshold, 10)
        )
        .limit(5)
        .all()
    )
    low_stock_items = [
        {
            "name": m.name,
            "stock": m.stock,
            "threshold": m.low_stock_threshold or 10,
        }
        for m in low_stock_db
    ]

    revenue_inr_formatted = f"₹{float(total_revenue) * 83:,.2f}"

    return {
        "total_revenue": float(total_revenue),
        "total_revenue_formatted": revenue_inr_formatted,
        "orders_count": orders_count,
        "products_count": products_count,
        "active_users_count": active_users_count,
        "recent_orders": recent_orders,
        "low_stock_items": low_stock_items,
    }