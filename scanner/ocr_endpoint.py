from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from PIL import Image
from io import BytesIO
import pytesseract
import time
import uuid
import logging
import traceback
import re
import cv2
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Tuple, List, Optional, Dict, Any
try:
    from rapidfuzz import fuzz as rapidfuzz_fuzz
except ImportError:  # rapidfuzz is in requirements.txt; difflib fallback keeps the service usable without it
    import difflib
    class rapidfuzz_fuzz:  # noqa: N801
        @staticmethod
        def token_set_ratio(a, b):
            a, b = " ".join(sorted(set(str(a).split()))), " ".join(sorted(set(str(b).split())))
            return difflib.SequenceMatcher(None, a, b).ratio() * 100
        partial_ratio = ratio = token_set_ratio
import json
import os
import shutil

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Ensure Tesseract executable is located
if shutil.which("tesseract") is None:
    for candidate in [
        "/opt/homebrew/bin/tesseract",
        "/opt/homebrew/opt/tesseract/bin/tesseract",
        "/usr/local/bin/tesseract",
        "/usr/bin/tesseract"
    ]:
        if os.path.exists(candidate):
            pytesseract.pytesseract.tesseract_cmd = candidate
            logger.info(f"Using Tesseract binary at: {candidate}")
            break

# Initialize FastAPI app
app = FastAPI(title="GenMedics Prescription OCR Microservice")

# Load medicine database
MEDICINE_DB_PATH = Path(__file__).parent / 'data' / 'medicine_db_clean.csv'
MEDICINE_DB = None

def load_medicine_db():
    """Load and prepare the medicine database"""
    try:
        if not MEDICINE_DB_PATH.exists():
            logger.warning(f"Medicine DB not found at {MEDICINE_DB_PATH}")
            return pd.DataFrame()
        df = pd.read_csv(MEDICINE_DB_PATH, encoding='utf-8', on_bad_lines='skip')
        df['clean_generic'] = df['Generic Name'].astype(str).str.lower().str.replace(r'[^a-z0-9\s]', '', regex=True)
        df['clean_brand'] = df['Brand Name'].fillna('').astype(str).str.lower().str.replace(r'[^a-z0-9\s]', '', regex=True)
        logger.info(f"Loaded {len(df)} medicines into reference database")
        return df
    except Exception as e:
        logger.error(f"Failed to load medicine database: {str(e)}")
        return pd.DataFrame()

# Load medicine database on startup
MEDICINE_DB = load_medicine_db()

def find_medicines_in_text(text: str, threshold: int = 70) -> List[Dict[str, Any]]:
    """Find medicine names in the extracted text using fuzzy matching"""
    if MEDICINE_DB is None or MEDICINE_DB.empty:
        return []
    
    clean_text = text.lower()
    clean_text = re.sub(r'[^a-z0-9\s]', ' ', clean_text)
    raw_lines = [re.sub(r'[^a-z0-9\s]', ' ', l.lower()).strip() for l in text.split('\n') if l.strip()]
    lines = [l for l in raw_lines if len(l) >= 3 and l not in ['prescription', 'doctor signature', 'medical license', 'patient', 'date', 'rx']]
    
    found_medicines = []
    
    for _, row in MEDICINE_DB.iterrows():
        gen_clean = row['clean_generic']
        brand_clean = row['clean_brand']
        
        # Check generic name
        if isinstance(gen_clean, str) and len(gen_clean) >= 3:
            ratio = rapidfuzz_fuzz.token_set_ratio(gen_clean, clean_text)
            for line in lines:
                l_ratio = rapidfuzz_fuzz.token_set_ratio(line, gen_clean)
                if l_ratio > ratio:
                    ratio = l_ratio
            if ratio >= threshold:
                found_medicines.append({
                    'name': row['Generic Name'],
                    'type': 'generic',
                    'confidence': float(ratio),
                    'details': {
                        'Brand Name': str(row['Brand Name']) if pd.notna(row['Brand Name']) else '',
                        'Dosage': str(row['Dosage']) if pd.notna(row['Dosage']) else '',
                        'Use of Medicine': str(row['Use of Medicine']) if pd.notna(row['Use of Medicine']) else '',
                        'MRP': str(row['MRP']) if pd.notna(row['MRP']) else ''
                    }
                })
        
        # Check brand name if available
        if isinstance(brand_clean, str) and len(brand_clean) >= 3:
            ratio = rapidfuzz_fuzz.token_set_ratio(brand_clean, clean_text)
            for line in lines:
                l_ratio = rapidfuzz_fuzz.token_set_ratio(line, brand_clean)
                if l_ratio > ratio:
                    ratio = l_ratio
            if ratio >= threshold:
                found_medicines.append({
                    'name': row['Brand Name'],
                    'type': 'brand',
                    'confidence': float(ratio),
                    'details': {
                        'Generic Name': str(row['Generic Name']) if pd.notna(row['Generic Name']) else '',
                        'Dosage': str(row['Dosage']) if pd.notna(row['Dosage']) else '',
                        'Use of Medicine': str(row['Use of Medicine']) if pd.notna(row['Use of Medicine']) else '',
                        'MRP': str(row['MRP']) if pd.notna(row['MRP']) else ''
                    }
                })
    
    seen = set()
    unique_medicines = []
    for med in sorted(found_medicines, key=lambda x: x['confidence'], reverse=True):
        key = (med['name'], med['type'])
        if key not in seen:
            seen.add(key)
            unique_medicines.append(med)
    
    return unique_medicines

TESSERACT_CONFIG = r'--oem 3 --psm 6'

def _preprocess_image_for_ocr(image: Image.Image) -> Image.Image:
    """Enhanced image preprocessing pipeline for OCR"""
    try:
        img_cv = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        
        height, width = gray.shape
        if max(width, height) > 2000:
            scale = 2000.0 / max(width, height)
            gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        elif min(width, height) < 300:
            scale = 300.0 / min(width, height)
            gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        
        denoised = cv2.bilateralFilter(gray, 9, 75, 75)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(denoised)
        
        thresh = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
        return Image.fromarray(thresh)
    except Exception as e:
        logger.error(f"Error in image preprocessing: {e}")
        return image

def _calculate_confidence(text: str) -> float:
    """Calculate confidence score based on text characteristics"""
    if not text:
        return 0.0
    
    score = 50.0
    score += min(len(text) / 10, 30)
    medical_terms = ['mg', 'ml', 'tab', 'caps', 'injection', 'syrup', 'drops', 'ointment', 'rx', 'patient', 'doctor']
    score += sum(8 for term in medical_terms if term in text.lower())
    if re.search(r'\d+', text):
        score += 10
    if re.search(r'\d+\s*(mg|ml|mg/ml|mcg|iu|%|x|X)\s*\d+', text, re.IGNORECASE):
        score += 15
    return min(max(score, 0), 100)

ALLOWED_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.bmp'}

@app.post("/scan-text-only")
async def scan_text_only(file: UploadFile = File(...), min_confidence: int = 70):
    """
    High-accuracy OCR endpoint that processes prescription images and extracts medicine information.
    Accepts: PNG, JPG, JPEG, BMP via multipart/form-data.
    """
    start_time = time.time()
    
    # 1. Format validation
    filename = file.filename or ""
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Accepted formats are PNG, JPG, JPEG, BMP."
        )
    
    min_confidence = max(0, min(100, min_confidence))
    
    try:
        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
            
        try:
            image = Image.open(BytesIO(file_bytes)).convert('RGB')
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid image file.")
            
        preprocessed = _preprocess_image_for_ocr(image)
        
        results = []
        tesseract_configs = [
            (6, "Single uniform block"),
            (11, "Sparse text"),
            (4, "Single column"),
            (3, "Fully automatic")
        ]
        
        # Test OCR passes on preprocessed and raw images
        for target_img, variant in [(image, "raw"), (preprocessed, "preprocessed")]:
            for psm, desc in tesseract_configs:
                try:
                    config = f"--oem 3 --psm {psm}"
                    text = pytesseract.image_to_string(target_img, config=config, timeout=30).strip()
                    if text:
                        cleaned = '\n'.join(line.strip() for line in text.split('\n') if line.strip())
                        confidence = _calculate_confidence(cleaned)
                        results.append((cleaned, confidence, f"tesseract_psm{psm}_{variant}"))
                except Exception as e:
                    logger.debug(f"OCR pass {variant} psm{psm} failed: {e}")
        
        if not results:
            try:
                text = pytesseract.image_to_string(image).strip()
                if text:
                    cleaned = '\n'.join(line.strip() for line in text.split('\n') if line.strip())
                    confidence = _calculate_confidence(cleaned)
                    results.append((cleaned, confidence, "tesseract_default"))
            except Exception as e:
                logger.error(f"Default Tesseract fallback failed: {e}")
        
        if not results:
            raise HTTPException(
                status_code=400, 
                detail="Could not extract any text from the image using any OCR method"
            )
        
        # Sort results by confidence and length
        results.sort(key=lambda x: (x[1], len(x[0])), reverse=True)
        best_text, confidence, method = results[0]
        
        # Find medicines in the extracted text using RapidFuzz
        medicines = find_medicines_in_text(best_text, min_confidence)
        
        return {
            "status": "success",
            "method": method,
            "confidence": round(confidence, 1),
            "text": best_text,
            "medicines": medicines,
            "processing_time_seconds": round(time.time() - start_time, 2)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in OCR: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Unexpected internal error processing prescription OCR.")

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "prescription-scanner", "port": 8001}

if __name__ == "__main__":
    import uvicorn
    print("Starting Prescription Scanner microservice on http://127.0.0.1:8001")
    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="info")
