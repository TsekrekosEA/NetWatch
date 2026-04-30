# NetWatch Development Guide

This document covers how to contribute to NetWatch, train its machine learning models, and ensure code quality.

## 1. Local Setup

### Backend & Capture
```bash
# Recommended: Create a virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
pip install -r capture/requirements.txt
```

### Frontend
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

## 2. ML Model Lifecycle (`backend/ml/`)

NetWatch uses scikit-learn for its ML stage.

### Training
1.  **Dataset**: Download the CIC-IDS-2018 dataset CSVs.
2.  **Preprocess**: Run `python -m ml.preprocess` to clean data and align features.
3.  **Train**: Run `python -m ml.train`. This generates:
    - `scaler.joblib`: Standardizes input features.
    - `isolation_forest.joblib`: The unsupervised anomaly detector.
    - `random_forest.joblib`: The multi-class classifier.

### Evaluation
Run `python -m ml.evaluate` to generate a detailed performance report, including:
- Accuracy, Precision, Recall, and F1-score.
- Confusion matrix for attack categories.
- False Positive Rate (FPR) for benign traffic.

## 3. Testing Strategy

We use `pytest` for the backend. Tests are located in `backend/tests/`.

### Running Tests
```bash
cd backend
python -m pytest tests/ -v
```

### Coverage
- **Unit Tests**: Test individual components like `stage1_statistical.py` and `severity.py`.
- **Integration Tests**: Test the full `run_pipeline` flow and API endpoints (`POST /ingest`, `GET /alerts`).
- **Database Tests**: Verify async CRUD operations with a temporary SQLite database.

## 4. Contributing Guidelines

- **Code Style**: We follow PEP 8 for Python and standard Prettier/ESLint for TypeScript.
- **Documentation**: If you add a new feature or change a design choice, update the corresponding file in `docs/`.
- **Pull Requests**:
    - Ensure all tests pass.
    - Include a description of what changed and why.
    - Add new tests for bug fixes or new features.

## 5. Roadmap & Improvements

- [ ] Support for IPv6 feature extraction (currently limited to IPv4).
- [ ] Distributed capture service via gRPC for even lower latency.
- [ ] Integration with ELK stack for long-term log retention.
- [ ] Real-time retraining of ML models based on user feedback (Alert False Positive reporting).
