# AI Audit Dashboard — Python AI Engine

This service is the FastAPI-based AI/ML engine for the **AI Audit Dashboard** hackathon project. It analyzes uploaded datasets, trains baseline ML models, serves predictions, and exposes monitoring signals such as drift, anomaly, bias, and confidence metrics.

## What This Engine Does

- Profiles any CSV dataset
- Detects likely ML problem type
- Trains classification or regression models
- Saves trained models and preprocessing artifacts
- Runs predictions from saved models
- Monitors data drift, anomalies, bias, and prediction confidence

## Tech Stack

- Python
- FastAPI
- pandas
- numpy
- scikit-learn
- scipy
- joblib

## Project Structure

```text
ai-engine/
├── app/
│   ├── monitoring/
│   │   ├── anomaly_detector.py
│   │   ├── bias_detector.py
│   │   ├── confidence_monitor.py
│   │   └── drift_detector.py
│   ├── models/
│   │   └── schemas.py
│   ├── preprocessing/
│   │   └── cleaner.py
│   ├── routes/
│   │   ├── analyze.py
│   │   ├── health.py
│   │   ├── monitor.py
│   │   ├── predict.py
│   │   └── train.py
│   ├── services/
│   │   ├── analyzer.py
│   │   ├── monitoring_service.py
│   │   ├── predictor.py
│   │   └── trainer.py
│   ├── utils/
│   │   ├── config.py
│   │   ├── file_utils.py
│   │   └── response.py
│   └── main.py
├── saved_models/
├── uploads/
├── requirements.txt
└── .env
```

## Architecture Notes

- `routes/` contains thin FastAPI endpoints
- `services/` contains reusable business logic
- `monitoring/` contains specialized monitoring modules
- `preprocessing/` contains reusable data cleaning and transformation logic
- `models/schemas.py` centralizes all Pydantic request/response models
- `utils/response.py` keeps every API response in a consistent frontend-friendly envelope

## Setup Instructions

### 1. Create a virtual environment

```bash
cd ai-engine
python -m venv venv
```

### 2. Activate the environment

Windows:

```bash
venv\Scripts\activate
```

macOS/Linux:

```bash
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

## Environment Variables

The project uses `.env` for runtime configuration.

Example values:

```env
HOST=0.0.0.0
PORT=8000
ENV=development
UPLOAD_DIR=uploads
MODEL_DIR=saved_models
TEST_SIZE=0.2
RANDOM_STATE=42
DRIFT_THRESHOLD=0.2
ANOMALY_CONTAMINATION=0.05
```

## Run The FastAPI Server

```bash
cd ai-engine
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## API Overview

Base prefix:

```text
/api/v1
```

Available endpoints:

- `GET /api/v1/health`
- `GET /api/v1/health/ready`
- `POST /api/v1/analyse`
- `POST /api/v1/analyse/upload`
- `POST /api/v1/train`
- `POST /api/v1/predict`
- `GET /api/v1/monitor`

Swagger docs:

```text
http://127.0.0.1:8000/docs
```

## Example Requests

### Health Check

```bash
curl http://127.0.0.1:8000/api/v1/health
```

### Analyse Existing CSV

```bash
curl -X POST "http://127.0.0.1:8000/api/v1/analyse" ^
  -H "Content-Type: application/json" ^
  -d "{\"file_path\":\"uploads/customer_churn.csv\"}"
```

### Analyse Direct Upload

```bash
curl -X POST "http://127.0.0.1:8000/api/v1/analyse/upload" ^
  -H "accept: application/json" ^
  -H "Content-Type: multipart/form-data" ^
  -F "file=@C:\path\to\dataset.csv"
```

### Train Model

```bash
curl -X POST "http://127.0.0.1:8000/api/v1/train" ^
  -H "Content-Type: application/json" ^
  -d "{\"file_path\":\"uploads/customer_churn.csv\",\"target_column\":\"churn\",\"config\":{\"test_size\":0.2}}"
```

### Predict

```bash
curl -X POST "http://127.0.0.1:8000/api/v1/predict" ^
  -H "Content-Type: application/json" ^
  -d "{\"file_path\":\"uploads/scoring_batch.csv\",\"model_id\":\"YOUR_MODEL_ID\"}"
```

### Monitor

```bash
curl "http://127.0.0.1:8000/api/v1/monitor?dataset_id=batch-001&current_file_path=uploads/scoring_batch.csv&reference_file_path=uploads/training_baseline.csv&model_id=YOUR_MODEL_ID&target_column=churn&sensitive_attributes=gender&sensitive_attributes=region"
```

## Sample Payloads

### `/api/v1/analyse`

```json
{
  "file_path": "uploads/customer_churn.csv"
}
```

### `/api/v1/train`

```json
{
  "file_path": "uploads/customer_churn.csv",
  "target_column": "churn",
  "config": {
    "test_size": 0.2,
    "random_state": 42
  }
}
```

### `/api/v1/predict`

```json
{
  "file_path": "uploads/scoring_batch.csv",
  "model_id": "e4b82c63-6f7c-46de-bfe6-31049f8fe1e2"
}
```

## Response Envelope

Every endpoint follows a shared response envelope from `app/utils/response.py`.

Successful response:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

Error response:

```json
{
  "success": false,
  "message": "An error occurred",
  "error": "INTERNAL_ERROR"
}
```

## Monitoring Output Notes

The `/monitor` endpoint can combine several signals in one response:

- `drift`: Population Stability Index based drift metrics
- `anomaly`: IsolationForest-based anomaly metrics
- `bias`: demographic parity style group outcome audit
- `confidence_summary`: classification confidence analytics
- `feature_importance`: top tree-model feature importances when available
- `alerts`: simple dashboard-friendly warnings

## Model Artifacts

Each training run is stored under:

```text
saved_models/<model_id>/
├── model.joblib
└── preprocessor.joblib
```

This keeps inference and monitoring consistent with the exact preprocessing used during training.
