"""Startup tasks: create tables, add columns introduced in GenMedics 2.0, seed catalogue + accounts.

Runs automatically when the API starts (see main.py). Safe to run repeatedly.
"""
import json
import os
from pathlib import Path

from sqlalchemy import inspect, text

import auth
import models
from database import Base, SessionLocal, engine

CATALOGUE = Path(__file__).resolve().parent.parent / "web" / "public" / "data" / "medicines.json"

# columns added to tables that may already exist in an older database
NEW_COLUMNS = {
    "addresses": {"name": "VARCHAR", "phone": "VARCHAR", "line2": "VARCHAR"},
    "customer_orders": {
        "payment": "VARCHAR", "prescription_id": "INTEGER", "subtotal": "FLOAT", "delivery_fee": "FLOAT",
        "brand_total": "FLOAT", "address_snapshot": "TEXT", "status_history": "TEXT",
    },
}

DEMO_USERS = [
    {"name": "Pharmacist on duty", "email": "admin@genmedics.in", "password": os.getenv("ADMIN_PASSWORD", "Admin@123"), "is_admin": True},
    {"name": "Demo Customer", "email": "demo@genmedics.in", "password": "Demo@123", "phone": "9800000000", "is_admin": False},
]


def migrate():
    Base.metadata.create_all(bind=engine)
    insp = inspect(engine)
    with engine.begin() as conn:
        for table, cols in NEW_COLUMNS.items():
            have = {c["name"] for c in insp.get_columns(table)}
            for col, typ in cols.items():
                if col not in have:
                    conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {col} {typ}'))


def seed_catalogue(db):
    if db.query(models.Medicine).count() > 0 or not CATALOGUE.exists():
        return 0
    meds = json.loads(CATALOGUE.read_text(encoding="utf-8"))
    for m in meds:
        brand_units = [b["unit"] for b in m.get("brands", []) if b.get("unit")]
        db.add(models.Medicine(
            id=m["id"], name=m["name"], generic_name=m["salt"], category=m["cat"], price=m["price"],
            original_price=round(min(brand_units) * m["count"], 2) if brand_units and m.get("save") else m["price"],
            stock=m["stock"], low_stock_threshold=30, manufacturer="PMBI · Jan Aushadhi",
            prescription_required=m["rx"], description=m.get("use") or None, status="active",
            net_quantity=m["pack"], dosage=m["form"],
        ))
    db.commit()
    if engine.dialect.name == "postgresql":  # move the id sequence past the explicit ids
        db.execute(text("SELECT setval(pg_get_serial_sequence('medicines','id'), (SELECT MAX(id) FROM medicines))"))
        db.commit()
    return len(meds)


def seed_users(db):
    n = 0
    for u in DEMO_USERS:
        if not db.query(models.User).filter(models.User.email == u["email"]).first():
            db.add(models.User(name=u["name"], email=u["email"], phone=u.get("phone"), is_admin=u["is_admin"],
                               password_hash=auth.get_password_hash(u["password"]), is_active=True))
            n += 1
    db.commit()
    return n


def run():
    migrate()
    db = SessionLocal()
    try:
        meds = seed_catalogue(db)
        users = seed_users(db)
        if meds or users:
            print(f"[bootstrap] seeded {meds} medicines, {users} users")
    finally:
        db.close()


if __name__ == "__main__":
    run()
