# GenMedics

Certified Jan Aushadhi generics matched to the exact salt and strength of the branded medicine you take — with an in-browser prescription scanner and a pharmacist admin console.

**Live site:** https://dev-coder21.github.io/GenMedics/ (store) · `#/prescriptions` (scanner) · `#/admin` (admin console)

| Demo account | Email | Password |
|---|---|---|
| Customer | `demo@genmedics.in` | `Demo@123` |
| Admin / pharmacist | `admin@genmedics.in` | `Admin@123` |

## What's in this repo

```
web/        Storefront + prescription scanner + admin console (React 18, TypeScript, Tailwind) — deployed to GitHub Pages
backend/    Original FastAPI + PostgreSQL REST API (customer, orders, admin, prescriptions) — run locally
scanner/    Original Python OCR microservice (OpenCV + Tesseract + RapidFuzz) — run locally
scripts/    build_catalogue.py: turns the medicine database CSV into web/public/data/medicines.json
```

### How the GitHub Pages build works
GitHub Pages only serves static files, so `web/` runs in **demo mode**: everything the backend stored
(accounts, cart, addresses, orders, prescriptions, inventory edits, settings) lives in the browser's
`localStorage`. The store and admin console share it, so an order placed in the store shows up in
`#/admin`, and status changes made there show up on the customer's order page. *Settings → Reset demo data*
restores the sample data.

The scanner runs the same pipeline as `scanner/` in the browser: grayscale + contrast stretch + Otsu
threshold on a canvas, Tesseract OCR via tesseract.js (loaded from jsDelivr) on the cleaned and the original
image, then fuzzy token matching of every line against brand names and salts, with strength and dosage form as
tie-breakers. Dosage like `1-0-1 x 30 days` is turned into the number of packs.

Savings are only claimed when every ingredient and strength matches (`scripts/build_catalogue.py`), and are
computed per unit against the cheapest listed brand. Prescription-required flags are a category heuristic.

## Run locally
```bash
cd web
npm install
npm run build      # outputs web/dist
npm run serve      # http://localhost:5173
```
No bundler: `tsc` compiles `src/` to ES modules, Tailwind builds the CSS, and React's UMD build is loaded through an import map.

Full-stack mode (optional): see `backend/` (`uvicorn main:app --port 8000`, needs PostgreSQL; copy `.env.example`) and `scanner/README.md`.

## Deploy
Push to `main`. `.github/workflows/deploy.yml` builds `web/` and publishes `web/dist` to GitHub Pages
(Settings → Pages → Source: **GitHub Actions**).

Made by Dev Trivedi
