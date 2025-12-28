import React, { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import dataService from '../../utils/dataService';
import { useAppContext } from '../../context/AppContext';

Chart.register(...registerables);

const ATHLETE_COLORS = [
  { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 1)', point: 'rgba(239, 68, 68, 1)', name: 'Red' },
  { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgba(59, 130, 246, 1)', point: 'rgba(59, 130, 246, 1)', name: 'Blue' },
  { bg: 'rgba(16, 185, 129, 0.2)', border: 'rgba(16, 185, 129, 1)', point: 'rgba(16, 185, 129, 1)', name: 'Green' },
  { bg: 'rgba(245, 158, 11, 0.2)', border: 'rgba(245, 158, 11, 1)', point: 'rgba(245, 158, 11, 1)', name: 'Amber' },
  { bg: 'rgba(139, 92, 246, 0.2)', border: 'rgba(139, 92, 246, 1)', point: 'rgba(139, 92, 246, 1)', name: 'Purple' },
];

const formatValue = (value, unit) => {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'number') {
    const strVal = value.toString();
    const decimalIndex = strVal.indexOf('.');
    if (decimalIndex !== -1) {
      const decimalPlaces = strVal.length - decimalIndex - 1;
      if (decimalPlaces > 3) return `${value.toFixed(3)}+`;
    }
    if (Number.isInteger(value)) return `${value}${unit ? ` ${unit}` : ''}`;
    return `${value.toFixed(Math.min(3, strVal.length - decimalIndex - 1))}${unit ? ` ${unit}` : ''}`;
  }
  return `${value}${unit ? ` ${unit}` : ''}`;
};

function Dashboard({ mode = 'selection' }) {
  const [athletes, setAthletes] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  const [filters, setFilters] = useState({
    positions: [],
    states: [],
    gradYears: [],
    heightRange: { min: null, max: null },
    weightRange: { min: null, max: null }
  });

  // #9: Filter toggle for athlete list
  const [applyFiltersToList, setApplyFiltersToList] = useState(false);

  const chartRef = useRef(null);
  const physicalChartRef = useRef(null);
  const forgedChartRef = useRef(null);
  const chartInstance = useRef(null);
  const physicalChartInstance = useRef(null);
  const forgedChartInstance = useRef(null);
  const { selectedAthletes, toggleAthleteSelection, clearSelectedAthletes, forgedAxes, removeForgedAxis, clearForgedAxes } = useAppContext();

  useEffect(() => {
    dataService.loadData().then(data => {
      setAthletes(data.athletes);
      setStatistics(data.statistics);
    });
  }, []);

  const getUniqueValues = (field) => {
    const values = [...new Set(athletes.map(a => a[field]).filter(Boolean))];
    return values.sort();
  };

  const getFilteredPopulation = () => {
    return athletes.filter(athlete => {
      if (filters.positions.length > 0 && !filters.positions.includes(athlete.position)) return false;
      if (filters.states.length > 0 && !filters.states.includes(athlete.state)) return false;
      if (filters.gradYears.length > 0 && !filters.gradYears.includes(athlete.gradYear)) return false;
      if (filters.heightRange.min !== null && athlete.height < filters.heightRange.min) return false;
      if (filters.heightRange.max !== null && athlete.height > filters.heightRange.max) return false;
      if (filters.weightRange.min !== null && athlete.weight < filters.weightRange.min) return false;
      if (filters.weightRange.max !== null && athlete.weight > filters.weightRange.max) return false;
      return true;
    });
  };

  const hasActiveFilters = () => {
    return filters.positions.length > 0 || filters.states.length > 0 || filters.gradYears.length > 0 ||
      filters.heightRange.min !== null || filters.heightRange.max !== null ||
      filters.weightRange.min !== null || filters.weightRange.max !== null;
  };

  const clearAllFilters = () => {
    setFilters({ positions: [], states: [], gradYears: [], heightRange: { min: null, max: null }, weightRange: { min: null, max: null } });
  };

  const toggleFilter = (filterType, value) => {
    setFilters(prev => {
      const current = prev[filterType];
      const updated = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      return { ...prev, [filterType]: updated };
    });
  };

  const calculateFilteredSigma = (metricKey, value) => {
    const filteredPop = getFilteredPopulation();
    const values = filteredPop.map(a => a[metricKey]).filter(v => v !== null && v !== undefined);
    if (values.length < 2) return dataService.calculateSigma(metricKey, value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);
    if (std === 0) return 0;
    return (value - mean) / std;
  };

  const selectedAthleteObjects = athletes.filter(a => selectedAthletes.includes(a.id));

  useEffect(() => {
    if (mode === 'charts' && selectedAthleteObjects.length > 0) {
      updateAthleteChart();
      updatePhysicalChart();
      updateForgedChart();
    }
  }, [selectedAthleteObjects, mode, forgedAxes, statistics]);

  const updateAthleteChart = () => {
    if (!chartRef.current) return;
    if (selectedAthletes.length === 0) return;
    const ctx = chartRef.current.getContext('2d');
    if (chartInstance.current) chartInstance.current.destroy();

    const metrics = [
      { key: 'dash40', label: '40-Yard Dash', inverse: true },
      { key: 'verticalJump', label: 'Vertical Jump' },
      { key: 'broadJump', label: 'Broad Jump' },
      { key: 'proAgility', label: 'Pro Agility', inverse: true },
      { key: 'lDrill', label: 'L-Drill', inverse: true }
    ];

    const athletesToDisplay = athletes.filter(a => selectedAthletes.includes(a.id));
    const datasets = athletesToDisplay.map((athlete, index) => {
      const data = metrics.map(metric => {
        const value = athlete[metric.key];
        if (!value || !statistics[metric.key]) return 0;
        return dataService.calculatePercentile(metric.key, value);
      });
      const colorIndex = index % ATHLETE_COLORS.length;
      const colors = ATHLETE_COLORS[colorIndex];
      return {
        label: `${athlete.firstName} ${athlete.lastName}`,
        data,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderWidth: 2,
        pointBackgroundColor: colors.point,
        pointBorderColor: '#fff',
        pointRadius: 5,
        pointHoverRadius: 7
      };
    });

    chartInstance.current = new Chart(ctx, {
      type: 'radar',
      data: { labels: metrics.map(m => m.label), datasets },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            min: 0,
            ticks: { stepSize: 25, color: '#a16207', backdropColor: 'transparent', font: { size: 11 } },
            grid: { color: '#78350f' },
            pointLabels: { color: '#fbbf24', font: { size: 12, weight: '500' } }
          }
        },
        plugins: {
          legend: { display: athletesToDisplay.length > 1, labels: { color: '#fb923c', font: { size: 12 }, padding: 10 } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${Math.round(ctx.parsed.r)}th percentile` } }
        }
      }
    });
  };

  const updatePhysicalChart = () => {
    if (!physicalChartRef.current) return;
    if (selectedAthletes.length === 0) return;
    const ctx = physicalChartRef.current.getContext('2d');
    if (physicalChartInstance.current) physicalChartInstance.current.destroy();

    const metrics = [{ key: 'height', label: 'Height' }, { key: 'weight', label: 'Weight' }];
    const athletesToDisplay = athletes.filter(a => selectedAthletes.includes(a.id));
    const datasets = athletesToDisplay.map((athlete, index) => {
      const data = metrics.map(metric => {
        const value = athlete[metric.key];
        if (!value || !statistics[metric.key]) return 0;
        return dataService.calculatePercentile(metric.key, value);
      });
      const colorIndex = index % ATHLETE_COLORS.length;
      const colors = ATHLETE_COLORS[colorIndex];
      return {
        label: `${athlete.firstName} ${athlete.lastName}`,
        data,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderWidth: 2,
        pointBackgroundColor: colors.point,
        pointBorderColor: '#fff',
        pointRadius: 5,
        pointHoverRadius: 7
      };
    });

    physicalChartInstance.current = new Chart(ctx, {
      type: 'radar',
      data: { labels: metrics.map(m => m.label), datasets },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            min: 0,
            ticks: { stepSize: 25, color: '#a16207', backdropColor: 'transparent', font: { size: 11 } },
            grid: { color: '#78350f' },
            pointLabels: { color: '#fbbf24', font: { size: 12, weight: '500' } }
          }
        },
        plugins: {
          legend: { display: athletesToDisplay.length > 1, labels: { color: '#fb923c', font: { size: 12 }, padding: 10 } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${Math.round(ctx.parsed.r)}th percentile` } }
        }
      }
    });
  };

  const updateForgedChart = () => {
    if (!forgedChartRef.current || forgedAxes.length === 0) {
      if (forgedChartInstance.current) { forgedChartInstance.current.destroy(); forgedChartInstance.current = null; }
      return;
    }
    const ctx = forgedChartRef.current.getContext('2d');
    if (forgedChartInstance.current) forgedChartInstance.current.destroy();

    const athletesToDisplay = athletes.filter(a => selectedAthletes.includes(a.id));
    if (athletesToDisplay.length === 0) return;

    const datasets = athletesToDisplay.map((athlete, index) => {
      const data = forgedAxes.map(axis => {
        const parts = axis.formula.toLowerCase().split('/');
        if (parts.length !== 2) return 0;
        const numerator = athlete[parts[0].trim()];
        const denominator = athlete[parts[1].trim()];
        if (!numerator || !denominator) return 0;
        return Math.min(100, Math.max(0, (numerator / denominator) * 10));
      });
      const colorIndex = index % ATHLETE_COLORS.length;
      const colors = ATHLETE_COLORS[colorIndex];
      return {
        label: `${athlete.firstName} ${athlete.lastName}`,
        data,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderWidth: 2,
        pointBackgroundColor: colors.point,
        pointBorderColor: '#fff',
        pointRadius: 5,
        pointHoverRadius: 7
      };
    });

    forgedChartInstance.current = new Chart(ctx, {
      type: 'radar',
      data: { labels: forgedAxes.map(a => a.label), datasets },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            beginAtZero: true,
            ticks: { stepSize: 20, color: '#a16207', backdropColor: 'transparent', font: { size: 11 } },
            grid: { color: '#78350f' },
            pointLabels: { color: '#fbbf24', font: { size: 10, weight: '500' } }
          }
        },
        plugins: { legend: { display: athletesToDisplay.length > 1, labels: { color: '#fb923c', font: { size: 12 }, padding: 10 } } }
      }
    });
  };

  const filteredAthletes = searchQuery ? dataService.searchAthletes(searchQuery) : athletes;

  // #9: Apply filters to athlete list if toggle is on
  const displayAthletes = applyFiltersToList && hasActiveFilters()
    ? filteredAthletes.filter(a => getFilteredPopulation().some(fp => fp.id === a.id))
    : filteredAthletes;
  const unselectedAthletes = displayAthletes.filter(a => !selectedAthletes.includes(a.id));

  const calculateSigmaBands = (athlete) => {
    const metrics = [{ key: 'dash40' }, { key: 'verticalJump' }, { key: 'broadJump' }, { key: 'proAgility' }, { key: 'lDrill' }, { key: 'height' }, { key: 'weight' }];
    const bands = { minus3: 0, minus2: 0, minus1: 0, zero: 0, plus1: 0, plus2: 0, plus3: 0 };
    metrics.forEach(m => {
      const value = athlete[m.key];
      if (!value) return;
      const sigma = dataService.calculateSigma(m.key, value);
      if (sigma < -3) bands.minus3++;
      else if (sigma < -2) bands.minus2++;
      else if (sigma < -1) bands.minus1++;
      else if (sigma < 1) bands.zero++;
      else if (sigma < 2) bands.plus1++;
      else if (sigma < 3) bands.plus2++;
      else bands.plus3++;
    });
    return bands;
  };

  // #6: Filters pane always visible (no show/hide toggle)
  const renderFilterPane = () => (
    <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', borderLeft: '4px solid #8b5cf6' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '1rem', color: '#a78bfa' }}>
          🔍 Population Filters
          {hasActiveFilters() && (<span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', padding: '0.15rem 0.4rem', background: '#5b21b6', borderRadius: '0.25rem' }}>Active</span>)}
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {hasActiveFilters() && (
            <button onClick={clearAllFilters} style={{ padding: '0.3rem 0.6rem', background: '#7c2d12', border: '1px solid #dc2626', borderRadius: '0.25rem', color: '#fbbf24', fontSize: '0.75rem', cursor: 'pointer' }}>Clear All</button>
          )}
          <button style={{ padding: '0.3rem 0.6rem', background: '#1e3a5f', border: '1px solid #3b82f6', borderRadius: '0.25rem', color: '#93c5fd', fontSize: '0.75rem', cursor: 'pointer', opacity: 0.6 }} title="Coming soon">💾 Save Forged</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {/* #10: Standard section - yellow-orange */}
        <div>
          <h4 style={{ fontSize: '0.8rem', color: '#fb923c', marginBottom: '0.5rem' }}>● Standard</h4>
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Position</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {getUniqueValues('position').slice(0, 8).map(pos => (
                <button key={pos} onClick={() => toggleFilter('positions', pos)} style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem', background: filters.positions.includes(pos) ? '#92400e' : '#374151', border: `1px solid ${filters.positions.includes(pos) ? '#f59e0b' : '#4b5563'}`, borderRadius: '0.25rem', color: filters.positions.includes(pos) ? '#fbbf24' : '#9ca3af', cursor: 'pointer' }}>{pos}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>State</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {getUniqueValues('state').slice(0, 6).map(state => (
                <button key={state} onClick={() => toggleFilter('states', state)} style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem', background: filters.states.includes(state) ? '#92400e' : '#374151', border: `1px solid ${filters.states.includes(state) ? '#f59e0b' : '#4b5563'}`, borderRadius: '0.25rem', color: filters.states.includes(state) ? '#fbbf24' : '#9ca3af', cursor: 'pointer' }}>{state}</button>
              ))}
            </div>
          </div>
        </div>

        {/* #10: Attributes section - yellow-orange */}
        <div>
          <h4 style={{ fontSize: '0.8rem', color: '#fb923c', marginBottom: '0.5rem' }}>▲ Attributes</h4>
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Height (in)</div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="number" placeholder="Min" value={filters.heightRange.min || ''} onChange={(e) => setFilters(prev => ({ ...prev, heightRange: { ...prev.heightRange, min: e.target.value ? Number(e.target.value) : null } }))} style={{ width: '60px', padding: '0.25rem', fontSize: '0.75rem', background: '#0f172a', border: '1px solid #4b5563', borderRadius: '0.25rem', color: '#fbbf24' }} />
              <input type="number" placeholder="Max" value={filters.heightRange.max || ''} onChange={(e) => setFilters(prev => ({ ...prev, heightRange: { ...prev.heightRange, max: e.target.value ? Number(e.target.value) : null } }))} style={{ width: '60px', padding: '0.25rem', fontSize: '0.75rem', background: '#0f172a', border: '1px solid #4b5563', borderRadius: '0.25rem', color: '#fbbf24' }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Weight (lbs)</div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="number" placeholder="Min" value={filters.weightRange.min || ''} onChange={(e) => setFilters(prev => ({ ...prev, weightRange: { ...prev.weightRange, min: e.target.value ? Number(e.target.value) : null } }))} style={{ width: '60px', padding: '0.25rem', fontSize: '0.75rem', background: '#0f172a', border: '1px solid #4b5563', borderRadius: '0.25rem', color: '#fbbf24' }} />
              <input type="number" placeholder="Max" value={filters.weightRange.max || ''} onChange={(e) => setFilters(prev => ({ ...prev, weightRange: { ...prev.weightRange, max: e.target.value ? Number(e.target.value) : null } }))} style={{ width: '60px', padding: '0.25rem', fontSize: '0.75rem', background: '#0f172a', border: '1px solid #4b5563', borderRadius: '0.25rem', color: '#fbbf24' }} />
            </div>
          </div>
        </div>

        {/* #10: Forged section - yellow-orange */}
        <div>
          <h4 style={{ fontSize: '0.8rem', color: '#fb923c', marginBottom: '0.5rem', fontStyle: 'italic' }}>f Forged</h4>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Grad Year</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {getUniqueValues('gradYear').map(year => (
                <button key={year} onClick={() => toggleFilter('gradYears', year)} style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem', background: filters.gradYears.includes(year) ? '#92400e' : '#374151', border: `1px solid ${filters.gradYears.includes(year) ? '#f59e0b' : '#4b5563'}`, borderRadius: '0.25rem', color: filters.gradYears.includes(year) ? '#fbbf24' : '#9ca3af', cursor: 'pointer' }}>{year}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {hasActiveFilters() && (
        <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: '#0f172a', borderRadius: '0.25rem', fontSize: '0.75rem', color: '#a78bfa' }}>
          📊 Filtered population: {getFilteredPopulation().length} athletes
        </div>
      )}
    </div>
  );

  // #5: Removed sidebar body click selection - only checkboxes work now
  const renderSidebar = () => (
    <div style={{ width: '280px', background: '#1e293b', borderRight: '1px solid #78350f', padding: '0.75rem', overflowY: 'auto' }}>
      <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', color: '#fb923c' }}>Athletes</h3>
      <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '0.4rem', marginBottom: '0.75rem', background: '#0f172a', border: '1px solid #78350f', borderRadius: '0.375rem', color: '#fbbf24', fontSize: '0.85rem' }} />

      {selectedAthleteObjects.length > 0 && (
        <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: '#422006', borderRadius: '0.5rem', border: '2px solid #ea580c' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h4 style={{ fontSize: '0.85rem', color: '#fb923c', fontWeight: '600' }}>✓ Selected ({selectedAthleteObjects.length})</h4>
            <button onClick={clearSelectedAthletes} style={{ padding: '0.2rem 0.4rem', background: '#7c2d12', border: '1px solid #ea580c', borderRadius: '0.25rem', color: '#fdba74', fontSize: '0.7rem', cursor: 'pointer' }}>Clear</button>
          </div>
          {selectedAthleteObjects.map((athlete, index) => {
            const bands = calculateSigmaBands(athlete);
            const colorIndex = index % ATHLETE_COLORS.length;
            const colors = ATHLETE_COLORS[colorIndex];
            return (
              <div key={athlete.id} style={{ padding: '0.4rem', marginBottom: '0.25rem', borderRadius: '0.375rem', background: '#292524', border: `2px solid ${colors.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input type="checkbox" checked={true} onChange={() => toggleAthleteSelection(athlete.id)} style={{ cursor: 'pointer', accentColor: colors.border }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: '500', color: '#fbbf24', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{athlete.firstName} {athlete.lastName}</div>
                    <div style={{ fontSize: '0.7rem', color: '#a16207' }}>{athlete.position} • {athlete.state}</div>
                  </div>
                </div>
                {/* #8: Sign after number */}
                <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.35rem', fontSize: '0.65rem', fontFamily: 'monospace' }}>
                  <span style={{ color: '#ef4444', width: '14px' }}>{bands.minus3 || '-'}</span>
                  <span style={{ color: '#ef4444', width: '14px' }}>{bands.minus2 || '-'}</span>
                  <span style={{ color: '#ef4444', width: '14px' }}>{bands.minus1 || '-'}</span>
                  <span style={{ color: '#94a3b8', width: '14px' }}>{bands.zero || '-'}</span>
                  <span style={{ color: '#10b981', width: '14px' }}>{bands.plus1 || '-'}</span>
                  <span style={{ color: '#10b981', width: '14px' }}>{bands.plus2 || '-'}</span>
                  <span style={{ color: '#10b981', width: '14px' }}>{bands.plus3 || '-'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* #8: Sigma Legend - sign after number */}
      <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.65rem', color: '#a16207' }}>
        <span style={{ fontWeight: '600' }}>σ:</span>
        <span style={{ color: '#ef4444' }}>3-</span>
        <span style={{ color: '#ef4444' }}>2-</span>
        <span style={{ color: '#ef4444' }}>1-</span>
        <span style={{ color: '#94a3b8' }}>±1</span>
        <span style={{ color: '#10b981' }}>1+</span>
        <span style={{ color: '#10b981' }}>2+</span>
        <span style={{ color: '#10b981' }}>3+</span>
      </div>

      {/* #9: Filter toggle for athlete list */}
      <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
        <input type="checkbox" checked={applyFiltersToList} onChange={() => setApplyFiltersToList(!applyFiltersToList)} style={{ cursor: 'pointer', accentColor: '#ea580c' }} />
        <span style={{ color: '#a16207' }}>Apply filters to list</span>
      </div>

      <div style={{ fontSize: '0.75rem', color: '#a16207', marginBottom: '0.4rem' }}>{unselectedAthletes.length} athletes</div>
      {unselectedAthletes.slice(0, 50).map(athlete => {
        const bands = calculateSigmaBands(athlete);
        return (
          <div key={athlete.id} style={{ padding: '0.5rem', marginBottom: '0.2rem', borderRadius: '0.375rem', cursor: 'pointer', background: 'transparent' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#422006'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input type="checkbox" checked={selectedAthletes.includes(athlete.id)} onChange={() => toggleAthleteSelection(athlete.id)} onClick={(e) => e.stopPropagation()} style={{ cursor: 'pointer', accentColor: '#ea580c' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '500', color: '#fbbf24', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{athlete.firstName} {athlete.lastName}</div>
                <div style={{ fontSize: '0.7rem', color: '#a16207' }}>{athlete.position} • {athlete.state} • {athlete.gradYear}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.35rem', fontSize: '0.65rem', fontFamily: 'monospace' }}>
              <span style={{ color: '#ef4444', width: '14px' }}>{bands.minus3 || '-'}</span>
              <span style={{ color: '#ef4444', width: '14px' }}>{bands.minus2 || '-'}</span>
              <span style={{ color: '#ef4444', width: '14px' }}>{bands.minus1 || '-'}</span>
              <span style={{ color: '#94a3b8', width: '14px' }}>{bands.zero || '-'}</span>
              <span style={{ color: '#10b981', width: '14px' }}>{bands.plus1 || '-'}</span>
              <span style={{ color: '#10b981', width: '14px' }}>{bands.plus2 || '-'}</span>
              <span style={{ color: '#10b981', width: '14px' }}>{bands.plus3 || '-'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );

  // #7: Comparison table with reordered sections and yellow styling
  const renderComparisonTable = () => {
    if (selectedAthleteObjects.length < 1) return null;

    // #7: Attribute data first
    const attributeMetrics = [
      { key: 'height', label: 'Height', unit: 'in', format: (v) => `${Math.floor(v / 12)}'${v % 12}"` },
      { key: 'weight', label: 'Weight', unit: 'lbs' }
    ];

    // #7: Standard data second
    const standardMetrics = [
      { key: 'dash40', label: '40-Yard Dash', unit: 'sec' },
      { key: 'verticalJump', label: 'Vertical Jump', unit: 'in' },
      { key: 'broadJump', label: 'Broad Jump', unit: 'in' },
      { key: 'proAgility', label: 'Pro Agility', unit: 'sec' },
      { key: 'lDrill', label: 'L-Drill', unit: 'sec' }
    ];

    const renderMetricRow = (metric, format) => (
      <tr key={metric.key} style={{ borderBottom: '1px solid #374151' }}>
        {/* #7: Metric name in yellow non-bold */}
        <td style={{ padding: '0.5rem', color: '#fbbf24' }}>{metric.label}</td>
        {selectedAthleteObjects.map((athlete) => {
          const value = athlete[metric.key];
          const displayValue = value ? (format ? format(value) : formatValue(value, metric.unit)) : 'N/A';
          const sigma = value ? (hasActiveFilters() ? calculateFilteredSigma(metric.key, value) : dataService.calculateSigma(metric.key, value)) : null;
          return (
            <td key={athlete.id} style={{ padding: '0.5rem', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                {/* #7: Data in yellow non-bold */}
                <span style={{ color: '#fbbf24', minWidth: '50px', textAlign: 'right' }}>{displayValue}</span>
                <span style={{ color: sigma !== null ? (sigma > 0 ? '#10b981' : '#ef4444') : '#6b7280', fontSize: '0.85rem', minWidth: '60px', textAlign: 'left', fontFamily: 'monospace' }}>
                  {sigma !== null ? `(${sigma > 0 ? '+' : ''}${sigma.toFixed(1)}σ)` : ''}
                </span>
              </div>
            </td>
          );
        })}
      </tr>
    );

    return (
      <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', borderLeft: '4px solid #ea580c' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: '#fb923c' }}>📊 Athlete Comparison</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #78350f' }}>
                <th style={{ padding: '0.5rem', textAlign: 'left', color: '#a16207', width: '140px' }}>Metric</th>
                {selectedAthleteObjects.map((athlete, index) => {
                  const colors = ATHLETE_COLORS[index % ATHLETE_COLORS.length];
                  return (<th key={athlete.id} style={{ padding: '0.5rem', textAlign: 'center', color: colors.border, minWidth: '120px' }}>{athlete.firstName} {athlete.lastName.charAt(0)}.</th>);
                })}
              </tr>
            </thead>
            <tbody>
              {/* #7: Attribute Data first - yellow bold header */}
              <tr>
                <td colSpan={selectedAthleteObjects.length + 1} style={{ padding: '0.75rem 0.5rem 0.25rem', color: '#fbbf24', fontWeight: '700', fontSize: '0.85rem' }}>▲ Attribute Data</td>
              </tr>
              {attributeMetrics.map(m => renderMetricRow(m, m.format))}

              {/* #7: Standard Data second - yellow bold header */}
              <tr>
                <td colSpan={selectedAthleteObjects.length + 1} style={{ padding: '0.75rem 0.5rem 0.25rem', color: '#fbbf24', fontWeight: '700', fontSize: '0.85rem' }}>● Standard Data</td>
              </tr>
              {standardMetrics.map(m => renderMetricRow(m))}

              {/* #7: Forged Data third - yellow bold header */}
              <tr>
                <td colSpan={selectedAthleteObjects.length + 1} style={{ padding: '0.75rem 0.5rem 0.25rem', color: '#fbbf24', fontWeight: '700', fontSize: '0.85rem', fontStyle: 'italic' }}>f Forged Data</td>
              </tr>
              <tr>
                <td colSpan={selectedAthleteObjects.length + 1} style={{ padding: '0.5rem', color: '#64748b', fontSize: '0.8rem' }}>Select metrics in Metric Explorer to add forged ratios</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // SELECTION MODE - #5: Removed Athlete Overview pane
  if (mode === 'selection') {
    return (
      <div style={{ display: 'flex', height: '100%' }}>
        {renderSidebar()}
        <div style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
          {renderFilterPane()}
          {renderComparisonTable()}
          {selectedAthleteObjects.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              Use checkboxes to select athletes for comparison
            </div>
          )}
        </div>
      </div>
    );
  }

  // CHARTS MODE
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {renderSidebar()}
      <div style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
        {selectedAthleteObjects.length > 0 ? (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.4rem', marginBottom: '0.25rem', color: '#fb923c' }}>
                {selectedAthleteObjects.length === 1
                  ? `${selectedAthleteObjects[0].firstName} ${selectedAthleteObjects[0].lastName}`
                  : `Comparing ${selectedAthleteObjects.length} Athletes`}
              </h2>
              {selectedAthleteObjects.length === 1 && (
                <div style={{ color: '#a16207', fontSize: '0.85rem' }}>
                  {selectedAthleteObjects[0].position} • {selectedAthleteObjects[0].state} • Class of {selectedAthleteObjects[0].gradYear}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', borderLeft: '4px solid #ea580c' }}>
                <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem', color: '#fb923c' }}>● Standard Radar</h3>
                <div style={{ position: 'relative', height: '320px' }}><canvas ref={chartRef}></canvas></div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#a16207', textAlign: 'center' }}>Percentile vs {athletes.length} athletes</div>
              </div>

              <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', borderLeft: '4px solid #5b21b6' }}>
                <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem', color: '#a78bfa' }}>▲ Attribute Radar</h3>
                <div style={{ position: 'relative', height: '320px' }}><canvas ref={physicalChartRef}></canvas></div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#a16207', textAlign: 'center' }}>Physical attributes percentile</div>
              </div>
            </div>

            {forgedAxes.length > 0 && (
              <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', borderLeft: '4px solid #dc2626' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1rem', color: '#ef4444' }}>🔥 Forged Profile</h3>
                  <button onClick={clearForgedAxes} style={{ padding: '0.25rem 0.5rem', background: '#7c2d12', border: '1px solid #dc2626', borderRadius: '0.25rem', color: '#fbbf24', fontSize: '0.7rem', cursor: 'pointer' }}>Clear All</button>
                </div>
                <div style={{ marginBottom: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {forgedAxes.map((axis, index) => (
                    <div key={index} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.5rem', background: '#422006', borderRadius: '1rem', fontSize: '0.7rem', color: '#fdba74', border: '1px solid #78350f' }}>
                      <span>{axis.label}</span>
                      <button onClick={() => removeForgedAxis(axis.formula)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '0', fontSize: '0.9rem', lineHeight: '1' }}>×</button>
                    </div>
                  ))}
                </div>
                <div style={{ position: 'relative', height: '280px' }}><canvas ref={forgedChartRef}></canvas></div>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#a16207', fontSize: '1rem' }}>
            Select athletes using checkboxes to view charts
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;