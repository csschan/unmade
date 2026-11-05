# UNMADE — The AI-Native Market for Undiscovered Value

> Turn overlooked information into products people will pay for.

PayPal AI Hackathon 2026 submission.

## What it does

UNMADE discovers unmet information needs, organizes fragmented knowledge from ordinary people, and fuses it into intelligence products that buyers pay for. It is not a data marketplace — it creates products that didn't exist before.

## How it works

1. **Business asks a question** that requires real-world observations (not public data)
2. **AI decomposes** the question into specific collection tasks
3. **Contributors** submit observations from their daily experience
4. **AI fuses** independent fragments to discover hidden correlations
5. **Business pays** via PayPal, contributors earn via PayPal Payouts

## Tech Stack

- **Backend**: Python + FastAPI
- **Frontend**: Next.js 14 + Tailwind CSS
- **AI**: Claude API (Anthropic) — Demand Analysis, Task Decomposition, Fusion, Attribution
- **Payments**: PayPal Checkout API + Payouts API
- **Database**: SQLite

## Quick Start

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Fill in your keys
python seed_demo.py
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## License

MIT
