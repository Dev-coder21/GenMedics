# backend/seed_data.py
from database import SessionLocal
import models
import json

def seed_medicines():
    db = SessionLocal()
    
    # Check if medicines already exist
    existing = db.query(models.Medicine).first()
    if existing:
        print("Medicines already exist in database. Skipping seed.")
        return
    
    sample_medicines = [
        {
            "name": "Paracetamol 500mg",
            "generic_name": "Paracetamol",
            "category": "Pain Relief",
            "price": 25.00,
            "original_price": 35.00,
            "stock": 500,
            "low_stock_threshold": 50,
            "manufacturer": "Sun Pharma",
            "prescription_required": False,
            "description": "Effective pain reliever and fever reducer",
            "image_url": "/images/paracetamol.jpg",
            "rating": 4.5,
            "reviews_count": 245,
            "net_quantity": "10 tablets",
            "dosage": "500mg",
            "medical_conditions": json.dumps(["Headache", "Fever", "Body Pain"]),
            "side_effects": json.dumps(["Nausea (rare)", "Allergic reactions (rare)"]),
            "precautions": json.dumps(["Do not exceed recommended dose", "Avoid alcohol"])
        },
        {
            "name": "Amoxicillin 250mg",
            "generic_name": "Amoxicillin",
            "category": "Antibiotics",
            "price": 120.00,
            "original_price": 150.00,
            "stock": 200,
            "low_stock_threshold": 30,
            "manufacturer": "Cipla",
            "prescription_required": True,
            "description": "Antibiotic for bacterial infections",
            "image_url": "/images/amoxicillin.jpg",
            "rating": 4.7,
            "reviews_count": 189,
            "net_quantity": "10 capsules",
            "dosage": "250mg",
            "medical_conditions": json.dumps(["Bacterial Infections", "Respiratory Infections"]),
            "side_effects": json.dumps(["Diarrhea", "Nausea", "Skin rash"]),
            "precautions": json.dumps(["Complete full course", "Take with food"])
        },
        {
            "name": "Cetirizine 10mg",
            "generic_name": "Cetirizine",
            "category": "Allergy",
            "price": 45.00,
            "original_price": 60.00,
            "stock": 350,
            "low_stock_threshold": 40,
            "manufacturer": "Dr. Reddy's",
            "prescription_required": False,
            "description": "Antihistamine for allergy relief",
            "image_url": "/images/cetirizine.jpg",
            "rating": 4.6,
            "reviews_count": 312,
            "net_quantity": "10 tablets",
            "dosage": "10mg",
            "medical_conditions": json.dumps(["Allergies", "Hay Fever", "Skin Allergies"]),
            "side_effects": json.dumps(["Drowsiness", "Dry mouth", "Fatigue"]),
            "precautions": json.dumps(["May cause drowsiness", "Avoid alcohol"])
        },
        {
            "name": "Vitamin D3 60000 IU",
            "generic_name": "Cholecalciferol",
            "category": "Vitamins",
            "price": 85.00,
            "original_price": 100.00,
            "stock": 400,
            "low_stock_threshold": 50,
            "manufacturer": "Mankind",
            "prescription_required": False,
            "description": "Vitamin D supplement for bone health",
            "image_url": "/images/vitamin-d3.jpg",
            "rating": 4.8,
            "reviews_count": 428,
            "net_quantity": "4 capsules",
            "dosage": "60000 IU",
            "medical_conditions": json.dumps(["Vitamin D Deficiency", "Bone Health"]),
            "side_effects": json.dumps(["Generally well tolerated"]),
            "precautions": json.dumps(["Take as directed", "Consult doctor if pregnant"])
        },
        {
            "name": "Omeprazole 20mg",
            "generic_name": "Omeprazole",
            "category": "Digestive Health",
            "price": 95.00,
            "original_price": 120.00,
            "stock": 280,
            "low_stock_threshold": 35,
            "manufacturer": "Sun Pharma",
            "prescription_required": False,
            "description": "Reduces stomach acid production",
            "image_url": "/images/omeprazole.jpg",
            "rating": 4.5,
            "reviews_count": 201,
            "net_quantity": "15 capsules",
            "dosage": "20mg",
            "medical_conditions": json.dumps(["Acid Reflux", "GERD", "Stomach Ulcers"]),
            "side_effects": json.dumps(["Headache", "Nausea", "Diarrhea"]),
            "precautions": json.dumps(["Take before meals", "Long-term use needs monitoring"])
        },
        {
            "name": "Metformin 500mg",
            "generic_name": "Metformin HCl",
            "category": "Diabetes",
            "price": 65.00,
            "original_price": 80.00,
            "stock": 450,
            "low_stock_threshold": 60,
            "manufacturer": "Cipla",
            "prescription_required": True,
            "description": "Controls blood sugar in type 2 diabetes",
            "image_url": "/images/metformin.jpg",
            "rating": 4.6,
            "reviews_count": 367,
            "net_quantity": "15 tablets",
            "dosage": "500mg",
            "medical_conditions": json.dumps(["Type 2 Diabetes"]),
            "side_effects": json.dumps(["Nausea", "Diarrhea", "Stomach upset"]),
            "precautions": json.dumps(["Take with meals", "Monitor blood sugar regularly"])
        },
        {
            "name": "Atorvastatin 10mg",
            "generic_name": "Atorvastatin",
            "category": "Cholesterol",
            "price": 110.00,
            "original_price": 140.00,
            "stock": 300,
            "low_stock_threshold": 40,
            "manufacturer": "Dr. Reddy's",
            "prescription_required": True,
            "description": "Lowers cholesterol and prevents heart disease",
            "image_url": "/images/atorvastatin.jpg",
            "rating": 4.7,
            "reviews_count": 289,
            "net_quantity": "10 tablets",
            "dosage": "10mg",
            "medical_conditions": json.dumps(["High Cholesterol", "Heart Disease Prevention"]),
            "side_effects": json.dumps(["Muscle pain", "Nausea", "Headache"]),
            "precautions": json.dumps(["Avoid grapefruit juice", "Regular liver monitoring"])
        },
        {
            "name": "Azithromycin 250mg",
            "generic_name": "Azithromycin",
            "category": "Antibiotics",
            "price": 145.00,
            "original_price": 180.00,
            "stock": 180,
            "low_stock_threshold": 25,
            "manufacturer": "Mankind",
            "prescription_required": True,
            "description": "Broad-spectrum antibiotic",
            "image_url": "/images/azithromycin.jpg",
            "rating": 4.5,
            "reviews_count": 156,
            "net_quantity": "6 tablets",
            "dosage": "250mg",
            "medical_conditions": json.dumps(["Respiratory Infections", "Skin Infections"]),
            "side_effects": json.dumps(["Diarrhea", "Nausea", "Abdominal pain"]),
            "precautions": json.dumps(["Complete full course", "Take on empty stomach"])
        }
    ]
    
    for med_data in sample_medicines:
        medicine = models.Medicine(**med_data)
        db.add(medicine)
    
    db.commit()
    print(f"✅ Successfully added {len(sample_medicines)} medicines to the database!")
    db.close()

if __name__ == "__main__":
    seed_medicines()