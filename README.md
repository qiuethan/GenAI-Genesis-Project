# GenAI Genesis 2026

AI-powered art generation platform with artist attribution.

## Tech Stack

- **Frontend:** React + TypeScript + Vite + TailwindCSS
- **Backend:** Python + FastAPI
- **Database:** Supabase (Postgres)

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- Supabase project (set up `.env` in `backend/`)

### Quick Setup

```bash
chmod +x scripts/setup_dev.sh
./scripts/setup_dev.sh
```

### Run Frontend

```bash
cd frontend
npm run dev
```

Runs on http://localhost:5173

### Run Backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

Runs on http://localhost:8000

### Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in your Supabase credentials.
