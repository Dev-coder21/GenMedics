#!/usr/bin/env bash
# Run GenMedics end to end on your machine:
#   web app  http://localhost:5173   (store, scanner, admin — talks to the API below)
#   API      http://127.0.0.1:8000   (FastAPI + PostgreSQL, docs at /docs)
#   scanner  http://127.0.0.1:8001   (Python OCR microservice: OpenCV + Tesseract)
set -e
cd "$(dirname "$0")"

command -v psql >/dev/null || { echo "PostgreSQL not found. Install it: brew install postgresql@16 && brew services start postgresql@16"; exit 1; }
command -v tesseract >/dev/null || echo "⚠ Tesseract not found (brew install tesseract) — the scanner will fall back to in-browser OCR."
command -v node >/dev/null || { echo "Node.js not found. Install it: brew install node"; exit 1; }

# 1. config: database connection lives in backend/.env (never committed)
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo "Created backend/.env — edit DATABASE_URL if your Postgres user/password differ, then re-run ./start.sh"
fi
set -a; . backend/.env; set +a
DB_NAME="${DATABASE_URL##*/}"
psql "${DATABASE_URL%/*}/postgres" -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  || psql "${DATABASE_URL%/*}/postgres" -c "CREATE DATABASE $DB_NAME" \
  || { echo "Couldn't reach PostgreSQL with DATABASE_URL in backend/.env"; exit 1; }

# 2. Python environment for the API + scanner
[ -d .venv ] || python3 -m venv .venv
. .venv/bin/activate
pip install -q -r backend/requirements.txt -r scanner/requirements.txt

# 3. web app
(cd web && { [ -d node_modules ] || npm install --no-audit --no-fund; } && npm run build)

# 4. run everything; Ctrl+C stops all three
trap 'kill 0' EXIT
(cd scanner && uvicorn ocr_endpoint:app --port 8001 --log-level warning) &
(cd backend && uvicorn main:app --port 8000 --log-level warning) &
(cd web && npm run serve) &
sleep 3
echo ""
echo "GenMedics is running → http://localhost:5173   (admin: http://localhost:5173/#/admin)"
( command -v open >/dev/null && open http://localhost:5173 ) || true
wait
