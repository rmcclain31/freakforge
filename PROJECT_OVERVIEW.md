# Athletic Metrics Analyzer - Project Structure

## Backend Recommendation: Python with FastAPI ✓

**Why Python/FastAPI is Best for This Project:**

### Video Processing Advantage
- **OpenCV** - Industry-standard library for frame-by-frame video analysis
- **NumPy/SciPy** - Perfect for spatial calculations, motion tracking, and acceleration math
- **Computer Vision Ecosystem** - Best tools for yard line detection and perspective transforms

### Performance & Features
- **FastAPI** - Modern, fast, async framework with automatic API documentation
- **WebSockets** - Real-time updates for video processing progress
- **Type Safety** - Pydantic models provide validation and clear data structures

### Statistical Analysis
- **SciPy** - Statistical calculations for sigma analysis and percentiles
- **Pandas** - Efficient database import/export for CSV, Excel formats
- **NumPy** - Matrix operations for custom metric combinations

---

## Project Structure

```
athletic-metrics-analyzer/
│
├── frontend/                      # React Application
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard/        # Main landing page with radar chart
│   │   │   ├── MetricExplorer/   # Bell curve & metric discovery
│   │   │   ├── RadarCharts/      # Customizable radar visualizations
│   │   │   ├── VideoAnalysis/    # Frame-by-frame video tools
│   │   │   ├── DataManagement/   # Database import/export
│   │   │   ├── MetricBuilder/    # Drag-drop metric creator
│   │   │   └── common/           # Shared UI components
│   │   ├── utils/                # Helper functions
│   │   ├── styles/               # CSS/styling
│   │   └── assets/               # Images, icons
│   ├── public/
│   │   └── demo.html            # Initial working prototype
│   └── package.json              # Node dependencies
│
├── backend/                       # FastAPI Server
│   ├── api/
│   │   ├── routes/               # API endpoints (athletes, metrics, video, database)
│   │   ├── controllers/          # Business logic
│   │   └── middleware/           # Auth, validation
│   ├── services/
│   │   ├── metricCalculation/    # Standard & custom metric algorithms
│   │   ├── videoProcessing/      # OpenCV video analysis
│   │   └── aiIntegration/        # AI metric explanations (future)
│   ├── models/                   # Database models
│   ├── main.py                   # FastAPI application entry
│   ├── requirements.txt          # Python dependencies
│   └── .env.example              # Configuration template
│
├── database/
│   ├── schema.sql                # PostgreSQL database schema
│   ├── migrations/               # Database version control
│   └── seeds/                    # Sample data
│
├── uploads/                      # User-uploaded videos & databases
│
└── docs/
    ├── GETTING_STARTED.md        # Setup instructions
    └── (more docs to come)

```

---

## What's Included in the Starter Pack

### ✅ Ready to Use
- Complete directory structure
- Database schema with all metric fields
- FastAPI server skeleton with health check
- React package.json with Chart.js dependencies
- Working demo prototype (frontend/public/demo.html)
- .gitignore configured for Python/Node
- Environment configuration templates

### 📝 Stubbed & Ready to Build
- API route definitions for all endpoints
- Video processing service structure
- Metric calculation algorithms framework
- Component directories organized by feature

---

## Next Development Steps

1. **Immediate** (MVP Core):
   - Complete metric calculation service with sigma analysis
   - Build React radar chart component with live data
   - Implement database import for CSV files

2. **Phase 2** (Exploration Features):
   - Freak Finder bell curve visualization
   - Custom metric builder with drag-drop
   - Percentile calculations against database

3. **Phase 3** (Advanced):
   - Video upload and frame extraction
   - Motion tracking with yard line markers
   - Multi-athlete comparison views

4. **Polish**:
   - User authentication & roles
   - Database export functionality
   - AI-powered metric explanations

---

## Key Technologies

**Frontend:**
- React 18
- Chart.js (radar charts)
- Canvas API (bell curves)
- Axios (API calls)

**Backend:**
- Python 3.10+
- FastAPI (REST API)
- OpenCV (video processing)
- NumPy/SciPy (calculations)
- SQLAlchemy (database ORM)

**Database:**
- PostgreSQL 14+
- JSONB for flexible custom metrics

**Deployment:**
- Docker (containerization)
- nginx (reverse proxy)
- PostgreSQL (production DB)

---

## Getting Started

See `docs/GETTING_STARTED.md` for detailed setup instructions.

**Quick Start:**
```bash
# Extract the zip file
unzip athletic-metrics-analyzer.zip
cd athletic-metrics-analyzer

# Install & run backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Install & run frontend (new terminal)
cd frontend
npm install
npm start
```

Your app will be running at http://localhost:3000

---

**Questions about the structure or next steps? Let me know!**
