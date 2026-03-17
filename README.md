# CalorieCost

This repo is now set up to deploy as a single container:

1. The frontend builds with Vite and uses `VITE_BACKEND_URL` when you want a separate API.
2. If `VITE_BACKEND_URL` is empty, the frontend talks to the same origin at `/api`.
3. The FastAPI app serves the built frontend from `frontend/build`, so one Docker deploy can host everything.

## Required environment variables

Backend:
- `MONGO_URL`
- `DB_NAME`
- `JWT_SECRET`
- `EMERGENT_LLM_KEY`
- `USDA_API_KEY`
- `CORS_ORIGINS`

Frontend:
- `VITE_BACKEND_URL` (leave blank for same-origin single-container deploys)

## Local build

Frontend:
```bash
npm ci
npm run build
```

Backend:
```bash
pip install -r backend/requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000
```

## Docker deploy

```bash
docker build -t caloriecost .
docker run -p 8000:8000 --env-file backend/.env caloriecost
```

## Vercel frontend deploy

Use these Vercel settings if you are deploying only the frontend:

- Root Directory: `frontend`
- Install Command: `npm install --legacy-peer-deps`
- Build Command: `vite build`
- Output Directory: `build`
- Node.js Version: `20.x`

Set `VITE_BACKEND_URL` in Vercel to your deployed backend URL, for example `https://your-api.example.com`.
