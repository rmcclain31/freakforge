# FreakForge AI Context

**Repo:** https://github.com/rmcclain31/freakforge

## What It Is
Athletic metrics analyzer - evaluates high school athletes using sigma/z-score analysis against population distributions. Identifies "freaks" (exceptional performers).

## Tech Stack
React frontend, FastAPI backend, PostgreSQL, Chart.js + HTML5 Canvas

## Key Files
```
freakforge/src/
├── components/tabs/
│   ├── FreakFinder.js   # Bell curve visualization, metric cards
│   ├── Dashboard.js     # Selection & Charts modes, radar charts
│   └── Settings.js      # Metric flip toggles
├── context/AppContext.js # Global state (selectedAthletes, forgedAxes)
└── utils/dataService.js  # Stats calculations (calculateSigma, calculatePercentile)
```

## Core Concepts
- **Metrics:** dash40, verticalJump, broadJump, proAgility, lDrill, height, weight
- **Time metrics flip:** Lower = better, so sigma is inverted (dash40, proAgility, lDrill)
- **Checkbox = bell curve data** (selectedAthletes[]), **Card click = highlight only** (selectedAthlete)
- **Exceptional threshold:** |σ| ≥ 1.5
- **Multi-athlete colors:** Red, Blue, Green, Amber, Purple (up to 5)

## Design
Dark slate backgrounds (#0f172a, #1e293b), orange/amber accents (#ea580c, #fbbf24), green for +σ (#10b981), red for -σ (#ef4444)

## Recent Work (Session 4)
1. Unified checkbox/card selection behavior
2. Multi-athlete comparison table
3. Metric cards split into +/- sigma columns
4. Card click → bell curve point selection
5. Sigma values in Selection tab
6. Sidebar width reduced to 280px, left-justified
