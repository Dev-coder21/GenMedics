# backend/main.py

import os
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List, Optional
import json

# Import your existing database connection
from database import get_db, engine
import models
import schemas
import crud_user  # We'll create this
import auth  # We'll create this

import bootstrap
from v2 import router as v2_router

# Create tables, add new columns, seed catalogue + demo accounts
bootstrap.run()

app = FastAPI(title="GenMedics User API", version="1.0.0")

# Mount uploads directory for prescription previews
os.makedirs("uploads/prescriptions", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.include_router(v2_router)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002"
    ],
    # the GenMedics web app (npm run serve) and any other local port
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add a simple root endpoint
@app.get("/")
def root():
    return {"message": "Welcome to GenMedics API. Please use /docs for API documentation."}

security = HTTPBearer()

# Helper function to transform medicine data for frontend
def transform_medicine_for_frontend(medicine):
    """Transform database medicine to frontend format"""
    discount_percentage = 0
    if medicine.original_price and medicine.original_price > medicine.price:
        discount_percentage = int(((medicine.original_price - medicine.price) / medicine.original_price) * 100)
    
    # Parse JSON fields
    medical_conditions = json.loads(medicine.medical_conditions) if medicine.medical_conditions else []
    side_effects = json.loads(medicine.side_effects) if medicine.side_effects else []
    precautions = json.loads(medicine.precautions) if medicine.precautions else []
    
    return {
        "id": medicine.id,
        "name": medicine.name,
        "generic_name": medicine.generic_name,
        "price": medicine.price,
        "original_price": medicine.original_price,
        "discount_percentage": discount_percentage,
        "net_quantity": medicine.net_quantity,
        "image_url": medicine.image_url,
        "manufacturer": medicine.manufacturer,
        "category": medicine.category,
        "rating": medicine.rating,
        "reviews_count": medicine.reviews_count,
        "prescription_required": medicine.prescription_required,
        "stock": medicine.stock,
        "low_stock_threshold": medicine.low_stock_threshold,
        "status": medicine.status,
        "in_stock": medicine.stock > 0 if medicine.stock is not None else False,
        "generic_available": True,
        "dosage": medicine.dosage,
        "medical_conditions": medical_conditions,
        "side_effects": side_effects,
        "precautions": precautions,
        "description": medicine.description
    }

# Authentication endpoints
@app.post("/auth/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud_user.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud_user.create_user(db=db, user=user)

@app.post("/auth/login", response_model=schemas.Token)
def login(user_credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = auth.authenticate_user(db, user_credentials.email, user_credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/auth/profile", response_model=schemas.User)
def get_profile(current_user: schemas.User = Depends(auth.get_current_user)):
    return current_user

@app.get("/users", response_model=List[schemas.User])
def get_users(
    skip: int = 0,
    limit: int = 100,
    current_admin: models.User = Depends(auth.get_current_admin_user),
    db: Session = Depends(get_db)
):
    return crud_user.get_users(db, skip=skip, limit=limit)

# Medicine endpoints for customer frontend
@app.get("/medicines")
def get_medicines(
    skip: int = 0, 
    limit: int = 100, 
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    medicines = crud_user.get_medicines(db, skip=skip, limit=limit, category=category)
    return {
        "medicines": [transform_medicine_for_frontend(med) for med in medicines]
    }

@app.get("/medicines/search")
def search_medicines(
    q: str = "", 
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    db: Session = Depends(get_db)
):
    medicines = crud_user.search_medicines(
        db, query=q, category=category, min_price=min_price, max_price=max_price
    )
    return {
        "medicines": [transform_medicine_for_frontend(med) for med in medicines]
    }

@app.get("/medicines/featured")
def get_featured_medicines(db: Session = Depends(get_db)):
    medicines = crud_user.get_featured_medicines(db)
    return {
        "medicines": [transform_medicine_for_frontend(med) for med in medicines]
    }

@app.get("/medicines/{medicine_id}")
def get_medicine(medicine_id: int, db: Session = Depends(get_db)):
    medicine = crud_user.get_medicine(db, medicine_id=medicine_id)
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return transform_medicine_for_frontend(medicine)

@app.get("/medicines/category/{category}")
def get_medicines_by_category(category: str, db: Session = Depends(get_db)):
    medicines = crud_user.get_medicines_by_category(db, category=category)
    return {
        "medicines": [transform_medicine_for_frontend(med) for med in medicines]
    }

# Admin Inventory endpoints
@app.post("/medicines")
def create_medicine(
    medicine: schemas.MedicineCreate,
    current_admin: models.User = Depends(auth.get_current_admin_user),
    db: Session = Depends(get_db)
):
    med = crud_user.create_medicine(db, medicine)
    return transform_medicine_for_frontend(med)

@app.patch("/medicines/{medicine_id}")
def update_medicine(
    medicine_id: int,
    updates: schemas.MedicineUpdate,
    current_admin: models.User = Depends(auth.get_current_admin_user),
    db: Session = Depends(get_db)
):
    med = crud_user.update_medicine(db, medicine_id=medicine_id, updates=updates)
    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return transform_medicine_for_frontend(med)

@app.delete("/medicines/{medicine_id}")
def delete_medicine(
    medicine_id: int,
    current_admin: models.User = Depends(auth.get_current_admin_user),
    db: Session = Depends(get_db)
):
    success = crud_user.delete_medicine(db, medicine_id=medicine_id)
    if not success:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return {"message": "Medicine deleted successfully", "id": medicine_id}

# Cart endpoints
@app.get("/cart", response_model=List[schemas.CartItem])
def get_cart(
    current_user: schemas.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    return crud_user.get_user_cart(db, user_id=current_user.id)

@app.post("/cart")
def add_to_cart(
    item: schemas.CartAdd,
    current_user: schemas.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    return crud_user.add_to_cart(db, user_id=current_user.id, item=item)

@app.delete("/cart/{item_id}")
def remove_from_cart(
    item_id: int,
    current_user: schemas.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    success = crud_user.remove_from_cart(db, item_id=item_id, user_id=current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Cart item not found")
    return {"message": "Item removed from cart"}

# Address endpoints
@app.get("/addresses", response_model=List[schemas.Address])
def get_addresses(
    current_user: schemas.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    return crud_user.get_user_addresses(db, user_id=current_user.id)

@app.post("/addresses", response_model=schemas.Address)
def create_address(
    address: schemas.AddressCreate,
    current_user: schemas.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    return crud_user.create_address(db, address=address, user_id=current_user.id)

# Order endpoints
@app.get("/orders", response_model=List[schemas.CustomerOrder])
def get_orders(
    current_user: schemas.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    return crud_user.get_user_orders(db, user_id=current_user.id)

@app.post("/orders", response_model=schemas.CustomerOrder)
def create_order(
    order: schemas.CustomerOrderCreate,
    current_user: schemas.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return crud_user.create_order(db, order=order, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@app.get("/orders/{order_id}", response_model=schemas.CustomerOrder)
def get_order(
    order_id: int,
    current_user: schemas.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    order = crud_user.get_order(db, order_id=order_id, user_id=current_user.id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

# Admin Order endpoints
ALLOWED_ORDER_STATUSES = {"pending", "processing", "confirmed", "shipped", "delivered"}

@app.get("/admin/orders", response_model=List[schemas.AdminOrderResponse])
def get_admin_orders(
    skip: int = 0,
    limit: int = 100,
    current_admin: models.User = Depends(auth.get_current_admin_user),
    db: Session = Depends(get_db)
):
    orders = crud_user.get_all_customer_orders(db, skip=skip, limit=limit)
    return [crud_user.format_admin_order(order) for order in orders]

@app.patch("/admin/orders/{order_id}", response_model=schemas.AdminOrderResponse)
def update_admin_order_status(
    order_id: str,
    status_update: schemas.OrderStatusUpdate,
    current_admin: models.User = Depends(auth.get_current_admin_user),
    db: Session = Depends(get_db)
):
    clean_id_str = order_id.lstrip("#").strip()
    if not clean_id_str.isdigit():
        raise HTTPException(status_code=404, detail="Order not found")
    
    clean_id = int(clean_id_str)
    normalized_status = status_update.status.strip().lower()
    if normalized_status not in ALLOWED_ORDER_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{status_update.status}'. Allowed statuses are: {', '.join(sorted(ALLOWED_ORDER_STATUSES))}"
        )
        
    updated_order = crud_user.update_customer_order_status(db, order_id=clean_id, status=normalized_status)
    if not updated_order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    return crud_user.format_admin_order(updated_order)

# Admin Dashboard endpoint
@app.get("/admin/dashboard", response_model=schemas.DashboardStats)
def get_admin_dashboard(
    current_admin: models.User = Depends(auth.get_current_admin_user),
    db: Session = Depends(get_db)
):
    return crud_user.get_admin_dashboard_stats(db)

# Prescription endpoints
@app.post("/prescriptions/scan", response_model=schemas.PrescriptionScanResponse)
async def scan_prescription(
    file: UploadFile = File(...),
    current_user: schemas.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    return await crud_user.scan_and_process_prescription(db, file=file, user_id=current_user.id)

@app.get("/prescriptions", response_model=List[schemas.Prescription])
def get_prescriptions(
    current_user: schemas.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    return crud_user.get_user_prescriptions(db, user_id=current_user.id)

@app.get("/prescriptions/{prescription_id}")
def get_prescription(
    prescription_id: int,
    current_user: schemas.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    p = crud_user.get_user_prescription_by_id(db, prescription_id=prescription_id, user_id=current_user.id)
    if not p:
        raise HTTPException(status_code=404, detail="Prescription not found")
    matched = []
    if p.matched_medicines:
        try:
            matched = json.loads(p.matched_medicines)
        except Exception:
            pass
    filename = os.path.basename(p.image_path) if p.image_path else ""
    return {
        "prescription_id": p.id,
        "status": p.status or "pending",
        "image_url": f"/uploads/prescriptions/{filename}" if filename else "",
        "ocr_text": p.ocr_text or "",
        "matched_medicines": matched,
        "confidence_score": p.confidence_score or 0.0,
        "uploaded_at": p.uploaded_at.isoformat() if p.uploaded_at else ""
    }

# Admin Prescription endpoints
@app.get("/admin/prescriptions", response_model=List[schemas.AdminPrescriptionResponse])
def get_admin_prescriptions(
    skip: int = 0,
    limit: int = 100,
    current_admin: models.User = Depends(auth.get_current_admin_user),
    db: Session = Depends(get_db)
):
    prescriptions = crud_user.get_all_prescriptions_for_admin(db, skip=skip, limit=limit)
    return [crud_user.format_admin_prescription(p) for p in prescriptions]

@app.patch("/admin/prescriptions/{prescription_id}", response_model=schemas.AdminPrescriptionResponse)
def update_admin_prescription(
    prescription_id: str,
    updates: schemas.AdminPrescriptionUpdate,
    current_admin: models.User = Depends(auth.get_current_admin_user),
    db: Session = Depends(get_db)
):
    clean_id_str = prescription_id.lstrip("#").strip()
    if not clean_id_str.isdigit():
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    clean_id = int(clean_id_str)
    updated = crud_user.update_admin_prescription(db, prescription_id=clean_id, updates=updates, admin_user=current_admin)
    if not updated:
        raise HTTPException(status_code=404, detail="Prescription not found")
    return crud_user.format_admin_prescription(updated)

# Health check
@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "genmedics-user-api"}


# Provide a simple favicon handler to avoid 404s when browsers request /favicon.ico
@app.get("/favicon.ico")
def favicon():
    """Return no content for favicon requests to avoid 404 log entries from browsers."""
    return Response(status_code=204)