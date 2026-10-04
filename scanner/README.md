# 🔍 GenMedics — Prescription Scanner Microservice

A high-performance, stateless computer vision microservice designed to process prescription images, extract pharmaceutical text using **Tesseract OCR**, and identify candidate medications using **RapidFuzz** token matching against a validated pharmaceutical database.

This microservice runs on port **8001** and acts as an image processing engine for the **Main-GenMedics** backend.

---

## 📑 Table of Contents

- [Purpose & Overview](#purpose--overview)
- [System Integration with Main-GenMedics](#system-integration-with-main-genmedics)
- [OCR & Entity Extraction Pipeline](#ocr--entity-extraction-pipeline)
  - [1. Image Validation & Preprocessing (OpenCV)](#1-image-validation--preprocessing-opencv)
  - [2. Multi-Pass Tesseract OCR Engine](#2-multi-pass-tesseract-ocr-engine)
  - [3. Text Extraction & Confidence Scoring](#3-text-extraction--confidence-scoring)
  - [4. Fuzzy Medicine Matching (RapidFuzz)](#4-fuzzy-medicine-matching-rapidfuzz)
- [API Endpoints](#api-endpoints)
  - [`GET /health`](#get-health)
  - [`POST /scan-text-only`](#post-scan-text-only)
- [Stateless & In-Memory Design](#stateless--in-memory-design)
- [Dependencies & Prerequisites](#dependencies--prerequisites)
  - [System Dependency: Tesseract OCR](#system-dependency-tesseract-ocr)
  - [Python Libraries](#python-libraries)
- [Environment Configuration](#environment-configuration)
- [Local Run Instructions](#local-run-instructions)
- [Project Folder Structure](#project-folder-structure)
- [Limitations & Recommended Guidelines](#limitations--recommended-guidelines)

---

## 🎯 Purpose & Overview

Prescription reading poses significant challenges due to low contrast, varied image resolutions, background artifacts, and handwriting variations. This microservice addresses these challenges through:
- **Intelligent Preprocessing**: Noise suppression, dynamic scaling, adaptive histogram equalization, and Otsu thresholding.
- **Multi-PSM OCR Evaluation**: Evaluating multiple Tesseract Page Segmentation Modes (PSMs) across both raw and preprocessed variants to select the highest-scoring candidate.
- **Reference Catalog Cross-Referencing**: Fast fuzzy token-set matching against thousands of verified brand and generic chemical entities.
- **Pure In-Memory Processing**: Zero disk write overhead during requests, ensuring high throughput, thread safety, and data privacy.

---

## 🔗 System Integration with Main-GenMedics

The service operates on port **8001** and is invoked over HTTP by the **Main-GenMedics** FastAPI backend:

```
+------------------------------------+
|     MAIN-GENMEDICS BACKEND         |
|            Port 8000               |
+-----------------+------------------+
                  |
                  | 1. HTTP POST /scan-text-only (multipart/form-data)
                  |    Prescription image bytes + min_confidence
                  v
+------------------------------------+
|    PRESCRIPTION SCANNER SERVICE    |
|            Port 8001               |
|                                    |
|   - OpenCV Image Preprocessing     |
|   - Parallel Multi-PSM Tesseract   |
|   - Confidence Evaluation          |
|   - RapidFuzz DB Matching          |
+-----------------+------------------+
                  |
                  | 2. JSON Response:
                  |    { status, method, confidence, text, medicines, time }
                  v
+------------------------------------+
|     MAIN-GENMEDICS BACKEND         |
|  - Cross-references catalog stock  |
|  - Stores record in PostgreSQL     |
|  - Returns matches to customer     |
+------------------------------------+
```

The Main backend specifies the scanner endpoint via the `SCANNER_URL` environment variable (default: `http://127.0.0.1:8001/scan-text-only`).

---

## 🔬 OCR & Entity Extraction Pipeline

### 1. Image Validation & Preprocessing (OpenCV)
When an image is received:
- Format verification ensures the extension is one of `.png`, `.jpg`, `.jpeg`, `.bmp`.
- Decoded using Pillow and converted to an OpenCV grayscale matrix.
- **Dynamic Dimension Scaling**: Images larger than 2000px on the longest edge are downscaled; images smaller than 300px are upscaled using cubic interpolation.
- **Bilateral Filtering**: Smooths textures while preserving critical edge boundaries of characters.
- **Contrast Limited Adaptive Histogram Equalization (CLAHE)**: Amplifies localized contrast across unevenly lit documents.
- **Otsu's Adaptive Thresholding**: Generates a high-contrast binary matrix separating ink from paper.

### 2. Multi-Pass Tesseract OCR Engine
The service tests multiple Tesseract Page Segmentation Modes (PSMs) across both the preprocessed matrix and original raw image:
- **PSM 6**: Single uniform block of text.
- **PSM 11**: Sparse text with arbitrary orientation.
- **PSM 4**: Single column of text with variable sizes.
- **PSM 3**: Fully automatic page segmentation.

Results are ranked by text length and lexical confidence score to select the optimal transcription.

### 3. Text Extraction & Confidence Scoring
A heuristic scoring algorithm evaluates the extracted text:
- Base score adjusted by character density.
- Positive weight for standard pharmaceutical syntax (e.g., `mg`, `ml`, `tab`, `caps`, `syrup`, `drops`, `ointment`, `rx`).
- Numeric dosage pattern recognition (e.g., regex matching `\d+\s*(mg|ml|mcg|iu)`).

### 4. Fuzzy Medicine Matching (RapidFuzz)
The transcription is compared against the preloaded reference database (`data/medicine_db_clean.csv`):
- Uses `rapidfuzz.fuzz.token_set_ratio` to compare both whole text blocks and individual lines against brand names and generic compounds.
- Matches exceeding the configurable confidence threshold (default: 70%) are returned with their therapeutic category, dosage, manufacturer, and MRP details.

---

## 📡 API Endpoints

### `GET /health`
Liveness check used by container health checks and the Main backend.

**Response (`200 OK`)**:
```json
{
  "status": "healthy",
  "service": "prescription-scanner",
  "port": 8001
}
```

---

### `POST /scan-text-only`
Main analysis endpoint.

- **Request**: `multipart/form-data`
  - `file`: Image binary (`image/png`, `image/jpeg`, `image/bmp`)
  - `min_confidence` *(optional query param, integer 0-100, default: 70)*

**Response (`200 OK`)**:
```json
{
  "status": "success",
  "method": "tesseract_psm6_preprocessed",
  "confidence": 88.5,
  "text": "Rx\nAmoxicillin 500mg\nParacetamol 650mg\nTake 1 tablet twice daily",
  "medicines": [
    {
      "name": "Amoxicillin",
      "type": "generic",
      "confidence": 95.0,
      "details": {
        "Brand Name": "Amoxil",
        "Dosage": "500mg",
        "Use of Medicine": "Bacterial infections",
        "MRP": "120.00"
      }
    },
    {
      "name": "Paracetamol",
      "type": "generic",
      "confidence": 92.0,
      "details": {
        "Brand Name": "Calpol",
        "Dosage": "650mg",
        "Use of Medicine": "Fever and pain relief",
        "MRP": "35.00"
      }
    }
  ],
  "processing_time_seconds": 1.42
}
```

---

## ⚡ Stateless & In-Memory Design

- **Zero Disk Residue**: Uploaded image buffers are parsed strictly in RAM via `io.BytesIO`. No temporary debug images, logs, or intermediate files are written to disk.
- **Concurrency & Isolation**: Requests are isolated; failure or timeout in one upload does not impact subsequent requests.
- **Reference DB Caching**: `data/medicine_db_clean.csv` is loaded once into memory upon server startup for fast sub-millisecond fuzzy indexing.

---

## 📦 Dependencies & Prerequisites

### System Dependency: Tesseract OCR

Tesseract OCR must be installed on the host operating system:

```bash
# macOS (via Homebrew)
brew install tesseract

# Ubuntu / Debian
sudo apt-get update && sudo apt-get install -y tesseract-ocr libtesseract-dev

# RedHat / CentOS
sudo yum install -y tesseract
```

The service automatically inspects system paths including `/opt/homebrew/bin/tesseract`, `/usr/local/bin/tesseract`, and `/usr/bin/tesseract`.

### Python Libraries
Install Python packages:
```bash
pip install fastapi uvicorn pytesseract opencv-python pillow rapidfuzz pandas numpy python-multipart
```

---

## ⚙️ Environment Configuration

Create a `.env` file if custom host or port binding is required:

```bash
cp .env.example .env
```

### Template (`.env.example`)
```env
# Prescription-Scanner Environment Configuration
HOST=127.0.0.1
PORT=8001
LOG_LEVEL=info
```

---

## 🚀 Local Run Instructions

### Step 1: Set up Virtual Environment
```bash
cd Prescription-Scanner
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Step 2: Start the Microservice
Start using Uvicorn on port **8001**:
```bash
uvicorn ocr_endpoint:app --host 127.0.0.1 --port 8001
```
Or run directly:
```bash
python ocr_endpoint.py
```

### Step 3: Test Health Endpoint
```bash
curl http://127.0.0.1:8001/health
```

---

## 📁 Project Folder Structure

```
Prescription-Scanner/
├── data/
│   └── medicine_db_clean.csv         # Reference pharmaceutical dataset
├── ocr_endpoint.py                   # FastAPI microservice & OCR pipeline
├── requirements.txt                  # Python dependencies
├── .env.example                      # Configuration template
├── .gitignore                        # Git ignore patterns
└── README.md                         # Microservice documentation
```

---

## ⚠️ Limitations & Recommended Guidelines

1. **Severely Degraded Handwriting**: Heavily hurried cursive or fragmented physician handwriting can yield reduced confidence scores. In such cases, the Main-GenMedics admin verification queue provides human review.
2. **Camera Angles & Glare**: Glossy or angled photos taken under dim lighting may produce OCR artifacts. Clear, flat, top-down photos yield the highest extraction accuracy.
3. **Compound Synonymy**: Novel or rare experimental compounds not yet cataloged in `medicine_db_clean.csv` will not produce a fuzzy match.
