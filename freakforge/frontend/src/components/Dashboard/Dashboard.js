import React, { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import dataService from '../../utils/dataService';
import { useAppContext } from '../../context/AppContext';

// Register Chart.js components
Chart.register(...registerables);

// Color palette matching FreakFinder
const ATHLETE_COLORS = [
  { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 1)', point: 'rgba(239, 68, 68, 1)', name: 'Red' },
  { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgba(59, 130, 246, 1)', point: 'rgba(59, 130, 246, 1)', name: 'Blue' },
  { bg: 'rgba(16, 185, 129, 0.2)', border: 'rgba(16, 185, 129, 1)', point: 'rgba(16, 185, 129, 1)', name: 'Green' },
  { bg: 'rgba(245, 158, 11, 0.2)', border: 'rgba(245, 158, 11, 1)', point: 'rgba(245, 158, 11, 1)', name: 'Amber' },
  { bg: 'rgba(139, 92, 246, 0.2)', border: 'rgba(139, 92, 246, 1)', point: 'rgba(139, 92, 246, 1)', name: 'Purple' },
];

function Dashboard({ mode = 'selection' }) {
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
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

      if (data.athletes.length > 0) {
        setSelectedAthlete(data.athletes[0]);
      }
    });
  }, []);

  useEffect(() => {
    if (mode === 'charts') {
      if (chartRef.current && physicalChartRef.current) {
        updateChart();
        updatePhysicalChart();
      }
      if (forgedChartRef.current) {
        updateForgedChart();
      }
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
      if (physicalChartInstance.current) {
        physicalChartInstance.current.destroy();
      }
      if (forgedChartInstance.current) {
        forgedChartInstance.current.destroy();
      }
    };
  }, [selectedAthlete, selectedAthletes, statistics, forgedAxes, mode]);

  const updateChart = () => {
    if (!chartRef.current) return;
    if (selectedAthletes.length === 0 && !selectedAthlete) return;

    const ctx = chartRef.current.getContext('2d');

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const metrics = [
      { key: 'dash40', label: '40-Yard Dash', inverse: true },
      { key: 'verticalJump', label: 'Vertical Jump' },
      { key: 'broadJump', label: 'Broad Jump' },
      { key: 'proAgility', label: 'Pro Agility', inverse: true },
      { key: 'lDrill', label: 'L-Drill', inverse: true }
    ];

    const athletesToDisplay = selectedAthletes.length > 0
      ? athletes.filter(a => selectedAthletes.includes(a.id))
      : selectedAthlete ? [selectedAthlete] : [];

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
        data: data,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderWidth: 2,
        pointBackgroundColor: colors.point,
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: colors.point,
        pointRadius: 5,
        pointHoverRadius: 7
      };
    });

    chartInstance.current = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: metrics.map(m => m.label),
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            min: 0,
            ticks: {
              stepSize: 25,
              color: '#a16207',
              backdropColor: 'transparent',
              font: { size: 11 }
            },
            grid: {
              color: '#78350f'
            },
            pointLabels: {
              color: '#fbbf24',
              font: { size: 12, weight: '500' }
            }
          }
        },
        plugins: {
          legend: {
            display: athletesToDisplay.length > 1,
            labels: {
              color: '#fb923c',
              font: { size: 12 },
              padding: 10
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${Math.round(context.parsed.r)}th percentile`;
              }
            }
          }
        }
      }
    });
  };

  const updatePhysicalChart = () => {
    if (!physicalChartRef.current || !selectedAthlete) return;

    const ctx = physicalChartRef.current.getContext('2d');

    if (physicalChartInstance.current) {
      physicalChartInstance.current.destroy();
    }

    const metrics = [
      { key: 'height', label: 'Height' },
      { key: 'weight', label: 'Weight' }
    ];

    const data = metrics.map(metric => {
      const value = selectedAthlete[metric.key];
      if (!value || !statistics[metric.key]) return 0;
      return dataService.calculatePercentile(metric.key, value);
    });

    physicalChartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: metrics.map(m => m.label),
        datasets: [{
          label: `${selectedAthlete.firstName} ${selectedAthlete.lastName}`,
          data: data,
          backgroundColor: ['rgba(217, 119, 6, 0.8)', 'rgba(245, 158, 11, 0.8)'],
          borderColor: ['rgba(217, 119, 6, 1)', 'rgba(245, 158, 11, 1)'],
          borderWidth: 2
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          x: {
            beginAtZero: true,
            max: 100,
            ticks: { color: '#a16207', font: { size: 11 } },
            grid: { color: '#78350f' }
          },
          y: {
            ticks: { color: '#fbbf24', font: { size: 12, weight: '500' } },
            grid: { display: false }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `Percentile: ${Math.round(context.parsed.x)}th`;
              }
            }
          }
        }
      }
    });
  };

  const updateForgedChart = () => {
    if (!forgedChartRef.current || forgedAxes.length === 0) {
      if (forgedChartInstance.current) {
        forgedChartInstance.current.destroy();
        forgedChartInstance.current = null;
      }
      return;
    }

    const ctx = forgedChartRef.current.getContext('2d');

    if (forgedChartInstance.current) {
      forgedChartInstance.current.destroy();
    }

    const athletesToDisplay = selectedAthletes.length > 0
      ? athletes.filter(a => selectedAthletes.includes(a.id))
      : selectedAthlete ? [selectedAthlete] : [];

    if (athletesToDisplay.length === 0) return;

    const datasets = athletesToDisplay.map((athlete, index) => {
      const data = forgedAxes.map(axis => {
        const parts = axis.formula.toLowerCase().split('/');
        if (parts.length !== 2) return 0;

        const numerator = athlete[parts[0].trim()];
        const denominator = athlete[parts[1].trim()];

        if (!numerator || !denominator) return 0;

        const value = numerator / denominator;
        return Math.min(100, Math.max(0, value * 10));
      });

      const colorIndex = index % ATHLETE_COLORS.length;
      const colors = ATHLETE_COLORS[colorIndex];

      return {
        label: `${athlete.firstName} ${athlete.lastName}`,
        data: data,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderWidth: 2,
        pointBackgroundColor: colors.point,
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: colors.point,
        pointRadius: 5,
        pointHoverRadius: 7
      };
    });

    forgedChartInstance.current = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: forgedAxes.map(axis => axis.label),
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            min: 0,
            ticks: {
              stepSize: 25,
              color: '#a16207',
              backdropColor: 'transparent',
              font: { size: 11 }
            },
            grid: { color: '#78350f' },
            pointLabels: { color: '#fbbf24', font: { size: 10, weight: '500' } }
          }
        },
        plugins: {
          legend: {
            display: athletesToDisplay.length > 1,
            labels: { color: '#fb923c', font: { size: 12 }, padding: 10 }
          }
        }
      }
    });
  };

  const filteredAthletes = searchQuery
    ? dataService.searchAthletes(searchQuery)
    : athletes;

  const selectedAthleteObjects = athletes.filter(a => selectedAthletes.includes(a.id));
  const unselectedAthletes = filteredAthletes.filter(a => !selectedAthletes.includes(a.id));

  // Calculate sigma bands for athlete
  const calculateSigmaBands = (athlete) => {
    const metrics = [
      { key: 'dash40' }, { key: 'verticalJump' }, { key: 'broadJump' },
      { key: 'proAgility' }, { key: 'lDrill' }, { key: 'height' }, { key: 'weight' }
    ];

    const bands = { 'minus3': 0, 'minus2': 0, 'minus1': 0, 'zero': 0, 'plus1': 0, 'plus2': 0, 'plus3': 0 };

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

  // Sidebar component (reused for both modes)
  const renderSidebar = () => (
    <div style={{
      width: '280px',
      background: '#1e293b',
      borderRight: '1px solid #78350f',
      padding: '0.75rem',
      overflowY: 'auto'
    }}>
      <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', color: '#fb923c' }}>Athletes</h3>

      <input
        type="text"
        placeholder="Search..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{
          width: '100%',
          padding: '0.4rem',
          marginBottom: '0.75rem',
          background: '#0f172a',
          border: '1px solid #78350f',
          borderRadius: '0.375rem',
          color: '#fbbf24',
          fontSize: '0.85rem'
        }}
      />

      {/* Selected Athletes Section */}
      {selectedAthleteObjects.length > 0 && (
        <div style={{
          marginBottom: '0.75rem',
          padding: '0.75rem',
          background: '#422006',
          borderRadius: '0.5rem',
          border: '2px solid #ea580c'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.5rem'
          }}>
            <h4 style={{ fontSize: '0.85rem', color: '#fb923c', fontWeight: '600' }}>
              ✓ Selected ({selectedAthleteObjects.length})
            </h4>
            <button
              onClick={clearSelectedAthletes}
              style={{
                padding: '0.2rem 0.4rem',
                background: '#7c2d12',
                border: '1px solid #ea580c',
                borderRadius: '0.25rem',
                color: '#fdba74',
                fontSize: '0.7rem',
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          </div>

          {selectedAthleteObjects.map((athlete, index) => {
            const bands = calculateSigmaBands(athlete);
            const colorIndex = index % ATHLETE_COLORS.length;
            const colors = ATHLETE_COLORS[colorIndex];

            return (
              <div
                key={athlete.id}
                onClick={() => setSelectedAthlete(athlete)}
                style={{
                  padding: '0.4rem',
                  marginBottom: '0.25rem',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  background: selectedAthlete?.id === athlete.id ? '#7c2d12' : '#292524',
                  border: `2px solid ${colors.border}`,
                  transition: 'background 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input
                    type="checkbox"
                    checked={true}
                    onChange={() => toggleAthleteSelection(athlete.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ cursor: 'pointer', accentColor: colors.border }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: '500', color: '#fbbf24', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {athlete.firstName} {athlete.lastName}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#a16207' }}>
                      {athlete.position} • {athlete.state}
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '0.25rem',
                  marginTop: '0.35rem',
                  fontSize: '0.65rem',
                  justifyContent: 'flex-start',
                  fontFamily: 'monospace'
                }}>
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

      {/* All Athletes List */}
      <div style={{ fontSize: '0.75rem', color: '#a16207', marginBottom: '0.4rem' }}>
        {unselectedAthletes.length} athletes
      </div>

      {unselectedAthletes.slice(0, 50).map(athlete => {
        const bands = calculateSigmaBands(athlete);

        return (
          <div
            key={athlete.id}
            onClick={() => setSelectedAthlete(athlete)}
            style={{
              padding: '0.5rem',
              marginBottom: '0.2rem',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              background: selectedAthlete?.id === athlete.id ? '#7c2d12' : 'transparent',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => {
              if (selectedAthlete?.id !== athlete.id) {
                e.currentTarget.style.background = '#422006';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedAthlete?.id !== athlete.id) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input
                type="checkbox"
                checked={selectedAthletes.includes(athlete.id)}
                onChange={() => toggleAthleteSelection(athlete.id)}
                onClick={(e) => e.stopPropagation()}
                style={{ cursor: 'pointer', accentColor: '#ea580c' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '500', color: '#fbbf24', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {athlete.firstName} {athlete.lastName}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#a16207' }}>
                  {athlete.position} • {athlete.state} • {athlete.gradYear}
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '0.25rem',
              marginTop: '0.35rem',
              fontSize: '0.65rem',
              justifyContent: 'flex-start',
              fontFamily: 'monospace'
            }}>
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

  // FEATURE #2: Multi-athlete comparison table
  const renderComparisonTable = () => {
    if (selectedAthleteObjects.length < 2) return null;

    const athleticMetrics = [
      { key: 'dash40', label: '40-Yard Dash', unit: 'sec' },
      { key: 'verticalJump', label: 'Vertical Jump', unit: 'in' },
      { key: 'broadJump', label: 'Broad Jump', unit: 'in' },
      { key: 'proAgility', label: 'Pro Agility', unit: 'sec' },
      { key: 'lDrill', label: 'L-Drill', unit: 'sec' }
    ];

    const physicalMetrics = [
      { key: 'height', label: 'Height', unit: 'in', format: (v) => `${Math.floor(v / 12)}'${v % 12}"` },
      { key: 'weight', label: 'Weight', unit: 'lbs' }
    ];

    return (
      <div style={{
        background: '#1e293b',
        padding: '1.5rem',
        borderRadius: '0.5rem',
        marginBottom: '1.5rem',
        borderLeft: '4px solid #ea580c'
      }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: '#fb923c' }}>
          📊 Athlete Comparison
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #78350f' }}>
                <th style={{ padding: '0.5rem', textAlign: 'left', color: '#a16207' }}>Metric</th>
                {selectedAthleteObjects.map((athlete, index) => {
                  const colors = ATHLETE_COLORS[index % ATHLETE_COLORS.length];
                  return (
                    <th key={athlete.id} style={{ padding: '0.5rem', textAlign: 'center', color: colors.border }}>
                      {athlete.firstName} {athlete.lastName.charAt(0)}.
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* Athletic Metrics */}
              <tr>
                <td colSpan={selectedAthleteObjects.length + 1} style={{ padding: '0.5rem 0.5rem 0.25rem', color: '#fb923c', fontWeight: '600', fontSize: '0.8rem' }}>
                  Athletic Metrics
                </td>
              </tr>
              {athleticMetrics.map(metric => (
                <tr key={metric.key} style={{ borderBottom: '1px solid #374151' }}>
                  <td style={{ padding: '0.5rem', color: '#a16207' }}>{metric.label}</td>
                  {selectedAthleteObjects.map((athlete, index) => {
                    const value = athlete[metric.key];
                    const sigma = value ? dataService.calculateSigma(metric.key, value) : null;
                    const colors = ATHLETE_COLORS[index % ATHLETE_COLORS.length];
                    return (
                      <td key={athlete.id} style={{ padding: '0.5rem', textAlign: 'center' }}>
                        <span style={{ color: '#fbbf24' }}>{value || 'N/A'}</span>
                        {sigma !== null && (
                          <span style={{ color: sigma > 0 ? '#10b981' : '#ef4444', marginLeft: '0.25rem', fontSize: '0.75rem' }}>
                            ({sigma > 0 ? '+' : ''}{sigma.toFixed(1)}σ)
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Physical Metrics */}
              <tr>
                <td colSpan={selectedAthleteObjects.length + 1} style={{ padding: '0.75rem 0.5rem 0.25rem', color: '#fbbf24', fontWeight: '600', fontSize: '0.8rem' }}>
                  Physical Attributes
                </td>
              </tr>
              {physicalMetrics.map(metric => (
                <tr key={metric.key} style={{ borderBottom: '1px solid #374151' }}>
                  <td style={{ padding: '0.5rem', color: '#a16207' }}>{metric.label}</td>
                  {selectedAthleteObjects.map((athlete, index) => {
                    const value = athlete[metric.key];
                    const displayValue = value ? (metric.format ? metric.format(value) : `${value} ${metric.unit}`) : 'N/A';
                    const sigma = value ? dataService.calculateSigma(metric.key, value) : null;
                    return (
                      <td key={athlete.id} style={{ padding: '0.5rem', textAlign: 'center' }}>
                        <span style={{ color: '#fbbf24' }}>{displayValue}</span>
                        {sigma !== null && (
                          <span style={{ color: sigma > 0 ? '#10b981' : '#ef4444', marginLeft: '0.25rem', fontSize: '0.75rem' }}>
                            ({sigma > 0 ? '+' : ''}{sigma.toFixed(1)}σ)
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // SELECTION MODE
  if (mode === 'selection') {
    return (
      <div style={{ display: 'flex', height: '100%' }}>
        {renderSidebar()}

        <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
          {/* FEATURE #2: Show comparison table when multiple athletes selected */}
          {selectedAthleteObjects.length > 1 && renderComparisonTable()}

          {selectedAthlete ? (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.6rem', marginBottom: '0.5rem', color: '#fb923c' }}>
                  {selectedAthlete.firstName} {selectedAthlete.lastName}
                </h2>
                <div style={{ color: '#a16207', fontSize: '0.9rem' }}>
                  {selectedAthlete.position} • {selectedAthlete.state} • Class of {selectedAthlete.gradYear}
                </div>
              </div>

              {/* FEATURE #6: Athlete Overview with Sigma Values */}
              <div style={{
                background: '#1e293b',
                padding: '1.5rem',
                borderRadius: '0.5rem',
                borderLeft: '4px solid #ea580c'
              }}>
                <h3 style={{ marginBottom: '1.25rem', fontSize: '1.1rem', color: '#fb923c' }}>
                  Athlete Overview
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                  {/* Athletic Metrics with Sigma */}
                  <div>
                    <h4 style={{ marginBottom: '0.75rem', fontSize: '0.95rem', color: '#fbbf24' }}>
                      Athletic Metrics
                    </h4>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      {[
                        { key: 'dash40', label: '40-Yard Dash', unit: 'sec' },
                        { key: 'verticalJump', label: 'Vertical Jump', unit: 'in' },
                        { key: 'broadJump', label: 'Broad Jump', unit: 'in' },
                        { key: 'proAgility', label: 'Pro Agility', unit: 'sec' },
                        { key: 'lDrill', label: 'L-Drill', unit: 'sec' }
                      ].map(metric => {
                        const value = selectedAthlete[metric.key];
                        const sigma = value ? dataService.calculateSigma(metric.key, value) : null;
                        return (
                          <div key={metric.key} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.5rem',
                            background: '#0f172a',
                            borderRadius: '0.25rem',
                            borderLeft: `3px solid ${sigma && sigma > 0 ? '#10b981' : sigma && sigma < 0 ? '#ef4444' : '#78350f'}`
                          }}>
                            <span style={{ color: '#a16207', fontSize: '0.85rem' }}>{metric.label}</span>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ color: '#fbbf24', fontWeight: '500' }}>
                                {value ? `${value} ${metric.unit}` : 'N/A'}
                              </span>
                              {sigma !== null && (
                                <span style={{
                                  color: sigma > 0 ? '#10b981' : '#ef4444',
                                  marginLeft: '0.5rem',
                                  fontSize: '0.8rem',
                                  fontWeight: '600'
                                }}>
                                  {sigma > 0 ? '+' : ''}{sigma.toFixed(2)}σ
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Physical Attributes with Sigma */}
                  <div>
                    <h4 style={{ marginBottom: '0.75rem', fontSize: '0.95rem', color: '#fbbf24' }}>
                      Physical Attributes
                    </h4>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      {[
                        { key: 'height', label: 'Height', unit: 'in', format: (v) => `${Math.floor(v / 12)}'${v % 12}"` },
                        { key: 'weight', label: 'Weight', unit: 'lbs', format: (v) => `${v} lbs` }
                      ].map(metric => {
                        const value = selectedAthlete[metric.key];
                        const sigma = value ? dataService.calculateSigma(metric.key, value) : null;
                        return (
                          <div key={metric.key} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.5rem',
                            background: '#0f172a',
                            borderRadius: '0.25rem',
                            borderLeft: `3px solid ${sigma && sigma > 0 ? '#10b981' : sigma && sigma < 0 ? '#ef4444' : '#78350f'}`
                          }}>
                            <span style={{ color: '#a16207', fontSize: '0.85rem' }}>{metric.label}</span>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ color: '#fbbf24', fontWeight: '500' }}>
                                {value ? metric.format(value) : 'N/A'}
                              </span>
                              {sigma !== null && (
                                <span style={{
                                  color: sigma > 0 ? '#10b981' : '#ef4444',
                                  marginLeft: '0.5rem',
                                  fontSize: '0.8rem',
                                  fontWeight: '600'
                                }}>
                                  {sigma > 0 ? '+' : ''}{sigma.toFixed(2)}σ
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div style={{
                  marginTop: '1.5rem',
                  padding: '0.75rem',
                  background: '#422006',
                  borderRadius: '0.375rem',
                  fontSize: '0.85rem',
                  color: '#fdba74',
                  textAlign: 'center'
                }}>
                  💡 Use checkboxes to select athletes for comparison, then visit <strong>Charts</strong> for visualizations or <strong>Metric Explorer</strong> for detailed analysis
                </div>
              </div>
            </>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#a16207',
              fontSize: '1.1rem'
            }}>
              Select an athlete to view their profile
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

      <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
        {selectedAthlete ? (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.6rem', marginBottom: '0.5rem', color: '#fb923c' }}>
                {selectedAthlete.firstName} {selectedAthlete.lastName}
              </h2>
              <div style={{ color: '#a16207', fontSize: '0.9rem' }}>
                {selectedAthlete.position} • {selectedAthlete.state} • Class of {selectedAthlete.gradYear}
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1.5rem',
              marginBottom: '1.5rem'
            }}>
              {/* Athletic Radar Chart */}
              <div style={{
                background: '#1e293b',
                padding: '1.5rem',
                borderRadius: '0.5rem',
                borderLeft: '4px solid #ea580c'
              }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: '#fb923c' }}>
                  Raw Profile
                </h3>
                <div style={{ position: 'relative', height: '300px' }}>
                  <canvas ref={chartRef}></canvas>
                </div>
                <div style={{
                  marginTop: '0.75rem',
                  fontSize: '0.8rem',
                  color: '#a16207',
                  textAlign: 'center'
                }}>
                  Percentile rankings vs {athletes.length} athletes
                </div>
              </div>

              {/* Physical Bar Chart */}
              <div style={{
                background: '#1e293b',
                padding: '1.5rem',
                borderRadius: '0.5rem',
                borderLeft: '4px solid #d97706'
              }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: '#fbbf24' }}>
                  Physical Profile
                </h3>
                <div style={{ position: 'relative', height: '300px' }}>
                  <canvas ref={physicalChartRef}></canvas>
                </div>
                <div style={{
                  marginTop: '0.75rem',
                  fontSize: '0.8rem',
                  color: '#a16207',
                  textAlign: 'center'
                }}>
                  Physical characteristics percentile
                </div>
              </div>
            </div>

            {/* Forged Profile Chart */}
            {forgedAxes.length > 0 && (
              <div style={{
                background: '#1e293b',
                padding: '1.5rem',
                borderRadius: '0.5rem',
                borderLeft: '4px solid #dc2626'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', color: '#ef4444' }}>
                    🔥 Forged Profile
                  </h3>
                  <button
                    onClick={clearForgedAxes}
                    style={{
                      padding: '0.25rem 0.75rem',
                      background: '#7c2d12',
                      border: '1px solid #dc2626',
                      borderRadius: '0.25rem',
                      color: '#fbbf24',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    Clear All
                  </button>
                </div>

                <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {forgedAxes.map((axis, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.25rem 0.75rem',
                        background: '#422006',
                        borderRadius: '1rem',
                        fontSize: '0.75rem',
                        color: '#fdba74',
                        border: '1px solid #78350f'
                      }}
                    >
                      <span>{axis.label}</span>
                      <button
                        onClick={() => removeForgedAxis(axis.formula)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          cursor: 'pointer',
                          padding: '0',
                          fontSize: '1rem',
                          lineHeight: '1'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ position: 'relative', height: '300px' }}>
                  <canvas ref={forgedChartRef}></canvas>
                </div>
                <div style={{
                  marginTop: '0.75rem',
                  fontSize: '0.8rem',
                  color: '#a16207',
                  textAlign: 'center'
                }}>
                  Custom metrics from Metric Explorer
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#a16207',
            fontSize: '1.1rem'
          }}>
            Select an athlete to view their profile
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;