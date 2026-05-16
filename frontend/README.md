# AI Audit Dashboard — Frontend

> A modern, futuristic AI auditing platform frontend built for hackathon presentation.

## Tech Stack

- **React 18** + **Vite 5**
- **Tailwind CSS** — styling
- **React Router DOM v6** — routing
- **Recharts** — data visualization (bar, pie, line, radar)
- **React Three Fiber + Drei** — 3D hero scene
- **Three.js** — 3D rendering
- **Axios** — API integration
- **Lucide React** — icons

## Project Structure

```
frontend/
├── public/
│   └── favicon.svg
├── src/
│   ├── api/
│   │   ├── client.js         # Axios base client
│   │   └── endpoints.js      # API endpoint functions
│   ├── charts/
│   │   ├── ChartPanel.jsx    # Recharts wrapper with panel UI
│   │   └── theme.js          # Chart colors and styles
│   ├── components/
│   │   ├── Alert.jsx
│   │   ├── Badge.jsx
│   │   ├── LoadingSpinner.jsx
│   │   ├── ProgressBar.jsx
│   │   ├── SectionHeader.jsx
│   │   └── StatCard.jsx
│   ├── layouts/
│   │   ├── MainLayout.jsx    # Sidebar + Navbar shell
│   │   ├── Navbar.jsx
│   │   └── Sidebar.jsx
│   ├── pages/
│   │   ├── HomePage.jsx      # 3D hero + feature overview
│   │   ├── UploadPage.jsx    # Drag & drop CSV upload
│   │   ├── AnalysisPage.jsx  # Dataset analysis + charts
│   │   ├── MetricsPage.jsx   # Model performance metrics
│   │   └── MonitoringPage.jsx # Drift/bias/anomaly monitoring
│   ├── three/
│   │   ├── AISphere.jsx      # Animated 3D sphere
│   │   ├── HeroScene.jsx     # Three.js canvas scene
│   │   └── ParticleBackground.jsx
│   ├── utils/
│   │   ├── format.js         # Number formatting helpers
│   │   └── mock.js           # Demo/fallback data
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── vite.config.js
```

## Installation

```bash
# 1. Enter the frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

App runs at: **http://localhost:3000**

## Backend API Integration

The frontend connects to your Python backend at `http://localhost:8000`.

Vite proxies all `/api/*` requests automatically (see `vite.config.js`).

### Expected Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload` | Upload CSV file |
| GET | `/api/datasets` | List uploaded datasets |
| GET | `/api/analysis/:id` | Dataset analysis results |
| GET | `/api/metrics/:id` | Model training metrics |
| POST | `/api/train/:id` | Trigger model training |
| GET | `/api/monitoring/:id` | Monitoring data |
| GET | `/api/drift/:id` | Drift report |
| GET | `/api/bias/:id` | Bias report |

### Demo Mode

If the backend is not running, the frontend automatically falls back to rich mock data so the UI remains fully functional for demos.

## Build for Production

```bash
npm run build
# Output: dist/
```

## Pages

| Route | Page |
|-------|------|
| `/` | Home — 3D hero + feature overview |
| `/upload` | CSV upload with drag & drop |
| `/analysis` | Dataset analysis + charts |
| `/metrics` | Model metrics + training history |
| `/monitoring` | AI monitoring + drift/bias |
