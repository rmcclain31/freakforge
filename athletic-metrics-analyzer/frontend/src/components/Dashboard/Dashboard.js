import React, { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import dataService from '../../utils/dataService';
import { useAppContext } from '../../context/AppContext';

// Register Chart.js components
Chart.register(...registerables);

function Dashboard() {
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
    // Load data on mount
    dataService.loadData().then(data => {
      setAthletes(data.athletes);
      setStatistics(data.statistics);

      // Select first athlete by default
      if (data.athletes.length > 0) {
        setSelectedAthlete(data.athletes[0]);
      }
    });
  }, []);

  useEffect(() => {
    // Update charts when selected athlete or selected athletes changes
    if (chartRef.current && physicalChartRef.current) {
      updateChart();
      updatePhysicalChart();
    }
    if (forgedChartRef.current) {
      updateForgedChart();
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
  }, [selectedAthlete, selectedAthletes, statistics, forgedAxes]);

  const updateChart = () => {
    if (!chartRef.current) return;
    if (selectedAthletes.length === 0 && !selectedAthlete) return;

    const ctx = chartRef.current.getContext('2d');

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Define ATHLETIC metrics for radar chart
    const metrics = [
      { key: 'dash40', label: '40-Yard Dash', inverse: true },
      { key: 'verticalJump', label: 'Vertical Jump' },
      { key: 'broadJump', label: 'Broad Jump' },
      { key: 'proAgility', label: 'Pro Agility', inverse: true },
      { key: 'lDrill', label: 'L-Drill', inverse: true }
    ];

    // Fire palette for multi-athlete
    const FIRE_COLORS = [
      { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 1)', point: 'rgba(239, 68, 68, 1)' },      // Red
      { bg: 'rgba(249, 115, 22, 0.2)', border: 'rgba(249, 115, 22, 1)', point: 'rgba(249, 115, 22, 1)' },    // Orange
      { bg: 'rgba(245, 158, 11, 0.2)', border: 'rgba(245, 158, 11, 1)', point: 'rgba(245, 158, 11, 1)' },    // Amber
      { bg: 'rgba(234, 179, 8, 0.2)', border: 'rgba(234, 179, 8, 1)', point: 'rgba(234, 179, 8, 1)' },       // Yellow
      { bg: 'rgba(146, 64, 14, 0.2)', border: 'rgba(146, 64, 14, 1)', point: 'rgba(146, 64, 14, 1)' }        // Brown
    ];

    // Get athletes to display (selected ones or current athlete)
    const athletesToDisplay = selectedAthletes.length > 0
      ? athletes.filter(a => selectedAthletes.includes(a.id))
      : selectedAthlete ? [selectedAthlete] : [];

    // Create datasets for each athlete
    const datasets = athletesToDisplay.map((athlete, index) => {
      const data = metrics.map(metric => {
        const value = athlete[metric.key];
        if (!value || !statistics[metric.key]) return 0;
        return dataService.calculatePercentile(metric.key, value);
      });

      const colorIndex = index % FIRE_COLORS.length;
      const colors = FIRE_COLORS[colorIndex];

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

    // Define PHYSICAL attributes for bar chart
    const metrics = [
      { key: 'height', label: 'Height' },
      { key: 'weight', label: 'Weight' }
    ];

    // Calculate percentile scores (0-100)
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
            ticks: {
              color: '#a16207',
              font: { size: 11 }
            },
            grid: {
              color: '#78350f'
            }
          },
          y: {
            ticks: {
              color: '#fbbf24',
              font: { size: 12, weight: '500' }
            },
            grid: {
              display: false
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
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

    // Fire palette for multi-athlete
    const FIRE_COLORS = [
      { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 1)', point: 'rgba(239, 68, 68, 1)' },
      { bg: 'rgba(249, 115, 22, 0.2)', border: 'rgba(249, 115, 22, 1)', point: 'rgba(249, 115, 22, 1)' },
      { bg: 'rgba(245, 158, 11, 0.2)', border: 'rgba(245, 158, 11, 1)', point: 'rgba(245, 158, 11, 1)' },
      { bg: 'rgba(234, 179, 8, 0.2)', border: 'rgba(234, 179, 8, 1)', point: 'rgba(234, 179, 8, 1)' },
      { bg: 'rgba(146, 64, 14, 0.2)', border: 'rgba(146, 64, 14, 1)', point: 'rgba(146, 64, 14, 1)' }
    ];

    // Get athletes to display
    const athletesToDisplay = selectedAthletes.length > 0
      ? athletes.filter(a => selectedAthletes.includes(a.id))
      : selectedAthlete ? [selectedAthlete] : [];

    if (athletesToDisplay.length === 0) return;

    // Calculate data for each custom axis
    const datasets = athletesToDisplay.map((athlete, index) => {
      const data = forgedAxes.map(axis => {
        // Calculate the metric value for this axis
        const parts = axis.formula.toLowerCase().split('/');
        if (parts.length !== 2) return 0;

        const numerator = athlete[parts[0].trim()];
        const denominator = athlete[parts[1].trim()];

        if (!numerator || !denominator) return 0;

        const value = numerator / denominator;

        // Convert to percentile (simplified - could use actual statistics)
        // For now, just scale to 0-100
        return Math.min(100, Math.max(0, value * 10)); // Basic scaling
      });

      const colorIndex = index % FIRE_COLORS.length;
      const colors = FIRE_COLORS[colorIndex];

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
            grid: {
              color: '#78350f'
            },
            pointLabels: {
              color: '#fbbf24',
              font: { size: 10, weight: '500' }
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

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left sidebar - athlete selector */}
      <div style={{
        width: '350px',
        background: '#1e293b',
        borderRight: '1px solid #78350f',
        padding: '1rem',
        overflowY: 'auto'
      }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: '#fb923c' }}>Athletes</h3>

        <input
          type="text"
          placeholder="Search athletes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            marginBottom: '1rem',
            background: '#0f172a',
            border: '1px solid #78350f',
            borderRadius: '0.375rem',
            color: '#fbbf24',
            fontSize: '0.9rem'
          }}
        />

        {/* Selected Athletes Section */}
        {selectedAthleteObjects.length > 0 && (
          <div style={{
            marginBottom: '1rem',
            padding: '1rem',
            background: '#422006',
            borderRadius: '0.5rem',
            border: '2px solid #ea580c'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem'
            }}>
              <h4 style={{ fontSize: '0.95rem', color: '#fb923c', fontWeight: '600' }}>
                ✓ Selected ({selectedAthleteObjects.length})
              </h4>
              <button
                onClick={clearSelectedAthletes}
                style={{
                  padding: '0.25rem 0.5rem',
                  background: '#7c2d12',
                  border: '1px solid #ea580c',
                  borderRadius: '0.25rem',
                  color: '#fdba74',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                Clear All
              </button>
            </div>

            {selectedAthleteObjects.map(athlete => (
              <div
                key={athlete.id}
                onClick={() => setSelectedAthlete(athlete)}
                style={{
                  padding: '0.5rem',
                  marginBottom: '0.25rem',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  background: selectedAthlete?.id === athlete.id ? '#7c2d12' : '#292524',
                  border: '1px solid #78350f',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (selectedAthlete?.id !== athlete.id) {
                    e.currentTarget.style.background = '#57534e';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedAthlete?.id !== athlete.id) {
                    e.currentTarget.style.background = '#292524';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={true}
                    onChange={() => toggleAthleteSelection(athlete.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ cursor: 'pointer', accentColor: '#ea580c' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '500', color: '#fbbf24' }}>
                      {athlete.firstName} {athlete.lastName}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#a16207', marginTop: '0.125rem' }}>
                      {athlete.position} • {athlete.state}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* All Athletes List */}
        <div style={{ fontSize: '0.85rem', color: '#a16207', marginBottom: '0.5rem' }}>
          {unselectedAthletes.length} athletes
        </div>

        {unselectedAthletes.slice(0, 50).map(athlete => (
          <div
            key={athlete.id}
            onClick={() => setSelectedAthlete(athlete)}
            style={{
              padding: '0.75rem',
              marginBottom: '0.25rem',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={selectedAthletes.includes(athlete.id)}
                onChange={() => toggleAthleteSelection(athlete.id)}
                onClick={(e) => e.stopPropagation()}
                style={{ cursor: 'pointer', accentColor: '#ea580c' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.95rem', fontWeight: '500', color: '#fbbf24' }}>
                  {athlete.firstName} {athlete.lastName}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#a16207', marginTop: '0.25rem' }}>
                  {athlete.position} • {athlete.state} • {athlete.gradYear}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        {selectedAthlete ? (
          <>
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', color: '#fb923c' }}>
                {selectedAthlete.firstName} {selectedAthlete.lastName}
              </h2>
              <div style={{ color: '#a16207', fontSize: '1rem' }}>
                {selectedAthlete.position} • {selectedAthlete.state} • Class of {selectedAthlete.gradYear}
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '2rem',
              marginBottom: '2rem'
            }}>
              {/* Athletic Performance Column */}
              <div>
                {/* Athletic Radar Chart */}
                <div style={{
                  background: '#1e293b',
                  padding: '2rem',
                  borderRadius: '0.5rem',
                  marginBottom: '2rem',
                  borderLeft: '4px solid #ea580c'
                }}>
                  <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', color: '#fb923c' }}>
                    Raw Profile
                  </h3>
                  <div style={{ position: 'relative', height: '350px' }}>
                    <canvas ref={chartRef}></canvas>
                  </div>
                  <div style={{
                    marginTop: '1rem',
                    fontSize: '0.85rem',
                    color: '#a16207',
                    textAlign: 'center'
                  }}>
                    Percentile rankings vs {athletes.length} athletes
                  </div>
                </div>

                {/* Athletic Metrics Data */}
                <div>
                  <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', color: '#fb923c' }}>
                    Athletic Metrics
                  </h3>
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {[
                      { key: 'dash40', label: '40-Yard Dash', unit: 'sec' },
                      { key: 'verticalJump', label: 'Vertical Jump', unit: 'in' },
                      { key: 'broadJump', label: 'Broad Jump', unit: 'in' },
                      { key: 'proAgility', label: 'Pro Agility', unit: 'sec' },
                      { key: 'lDrill', label: 'L-Drill (3-Cone)', unit: 'sec' }
                    ].map(metric => {
                      const value = selectedAthlete[metric.key];
                      const percentile = value && statistics[metric.key]
                        ? dataService.calculatePercentile(metric.key, value)
                        : null;
                      const sigma = value && statistics[metric.key]
                        ? dataService.calculateSigma(metric.key, value)
                        : null;

                      return (
                        <div key={metric.key} style={{
                          background: '#1e293b',
                          padding: '1rem',
                          borderRadius: '0.375rem',
                          borderLeft: `3px solid ${sigma && sigma > 0 ? '#f97316' : sigma && sigma < 0 ? '#dc2626' : '#78350f'}`
                        }}>
                          <div style={{ fontSize: '0.85rem', color: '#a16207', marginBottom: '0.25rem' }}>
                            {metric.label}
                          </div>
                          <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#fbbf24' }}>
                            {value ? `${value} ${metric.unit}` : 'N/A'}
                          </div>
                          {percentile !== null && (
                            <div style={{ fontSize: '0.85rem', color: '#fb923c', marginTop: '0.25rem' }}>
                              {percentile}th percentile
                              {sigma !== null && ` (${sigma > 0 ? '+' : ''}${sigma.toFixed(2)}σ)`}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Forged Profile Chart - Custom Axes */}
                {forgedAxes.length > 0 && (
                  <div style={{
                    background: '#1e293b',
                    padding: '2rem',
                    borderRadius: '0.5rem',
                    marginTop: '2rem',
                    borderLeft: '4px solid #dc2626'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '1.2rem', color: '#ef4444' }}>
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

                    {/* Custom axes management */}
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

                    <div style={{ position: 'relative', height: '350px' }}>
                      <canvas ref={forgedChartRef}></canvas>
                    </div>
                    <div style={{
                      marginTop: '1rem',
                      fontSize: '0.85rem',
                      color: '#a16207',
                      textAlign: 'center'
                    }}>
                      Custom metrics from Metric Explorer
                    </div>
                  </div>
                )}
              </div>

              {/* Physical Attributes Column */}
              <div>
                {/* Physical Radar Chart */}
                <div style={{
                  background: '#1e293b',
                  padding: '2rem',
                  borderRadius: '0.5rem',
                  marginBottom: '2rem',
                  borderLeft: '4px solid #d97706'
                }}>
                  <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', color: '#fbbf24' }}>
                    Physical Profile
                  </h3>
                  <div style={{ position: 'relative', height: '350px' }}>
                    <canvas ref={physicalChartRef}></canvas>
                  </div>
                  <div style={{
                    marginTop: '1rem',
                    fontSize: '0.85rem',
                    color: '#a16207',
                    textAlign: 'center'
                  }}>
                    Physical characteristics percentile
                  </div>
                </div>

                {/* Physical Attributes Data */}
                <div>
                  <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', color: '#fbbf24' }}>
                    Physical Attributes
                  </h3>
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {[
                      { key: 'height', label: 'Height', unit: 'in' },
                      { key: 'weight', label: 'Weight', unit: 'lbs' }
                    ].map(metric => {
                      const value = selectedAthlete[metric.key];
                      const percentile = value && statistics[metric.key]
                        ? dataService.calculatePercentile(metric.key, value)
                        : null;
                      const sigma = value && statistics[metric.key]
                        ? dataService.calculateSigma(metric.key, value)
                        : null;

                      return (
                        <div key={metric.key} style={{
                          background: '#1e293b',
                          padding: '1rem',
                          borderRadius: '0.375rem',
                          borderLeft: `3px solid ${sigma && sigma > 0 ? '#f59e0b' : sigma && sigma < 0 ? '#b45309' : '#78350f'}`
                        }}>
                          <div style={{ fontSize: '0.85rem', color: '#a16207', marginBottom: '0.25rem' }}>
                            {metric.label}
                          </div>
                          <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#fbbf24' }}>
                            {value ? (
                              metric.key === 'height'
                                ? `${Math.floor(value / 12)}' ${value % 12}"`
                                : `${value} ${metric.unit}`
                            ) : 'N/A'}
                          </div>
                          {percentile !== null && (
                            <div style={{ fontSize: '0.85rem', color: '#fb923c', marginTop: '0.25rem' }}>
                              {percentile}th percentile
                              {sigma !== null && ` (${sigma > 0 ? '+' : ''}${sigma.toFixed(2)}σ)`}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
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
            fontSize: '1.2rem'
          }}>
            Select an athlete to view their profile
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;