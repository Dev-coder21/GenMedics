# backend/schemas.py

from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

# Medicine schemas
class MedicineBase(BaseModel):
    name: str
    generic_name: str
    category: str
    price: float
    original_price: Optional[float] = None
    stock: int
    manufacturer: str
    prescription_required: bool = False
    description: Optional[str] = None
    image_url: Optional[str] = None
    rating: float = 0.0
    reviews_count: int = 0
    net_quantity: Optional[str] = None
    dosage: Optional[str] = None
    medical_conditions: Optional[str] = None
    side_effects: Optional[str] = None
    precautions: Optional[str] = None

class Medicine(MedicineBase):
    id: int
    status: str
    discount_percentage: Optional[int] = None
    in_stock: bool = True
    generic_available: bool = True
    
    class Config:
        from_attributes = True

class MedicineCard(BaseModel):
    """Simplified schema for product cards"""
    id: int
    name: str
    generic_name: str
    price: float
    original_price: Optional[float]
    discount_percentage: Optional[int]
    image_url: Optional[str]
    rating: float
    reviews_count: int
    prescription_required: bool
    in_stock: bool
    manufacturer: str
    net_quantity: Optional[str]

class MedicineCreate(BaseModel):
    name: str
    generic_name: str
    category: str
    price: float
    stock: int
    manufacturer: str
    prescription_required: bool = False
    low_stock_threshold: Optional[int] = 10
    original_price: Optional[float] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    net_quantity: Optional[str] = None
    dosage: Optional[str] = None

class MedicineUpdate(BaseModel):
    name: Optional[str] = None
    generic_name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    manufacturer: Optional[str] = None
    prescription_required: Optional[bool] = None
    low_stock_threshold: Optional[int] = None
    original_price: Optional[float] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    status: Optional[str] = None

# User schemas
class UserBase(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool
    is_admin: bool = False
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str

# Address schemas
class AddressBase(BaseModel):
    label: str
    street: str
    city: str
    state: str
    pincode: str
    is_default: bool = False

class AddressCreate(AddressBase):
    pass

class Address(AddressBase):
    id: int
    user_id: int
    
    class Config:
        from_attributes = True

# Cart schemas
class CartItemBase(BaseModel):
    medicine_id: int
    quantity: int

class CartItem(CartItemBase):
    id: int
    user_id: int
    medicine: Medicine
    added_at: datetime
    
    class Config:
        from_attributes = True

class CartAdd(BaseModel):
    medicine_id: int
    quantity: int = 1

# Order schemas
class OrderItemBase(BaseModel):
    medicine_id: int
    quantity: int
    price_per_unit: float

class OrderItem(OrderItemBase):
    id: int
    medicine: Medicine
    
    class Config:
        from_attributes = True

class CustomerOrderBase(BaseModel):
    shipping_address_id: int
    
class CustomerOrderCreate(CustomerOrderBase):
    items: Optional[List[OrderItemBase]] = []

class CustomerOrder(CustomerOrderBase):
    id: int
    user_id: int
    total_amount: float
    status: str
    created_at: datetime
    tracking_number: Optional[str]
    items: List[OrderItem]
    shipping_address: Address
    
    class Config:
        from_attributes = True

# Admin Order schemas
class AdminOrderItemResponse(BaseModel):
    name: str
    quantity: int
    price: float

    class Config:
        from_attributes = True

class AdminOrderResponse(BaseModel):
    id: str
    customer: str
    email: str
    amount: float
    status: str
    date: datetime
    shippingAddress: str
    trackingNumber: Optional[str] = None
    items: List[AdminOrderItemResponse] = []

    class Config:
        from_attributes = True

class OrderStatusUpdate(BaseModel):
    status: str

# Admin Dashboard schemas
class DashboardRecentOrder(BaseModel):
    id: str
    customer: str
    amount: str
    status: str
    date: str

class DashboardLowStockItem(BaseModel):
    name: str
    stock: int
    threshold: int

class DashboardStats(BaseModel):
    total_revenue: float
    total_revenue_formatted: str
    orders_count: int
    products_count: int
    active_users_count: int
    recent_orders: List[DashboardRecentOrder]
    low_stock_items: List[DashboardLowStockItem]

# Prescription schemas
class PrescriptionBase(BaseModel):
    notes: Optional[str] = None

class PrescriptionUpload(PrescriptionBase):
    pass

class Prescription(PrescriptionBase):
    id: int
    user_id: int
    image_path: str
    is_verified: bool
    verified_by: Optional[str]
    uploaded_at: datetime
    verified_at: Optional[datetime]
    
    class Config:
        from_attributes = True

# Search and filter schemas
class MedicineSearch(BaseModel):
    query: Optional[str] = None
    category: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    in_stock_only: bool = True
    prescription_required: Optional[bool] = None

# Authentication schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# Prescription scan schemas
class MatchedMedicineItem(BaseModel):
    medicine_id: int
    name: str
    generic_name: Optional[str] = None
    price: float
    dosage: Optional[str] = None
    confidence: float
    in_stock: bool

class PrescriptionScanResponse(BaseModel):
    prescription_id: int
    status: str
    image_url: str
    ocr_text: str
    matched_medicines: List[MatchedMedicineItem]
    confidence_score: float
    uploaded_at: str

class AdminPrescriptionResponse(BaseModel):
    id: str
    prescription_id: int
    customer: str
    customer_email: str
    upload_date: str
    status: str
    is_verified: bool
    confidence: float
    ocr_text: str
    matched_medicines: List[dict]
    image_url: str
    verified_by: Optional[str] = None
    verified_at: Optional[str] = None
    notes: Optional[str] = None

class AdminPrescriptionUpdate(BaseModel):
    status: Optional[str] = None
    is_verified: Optional[bool] = None
    notes: Optional[str] = None