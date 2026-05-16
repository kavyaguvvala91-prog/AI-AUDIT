# AI Audit Dashboard — Node.js Backend

A production-grade Express API that handles CSV uploads, dataset management,
and orchestrates all communication with the Python FastAPI AI engine.

---

## Quick Start

```bash
# 1. Install dependencies
cd server
npm install

# 2. Configure environment
cp .env .env.local        # edit values as needed
# (or edit .env directly)

# 3. Start MongoDB locally
mongod --dbpath /data/db

# 4. Start the Node server (development — auto-restarts on change)
npm run dev

# 5. Start the Node server (production)
npm start
```

The API will be available at **http://localhost:5000**.

---

## Environment Variables (`.env`)

| Variable             | Default                              | Description                        |
|----------------------|--------------------------------------|------------------------------------|
| `PORT`               | `5000`                               | HTTP port                          |
| `NODE_ENV`           | `development`                        | `development` or `production`      |
| `MONGO_URI`          | `mongodb://localhost:27017/ai_audit_dashboard` | MongoDB connection string |
| `AI_ENGINE_BASE_URL` | `http://localhost:8000`              | Python FastAPI base URL            |
| `UPLOAD_DIR`         | `uploads`                            | Local upload directory             |
| `MAX_FILE_SIZE_MB`   | `50`                                 | Max CSV file size in MB            |
| `CORS_ORIGINS`       | `http://localhost:3000`              | Comma-separated allowed origins    |

---

## Folder Structure

```
server/
├── server.js                   # Entry point — boots DB then Express
├── package.json
├── .env
├── uploads/                    # Uploaded CSV files stored here
└── src/
    ├── app.js                  # Express app factory (routes, middleware)
    ├── config/
    │   ├── db.js               # Mongoose connection
    │   ├── cors.js             # CORS options from env
    │   ├── multer.js           # File upload config
    │   └── axios.js            # Pre-configured Axios for AI engine
    ├── models/
    │   └── Dataset.model.js    # Mongoose schema (file + all AI results)
    ├── controllers/
    │   ├── dataset.controller.js    # CRUD
    │   ├── analysis.controller.js   # Analysis / AutoML / Predictions
    │   ├── monitoring.controller.js # Drift / Bias / Anomaly
    │   └── health.controller.js     # Health checks
    ├── routes/
    │   ├── dataset.routes.js
    │   ├── analysis.routes.js
    │   ├── monitoring.routes.js
    │   └── health.routes.js
    ├── services/
    │   ├── dataset.service.js   # DB operations for datasets
    │   └── aiEngine.service.js  # All Axios calls to Python engine
    ├── middleware/
    │   ├── errorHandler.js      # Global error handler + 404
    │   └── validate.js          # ObjectId, body fields, file presence
    └── utils/
        ├── logger.js            # Timestamp-prefixed console logger
        ├── apiResponse.js       # Consistent JSON envelope helpers
        └── csvHelper.js         # CSV validation & column parsing
```

---

## API Reference

### Health

| Method | Endpoint                   | Description              |
|--------|----------------------------|--------------------------|
| GET    | `/api/v1/health`           | Liveness probe           |
| GET    | `/api/v1/health/db`        | MongoDB connectivity     |
| GET    | `/api/v1/health/ai`        | AI engine reachability   |

---

### Datasets

| Method | Endpoint                        | Description                        |
|--------|---------------------------------|------------------------------------|
| POST   | `/api/v1/datasets/upload`       | Upload a CSV file (multipart)      |
| GET    | `/api/v1/datasets`              | List datasets (paginated)          |
| GET    | `/api/v1/datasets/:id`          | Get a single dataset               |
| PATCH  | `/api/v1/datasets/:id`          | Update metadata                    |
| DELETE | `/api/v1/datasets/:id`          | Soft-delete dataset + remove file  |

**Upload request** (`multipart/form-data`):
```
file          — CSV file (required)
name          — Dataset display name (optional)
description   — Free-text description (optional)
tags          — Comma-separated tags (optional)
targetColumn  — ML label column name (optional)
```

**List query params**: `page`, `limit`, `status`, `search`

---

### Analysis (triggers AI engine jobs)

| Method | Endpoint                          | Description                     |
|--------|-----------------------------------|---------------------------------|
| POST   | `/api/v1/analysis/:id/run`        | Run dataset analysis            |
| POST   | `/api/v1/analysis/:id/automl`     | Train AutoML model              |
| POST   | `/api/v1/analysis/:id/predict`    | Run predictions                 |

**AutoML body**: `{ "targetColumn": "label", "config": {} }`
**Predict body**: `{ "modelId": "<id from automl result>" }`

---

### Monitoring (triggers AI engine jobs + result retrieval)

| Method | Endpoint                              | Description                     |
|--------|---------------------------------------|---------------------------------|
| POST   | `/api/v1/monitoring/:id/drift`        | Detect drift vs reference       |
| POST   | `/api/v1/monitoring/:id/bias`         | Run bias / fairness audit       |
| POST   | `/api/v1/monitoring/:id/anomaly`      | Detect anomalies / outliers     |
| GET    | `/api/v1/monitoring/:id/results`      | Get all stored monitoring results |
| GET    | `/api/v1/monitoring/:id/predictions`  | Get stored predictions          |

**Drift body**: `{ "referenceDatasetId": "<dataset_id>" }`
**Bias body**: `{ "targetColumn": "label", "sensitiveAttributes": ["gender", "race"] }`
**Anomaly body**: `{ "columns": ["age", "income"] }` (optional column subset)

---

## Response Envelope

All endpoints return the same JSON shape:

```json
// Success
{
  "success": true,
  "message": "Dataset uploaded successfully",
  "data": { ... },
  "meta": { "total": 42, "page": 1, "totalPages": 3 }
}

// Error
{
  "success": false,
  "message": "Invalid CSV: Could not parse CSV headers",
  "error": "VALIDATION_ERROR",
  "stack": "..."   // only in development
}
```

---

## Python AI Engine Contract

The Node backend expects the FastAPI service to expose these endpoints:

| Method | Path        | Payload fields                                               |
|--------|-------------|--------------------------------------------------------------|
| POST   | `/analyse`  | `file_path`, `columns`                                       |
| POST   | `/automl`   | `file_path`, `target_column`, `config`                       |
| POST   | `/predict`  | `file_path`, `model_id`                                      |
| POST   | `/drift`    | `current_file_path`, `reference_file_path`                   |
| POST   | `/bias`     | `file_path`, `target_column`, `sensitive_attributes`         |
| POST   | `/anomaly`  | `file_path`, `columns`                                       |
| GET    | `/health`   | (no body)                                                    |

All Python responses are stored verbatim in `dataset.<jobKey>.payload`.
