import React, { useState, useEffect, useRef, useCallback } from 'react';
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

// Mapping from display names to athlete object keys
const METRIC_NAME_TO_KEY = {
  '40-Yard Dash': 'dash40',
  'Vertical Jump': 'verticalJump',
  'Broad Jump': 'broadJump',
  'Pro Agility': 'proAgility',
  'L-Drill': 'lDrill',
  'Height': 'height',
  'Weight': 'weight'
};

// Reusable ForgedGlyph component
const ForgedGlyph = ({ size = '1rem', color = '#ef4444' }) => {
  const fontSize = typeof size === 'string' ? `calc(${size} * 1.2)` : `${size * 1.2}px`;
  return (
    <span style={{
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontStyle: 'italic',
      fontWeight: 'bold',
      fontFamily: 'Georgia, serif',
      fontSize,
      color,
      lineHeight: 1
    }}>
      <span style={{ position: 'relative', zIndex: 1 }}>f</span>
      <span style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: '50%',
        height: '2px',
        background: color,
        zIndex: 2
      }}></span>
    </span>
  );
};

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

// Confirmation Dialog Component
const ConfirmationDialog = ({ dialog }) => {
  if (!dialog.open) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#1e293b',
        padding: '1.5rem',
        borderRadius: '0.5rem',
        border: '2px solid #ea580c',
        maxWidth: '500px',
        width: '90%'
      }}>
        <h3 style={{ color: '#fb923c', marginBottom: '0.75rem', fontSize: '1.1rem' }}>
          {dialog.title}
        </h3>
        <p style={{ color: '#fbbf24', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {dialog.message}
        </p>
        {dialog.details && dialog.details.length > 0 && (
          <div style={{
            background: '#0f172a',
            padding: '0.75rem',
            borderRadius: '0.375rem',
            marginBottom: '1rem',
            maxHeight: '200px',
            overflowY: 'auto'
          }}>
            {dialog.details.map((detail, idx) => (
              <div key={idx} style={{
                color: '#94a3b8',
                fontSize: '0.8rem',
                marginBottom: '0.5rem',
                paddingBottom: '0.5rem',
                borderBottom: idx < dialog.details.length - 1 ? '1px solid #374151' : 'none'
              }}>
                <span style={{ color: '#fbbf24', fontWeight: '600' }}>{detail.name}:</span>
                <ul style={{ margin: '0.25rem 0 0 1rem', paddingLeft: '0.5rem' }}>
                  {detail.failures.map((f, i) => (
                    <li key={i} style={{ color: '#ef4444' }}>{f}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={dialog.onCancel}
            style={{
              padding: '0.5rem 1rem',
              background: '#374151',
              border: '1px solid #4b5563',
              borderRadius: '0.375rem',
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            Keep Players
          </button>
          <button
            onClick={dialog.onConfirm}
            style={{
              padding: '0.5rem 1rem',
              background: '#dc2626',
              border: '1px solid #ef4444',
              borderRadius: '0.375rem',
              color: '#fef2f2',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: '600'
            }}
          >
            Remove Players
          </button>
        </div>
      </div>
    </div>
  );
};

function Dashboard({ mode = 'selection' }) {
  const [athletes, setAthletes] = useState([]);
  const [statistics, setStatistics] = useState({});

  // Stack/Iso toggle state for each radar pane
  const [standardViewMode, setStandardViewMode] = useState('stack');
  const [attributeViewMode, setAttributeViewMode] = useState('stack');
  const [forgedViewMode, setForgedViewMode] = useState('stack');

  // Statistic filter slider drag state
  const [draggingStatHandle, setDraggingStatHandle] = useState(null);
  const statSliderRef = useRef(null);

  // Stacked chart refs
  const chartRef = useRef(null);
  const physicalChartRef = useRef(null);
  const forgedChartRef = useRef(null);
  const chartInstance = useRef(null);
  const physicalChartInstance = useRef(null);
  const forgedChartInstance = useRef(null);

  // Iso mode refs - store canvas elements and chart instances separately
  const isoCanvasRefs = useRef({});
  const isoChartInstances = useRef({});

  const {
    selectedAthletes,
    setSelectedAthletes,
    toggleAthleteSelection,
    clearSelectedAthletes,
    forgedAxes,
    removeForgedAxis,
    clearForgedAxes,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    toggleFilter,
    clearAllFilters,
    hasActiveFilters,
    statisticFilter,
    setStatisticFilter,
    filterPaneCollapsed,
    setFilterPaneCollapsed,
    recalcStatsFromFilters,
    setRecalcStatsFromFilters,
    confirmDialog,
    showConfirmDialog
  } = useAppContext();

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

  // Calculate all z-scores for an athlete
  const getAthleteZScores = (athlete) => {
    const metrics = ['dash40', 'verticalJump', 'broadJump', 'proAgility', 'lDrill', 'height', 'weight'];
    const zScores = [];
    metrics.forEach(key => {
      const value = athlete[key];
      if (value) {
        const sigma = dataService.calculateSigma(key, value);
        zScores.push({ key, sigma });
      }
    });
    return zScores;
  };

  // Check if athlete passes statistic filter
  const athletePassesStatisticFilter = (athlete) => {
    if (!statisticFilter.enabled) return true;

    const zScores = getAthleteZScores(athlete);
    if (zScores.length === 0) return false;

    const { low, high, keepOutside } = statisticFilter;

    if (keepOutside) {
      return zScores.some(z => z.sigma >= high || z.sigma <= low);
    } else {
      return zScores.every(z => z.sigma >= low && z.sigma <= high);
    }
  };

  // Get filter failures for an athlete
  const getAthleteFilterFailures = (athlete) => {
    const failures = [];

    if (filters.positions.length > 0 && !filters.positions.includes(athlete.position)) {
      failures.push(`Position "${athlete.position}" not in filter`);
    }
    if (filters.states.length > 0 && !filters.states.includes(athlete.state)) {
      failures.push(`State "${athlete.state}" not in filter`);
    }
    if (filters.gradYears.length > 0 && !filters.gradYears.includes(athlete.gradYear)) {
      failures.push(`Grad year ${athlete.gradYear} not in filter`);
    }
    if (filters.heightRange.min !== null && athlete.height < filters.heightRange.min) {
      failures.push(`Height ${athlete.height}" below minimum ${filters.heightRange.min}"`);
    }
    if (filters.heightRange.max !== null && athlete.height > filters.heightRange.max) {
      failures.push(`Height ${athlete.height}" above maximum ${filters.heightRange.max}"`);
    }
    if (filters.weightRange.min !== null && athlete.weight < filters.weightRange.min) {
      failures.push(`Weight ${athlete.weight}lbs below minimum ${filters.weightRange.min}lbs`);
    }
    if (filters.weightRange.max !== null && athlete.weight > filters.weightRange.max) {
      failures.push(`Weight ${athlete.weight}lbs above maximum ${filters.weightRange.max}lbs`);
    }

    if (statisticFilter.enabled && !athletePassesStatisticFilter(athlete)) {
      const { low, high, keepOutside } = statisticFilter;
      if (keepOutside) {
        failures.push(`No z-scores outside range [${low}σ, ${high}σ]`);
      } else {
        failures.push(`Some z-scores outside range [${low}σ, ${high}σ]`);
      }
    }

    return failures;
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
      if (!athletePassesStatisticFilter(athlete)) return false;
      return true;
    });
  };

  // Check for filter conflicts with selected athletes
  const checkFilterConflicts = () => {
    if (selectedAthletes.length === 0) return;

    const conflictingAthletes = [];
    selectedAthletes.forEach(athleteId => {
      const athlete = athletes.find(a => a.id === athleteId);
      if (athlete) {
        const failures = getAthleteFilterFailures(athlete);
        if (failures.length > 0) {
          conflictingAthletes.push({
            name: `${athlete.firstName} ${athlete.lastName}`,
            id: athleteId,
            failures
          });
        }
      }
    });

    if (conflictingAthletes.length > 0) {
      showConfirmDialog(
        'Filter Conflict',
        `${conflictingAthletes.length} selected athlete(s) don't match the current filters:`,
        conflictingAthletes,
        () => {
          const idsToRemove = conflictingAthletes.map(a => a.id);
          setSelectedAthletes(prev => prev.filter(id => !idsToRemove.includes(id)));
        },
        null
      );
    }
  };

  useEffect(() => {
    if (hasActiveFilters() && selectedAthletes.length > 0 && athletes.length > 0) {
      checkFilterConflicts();
    }
  }, [filters, statisticFilter]);

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

  // Ensure minimum 5 axes (pentagon) with placeholders
  const ensureMinimumAxes = (metrics, minAxes = 5) => {
    if (metrics.length >= minAxes) return metrics;
    const result = [...metrics];
    while (result.length < minAxes) {
      result.push({ key: `placeholder_${result.length}`, label: '', isPlaceholder: true });
    }
    return result;
  };

  // Reorder metrics to start upper-right, counter-clockwise
  const arrangeForPentagon = (metrics) => {
    if (metrics.length === 0) return metrics;
    const totalAxes = Math.max(5, metrics.length);
    const result = new Array(totalAxes).fill(null).map((_, i) => ({
      key: `placeholder_${i}`,
      label: '',
      isPlaceholder: true
    }));

    const realMetrics = metrics.filter(m => !m.isPlaceholder);
    realMetrics.forEach((metric, i) => {
      const positions = [1, 0, 4, 3, 2];
      if (totalAxes === 5) {
        result[positions[i % 5]] = metric;
      } else {
        result[(1 + totalAxes - i) % totalAxes] = metric;
      }
    });

    return result;
  };

  // Calculate data for a metric
  const calculateMetricData = (athlete, metric, type) => {
    if (metric.isPlaceholder) return 0;

    if (type === 'forged') {
      const parts = metric.key.split(' / ');
      if (parts.length !== 2) return 0;
      const numKey = METRIC_NAME_TO_KEY[parts[0].trim()];
      const denKey = METRIC_NAME_TO_KEY[parts[1].trim()];
      if (!numKey || !denKey) return 0;
      const numerator = athlete[numKey];
      const denominator = athlete[denKey];
      if (!numerator || !denominator) return 0;
      const ratio = numerator / denominator;
      const allRatios = athletes.map(a => {
        const n = a[numKey], d = a[denKey];
        return (n && d && d !== 0) ? n / d : null;
      }).filter(r => r !== null).sort((a, b) => a - b);
      if (allRatios.length === 0) return 0;
      const rank = allRatios.filter(r => r < ratio).length;
      return Math.round((rank / allRatios.length) * 100);
    }

    const value = athlete[metric.key];
    if (!value) return 0;
    return dataService.calculatePercentile(metric.key, value);
  };

  // Stacked charts update
  // Metric units for tooltips
  const METRIC_UNITS = {
    'dash40': 'sec',
    'verticalJump': 'in',
    'broadJump': 'in',
    'proAgility': 'sec',
    'lDrill': 'sec',
    'height': 'in',
    'weight': 'lbs'
  };

  const updateAthleteChart = useCallback(() => {
    if (!chartRef.current || selectedAthletes.length === 0) return;
    const ctx = chartRef.current.getContext('2d');
    if (chartInstance.current) chartInstance.current.destroy();

    let metrics = [
      { key: 'dash40', label: '40-Yard Dash' },
      { key: 'verticalJump', label: 'Vertical Jump' },
      { key: 'broadJump', label: 'Broad Jump' },
      { key: 'proAgility', label: 'Pro Agility' },
      { key: 'lDrill', label: 'L-Drill' }
    ];
    metrics = arrangeForPentagon(metrics);

    const athletesToDisplay = athletes.filter(a => selectedAthletes.includes(a.id));
    const datasets = athletesToDisplay.map((athlete, index) => {
      const data = metrics.map(metric => calculateMetricData(athlete, metric, 'standard'));
      const rawValues = metrics.map(metric => metric.isPlaceholder ? null : athlete[metric.key]);
      const units = metrics.map(metric => metric.isPlaceholder ? '' : (METRIC_UNITS[metric.key] || ''));
      const colorIndex = index % ATHLETE_COLORS.length;
      const colors = ATHLETE_COLORS[colorIndex];
      const initials = `${athlete.firstName.charAt(0)}${athlete.lastName.charAt(0)}`;
      return {
        label: `${athlete.firstName} ${athlete.lastName}`,
        data,
        rawValues,
        units,
        initials,
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
        maintainAspectRatio: false,
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
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const dataset = ctx.dataset;
                const rawValue = dataset.rawValues?.[ctx.dataIndex];
                const unit = dataset.units?.[ctx.dataIndex] || '';
                const initials = dataset.initials || '';
                const percentile = Math.round(ctx.parsed.r);
                if (rawValue === null || rawValue === undefined) return '';
                const valueStr = typeof rawValue === 'number' ? rawValue.toFixed(2) : rawValue;
                return `${initials} | ${valueStr} ${unit} | %:${percentile}`;
              }
            }
          }
        }
      }
    });
  }, [athletes, selectedAthletes, statistics]);

  const updatePhysicalChart = useCallback(() => {
    if (!physicalChartRef.current || selectedAthletes.length === 0) return;
    const ctx = physicalChartRef.current.getContext('2d');
    if (physicalChartInstance.current) physicalChartInstance.current.destroy();

    let metrics = [{ key: 'height', label: 'Height' }, { key: 'weight', label: 'Weight' }];
    metrics = arrangeForPentagon(ensureMinimumAxes(metrics, 5));

    const athletesToDisplay = athletes.filter(a => selectedAthletes.includes(a.id));
    const datasets = athletesToDisplay.map((athlete, index) => {
      const data = metrics.map(metric => calculateMetricData(athlete, metric, 'attribute'));
      const rawValues = metrics.map(metric => metric.isPlaceholder ? null : athlete[metric.key]);
      const units = metrics.map(metric => metric.isPlaceholder ? '' : (METRIC_UNITS[metric.key] || ''));
      const colorIndex = index % ATHLETE_COLORS.length;
      const colors = ATHLETE_COLORS[colorIndex];
      const initials = `${athlete.firstName.charAt(0)}${athlete.lastName.charAt(0)}`;
      return {
        label: `${athlete.firstName} ${athlete.lastName}`,
        data,
        rawValues,
        units,
        initials,
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
        maintainAspectRatio: false,
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
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const dataset = ctx.dataset;
                const rawValue = dataset.rawValues?.[ctx.dataIndex];
                const unit = dataset.units?.[ctx.dataIndex] || '';
                const initials = dataset.initials || '';
                const percentile = Math.round(ctx.parsed.r);
                if (rawValue === null || rawValue === undefined) return '';
                const valueStr = typeof rawValue === 'number' ? rawValue.toFixed(2) : rawValue;
                return `${initials} | ${valueStr} ${unit} | %:${percentile}`;
              }
            }
          }
        }
      }
    });
  }, [athletes, selectedAthletes, statistics]);

  const updateForgedChart = useCallback(() => {
    if (!forgedChartRef.current || forgedAxes.length === 0) {
      if (forgedChartInstance.current) { forgedChartInstance.current.destroy(); forgedChartInstance.current = null; }
      return;
    }
    const ctx = forgedChartRef.current.getContext('2d');
    if (forgedChartInstance.current) forgedChartInstance.current.destroy();

    const athletesToDisplay = athletes.filter(a => selectedAthletes.includes(a.id));
    if (athletesToDisplay.length === 0) return;

    let metrics = forgedAxes.map(axis => ({ key: axis.formula, label: axis.label }));
    metrics = arrangeForPentagon(ensureMinimumAxes(metrics, 5));

    // Helper to calculate forged ratio value
    const getForgedRawValue = (athlete, metricKey) => {
      if (!metricKey || metricKey.startsWith('placeholder_')) return null;
      const parts = metricKey.split(' / ');
      if (parts.length !== 2) return null;
      const numKey = METRIC_NAME_TO_KEY[parts[0].trim()];
      const denKey = METRIC_NAME_TO_KEY[parts[1].trim()];
      if (!numKey || !denKey) return null;
      const numerator = athlete[numKey];
      const denominator = athlete[denKey];
      if (!numerator || !denominator || denominator === 0) return null;
      return numerator / denominator;
    };

    // Helper to get forged unit string
    const getForgedUnit = (metricKey) => {
      if (!metricKey || metricKey.startsWith('placeholder_')) return '';
      const parts = metricKey.split(' / ');
      if (parts.length !== 2) return '';
      const numKey = METRIC_NAME_TO_KEY[parts[0].trim()];
      const denKey = METRIC_NAME_TO_KEY[parts[1].trim()];
      const numUnit = METRIC_UNITS[numKey] || '';
      const denUnit = METRIC_UNITS[denKey] || '';
      if (numUnit && denUnit) return `${numUnit}/${denUnit}`;
      return '';
    };

    const datasets = athletesToDisplay.map((athlete, index) => {
      const data = metrics.map(metric => calculateMetricData(athlete, metric, 'forged'));
      const rawValues = metrics.map(metric => metric.isPlaceholder ? null : getForgedRawValue(athlete, metric.key));
      const units = metrics.map(metric => metric.isPlaceholder ? '' : getForgedUnit(metric.key));
      const colorIndex = index % ATHLETE_COLORS.length;
      const colors = ATHLETE_COLORS[colorIndex];
      const initials = `${athlete.firstName.charAt(0)}${athlete.lastName.charAt(0)}`;
      return {
        label: `${athlete.firstName} ${athlete.lastName}`,
        data,
        rawValues,
        units,
        initials,
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
      data: { labels: metrics.map(m => m.label), datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 20,
            bottom: 20,
            left: 40,
            right: 40
          }
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            min: 0,
            ticks: { stepSize: 25, color: '#a16207', backdropColor: 'transparent', font: { size: 10 } },
            grid: { color: '#78350f' },
            pointLabels: { color: '#fbbf24', font: { size: 9, weight: '500' }, padding: 15 }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const dataset = ctx.dataset;
                const rawValue = dataset.rawValues?.[ctx.dataIndex];
                const unit = dataset.units?.[ctx.dataIndex] || '';
                const initials = dataset.initials || '';
                const percentile = Math.round(ctx.parsed.r);
                if (rawValue === null || rawValue === undefined) return '';
                const valueStr = typeof rawValue === 'number' ? rawValue.toFixed(3) : rawValue;
                return `${initials} | ${valueStr} ${unit} | %:${percentile}`;
              }
            }
          }
        }
      }
    });
  }, [athletes, selectedAthletes, forgedAxes]);

  // Update stacked charts
  useEffect(() => {
    if (mode === 'charts' && selectedAthleteObjects.length > 0) {
      if (standardViewMode === 'stack') updateAthleteChart();
      if (attributeViewMode === 'stack') updatePhysicalChart();
      if (forgedViewMode === 'stack') updateForgedChart();
    }
  }, [selectedAthleteObjects, mode, forgedAxes, statistics, standardViewMode, attributeViewMode, forgedViewMode, updateAthleteChart, updatePhysicalChart, updateForgedChart]);

  // Create iso charts using useEffect
  useEffect(() => {
    if (mode !== 'charts') return;

    const athletesToDisplay = athletes.filter(a => selectedAthletes.includes(a.id));
    if (athletesToDisplay.length === 0) return;

    // Prepare metrics
    const standardMetrics = arrangeForPentagon([
      { key: 'dash40', label: '40-Yard Dash' },
      { key: 'verticalJump', label: 'Vertical Jump' },
      { key: 'broadJump', label: 'Broad Jump' },
      { key: 'proAgility', label: 'Pro Agility' },
      { key: 'lDrill', label: 'L-Drill' }
    ]);

    const attributeMetrics = arrangeForPentagon(ensureMinimumAxes([
      { key: 'height', label: 'Height' },
      { key: 'weight', label: 'Weight' }
    ], 5));

    const forgedMetrics = arrangeForPentagon(ensureMinimumAxes(
      forgedAxes.map(axis => ({ key: axis.formula, label: axis.label })),
      5
    ));

    // Destroy existing iso charts
    Object.keys(isoChartInstances.current).forEach(key => {
      if (isoChartInstances.current[key]) {
        isoChartInstances.current[key].destroy();
        delete isoChartInstances.current[key];
      }
    });

    // Create charts for each type in iso mode
    const createIsoChart = (type, metrics, athlete, colorIndex) => {
      const key = `${type}_${athlete.id}`;
      const canvas = isoCanvasRefs.current[key];
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const colors = ATHLETE_COLORS[colorIndex];
      const data = metrics.map(metric => calculateMetricData(athlete, metric, type));
      const initials = `${athlete.firstName.charAt(0)}${athlete.lastName.charAt(0)}`;

      // Calculate raw values based on type
      let rawValues, units;
      if (type === 'forged') {
        const getForgedRawValue = (metricKey) => {
          if (!metricKey || metricKey.startsWith('placeholder_')) return null;
          const parts = metricKey.split(' / ');
          if (parts.length !== 2) return null;
          const numKey = METRIC_NAME_TO_KEY[parts[0].trim()];
          const denKey = METRIC_NAME_TO_KEY[parts[1].trim()];
          if (!numKey || !denKey) return null;
          const numerator = athlete[numKey];
          const denominator = athlete[denKey];
          if (!numerator || !denominator || denominator === 0) return null;
          return numerator / denominator;
        };
        const getForgedUnit = (metricKey) => {
          if (!metricKey || metricKey.startsWith('placeholder_')) return '';
          const parts = metricKey.split(' / ');
          if (parts.length !== 2) return '';
          const numKey = METRIC_NAME_TO_KEY[parts[0].trim()];
          const denKey = METRIC_NAME_TO_KEY[parts[1].trim()];
          const numUnit = METRIC_UNITS[numKey] || '';
          const denUnit = METRIC_UNITS[denKey] || '';
          if (numUnit && denUnit) return `${numUnit}/${denUnit}`;
          return '';
        };
        rawValues = metrics.map(metric => metric.isPlaceholder ? null : getForgedRawValue(metric.key));
        units = metrics.map(metric => metric.isPlaceholder ? '' : getForgedUnit(metric.key));
      } else {
        rawValues = metrics.map(metric => metric.isPlaceholder ? null : athlete[metric.key]);
        units = metrics.map(metric => metric.isPlaceholder ? '' : (METRIC_UNITS[metric.key] || ''));
      }

      isoChartInstances.current[key] = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: metrics.map(m => m.label),
          datasets: [{
            data,
            rawValues,
            units,
            initials,
            backgroundColor: colors.bg,
            borderColor: colors.border,
            borderWidth: 2,
            pointBackgroundColor: colors.point,
            pointBorderColor: '#fff',
            pointRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          scales: {
            r: {
              beginAtZero: true,
              max: 100,
              min: 0,
              ticks: { stepSize: 25, color: '#64748b', backdropColor: 'transparent', font: { size: 9 } },
              grid: { color: '#374151' },
              pointLabels: {
                color: '#fbbf24',
                font: { size: 10, weight: '500' }
              }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const dataset = ctx.dataset;
                  const rawValue = dataset.rawValues?.[ctx.dataIndex];
                  const unit = dataset.units?.[ctx.dataIndex] || '';
                  const initials = dataset.initials || '';
                  const percentile = Math.round(ctx.parsed.r);
                  if (rawValue === null || rawValue === undefined) return '';
                  const decimals = type === 'forged' ? 3 : 2;
                  const valueStr = typeof rawValue === 'number' ? rawValue.toFixed(decimals) : rawValue;
                  return `${initials} | ${valueStr} ${unit} | %:${percentile}`;
                }
              }
            }
          }
        }
      });
    };

    // Small delay to ensure canvas refs are set
    setTimeout(() => {
      athletesToDisplay.forEach((athlete, index) => {
        if (standardViewMode === 'iso') {
          createIsoChart('standard', standardMetrics, athlete, index % ATHLETE_COLORS.length);
        }
        if (attributeViewMode === 'iso') {
          createIsoChart('attribute', attributeMetrics, athlete, index % ATHLETE_COLORS.length);
        }
        if (forgedViewMode === 'iso' && forgedAxes.length > 0) {
          createIsoChart('forged', forgedMetrics, athlete, index % ATHLETE_COLORS.length);
        }
      });
    }, 50);

    return () => {
      Object.keys(isoChartInstances.current).forEach(key => {
        if (isoChartInstances.current[key]) {
          isoChartInstances.current[key].destroy();
        }
      });
      isoChartInstances.current = {};
    };
  }, [mode, selectedAthletes, athletes, standardViewMode, attributeViewMode, forgedViewMode, forgedAxes]);

  const filteredAthletes = searchQuery ? dataService.searchAthletes(searchQuery) : athletes;

  // Apply population filters to sidebar list (change #2)
  const filteredPopulation = getFilteredPopulation();
  const displayAthletes = hasActiveFilters()
    ? filteredAthletes.filter(a => filteredPopulation.some(fp => fp.id === a.id))
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

  // Statistic filter slider handling
  const snapToHalfSigma = (value) => {
    const snapPoints = [-3, -2.5, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3];
    const snapThreshold = 0.15;
    for (const snap of snapPoints) {
      if (Math.abs(value - snap) < snapThreshold) return snap;
    }
    return Math.round(value * 10) / 10;
  };

  const handleStatSliderDrag = (handle, e) => {
    e.preventDefault();
    setDraggingStatHandle(handle);
    const container = statSliderRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const onMouseMove = (moveEvent) => {
      const x = moveEvent.clientX - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));
      const rawValue = percent * 6 - 3;
      const snappedValue = snapToHalfSigma(rawValue);

      if (handle === 'low') {
        if (snappedValue < statisticFilter.high) {
          setStatisticFilter(prev => ({ ...prev, low: snappedValue }));
        }
      } else {
        if (snappedValue > statisticFilter.low) {
          setStatisticFilter(prev => ({ ...prev, high: snappedValue }));
        }
      }
    };

    const onMouseUp = () => {
      setDraggingStatHandle(null);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Filter pane
  const renderFilterPane = () => {
    // Collapsed state - show minimal bar
    if (filterPaneCollapsed) {
      return (
        <div
          onClick={() => setFilterPaneCollapsed(false)}
          style={{
            background: '#1e293b',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            borderLeft: '4px solid #8b5cf6',
            borderBottom: '4px solid #8b5cf6',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#a78bfa', fontSize: '0.9rem' }}> Population Filters</span>
            {hasActiveFilters() && (
              <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', background: '#5b21b6', borderRadius: '0.25rem', color: '#c4b5fd' }}>
                Active • {getFilteredPopulation().length} athletes
              </span>
            )}
          </div>
          <span style={{ color: '#8b5cf6', fontSize: '1.2rem' }}>▼</span>
        </div>
      );
    }

    return (
      <div style={{
        background: '#1e293b',
        padding: '1rem',
        borderRadius: '0.5rem',
        marginBottom: '1rem',
        borderLeft: '4px solid #8b5cf6',
        borderBottom: '4px solid #8b5cf6',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1rem', color: '#a78bfa' }}>
             Population Filters
            {hasActiveFilters() && (<span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', padding: '0.15rem 0.4rem', background: '#5b21b6', borderRadius: '0.25rem' }}>Active</span>)}
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {hasActiveFilters() && (
              <button onClick={clearAllFilters} style={{ padding: '0.3rem 0.6rem', background: '#7c2d12', border: '1px solid #dc2626', borderRadius: '0.25rem', color: '#fbbf24', fontSize: '0.75rem', cursor: 'pointer' }}>Clear All</button>
            )}
            <button style={{ padding: '0.3rem 0.6rem', background: '#1e3a5f', border: '1px solid #3b82f6', borderRadius: '0.25rem', color: '#93c5fd', fontSize: '0.75rem', cursor: 'pointer', opacity: 0.6 }} title="Coming soon"> Save Forged</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {/* Attributes section - now includes Position, State, Height, Weight, Grad Year */}
          <div>
            <h4 style={{ fontSize: '0.8rem', color: '#fbbf24', marginBottom: '0.5rem' }}>▲ Attributes</h4>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Position</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                {getUniqueValues('position').slice(0, 8).map(pos => (
                  <button key={pos} onClick={() => toggleFilter('positions', pos)} style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem', background: filters.positions.includes(pos) ? '#5b21b6' : '#374151', border: `1px solid ${filters.positions.includes(pos) ? '#a78bfa' : '#4b5563'}`, borderRadius: '0.25rem', color: filters.positions.includes(pos) ? '#c4b5fd' : '#9ca3af', cursor: 'pointer' }}>{pos}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>State</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                {getUniqueValues('state').slice(0, 6).map(state => (
                  <button key={state} onClick={() => toggleFilter('states', state)} style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem', background: filters.states.includes(state) ? '#5b21b6' : '#374151', border: `1px solid ${filters.states.includes(state) ? '#a78bfa' : '#4b5563'}`, borderRadius: '0.25rem', color: filters.states.includes(state) ? '#c4b5fd' : '#9ca3af', cursor: 'pointer' }}>{state}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Grad Year</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                {getUniqueValues('gradYear').map(year => (
                  <button key={year} onClick={() => toggleFilter('gradYears', year)} style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem', background: filters.gradYears.includes(year) ? '#5b21b6' : '#374151', border: `1px solid ${filters.gradYears.includes(year) ? '#a78bfa' : '#4b5563'}`, borderRadius: '0.25rem', color: filters.gradYears.includes(year) ? '#c4b5fd' : '#9ca3af', cursor: 'pointer' }}>{year}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Standard section - Height/Weight ranges */}
          <div>
            <h4 style={{ fontSize: '0.8rem', color: '#fbbf24', marginBottom: '0.5rem' }}>● Standard</h4>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Height (in)</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="number" placeholder="Min" value={filters.heightRange.min || ''} onChange={(e) => setFilters(prev => ({ ...prev, heightRange: { ...prev.heightRange, min: e.target.value ? Number(e.target.value) : null } }))} style={{ width: '60px', padding: '0.25rem', fontSize: '0.75rem', background: '#0f172a', border: '1px solid #4b5563', borderRadius: '0.25rem', color: '#fbbf24' }} />
                <input type="number" placeholder="Max" value={filters.heightRange.max || ''} onChange={(e) => setFilters(prev => ({ ...prev, heightRange: { ...prev.heightRange, max: e.target.value ? Number(e.target.value) : null } }))} style={{ width: '60px', padding: '0.25rem', fontSize: '0.75rem', background: '#0f172a', border: '1px solid #4b5563', borderRadius: '0.25rem', color: '#fbbf24' }} />
              </div>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Weight (lbs)</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="number" placeholder="Min" value={filters.weightRange.min || ''} onChange={(e) => setFilters(prev => ({ ...prev, weightRange: { ...prev.weightRange, min: e.target.value ? Number(e.target.value) : null } }))} style={{ width: '60px', padding: '0.25rem', fontSize: '0.75rem', background: '#0f172a', border: '1px solid #4b5563', borderRadius: '0.25rem', color: '#fbbf24' }} />
                <input type="number" placeholder="Max" value={filters.weightRange.max || ''} onChange={(e) => setFilters(prev => ({ ...prev, weightRange: { ...prev.weightRange, max: e.target.value ? Number(e.target.value) : null } }))} style={{ width: '60px', padding: '0.25rem', fontSize: '0.75rem', background: '#0f172a', border: '1px solid #4b5563', borderRadius: '0.25rem', color: '#fbbf24' }} />
              </div>
            </div>
          </div>

          {/* Forged section - now before Statistics */}
          <div>
            <h4 style={{ fontSize: '0.8rem', color: '#fbbf24', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <ForgedGlyph size="0.8rem" color="#fbbf24" /> Forged
            </h4>
            <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
              Custom forged filters coming soon...
            </div>
          </div>

          {/* Statistics section - now last */}
          <div>
            <h4 style={{ fontSize: '0.8rem', color: '#fbbf24', marginBottom: '0.5rem' }}> Statistics</h4>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.75rem' }}>
                <input
                  type="checkbox"
                  checked={statisticFilter.enabled}
                  onChange={() => setStatisticFilter(prev => ({ ...prev, enabled: !prev.enabled }))}
                  style={{ cursor: 'pointer', accentColor: '#fbbf24' }}
                />
                <span style={{ color: '#fbbf24' }}>Use σ Filtering</span>
              </label>
            </div>

            {/* Slider with grey handles, green for kept data */}
            <div
              ref={statSliderRef}
              style={{ position: 'relative', height: '24px', marginBottom: '0.5rem', opacity: statisticFilter.enabled ? 1 : 0.4 }}
            >
              {/* Base track */}
              <div style={{ position: 'absolute', top: '10px', left: 0, right: 0, height: '4px', background: '#374151', borderRadius: '2px' }}></div>

              {/* Kept data highlight - green */}
              {statisticFilter.keepOutside ? (
                <>
                  {/* Left segment (kept) */}
                  <div style={{ position: 'absolute', top: '10px', left: 0, width: `${((statisticFilter.low + 3) / 6) * 100}%`, height: '4px', background: '#22c55e', borderRadius: '2px 0 0 2px' }}></div>
                  {/* Right segment (kept) */}
                  <div style={{ position: 'absolute', top: '10px', left: `${((statisticFilter.high + 3) / 6) * 100}%`, right: 0, height: '4px', background: '#22c55e', borderRadius: '0 2px 2px 0' }}></div>
                </>
              ) : (
                /* Inside segment (kept) */
                <div style={{ position: 'absolute', top: '10px', left: `${((statisticFilter.low + 3) / 6) * 100}%`, width: `${((statisticFilter.high - statisticFilter.low) / 6) * 100}%`, height: '4px', background: '#22c55e', borderRadius: '2px' }}></div>
              )}

              {/* Grey handles */}
              <div style={{ position: 'absolute', left: `${((statisticFilter.low + 3) / 6) * 100}%`, top: '5px', width: '14px', height: '14px', background: draggingStatHandle === 'low' ? '#9ca3af' : '#6b7280', borderRadius: '50%', transform: 'translateX(-50%)', cursor: statisticFilter.enabled ? 'grab' : 'not-allowed', border: '2px solid #9ca3af', zIndex: 3 }} onMouseDown={(e) => statisticFilter.enabled && handleStatSliderDrag('low', e)} />
              <div style={{ position: 'absolute', left: `${((statisticFilter.high + 3) / 6) * 100}%`, top: '5px', width: '14px', height: '14px', background: draggingStatHandle === 'high' ? '#9ca3af' : '#6b7280', borderRadius: '50%', transform: 'translateX(-50%)', cursor: statisticFilter.enabled ? 'grab' : 'not-allowed', border: '2px solid #9ca3af', zIndex: 3 }} onMouseDown={(e) => statisticFilter.enabled && handleStatSliderDrag('high', e)} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#64748b', marginBottom: '0.5rem' }}>
              <span>-3σ</span>
              <span>0σ</span>
              <span>+3σ</span>
            </div>

            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.5rem', textAlign: 'center' }}>
              Range: [{statisticFilter.low > 0 ? '+' : ''}{statisticFilter.low}σ, {statisticFilter.high > 0 ? '+' : ''}{statisticFilter.high}σ]
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.7rem', marginBottom: '0.5rem' }}>
              <input
                type="checkbox"
                checked={!statisticFilter.keepOutside}
                onChange={() => setStatisticFilter(prev => ({ ...prev, keepOutside: !prev.keepOutside }))}
                style={{ cursor: 'pointer', accentColor: '#fbbf24' }}
                disabled={!statisticFilter.enabled}
              />
              <span style={{ color: '#fbbf24' }}>
                Keep Data Inside/Outside of Handles
              </span>
            </label>

            {/* Recalc stats toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.7rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #374151' }}>
              <input
                type="checkbox"
                checked={recalcStatsFromFilters}
                onChange={() => setRecalcStatsFromFilters(!recalcStatsFromFilters)}
                style={{ cursor: 'pointer', accentColor: '#fbbf24' }}
              />
              <span style={{ color: recalcStatsFromFilters ? '#22c55e' : '#9ca3af' }}>
                Recalc σ from filtered pop
              </span>
            </label>
          </div>
        </div>

        {hasActiveFilters() && (
          <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: '#0f172a', borderRadius: '0.25rem', fontSize: '0.75rem', color: '#fbbf24' }}>
             Filtered population: {getFilteredPopulation().length} athletes
          </div>
        )}

        {/* Collapse triangle at bottom center */}
        <div
          onClick={() => setFilterPaneCollapsed(true)}
          style={{
            position: 'absolute',
            bottom: '-4px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '40px',
            height: '20px',
            background: '#8b5cf6',
            borderRadius: '0 0 8px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <span style={{ color: '#1e293b', fontSize: '0.8rem', fontWeight: 'bold' }}>▲</span>
        </div>
      </div>
    );
  };

  const renderSidebar = () => (
    <div style={{ width: '280px', background: '#1e293b', borderRight: '1px solid #78350f', padding: '0.75rem', overflowY: 'auto' }}>
      <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', color: '#fb923c' }}>Athletes</h3>
      <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '0.4rem', marginBottom: '0.75rem', background: '#0f172a', border: '1px solid #78350f', borderRadius: '0.375rem', color: '#fbbf24', fontSize: '0.85rem' }} />

      {selectedAthleteObjects.length > 0 && (
        <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: '#422006', borderRadius: '0.5rem', border: '2px solid #ea580c' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h4 style={{ fontSize: '0.85rem', color: '#fb923c', fontWeight: '600' }}>Selected ({selectedAthleteObjects.length})</h4>
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

  const renderComparisonTable = () => {
    if (selectedAthleteObjects.length < 1) return null;

    const attributeMetrics = [
      { key: 'height', label: 'Height', unit: 'in', format: (v) => `${Math.floor(v / 12)}'${v % 12}"` },
      { key: 'weight', label: 'Weight', unit: 'lbs' }
    ];

    const standardMetrics = [
      { key: 'dash40', label: '40-Yard Dash', unit: 'sec' },
      { key: 'verticalJump', label: 'Vertical Jump', unit: 'in' },
      { key: 'broadJump', label: 'Broad Jump', unit: 'in' },
      { key: 'proAgility', label: 'Pro Agility', unit: 'sec' },
      { key: 'lDrill', label: 'L-Drill', unit: 'sec' }
    ];

    const renderMetricRow = (metric, format) => (
      <tr key={metric.key} style={{ borderBottom: '1px solid #374151' }}>
        <td style={{ padding: '0.5rem', color: '#fbbf24' }}>{metric.label}</td>
        {selectedAthleteObjects.map((athlete) => {
          const value = athlete[metric.key];
          const displayValue = value ? (format ? format(value) : formatValue(value, metric.unit)) : 'N/A';
          const sigma = value ? (hasActiveFilters() ? calculateFilteredSigma(metric.key, value) : dataService.calculateSigma(metric.key, value)) : null;
          return (
            <td key={athlete.id} style={{ padding: '0.5rem', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
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
      <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', borderLeft: '4px solid #fbbf24' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: '#fb923c' }}> Athlete Comparison</h3>
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
              <tr><td colSpan={selectedAthleteObjects.length + 1} style={{ padding: '0.75rem 0.5rem 0.25rem', color: '#fbbf24', fontWeight: '700', fontSize: '0.85rem' }}>▲ Attribute Data</td></tr>
              {attributeMetrics.map(m => renderMetricRow(m, m.format))}
              <tr><td colSpan={selectedAthleteObjects.length + 1} style={{ padding: '0.75rem 0.5rem 0.25rem', color: '#fbbf24', fontWeight: '700', fontSize: '0.85rem' }}>● Standard Data</td></tr>
              {standardMetrics.map(m => renderMetricRow(m))}
              <tr><td colSpan={selectedAthleteObjects.length + 1} style={{ padding: '0.75rem 0.5rem 0.25rem', color: '#fbbf24', fontWeight: '700', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><ForgedGlyph size="0.85rem" color="#fbbf24" /> Forged Data</td></tr>
              <tr><td colSpan={selectedAthleteObjects.length + 1} style={{ padding: '0.5rem', color: '#64748b', fontSize: '0.8rem' }}>Select metrics in Metric Explorer to add forged ratios</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const ViewModeToggle = ({ mode, setMode }) => (
    <div style={{ display: 'flex', gap: '0.25rem', background: '#0f172a', padding: '0.2rem', borderRadius: '0.25rem' }}>
      <button onClick={() => setMode('stack')} style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', background: mode === 'stack' ? '#ea580c' : 'transparent', border: 'none', borderRadius: '0.2rem', color: mode === 'stack' ? '#fef3c7' : '#94a3b8', cursor: 'pointer', fontWeight: mode === 'stack' ? '600' : '400' }}>Stack</button>
      <button onClick={() => setMode('iso')} style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', background: mode === 'iso' ? '#ea580c' : 'transparent', border: 'none', borderRadius: '0.2rem', color: mode === 'iso' ? '#fef3c7' : '#94a3b8', cursor: 'pointer', fontWeight: mode === 'iso' ? '600' : '400' }}>Iso</button>
    </div>
  );

  // Athlete legend component for stacked radar charts
  const AthleteLegend = ({ athleteList }) => (
    <div style={{
      minWidth: '140px',
      maxWidth: '160px',
      padding: '0.5rem',
      background: '#0f172a',
      borderRadius: '0.375rem',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: '0.4rem'
    }}>
      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Athletes</div>
      {athleteList.map((athlete, index) => {
        const colorIndex = index % ATHLETE_COLORS.length;
        const colors = ATHLETE_COLORS[colorIndex];
        return (
          <div key={athlete.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: colors.border,
              border: '2px solid #fff',
              flexShrink: 0
            }}></div>
            <span style={{
              fontSize: '0.75rem',
              color: colors.border,
              fontWeight: '500',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {athlete.firstName} {athlete.lastName.charAt(0)}.
            </span>
          </div>
        );
      })}
    </div>
  );

  // Units legend component for stacked radar charts
  const UnitsLegend = ({ metrics, type }) => {
    // Filter out placeholder metrics
    const realMetrics = metrics.filter(m => !m.isPlaceholder && m.label);
    if (realMetrics.length === 0) return null;

    return (
      <div style={{
        minWidth: '140px',
        maxWidth: '180px',
        padding: '0.5rem',
        background: '#0f172a',
        borderRadius: '0.375rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '0.3rem'
      }}>
        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Units</div>
        {realMetrics.map((metric, index) => {
          let unit = '';
          if (type === 'forged') {
            const parts = metric.key.split(' / ');
            if (parts.length === 2) {
              const numKey = METRIC_NAME_TO_KEY[parts[0].trim()];
              const denKey = METRIC_NAME_TO_KEY[parts[1].trim()];
              const numUnit = METRIC_UNITS[numKey] || '';
              const denUnit = METRIC_UNITS[denKey] || '';
              unit = numUnit && denUnit ? `${numUnit}/${denUnit}` : '';
            }
          } else {
            unit = METRIC_UNITS[metric.key] || '';
          }
          return (
            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span style={{
                fontSize: '0.7rem',
                color: '#fbbf24',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1
              }}>
                {metric.label}
              </span>
              <span style={{
                fontSize: '0.7rem',
                color: '#94a3b8',
                fontFamily: 'monospace',
                flexShrink: 0
              }}>
                ({unit || '-'})
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Get metrics for each chart type (for legends)
  const getStandardMetrics = () => arrangeForPentagon([
    { key: 'dash40', label: '40-Yard Dash' },
    { key: 'verticalJump', label: 'Vertical Jump' },
    { key: 'broadJump', label: 'Broad Jump' },
    { key: 'proAgility', label: 'Pro Agility' },
    { key: 'lDrill', label: 'L-Drill' }
  ]);

  const getAttributeMetrics = () => arrangeForPentagon(ensureMinimumAxes([
    { key: 'height', label: 'Height' },
    { key: 'weight', label: 'Weight' }
  ], 5));

  const getForgedMetrics = () => arrangeForPentagon(ensureMinimumAxes(
    forgedAxes.map(axis => ({ key: axis.formula, label: axis.label })),
    5
  ));

  // Render iso charts grid
  const renderIsoCharts = (type, athletesToDisplay) => {
    const columns = Math.min(3, athletesToDisplay.length);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '1rem', marginTop: '0.5rem' }}>
        {athletesToDisplay.map((athlete, index) => {
          const colorIndex = index % ATHLETE_COLORS.length;
          const colors = ATHLETE_COLORS[colorIndex];
          const key = `${type}_${athlete.id}`;

          return (
            <div key={athlete.id} style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.375rem', border: `2px solid ${colors.border}` }}>
              <div style={{ fontSize: '0.85rem', color: colors.border, marginBottom: '0.5rem', textAlign: 'center', fontWeight: '600' }}>
                {athlete.firstName} {athlete.lastName}
              </div>
              <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <canvas
                  ref={el => { isoCanvasRefs.current[key] = el; }}
                  style={{ maxWidth: '100%', maxHeight: '100%' }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // SELECTION MODE
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
        <ConfirmationDialog dialog={confirmDialog} />
      </div>
    );
  }

  // CHARTS MODE
  const athletesToDisplay = athletes.filter(a => selectedAthletes.includes(a.id));

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {renderSidebar()}
      <div style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
        {selectedAthleteObjects.length > 0 ? (
          <>
            {/* Standard Radar pane */}
            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', borderLeft: '4px solid #fbbf24' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1rem', color: '#fbbf24' }}>● Standard Radar</h3>
                <ViewModeToggle mode={standardViewMode} setMode={setStandardViewMode} />
              </div>
              {standardViewMode === 'stack' ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'stretch', gap: '1rem' }}>
                    <AthleteLegend athleteList={athletesToDisplay} />
                    <div style={{ flex: 1, position: 'relative', minHeight: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <canvas ref={chartRef} style={{ maxWidth: '100%', maxHeight: '100%' }}></canvas>
                    </div>
                    <UnitsLegend metrics={getStandardMetrics()} type="standard" />
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#a16207', textAlign: 'center' }}>Percentile vs. {athletes.length} Athletes</div>
                </>
              ) : (
                renderIsoCharts('standard', athletesToDisplay)
              )}
            </div>

            {/* Attribute Radar pane */}
            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', borderLeft: '4px solid #fbbf24' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1rem', color: '#fbbf24' }}>▲ Attribute Radar</h3>
                <ViewModeToggle mode={attributeViewMode} setMode={setAttributeViewMode} />
              </div>
              {attributeViewMode === 'stack' ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'stretch', gap: '1rem' }}>
                    <AthleteLegend athleteList={athletesToDisplay} />
                    <div style={{ flex: 1, position: 'relative', minHeight: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <canvas ref={physicalChartRef} style={{ maxWidth: '100%', maxHeight: '100%' }}></canvas>
                    </div>
                    <UnitsLegend metrics={getAttributeMetrics()} type="attribute" />
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#a16207', textAlign: 'center' }}>Percentile vs. {athletes.length} Athletes</div>
                </>
              ) : (
                renderIsoCharts('attribute', athletesToDisplay)
              )}
            </div>

            {/* Forged Radar pane - renamed from "Forged Profile" */}
            {forgedAxes.length > 0 && (
              <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', borderLeft: '4px solid #fbbf24' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <ForgedGlyph size="1rem" color="#fbbf24" /> Forged Radar
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <ViewModeToggle mode={forgedViewMode} setMode={setForgedViewMode} />
                    <button onClick={clearForgedAxes} style={{ padding: '0.25rem 0.5rem', background: '#7c2d12', border: '1px solid #dc2626', borderRadius: '0.25rem', color: '#fbbf24', fontSize: '0.7rem', cursor: 'pointer' }}>Clear All</button>
                  </div>
                </div>
                <div style={{ marginBottom: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {forgedAxes.map((axis, index) => (
                    <div key={index} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.5rem', background: '#422006', borderRadius: '1rem', fontSize: '0.7rem', color: '#fdba74', border: '1px solid #78350f' }}>
                      <span>{axis.label}</span>
                      <button onClick={() => removeForgedAxis(axis.formula)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '0', fontSize: '0.9rem', lineHeight: '1' }}>×</button>
                    </div>
                  ))}
                </div>
                {forgedViewMode === 'stack' ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'stretch', gap: '1rem' }}>
                      <AthleteLegend athleteList={athletesToDisplay} />
                      <div style={{ flex: 1, position: 'relative', minHeight: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <canvas ref={forgedChartRef} style={{ maxWidth: '100%', maxHeight: '100%' }}></canvas>
                      </div>
                      <UnitsLegend metrics={getForgedMetrics()} type="forged" />
                    </div>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#a16207', textAlign: 'center' }}>Percentile vs. {athletes.length} Athletes</div>
                  </>
                ) : (
                  renderIsoCharts('forged', athletesToDisplay)
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#a16207', fontSize: '1rem' }}>
            Select athletes using checkboxes to view charts
          </div>
        )}
      </div>
      <ConfirmationDialog dialog={confirmDialog} />
    </div>
  );
}

export default Dashboard;