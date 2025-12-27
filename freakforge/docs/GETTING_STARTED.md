# Getting Started

## Development Setup

### 1. Install Dependencies

**Frontend:**
```bash
cd frontend
npm install
```

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Database Setup

Install PostgreSQL, then:
```bash
createdb athletic_metrics
psql athletic_metrics < database/schema.sql
```

### 3. Configuration

Copy `.env.example` to `.env` and update values:
```bash
cd backend
cp .env.example .env
# Edit .env with your database credentials
```

### 4. Run Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

App will be available at http://localhost:3000

## Next Steps

- Review the API documentation in `docs/api-documentation.md`
- Explore the demo at `frontend/public/demo.html`
- Start building components in `frontend/src/components/`
