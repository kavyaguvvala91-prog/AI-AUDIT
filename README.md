# AI Audit Dashboard

AI Audit Dashboard is a monorepo with three services:

- `frontend/` - React + Vite dashboard
- `backend/server/` - Express API and dataset orchestration layer
- `ai-engine/` - FastAPI service for analysis, training, monitoring, and governance workflows

The repository is structured so runtime artifacts stay out of Git, the frontend can be served by the backend in production, and the stack can be started with Docker Compose.

## Repository Layout

```text
AI-AUDIT-DASHBOARD/
|- ai-engine/
|- backend/server/
|- docs/
|- frontend/
|- sample_datasets/
|- docker-compose.yml
`- README.md
```

## Local Setup

### 1. Create environment files

Use these templates:

- `ai-engine/.env.example`
- `backend/server/.env.example`
- `frontend/.env.example`

### 2. Run each service manually

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend/server
npm install
npm run dev
```

AI engine:

```bash
cd ai-engine
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Docker Deployment

The simplest full-stack deployment path in this repo is Docker Compose:

```bash
docker compose up --build
```

Services:

- App: `http://localhost:5000`
- Backend API: `http://localhost:5000/api/v1`
- AI engine: `http://localhost:8000`
- MongoDB: `mongodb://localhost:27017/ai_audit_dashboard`

In containerized production, the backend serves the compiled frontend automatically when `frontend/dist` is present.

## Deployment Notes

- The frontend uses `VITE_API_BASE_URL`. Keep `/api/v1` when the backend serves the frontend, or set a full backend URL when deploying the frontend separately.
- The AI engine now resolves `uploads/` and `saved_models/` relative to `ai-engine/`, which avoids stray runtime folders in the repo root.
- Runtime files such as uploads, model artifacts, `node_modules`, virtual environments, and local env files are ignored by Git.

## GitHub Push Checklist

- Keep secrets out of `.env` files committed to GitHub.
- Commit lockfiles and source code only.
- Do not commit generated uploads or trained models.
- Use `sample_datasets/` for demo data that should stay in the repo.
