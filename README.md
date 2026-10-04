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
backend/    FastAPI + PostgreSQL API — /v2 (used by web/) plus the original endpoints
scanner/    Python OCR microservice (OpenCV + multi-pass Tesseract + RapidFuzz); src/ has the OCR model experiments
start.sh    one command to run all three locally
scripts/    build_catalogue.py: turns the medicine database CSV into web/public/data/medicines.json
```

### Two modes, same app
| | **Local (full stack)** — `./start.sh` | **GitHub Pages (static)** |
|---|---|---|
| Accounts, orders, addresses, prescriptions, inventory, settings | PostgreSQL via the FastAPI backend (`/v2` API) | the visitor's browser (`localStorage`) |
| Prescription OCR | `scanner/` service (OpenCV + multi-pass Tesseract), called by the backend | the same pipeline in the browser (tesseract.js) |
| Catalogue | 1,769 medicines seeded into Postgres on first start | `web/public/data/medicines.json` |

The web app picks the mode by itself: on `localhost` it looks for the API at `http://127.0.0.1:4711`
(override with `?api=http://host:port`, or `?api=off` to force demo mode); anywhere else it runs static.
The footer shows which mode you're in. If the scanner service isn't running, scans fall back to browser OCR
and are still saved to the database.

Savings are only claimed when every ingredient and strength matches (`scripts/build_catalogue.py`), and are
computed per unit against the cheapest listed brand. Prescription-required flags are a category heuristic.

## Run locally (end to end)
Needs PostgreSQL, Python 3.10+, Node 18+ and Tesseract (`brew install postgresql@16 tesseract node`).
```bash
./start.sh
```
First run creates `backend/.env` — put your Postgres user/password in `DATABASE_URL`, then run it again.
It creates the `genmedics` database, installs dependencies, seeds the catalogue and the two demo accounts,
and starts the scanner (4712), the API (4711, docs at `/docs`) and the web app (4710).

Only the web app (static demo mode): `cd web && npm install && npm run build && npm run serve`.
The web app has no bundler: `tsc` compiles `src/` to ES modules, Tailwind builds the CSS, React's UMD build loads via an import map.

## Deploy
Push to `main`. `.github/workflows/deploy.yml` builds `web/` and publishes `web/dist` to GitHub Pages
(Settings → Pages → Source: **GitHub Actions**).

Made by Dev Trivedi
