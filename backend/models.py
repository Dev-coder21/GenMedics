from sqlalchemy import Boolean, Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

# Keep your existing Medicine model but enhance it
class Medicine(Base):
    __tablename__ = "medicines"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    generic_name = Column(String)
    category = Column(String)
    price = Column(Float)
    original_price = Column(Float, nullable=True)  # For discount calculation
    stock = Column(Integer)
    low_stock_threshold = Column(Integer)
    manufacturer = Column(String)
    prescription_required = Column(Boolean, default=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="active")
    
    # Additional fields for customer frontend
    image_url = Column(String, nullable=True)
    rating = Column(Float, default=0.0)
    reviews_count = Column(Integer, default=0)
    net_quantity = Column(String, nullable=True)
    dosage = Column(String, nullable=True)
    medical_conditions = Column(Text, nullable=True)  # JSON string
    side_effects = Column(Text, nullable=True)  # JSON string
    precautions = Column(Text, nullable=True)  # JSON string

# User management for customer side
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    phone = Column(String, nullable=True)
    password_hash = Column(String)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    addresses = relationship("Address", back_populates="user")
    orders = relationship("CustomerOrder", back_populates="user")
    prescriptions = relationship("Prescription", back_populates="user")

class Address(Base):
    __tablename__ = "addresses"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    label = Column(String)  # "home", "work", "other"
    street = Column(String)
    city = Column(String)
    state = Column(String)
    pincode = Column(String)
    is_default = Column(Boolean, default=False)
    
    user = relationship("User", back_populates="addresses")

# Customer orders (separate from admin orders)
class CustomerOrder(Base):
    __tablename__ = "customer_orders"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    total_amount = Column(Float)
    status = Column(String, default="pending")  # pending, confirmed, shipped, delivered
    created_at = Column(DateTime, default=datetime.utcnow)
    shipping_address_id = Column(Integer, ForeignKey("addresses.id"))
    tracking_number = Column(String, nullable=True)
    
    user = relationship("User", back_populates="orders")
    items = relationship("CustomerOrderItem", back_populates="order")
    shipping_address = relationship("Address")

class CustomerOrderItem(Base):
    __tablename__ = "customer_order_items"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("customer_orders.id"))
    medicine_id = Column(Integer, ForeignKey("medicines.id"))
    quantity = Column(Integer)
    price_per_unit = Column(Float)
    
    order = relationship("CustomerOrder", back_populates="items")
    medicine = relationship("Medicine")

class Prescription(Base):
    __tablename__ = "prescriptions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    image_path = Column(String)
    is_verified = Column(Boolean, default=False)
    verified_by = Column(String, nullable=True)  # doctor/pharmacist name
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    verified_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    ocr_text = Column(Text, nullable=True)
    matched_medicines = Column(Text, nullable=True)
    status = Column(String, default="pending")
    confidence_score = Column(Float, nullable=True)
    
    user = relationship("User", back_populates="prescriptions")

class Cart(Base):
    __tablename__ = "cart"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    medicine_id = Column(Integer, ForeignKey("medicines.id"))
    quantity = Column(Integer)
    added_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User")
    medicine = relationship("Medicine")

# Keep your existing admin models
class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    customer = Column(String)
    email = Column(String)
    amount = Column(Float)
    status = Column(String)
    date = Column(DateTime)
    shipping_address = Column(String)
    tracking_number = Column(String, nullable=True)
    items = relationship("OrderItem", back_populates="order")

class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    name = Column(String)
    quantity = Column(Integer)
    price = Column(Float)
    order = relationship("Order", back_populates="items")