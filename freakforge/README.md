# Athletic Metrics Analyzer

A comprehensive web application for analyzing athletic performance through advanced metrics visualization, statistical analysis, and video-based motion tracking.

## Features

- **Interactive Radar Charts** - Visualize performance across multiple metrics
- **Freak Finder Analysis** - Discover hidden statistical strengths using bell curve visualization
- **Custom Metric Builder** - Create unique performance ratios and indices
- **Video Motion Analysis** - Frame-by-frame speed/acceleration calculations
- **Multi-Athlete Comparison** - Compare performance across athletes
- **Database Import/Export** - Work with proprietary recruiting databases

## Tech Stack

### Frontend
- React 18
- Chart.js for radar charts
- Canvas/SVG for bell curve visualizations
- Tailwind CSS for styling

### Backend
- Python 3.10+
- FastAPI for REST API and WebSocket support
- OpenCV for video processing
- NumPy/SciPy for statistical calculations
- PostgreSQL for data storage

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- PostgreSQL 14+

### Installation

1. Clone the repository
2. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```

3. Install backend dependencies:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

4. Set up database:
   ```bash
   cd database
   psql -U postgres -f schema.sql
   ```

5. Run development servers:
   ```bash
   # Terminal 1 - Backend
   cd backend
   uvicorn main:app --reload

   # Terminal 2 - Frontend
   cd frontend
   npm start
   ```

## Project Structure

```
athletic-metrics-analyzer/
├── frontend/          # React application
├── backend/           # FastAPI server
├── database/          # SQL schemas and migrations
├── uploads/           # User-uploaded files (videos, databases)
└── docs/             # Documentation
```

## License

Proprietary - All rights reserved
